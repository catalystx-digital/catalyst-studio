/**
 * Page-Based Component Detection Service
 *
 * Uses LLMs to analyze web pages directly (no screenshots)
 * with dynamic component loading from DetectionAPI.
 *
 * @module component-detection
 */

import { performanceMonitor } from '@/lib/studio/components/cms/_import/performance'
import { detectionAPI, type DetectionRegistryStats } from '@/lib/studio/components/cms/_import/detection-api'
import { initializeCMSComponents } from '@/lib/studio/components/cms/_factory/initialize'
import type {
  ChatCompletionMessageParam
} from 'openai/resources/chat/completions'
import { getWebFetchTools, type HeadMeta, type ResourcesSummary } from './services/web-tools'
import { isAssetUrl } from './services/sitemap-discovery.service'
import { isTemplateRouteEligible } from './services/page-builder/template-resolver'
import { buildDetectionPromptFromCatalog } from './detection/prompt-builder'
import type { DetectionSectionTask } from './detection/section-plan'
import { aggregateSectionArtifacts, type SectionExtractionArtifact } from './detection/section-aggregation'
import type { GlobalSectionReuseKey, GlobalSectionReuseProvenance } from './detection/global-section-cache'
import type { DetectedComponent, DetectedPageTemplate, DetectionPromptPayload, ImportDetectionOptions, ImportDetectionResult, InvalidDetectedComponent, PageMetadata, ParserRepairNote } from './detection/types'
import { ask, getDecisionConfig, isDecisionModelEnabledFor } from '@/lib/studio/decisions'
import { traceMemory } from './utils/memory-trace'
import { parseFirstJsonValue } from './utils/json-parsing'
import { createDetectionTelemetry } from './telemetry/detection-telemetry'
import type { DetectionPhaseRecord, DetectionTelemetry } from './telemetry/detection-telemetry'
import { createLLMClient, validateLLMApiKey } from './services/llm-client'
import { calculateCost, getModelMaxCompletionTokens } from './openrouter-models'
import {
  ModelConfig,
  TokenConfig,
  ConfidenceConfig,
  LoggingConfig,
  OpenRouterConfig,
  DetectionConfig
} from './config'

// Use centralized configuration
const CONTEXT_BUDGET = TokenConfig.contextBudget
const MIN_COMPLETION_BUDGET = TokenConfig.minCompletionBudget
const USER_MAX_TOKENS = TokenConfig.maxCompletionTokens // User's requested max (from env)
const REPAIR_PREVIOUS_JSON_CHAR_LIMIT = 6_000

export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const limit = Math.max(1, Math.floor(concurrency))
  const results = new Array<R>(items.length)
  let nextIndex = 0

  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex++
      results[index] = await worker(items[index])
    }
  })
  await Promise.all(runners)
  return results
}

export async function loadReusableSectionFromCheckpoint(
  options: {
    checkpointSession?: ImportDetectionOptions['checkpointSession']
    checkpointService?: ImportDetectionOptions['checkpointService']
    reuseKey: GlobalSectionReuseKey | null
    role: DetectionSectionTask['role']
    currentUrl: string
  }
): Promise<{ artifact: SectionExtractionArtifact; provenance: GlobalSectionReuseProvenance } | null> {
  const { checkpointSession, checkpointService, reuseKey, role, currentUrl } = options
  if (!checkpointSession || !checkpointService || !reuseKey || (role !== 'header' && role !== 'footer')) {
    return null
  }

  const expectedType = role === 'header' ? 'navbar' : 'footer'
  const sitemap = await checkpointService.loadSitemap(checkpointSession)
  if (!sitemap) {
    return null
  }

  for (const entry of sitemap.urls) {
    if (entry.url === currentUrl) {
      continue
    }

    for await (const section of checkpointService.streamSectionResults(checkpointSession, entry.url)) {
      const debug = section.llmDebug
      if (debug?.reuseKey !== reuseKey.key) {
        continue
      }
      if (!Array.isArray(section.components) || !section.components.some(component => component.type === expectedType)) {
        continue
      }

      return {
        artifact: {
          sectionKey: section.sectionKey,
          sectionOrder: section.sectionOrder,
          durationMs: section.durationMs,
          components: section.components,
          pageMetadata: section.pageMetadata
        },
        provenance: {
          extractionMode: 'reused',
          reusedFromUrl: section.url,
          reusedFromSectionKey: section.sectionKey,
          sectionContentHash: reuseKey.sectionContentHash,
          reuseKey: reuseKey.key,
          reuseVersion: reuseKey.version,
          cacheHit: true
        }
      }
    }
  }

  return null
}

let registryInitialization: Promise<void> | null = null

function summarizeRegistry(stats: {
  before?: DetectionRegistryStats
  after?: DetectionRegistryStats
  initialized?: boolean
  skipped?: boolean
  untracked?: boolean
}): Record<string, unknown> {
  const before = stats.before
  const after = stats.after
  return {
    beforeComponentCount: before?.componentCount,
    afterComponentCount: after?.componentCount,
    registryDelta:
      typeof before?.componentCount === 'number' && typeof after?.componentCount === 'number'
        ? after.componentCount - before.componentCount
        : undefined,
    patternCacheEntries: after?.patternCacheEntries,
    catalogCached: after?.catalogCached,
    cacheAgeMs: after?.cacheAgeMs,
    initialized: Boolean(stats.initialized),
    skipped: Boolean(stats.skipped),
    untracked: Boolean(stats.untracked)
  }
}

/**
 * Token usage information from LLM response.
 */
export interface TokenUsage {
  total_tokens?: number
  prompt_tokens?: number
  completion_tokens?: number
  reasoning_tokens?: number
  total_cost?: number
}

export interface SectionProcessingResult {
  artifact: SectionExtractionArtifact
  pageSummary?: DetectionPromptPayload['pageSummary']
  usage: TokenUsage
  requestCount: number
  reuse: {
    freshSections: number
    reusedSections: number
    cacheHits: number
    cacheMisses: number
  }
}

export interface DetectionFailureDebug {
  model?: string
  stage: 'fetch' | 'llm_call' | 'budget' | 'parsing' | 'validation' | 'output_limit'
  rawResponse?: string
  rawResponseLength?: number
  finishReason?: string
  usage?: TokenUsage
  validationPath?: string
  requestCount?: number
  toolCallCount?: number
  contextBudget?: number
  minCompletionBudget?: number
  promptTokensEstimate?: number
  effectiveCompletionTokens?: number
  skippedSectionsDueToBudget?: string[]
  sectionKey?: string
  sectionOrder?: number
  sectionApproxBytes?: number
  parserRepair?: 'missing_section_key_injected' | ParserRepairNote['action']
  parserRepairs?: ParserRepairNote[]
  missingSectionKey?: boolean
  repairPromptCapped?: boolean
  repairPromptPreviousJsonChars?: number
  invalidComponents?: InvalidDetectedComponent[]
  invalidComponentReasons?: string[]
  invalidComponentCount?: number
  requiredSectionEmpty?: boolean
  extractionMode?: 'fresh' | 'reused' | 'checkpoint'
  reusedFromUrl?: string
  reusedFromSectionKey?: string
  sectionContentHash?: string
  reuseKey?: string
  reuseVersion?: string
  cacheHit?: boolean
  cacheMissReason?: string
}

export class DetectionFailureError extends Error {
  readonly debug: DetectionFailureDebug

  constructor(message: string, debug: DetectionFailureDebug) {
    super(message)
    this.name = 'DetectionFailureError'
    this.debug = debug
  }
}

function summarizeInvalidComponents(invalidComponents: InvalidDetectedComponent[] | undefined): string[] | undefined {
  if (!invalidComponents || invalidComponents.length === 0) {
    return undefined
  }
  return invalidComponents.slice(0, 5).map(component => {
    const type = component.type || component.component || 'unknown'
    return `components[${component.index}] ${type}: ${component.reason}`
  })
}

function estimateMessageTokens(messages: ChatCompletionMessageParam[]): number {
  const CHAR_PER_TOKEN = 4
  let totalChars = 0
  for (const message of messages) {
    totalChars += 16
    if (typeof message.content === 'string') {
      totalChars += message.content.length
    } else if (Array.isArray(message.content)) {
      for (const chunk of message.content as unknown[]) {
        if (!chunk) continue
        if (typeof chunk === 'string') {
          totalChars += chunk.length
        } else if (chunk && typeof chunk === 'object' && 'text' in chunk && typeof (chunk as { text?: unknown }).text === 'string') {
          totalChars += ((chunk as { text: string }).text).length
        }
      }
    }
    if ('tool_call_id' in message && typeof (message as { tool_call_id?: unknown }).tool_call_id === 'string') {
      totalChars += (message as { tool_call_id: string }).tool_call_id.length
    }
  }
  return Math.max(1, Math.ceil(totalChars / CHAR_PER_TOKEN))
}

export function capRepairPreviousJson(rawResult: string): { text: string; capped: boolean; chars: number } {
  if (rawResult.length <= REPAIR_PREVIOUS_JSON_CHAR_LIMIT) {
    return { text: rawResult, capped: false, chars: rawResult.length }
  }
  const headLength = Math.floor(REPAIR_PREVIOUS_JSON_CHAR_LIMIT / 2)
  const tailLength = REPAIR_PREVIOUS_JSON_CHAR_LIMIT - headLength
  return {
    text: [
      rawResult.slice(0, headLength),
      `\n... previous JSON truncated (${rawResult.length - REPAIR_PREVIOUS_JSON_CHAR_LIMIT} chars omitted) ...\n`,
      rawResult.slice(-tailLength)
    ].join(''),
    capped: true,
    chars: REPAIR_PREVIOUS_JSON_CHAR_LIMIT
  }
}

function buildTimingBreakdown(records: DetectionPhaseRecord[], totalDurationMs: number): ImportDetectionResult['timingBreakdown'] {
  const phaseMap = new Map<string, { phase: string; count: number; totalMs: number; maxMs: number; warningCount: number }>()
  const sectionTimings: NonNullable<ImportDetectionResult['timingBreakdown']>['sectionTimings'] = []

  for (const record of records) {
    const existing = phaseMap.get(record.phase) ?? {
      phase: record.phase,
      count: 0,
      totalMs: 0,
      maxMs: 0,
      warningCount: 0
    }
    existing.count += 1
    existing.totalMs += record.durationMs
    existing.maxMs = Math.max(existing.maxMs, record.durationMs)
    if (record.status === 'warning') {
      existing.warningCount += 1
    }
    phaseMap.set(record.phase, existing)

    if (record.phase === 'section_extract') {
      const metadata = record.metadata ?? {}
      sectionTimings.push({
        sectionKey: String(metadata.sectionKey ?? ''),
        sectionOrder: typeof metadata.sectionOrder === 'number' ? metadata.sectionOrder : undefined,
        role: typeof metadata.role === 'string' ? metadata.role : undefined,
        durationMs: record.durationMs,
        extractionMode: typeof metadata.extractionMode === 'string' ? metadata.extractionMode : undefined,
        cacheHit: typeof metadata.cacheHit === 'boolean' ? metadata.cacheHit : undefined,
        requestCount: typeof metadata.requestCount === 'number' ? metadata.requestCount : undefined,
        promptTokensEstimate: typeof metadata.promptTokensEstimate === 'number' ? metadata.promptTokensEstimate : undefined,
        componentCount: typeof metadata.componentCount === 'number' ? metadata.componentCount : undefined,
        originalBytes: typeof metadata.originalBytes === 'number' ? metadata.originalBytes : undefined,
        summarizedBytes: typeof metadata.summarizedBytes === 'number' ? metadata.summarizedBytes : undefined
      })
    }
  }

  return {
    totalDurationMs,
    phaseTotals: Array.from(phaseMap.values()).sort((a, b) => b.totalMs - a.totalMs),
    sectionTimings: sectionTimings.sort((a, b) => (a.sectionOrder ?? 0) - (b.sectionOrder ?? 0))
  }
}

function buildFooterQualityDiagnostics(
  components: DetectedComponent[],
  resourcesSummary: { anchors?: Array<{ href?: string; textPreview?: string }> } | undefined
): ImportDetectionResult['diagnostics'] {
  if (components.some(component => component.type === 'footer')) {
    return undefined
  }

  const evidence: string[] = []
  // Source-footer evidence came from the deleted section outline; this diagnostic is now link-based only.

  const footerAnchors = (resourcesSummary?.anchors ?? [])
    .filter(anchor => {
      const text = `${anchor.textPreview ?? ''} ${anchor.href ?? ''}`
      return /\b(footer|copyright|privacy|terms|legal|accessibility|instagram|facebook|linkedin|youtube|twitter|x\.com)\b/i.test(text)
    })
    .slice(0, 5)
    .map(anchor => `${anchor.textPreview ?? anchor.href ?? 'anchor'}`.slice(0, 80))

  if (footerAnchors.length >= 2) {
    evidence.push(...footerAnchors.map(anchor => `anchor:${anchor}`))
  }

  if (evidence.length === 0) {
    return undefined
  }

  return [{
    code: 'SOURCE_FOOTER_NOT_IMPORTED',
    severity: 'warning',
    message: 'Source footer evidence was detected, but no footer component was imported.',
    context: { evidence }
  }]
}

/**
 * Records the sections that were dropped so a partial page is never silently
 * partial. Without this the only trace of a lost footer would be a console
 * line, and the import would look complete.
 */
function buildDroppedSectionDiagnostics(
  failedSections: Array<{ task: DetectionSectionTask; error: unknown }>
): ImportDetectionResult['diagnostics'] {
  if (failedSections.length === 0) {
    return undefined
  }
  return [{
    code: 'SECTION_EXTRACTION_DROPPED',
    severity: 'warning',
    message: `${failedSections.length} section${failedSections.length === 1 ? '' : 's'} failed to extract and ${failedSections.length === 1 ? 'was' : 'were'} dropped from the page.`,
    context: {
      sections: failedSections.map(failure => ({
        sectionKey: failure.task.sectionKey,
        role: failure.task.role,
        required: failure.task.required,
        reason: failure.error instanceof Error ? failure.error.message : String(failure.error)
      }))
    }
  }]
}

export function isDedicatedEditorialListingUrl(url: string): boolean {
  try {
    const path = new URL(url).pathname
    return isEditorialIndexPath(path)
  } catch {
    return false
  }
}

function isEditorialIndexPath(path: string): boolean {
  return /^\/(?:news|blog|blogs|article|articles|post|posts|press|media|insights?)(?:\/page\/\d+)?\/?$/i.test(path)
}

function isEditorialDetailPath(path: string): boolean {
  return /^\/(?:news|blog|blogs|article|articles|post|posts|press|media|insights?)\/.+/i.test(path) && !isEditorialIndexPath(path)
}

/**
 * Detects if a JSON string is incomplete (truncated mid-output).
 * Returns an object with completion status and details about the truncation.
 */
export function detectIncompleteJson(jsonStr: string): {
  isComplete: boolean
  reason?: string
  truncationPoint?: string
} {
  if (!jsonStr || jsonStr.trim().length === 0) {
    return { isComplete: false, reason: 'empty_response' }
  }

  const trimmed = jsonStr.trim()

  // Try to parse - if it works, JSON is complete
  try {
    parseFirstJsonValue(trimmed)
    return { isComplete: true }
  } catch {
    // JSON is invalid, check if it's truncated
  }

  // Count brackets to detect structural truncation
  let braceCount = 0
  let bracketCount = 0
  let inString = false
  let escapeNext = false

  for (let i = 0; i < trimmed.length; i++) {
    const char = trimmed[i]

    if (escapeNext) {
      escapeNext = false
      continue
    }

    if (char === '\\' && inString) {
      escapeNext = true
      continue
    }

    if (char === '"' && !escapeNext) {
      inString = !inString
      continue
    }

    if (!inString) {
      if (char === '{') braceCount++
      else if (char === '}') braceCount--
      else if (char === '[') bracketCount++
      else if (char === ']') bracketCount--
    }
  }

  // Check for unclosed structures
  if (braceCount > 0 || bracketCount > 0) {
    const last50 = trimmed.slice(-50)
    return {
      isComplete: false,
      reason: 'unclosed_brackets',
      truncationPoint: last50
    }
  }

  // Check if we're mid-string (odd number of unescaped quotes after last complete value)
  if (inString) {
    const last50 = trimmed.slice(-50)
    return {
      isComplete: false,
      reason: 'mid_string',
      truncationPoint: last50
    }
  }

  // Check for trailing incomplete patterns
  const incompletePatterns = [
    /,\s*$/, // Ends with comma (expecting more)
    /:\s*$/, // Ends with colon (expecting value)
    /"\s*$/, // Ends with quote (might be mid-key)
    /\[\s*$/, // Ends with open bracket
    /{\s*$/, // Ends with open brace
  ]

  for (const pattern of incompletePatterns) {
    if (pattern.test(trimmed)) {
      return {
        isComplete: false,
        reason: 'trailing_incomplete',
        truncationPoint: trimmed.slice(-30)
      }
    }
  }

  // If we get here, structure looks complete but parsing failed
  // This might be a syntax error rather than truncation
  return {
    isComplete: false,
    reason: 'parse_error',
    truncationPoint: trimmed.slice(-50)
  }
}

export function extractValidationPath(message: string): string | undefined {
  const afterColon = message.split(':').slice(1).join(':').trim()
  const firstIssue = afterColon.split(';')[0]?.trim()
  const path = firstIssue?.split(':')[0]?.trim()
  return path || undefined
}

export function expandCandidatesFromSectionEvidence(candidateTypes: Set<string>, sectionSlice: unknown): void {
  const sectionText = JSON.stringify(sectionSlice).toLowerCase()
  if (/\b(header|nav|navigation|menu|navbar)\b/.test(sectionText)) {
    candidateTypes.add('navbar')
  }
  if (/\b(footer|copyright|legal|sociallinks|social links)\b/.test(sectionText)) {
    candidateTypes.add('footer')
  }
  if (/\b(video|youtube|youtu\.be|vimeo|wistia|loom|iframe|embed)\b/.test(sectionText)) {
    candidateTypes.add('video-embed')
  }
}

export function clampCompletionTokens(
  model: string,
  messages: ChatCompletionMessageParam[],
  requested: number
): number {
  const promptTokens = estimateMessageTokens(messages)
  const available = CONTEXT_BUDGET - promptTokens
  if (available < MIN_COMPLETION_BUDGET) {
    throw new DetectionFailureError(
      `Detection context budget exceeded before generation: prompt≈${promptTokens}, budget=${CONTEXT_BUDGET}, minimum completion reserve=${MIN_COMPLETION_BUDGET}`,
      {
        model,
        stage: 'budget',
        validationPath: 'context_budget_exceeded',
        contextBudget: CONTEXT_BUDGET,
        minCompletionBudget: MIN_COMPLETION_BUDGET,
        promptTokensEstimate: promptTokens,
        effectiveCompletionTokens: Math.max(0, available)
      }
    )
  }
  if (requested <= available) {
    return requested
  }
  const clamped = available
  console.warn(
    `[DetectionService] Reducing max_tokens from ${requested} to ${clamped} for ${model} (prompt≈${promptTokens} tokens, budget=${CONTEXT_BUDGET}).`
  )
  return clamped
}

export class DetectionService {
  private templateAllowsDetectedComponents(
    template: DetectionPromptPayload['pageSummary']['templates'][number],
    components: DetectedComponent[]
  ): boolean {
    const regions = [...(template.requiredRegions ?? []), ...(template.optionalRegions ?? [])]
    return components.every(component => {
      const location = component.location ?? 'main'
      const allowed = regions
        .filter(region => region.region === location)
        .flatMap(region => region.allowedComponents ?? [])
        .map(type => String(type))
      return allowed.includes(String(component.component)) || allowed.includes(String(component.type))
    })
  }

  /**
   * Asks the decision model which template this page is, with the deterministic
   * URL scorer below as the fallback.
   *
   * The scorer's own answer is handed in via context.input so the shadow log
   * compares like with like, and the model's answer is only accepted if it
   * names a route-eligible registered template that allows the components actually detected.
   */
  private async selectPageTemplateWithModel(
    pageSummary: DetectionPromptPayload['pageSummary'],
    url: string,
    components: DetectedComponent[],
    pageMetadata: PageMetadata,
    websiteId?: string
  ): Promise<DetectedPageTemplate> {
    const deterministic = this.selectPageTemplate(pageSummary, url, components)

    // Evidence is what detection actually found: the page's own title and
    // description, and the component types on the page.
    const nodes = [
      ...(pageMetadata.title ? [{ tag: 'h1', text: pageMetadata.title }] : []),
      ...(pageMetadata.description ? [{ tag: 'p', text: pageMetadata.description }] : []),
      ...components.map(component => ({ tag: 'p', text: `component: ${component.type}` }))
    ]

    const answer = await ask<string | null>(
      'page.type',
      { url, nodes },
      { url, websiteId, input: { deterministicTemplateKey: deterministic.templateKey } }
    )

    if (answer.source !== 'model' || !answer.value || answer.value === deterministic.templateKey) {
      return deterministic
    }

    const accepted = pageSummary.templates.find(template => template.templateKey === answer.value)
    if (!accepted || !isTemplateRouteEligible(accepted, url) || !this.templateAllowsDetectedComponents(accepted, components)) {
      return deterministic
    }

    return {
      templateKey: accepted.templateKey,
      confidence: answer.probability ?? deterministic.confidence,
      source: 'model',
      reason: `Selected by the decision model from page content (p=${(answer.probability ?? 0).toFixed(2)}).`
    }
  }

  /**
   * Asks page.isInternalFromContent, and DOES NOTHING WITH THE ANSWER.
   *
   * page.isInternal is asked during sitemap discovery, where only a URL
   * exists, and its threshold comment records exactly where that runs out: a
   * path cannot separate an internal department area from a public department
   * microsite. This asks the same question here, after the page has actually
   * been fetched, so the shadow log can show whether the page's own title,
   * description and headings separate the two where the path did not.
   *
   * THAT IS ALL IT DOES. The answer is not returned, not stored on the
   * detection result, and not assigned to anything — no page is skipped,
   * dropped, flagged or altered because of it, and there is deliberately no
   * variable here for a later change to start branching on. The question is
   * evidence-gathering; what to do about the evidence is a separate decision
   * that comes after there is some. See the `effect: 'record-only'` note on the
   * question itself before wiring this to any behaviour.
   *
   * It never throws: ask() swallows its own failures by contract.
   */
  private async recordIsInternalFromContent(
    url: string,
    pageMetadata: PageMetadata,
    components: DetectedComponent[],
    websiteId?: string
  ): Promise<void> {
    // The decisions module is off by default, so this is the normal path. It
    // returns before any evidence is assembled, any state string is built, any
    // request is made and any log row is written: the cost added to an import
    // that has not opted in is one environment-variable read.
    //
    // isDecisionModelEnabledFor is the same gate ask() applies internally — the
    // check is hoisted, not invented, so being disabled means the same thing
    // here as everywhere else.
    if (!isDecisionModelEnabledFor(['page.isInternalFromContent'], websiteId)) return

    // Real page content, from the fetched page: the head's title and
    // description (preFlightFetch.headMeta, via pageMetadata) and the headings
    // recovered from the fetched sections. Not the URL — the URL arrives
    // separately, as the question's 'url' facet.
    const MAX_EVIDENCE_HEADINGS = 40
    const headings = [
      ...new Set(
        components
          .flatMap(component => [
            component.content?.heading,
            component.content?.title,
            component.content?.subheading
          ])
          .map(value => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''))
          .filter(Boolean)
      )
    ].slice(0, MAX_EVIDENCE_HEADINGS)

    const nodes = [
      ...(pageMetadata.title ? [{ tag: 'h1', text: pageMetadata.title }] : []),
      ...(pageMetadata.description ? [{ tag: 'p', text: pageMetadata.description }] : []),
      ...headings.map(text => ({ tag: 'h2', text }))
    ]
    // No content means no content-based evidence. Asking anyway would log a row
    // that looks like a content answer and is really a URL answer, which is the
    // one thing this question must not contribute to the log.
    if (nodes.length === 0) return

    await ask<boolean>('page.isInternalFromContent', { url, nodes }, { url, websiteId })
  }

  private selectPageTemplate(
    pageSummary: DetectionPromptPayload['pageSummary'],
    url: string,
    components: DetectedComponent[] = []
  ): DetectedPageTemplate {
    const path = (() => {
      try {
        return new URL(url).pathname.toLowerCase() || '/'
      } catch {
        return '/'
      }
    })()
    const isRootPath = path === '/' || path === ''
    const genericKey = pageSummary.templates.find(template => template.templateKey === 'core/generic-default')?.templateKey
    let selectedByRouteHint = false
    let templateKey: string | undefined = isRootPath && pageSummary.homeEligibleTemplates.length > 0
      ? pageSummary.homeEligibleTemplates[0]
      : undefined

    if (!templateKey) {
      const tokens = path.split(/[^a-z0-9]+/).filter(Boolean)
      const scored = pageSummary.templates
        .filter(template => template.templateKey !== genericKey)
        .filter(template => isRootPath || !template.isHomeEligible)
        .map(template => {
          const routeHints = template.aiMetadata?.routeHints ?? []
          const keywords = template.aiMetadata?.keywords ?? []
          const haystack = [
            template.templateKey,
            template.name,
            template.category,
            template.description,
            ...routeHints,
            ...keywords
          ].join(' ').toLowerCase()
          let score = 0
          let routeScore = 0
          for (const hint of routeHints) {
            const normalizedHint = String(hint).toLowerCase().replace(/\/+$/, '')
            if (normalizedHint && (path === normalizedHint || path.startsWith(`${normalizedHint}/`))) {
              const increment = normalizedHint.length > 1 ? 6 : 0
              score += increment
              routeScore += increment
            }
          }
          for (const token of tokens) {
            if (token.length >= 3 && haystack.includes(token)) score += 2
          }
          const templateKey = template.templateKey.toLowerCase()
          const templateCategory = String(template.category ?? '').toLowerCase()
          const isEditorialTemplate = templateCategory === 'blog' || /\b(?:blog|article|post|news)\b/i.test(haystack)
          const isEditorialRoute = isEditorialIndexPath(path) || isEditorialDetailPath(path)
          if (isEditorialDetailPath(path) && isEditorialTemplate && /\b(?:post|article|detail)\b/i.test(templateKey)) {
            score += 4
            routeScore += 4
          }
          if (isEditorialIndexPath(path) && isEditorialTemplate && /\b(?:index|list|listing|archive)\b/i.test(templateKey)) {
            score += 4
            routeScore += 4
          }
          const canOverrideComponentCompatibility = routeScore > 0 && isEditorialRoute && isEditorialTemplate
          return { template, score, routeScore, canOverrideComponentCompatibility }
        })
        .filter(candidate =>
          candidate.score > 0 &&
          (
            candidate.canOverrideComponentCompatibility ||
            components.length === 0 ||
            this.templateAllowsDetectedComponents(candidate.template, components)
          )
        )
        .sort((a, b) => b.score - a.score)
      const best = scored[0]
      selectedByRouteHint = Boolean(best && best.routeScore > 0)
      templateKey = best ? best.template.templateKey : genericKey || pageSummary.templates[0]?.templateKey
    }

    if (!templateKey) {
      throw new Error('No page templates are registered for section harness assembly')
    }

    const selectedTemplate = pageSummary.templates.find(template => template.templateKey === templateKey)
    if (
      selectedTemplate &&
      !isRootPath &&
      components.length > 0 &&
      (selectedTemplate.isHomeEligible || !selectedByRouteHint) &&
      !this.templateAllowsDetectedComponents(selectedTemplate, components)
    ) {
      throw new Error(`Selected template ${selectedTemplate.templateKey} is incompatible with detected component regions for ${url}`)
    }

    return {
      templateKey,
      // Not a model and not a measurement — a keyword score over the URL path,
      // now reported as what it is.
      confidence: 0.8,
      source: 'url-scorer',
      reason: 'Selected deterministically from URL route hints and registered page templates.'
    }
  }

  private buildPageMetadataFromHead(headMeta: HeadMeta | undefined): PageMetadata {
    const meta = headMeta?.meta ?? []
    const findMeta = (name: string): string | undefined => {
      const match = meta.find(entry =>
        String(entry.name ?? entry.property ?? '').toLowerCase() === name.toLowerCase()
      )
      return typeof match?.content === 'string' ? match.content : undefined
    }

    return {
      title: headMeta?.title || findMeta('og:title') || '',
      description: findMeta('description') || findMeta('og:description') || '',
      canonicalUrl: headMeta?.canonical,
      language: headMeta?.language,
      robots: headMeta?.robots,
      viewport: headMeta?.viewport,
      openGraph: headMeta?.openGraph as PageMetadata['openGraph'],
      twitterCard: headMeta?.twitter as PageMetadata['twitterCard']
    }
  }

  private mergePageMetadata(base: PageMetadata, artifacts: SectionExtractionArtifact[]): PageMetadata {
    return artifacts.reduce<PageMetadata>((merged, artifact) => {
      if (!artifact.pageMetadata) return merged
      return {
        ...merged,
        ...Object.fromEntries(
          Object.entries(artifact.pageMetadata).filter(([, value]) => value !== undefined && value !== null && value !== '')
        )
      }
    }, base)
  }

  private async runSectionHarness(params: {
    url: string
    options: ImportDetectionOptions
    endpointModel: string
    displayModel: string
    effectiveMaxTokens: number
    telemetry: DetectionTelemetry
    webTools: ReturnType<typeof getWebFetchTools>
    preFlightFetch: Awaited<ReturnType<ReturnType<typeof getWebFetchTools>['fetchOutline']>>
    startTime: number
    client: ReturnType<typeof createLLMClient>
  }): Promise<ImportDetectionResult> {
    const {
      url,
      options,
      endpointModel,
      displayModel,
      effectiveMaxTokens,
      telemetry,
      webTools,
      preFlightFetch,
      startTime,
      client
    } = params
    const {
      includeContent = true,
      checkpointSession,
      checkpointService
    } = options

    const tasks: DetectionSectionTask[] = []
    const usageTotals: TokenUsage = {}
    let requestCount = 0
    const sectionReuseStats = {
      freshSections: 0,
      reusedSections: 0,
      cacheHits: 0,
      cacheMisses: 0
    }
    const artifacts: SectionExtractionArtifact[] = []
    const failedSections: Array<{ task: DetectionSectionTask; error: unknown }> = []
    let pageSummaryForAssembly: DetectionPromptPayload['pageSummary'] | undefined

    const sectionResults = await (await import('./detection/blocks/block-harness')).runBlockHarness({
      url,
      options,
      endpointModel,
      effectiveMaxTokens,
      telemetry,
      webTools,
      preFlightFetch,
      client,
      tasks,
      failedSections
    })
    for (const result of sectionResults) {
      artifacts.push(result.artifact)
      if (!pageSummaryForAssembly && result.pageSummary) {
        pageSummaryForAssembly = result.pageSummary
      }
      requestCount += result.requestCount
      usageTotals.total_tokens = (usageTotals.total_tokens ?? 0) + (result.usage.total_tokens ?? 0)
      usageTotals.prompt_tokens = (usageTotals.prompt_tokens ?? 0) + (result.usage.prompt_tokens ?? 0)
      usageTotals.completion_tokens = (usageTotals.completion_tokens ?? 0) + (result.usage.completion_tokens ?? 0)
      usageTotals.reasoning_tokens = (usageTotals.reasoning_tokens ?? 0) + ((result.usage as TokenUsage).reasoning_tokens ?? 0)
      usageTotals.total_cost = (usageTotals.total_cost ?? 0) + ((result.usage as TokenUsage).total_cost ?? 0)
      sectionReuseStats.freshSections += result.reuse.freshSections
      sectionReuseStats.reusedSections += result.reuse.reusedSections
      sectionReuseStats.cacheHits += result.reuse.cacheHits
      sectionReuseStats.cacheMisses += result.reuse.cacheMisses
    }

    const pageSummary = pageSummaryForAssembly ?? (await buildDetectionPromptFromCatalog({
      telemetry,
      pageUrl: url,
      mode: DetectionConfig.sectionPromptMode,
      model: endpointModel,
      provider: `${OpenRouterConfig.baseUrl}|${ModelConfig.allowedProvider || 'any'}`
    })).pageSummary
    const components = aggregateSectionArtifacts(tasks, artifacts)
    if (checkpointSession && checkpointService) {
      for (const artifact of artifacts) {
        if (!artifact.requiredSectionEmpty || !artifact.satisfiedBySectionKey) {
          continue
        }
        const existing = await checkpointService.loadSectionResult(checkpointSession, url, artifact.sectionKey)
        await checkpointService.saveSectionResult(
          checkpointSession,
          url,
          artifact.sectionKey,
          artifact.sectionOrder,
          artifact.components,
          artifact.durationMs ?? existing?.durationMs ?? 0,
          artifact.pageMetadata,
          {
            ...(existing?.llmDebug ?? {}),
            stage: existing?.llmDebug?.stage ?? 'validation',
            sectionKey: artifact.sectionKey,
            sectionOrder: artifact.sectionOrder,
            requiredSectionEmpty: true,
            satisfiedBySectionKey: artifact.satisfiedBySectionKey
          }
        ).catch(error => {
          console.warn('[Checkpoint] Failed to save section satisfaction metadata:', error)
        })
      }
    }
    if (components.length === 0) {
      // Nothing survived. Surface the first section's own error rather than the
      // generic message, so dropping sections never hides why they dropped.
      if (failedSections.length > 0) {
        throw failedSections[0].error
      }
      const invalidComponents = artifacts.flatMap(artifact => artifact.invalidComponents ?? [])
      const invalidSummary = invalidComponents.length
        ? `; ${invalidComponents.length} invalid component${invalidComponents.length === 1 ? '' : 's'} isolated`
        : ''
      throw new DetectionFailureError(
        `Section harness produced no components for ${url}${invalidSummary}`,
        {
          model: endpointModel,
          stage: 'validation',
          validationPath: 'sections.components',
          requestCount,
          toolCallCount: 0,
          invalidComponents,
          invalidComponentReasons: summarizeInvalidComponents(invalidComponents),
          invalidComponentCount: invalidComponents.length || undefined
        }
      )
    }
    const pageMetadata = this.mergePageMetadata(this.buildPageMetadataFromHead(preFlightFetch.headMeta), artifacts)
    // Shadow evidence only — nothing below reads this and nothing may. It sits
    // here because this is the first point after the preflight fetch where the
    // page's own title and description (preFlightFetch.headMeta) and the
    // headings recovered from the fetched sections both exist, which is the
    // evidence the question is about. It is on the path every successfully
    // fetched page takes, and beside the only other decision-model call in this
    // file, so both stay visible to the same reader.
    await this.recordIsInternalFromContent(url, pageMetadata, components, options.websiteId)
    const pageTemplate = await this.selectPageTemplateWithModel(pageSummary, url, components, pageMetadata, options.websiteId)
    const accuracy = components.length === 0
      ? 0
      : Math.min(1, components.filter(component => component.confidence >= ConfidenceConfig.highConfidence).length / Math.min(components.length, 10))
    const promptTokens = usageTotals.prompt_tokens || 0
    const completionTokens = usageTotals.completion_tokens || 0
    const reasoningTokens = usageTotals.reasoning_tokens || 0
    const tokenUsage = usageTotals.total_tokens || 0
    const cost = usageTotals.total_cost || (await calculateCost(displayModel, promptTokens, completionTokens, reasoningTokens))
    const diagnostics = [
      ...(buildDroppedSectionDiagnostics(failedSections) ?? []),
      ...(buildFooterQualityDiagnostics(components, preFlightFetch.resourcesSummary) ?? [])
    ]
    const detectionResult: ImportDetectionResult = {
      detectionHarness: 'blocks',
      components: includeContent
        ? components
        : components.map(({ content, ...rest }) => ({ ...rest, content: {} })),
      pageTemplate,
      pageMetadata,
      processingTime: Date.now() - startTime,
      modelUsed: displayModel,
      tokenUsage,
      promptTokens,
      completionTokens,
      cost,
      pageUrl: url,
      accuracy,
      resourcesSummary: preFlightFetch.resourcesSummary,
      timingBreakdown: buildTimingBreakdown(telemetry.getPhaseRecords(), Date.now() - startTime),
      sourceHttpStatus: preFlightFetch.status,
      sourceFinalUrl: preFlightFetch.finalUrl,
      ...(diagnostics?.length ? { diagnostics } : {})
    }

    if (checkpointSession && checkpointService) {
      await checkpointService.saveAssembledPage(checkpointSession, url, {
        url,
        generatedAt: new Date().toISOString(),
        sectionCount: tasks.length,
        componentCount: components.length,
        detection: detectionResult
      }).catch(error => {
        console.warn('[Checkpoint] Failed to save assembled page:', error)
      })
    }

    telemetry.flush({
      totalDurationMs: Date.now() - startTime,
      tokenUsage,
      requestCount,
      toolCallCount: 0,
      componentCount: detectionResult.components.length,
      templateKey: detectionResult.pageTemplate?.templateKey,
      accuracy,
      cost,
      sectionReuse: sectionReuseStats
    })

    return detectionResult
  }

  /**
   * Detect components from a URL using web-based analysis (no screenshot needed)
   */
  async detectComponentsFromUrl(
    url: string,
    options: ImportDetectionOptions = {}
  ): Promise<ImportDetectionResult> {
    // Shadow off is safe globally because unlisted questions never reach the model.
    if (!isDecisionModelEnabledFor(['import.block.component', 'import.block.multiple'], options.websiteId) || getDecisionConfig().shadow) {
      throw new Error('The blocks harness requires DECISION_MODEL_ENABLED=true and DECISION_MODEL_SHADOW=false. Both import.block.component and import.block.multiple must be enabled through DECISION_MODEL_QUESTIONS (empty or unset enables both by default).')
    }
    return performanceMonitor.measure('web.detect', async () => {
      const startTime = Date.now()
      traceMemory('detect:start', { url })
      const handlesUsed = new Set<string>()

      // Extract onProgress early so it's available in catch block
      const { onProgress } = options

      try {
        // Early exit: Skip asset URLs to avoid wasting expensive LLM tokens
        // This is a defensive check - asset URLs should be filtered by sitemap discovery
        if (isAssetUrl(url)) {
          console.warn(`[DetectionService] Skipping asset URL: ${url}`)
          return {
            components: [],
            pageTemplate: undefined,
            pageMetadata: { title: '', description: '' },
            processingTime: Date.now() - startTime,
            modelUsed: '',
            tokenUsage: 0,
            cost: 0,
            pageUrl: url,
            accuracy: 0
          }
        }

        const {
          apiKey: providedApiKey,
          baseUrl = OpenRouterConfig.baseUrl  // TKT-065: Use config (supports xAI direct)
        } = options
        const model = DetectionConfig.blockFillModel
        const telemetry = createDetectionTelemetry({ url, model })

        // Early redirect detection: Check for redirects before expensive LLM detection
        // This saves tokens by detecting redirect pages (external redirects, meta refresh, JS redirects)
        const webTools = getWebFetchTools()
        const preFlightFetch = await telemetry.timePhase(
          'fetch',
          async () => await webTools.fetchOutline({ url, stripScriptsStyles: true, collapseWhitespace: true }),
          result => ({
            status: result?.status,
            finalUrl: result?.finalUrl,
            handle: result?.handle
          })
        )
        if (preFlightFetch.handle) {
          handlesUsed.add(preFlightFetch.handle)
        }

        if (preFlightFetch.error) {
          throw new DetectionFailureError(
            `Source fetch failed for ${url}: ${preFlightFetch.message || 'fetch outline unavailable'}`,
            {
              model: 'preflight',
              stage: 'fetch',
              validationPath: 'source.fetchOutline',
              requestCount: 0,
              toolCallCount: 0
            }
          )
        }

        if (preFlightFetch.redirectInfo && preFlightFetch.redirectInfo.isExternal) {
          console.log(`[DetectionService] External redirect detected, skipping LLM detection: ${url} → ${preFlightFetch.redirectInfo.targetUrl}`)

          // Return early with redirect info - no need for LLM detection
          return {
            components: [],
            pageTemplate: {
              templateKey: 'redirect',
              confidence: 1.0,
              source: 'redirect-detection',
              reason: `External redirect to ${preFlightFetch.redirectInfo.targetUrl}`
            },
            pageMetadata: {
              title: preFlightFetch.headMeta?.title || 'Redirect Page',
              description: `Redirects to ${preFlightFetch.redirectInfo.targetUrl}`
            },
            processingTime: Date.now() - startTime,
            modelUsed: 'redirect-detection',
            tokenUsage: 0,
            cost: 0,
            pageUrl: url,
            accuracy: 1.0,
            timingBreakdown: buildTimingBreakdown(telemetry.getPhaseRecords(), Date.now() - startTime),
            redirectInfo: preFlightFetch.redirectInfo,
            isRedirectPage: true
          }
        }

        if (typeof preFlightFetch.status === 'number' && (preFlightFetch.status < 200 || preFlightFetch.status >= 400)) {
          throw new DetectionFailureError(
            `Source returned HTTP ${preFlightFetch.status} for ${url}`,
            {
              model: 'preflight',
              stage: 'validation',
              validationPath: 'source.status',
              requestCount: 0,
              toolCallCount: 0
            }
          )
        }

        // Report detection start
        onProgress?.({
          subsystemStart: {
            id: 'llm_detection',
            label: 'AI component detection',
            total: 4, // registry seeding, prompt building, llm call, parsing
          },
          message: `Starting AI detection for ${url}`,
        })
        const endpointModel = (() => {
          try {
            const host = new URL(baseUrl).hostname
            if (host.includes('api.openai.com')) {
              return model.replace(/^openai\//, '')
            }
          } catch {
            // ignore parsing issues and fall back to provided model id
          }
          return model
        })()

        // Get the model's actual max_completion_tokens from OpenRouter
        // effective = min(user's config, model's actual capability)
        const modelMaxTokens = await getModelMaxCompletionTokens(model, USER_MAX_TOKENS)
        const effectiveMaxTokens = Math.min(USER_MAX_TOKENS, modelMaxTokens)
        if (LoggingConfig.logOutput) {
          console.log(`[Detection] Model ${model}: user_max=${USER_MAX_TOKENS}, model_max=${modelMaxTokens}, effective=${effectiveMaxTokens}`)
        }

        const apiKey = validateLLMApiKey(
          providedApiKey || (process.env.NODE_ENV === 'test' ? 'test-key' : process.env.OPENROUTER_API_KEY),
          {
            missing: 'API key is required for web detection. Please set OPENROUTER_API_KEY environment variable or provide apiKey in options.',
            invalid: 'Invalid API key format. API key must be a non-empty string.'
          }
        )

        await telemetry.timePhase('registry_seeding', async () => {
          const canInspectRegistry = typeof detectionAPI?.getRegistryStats === 'function'
          if (!canInspectRegistry) {
            return { initialized: false, untracked: true }
          }
          const before = detectionAPI.getRegistryStats()
          let after = before
          let initialized = false
          let skipped = false
          if (before.componentCount === 0) {
            if (!registryInitialization) {
              registryInitialization = (async () => {
                await initializeCMSComponents()
                try {
                  await detectionAPI.warmupCache()
                } catch (error) {
                  console.warn('[DetectionRegistry] Failed to warm cache:', error)
                }
              })()
              registryInitialization.catch(() => {
                // ensure failed initialization can be retried by next invocation
              }).finally(() => {
                registryInitialization = null
              })
              await registryInitialization
              after = detectionAPI.getRegistryStats()
              initialized = true
            } else {
              await registryInitialization
              after = detectionAPI.getRegistryStats()
              skipped = true
            }
          } else {
            skipped = true
          }
          return { before, after, initialized, skipped }
        }, stats => stats ? summarizeRegistry(stats) : {})

        // Progress: registry seeding complete (step 1 of 4)
        onProgress?.({
          subsystemProgress: { id: 'llm_detection', current: 1, total: 4 },
          message: 'Preparing section detection harness...',
        })

        const sectionHarnessClient = createLLMClient({
          apiKey,
          baseURL: baseUrl,
          referer: url,
          title: 'Catalyst Studio Web Detection'
        })

        const sectionHarnessResult = await this.runSectionHarness({
          url,
          options,
          endpointModel,
          displayModel: model,
          effectiveMaxTokens,
          telemetry,
          webTools,
          preFlightFetch,
          startTime,
          client: sectionHarnessClient
        })

        onProgress?.({
          subsystemComplete: 'llm_detection',
          message: `Detected ${sectionHarnessResult.components.length} components`,
        })

        traceMemory('detect:complete', { url, components: sectionHarnessResult.components.length })
        return sectionHarnessResult

      } catch (error) {
        // Report detection error
        onProgress?.({
          subsystemError: { id: 'llm_detection', error: error instanceof Error ? error.message : 'Unknown error' },
        })
        console.error('Web detection error:', error)
        const message = `Web detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        if (error instanceof DetectionFailureError) {
          throw new DetectionFailureError(message, error.debug)
        }
        throw new Error(message)
      } finally {
        const webTools = getWebFetchTools()
        handlesUsed.forEach(handle => webTools.release(handle))
        handlesUsed.clear()
      }
    })
  }
}

let detectionService: DetectionService | null = null

export function getDetectionService(): DetectionService {
  if (!detectionService) {
    detectionService = new DetectionService()
  }
  return detectionService
}

export type {
  AIComponentMetadata,
  ComponentPattern,
  DetectedComponent,
  DetectedPageTemplate,
  ImportDetectionOptions,
  ImportDetectionResult,
  PageMetadata
} from './detection/types'

export { detectionParserInternals } from './detection/response-parser'
