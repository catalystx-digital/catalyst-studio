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
  ChatCompletion,
  ChatCompletionMessageParam
} from 'openai/resources/chat/completions'
import { getWebFetchTools, type HeadMeta, type ResourcesSummary } from './services/web-tools'
import { isAssetUrl } from './services/sitemap-discovery.service'
import { buildDetectionPromptFromCatalog, buildFillPromptFromCatalog } from './detection/prompt-builder'
import { filterPageContentCandidateTypes } from './detection/candidate-types'
import { parseDetectionResponse, parseSectionDetectionResponse } from './detection/response-parser'
import { buildDetectionSectionPlan, type DetectionSectionTask } from './detection/section-plan'
import { aggregateSectionArtifacts, type SectionExtractionArtifact } from './detection/section-aggregation'
import type { GlobalSectionReuseProvenance } from './detection/global-section-cache'
import {
  buildFillBatches,
  buildPageMap,
  parseComponentPlanResponse,
  parseFillBatchResponse,
  type ComponentPlan,
  type FillBatch,
  type PageMap
} from './detection/page-map-harness'
import { summarizeSectionNodes } from './detection/section-summarizer'
import { enrichNavbarRowStylesFromEvidence } from './detection/navbar-row-style-enrichment'
import { classifySectionIntent } from './detection/section-taxonomy'
import type { DetectedComponent, DetectedPageTemplate, DetectionPromptPayload, ImportDetectionOptions, ImportDetectionResult, InvalidDetectedComponent, PageMetadata } from './detection/types'
import { traceMemory } from './utils/memory-trace'
import { createDetectionTelemetry } from './telemetry/detection-telemetry'
import type { DetectionPhaseRecord, DetectionTelemetry } from './telemetry/detection-telemetry'
import { applyAllowedProviders, createLLMClient, validateLLMApiKey } from './services/llm-client'
import { getReasoningConfig, calculateCost, getModelMaxCompletionTokens } from './openrouter-models'
import {
  ModelConfig,
  TokenConfig,
  TimeoutConfig,
  ConfidenceConfig,
  LoggingConfig,
  OpenRouterConfig,
  DetectionConfig
} from './config'

// Use centralized configuration
const CONFIDENCE_THRESHOLD = ConfidenceConfig.detection
const TEMPERATURE = ModelConfig.temperature.detection
const DEFAULT_DETECTION_MODEL = ModelConfig.primary
const CONTEXT_BUDGET = TokenConfig.contextBudget
const MIN_COMPLETION_BUDGET = TokenConfig.minCompletionBudget
const USER_MAX_TOKENS = TokenConfig.maxCompletionTokens // User's requested max (from env)
const REQUEST_TIMEOUT_MS = TimeoutConfig.perRequestMs
const REPAIR_PREVIOUS_JSON_CHAR_LIMIT = 6_000

async function mapWithConcurrency<T, R>(
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

type SettledMapResult<T, R> =
  | { ok: true; item: T; result: R }
  | { ok: false; item: T; error: unknown }

async function mapSettledWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>
): Promise<Array<SettledMapResult<T, R>>> {
  return mapWithConcurrency(items, concurrency, async item => {
    try {
      return { ok: true, item, result: await worker(item) } as const
    } catch (error) {
      return { ok: false, item, error } as const
    }
  })
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
 * LLM chat completion request payload.
 */
interface LLMRequestPayload {
  model: string
  messages: ChatCompletionMessageParam[]
  temperature: number
  max_tokens: number
  response_format?: { type: 'json_object' }
  reasoning?: Record<string, unknown>
  [key: string]: unknown
}

/**
 * Token usage information from LLM response.
 */
interface TokenUsage {
  total_tokens?: number
  prompt_tokens?: number
  completion_tokens?: number
  reasoning_tokens?: number
  total_cost?: number
}

export interface DetectionFailureDebug {
  model?: string
  stage: 'llm_call' | 'budget' | 'parsing' | 'validation' | 'output_limit'
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
  groupKey?: string
  sectionApproxBytes?: number
  sectionSummaryEnabled?: boolean
  sectionOriginalBytes?: number
  sectionSummarizedBytes?: number
  sectionSummaryReductionRatio?: number
  parserRepair?: 'missing_section_key_injected'
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

function estimateTextTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4))
}

function hasOwnProperty(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key)
}

function responseMissingSectionKey(rawResult: string): boolean {
  try {
    const parsed = JSON.parse(rawResult)
    return Boolean(parsed && typeof parsed === 'object' && !Array.isArray(parsed) && !hasOwnProperty(parsed as Record<string, unknown>, 'sectionKey'))
  } catch {
    return false
  }
}

function capRepairPreviousJson(rawResult: string): { text: string; capped: boolean; chars: number } {
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

function checkpointArtifactKey(prefix: string, url: string): string {
  return `${prefix}-${Buffer.from(url).toString('base64url').slice(0, 80)}`
}

function isDedicatedEditorialListingUrl(url: string): boolean {
  try {
    const path = new URL(url).pathname
    return /\/(?:news|blog|blogs|article|articles|post|posts|press|media|insights?)(?:\/|$)/i.test(path)
  } catch {
    return false
  }
}

function addTokenUsage(target: TokenUsage, source: TokenUsage | undefined): void {
  if (!source) return
  target.total_tokens = (target.total_tokens ?? 0) + (source.total_tokens ?? 0)
  target.prompt_tokens = (target.prompt_tokens ?? 0) + (source.prompt_tokens ?? 0)
  target.completion_tokens = (target.completion_tokens ?? 0) + (source.completion_tokens ?? 0)
  target.reasoning_tokens = (target.reasoning_tokens ?? 0) + ((source as TokenUsage).reasoning_tokens ?? 0)
  target.total_cost = (target.total_cost ?? 0) + ((source as TokenUsage).total_cost ?? 0)
}

function hasAccordionEvidence(value: unknown): boolean {
  const visit = (node: unknown): boolean => {
    if (!node || typeof node !== 'object') return false
    const record = node as Record<string, unknown>
    const tag = typeof record.tag === 'string' ? record.tag.toLowerCase() : ''
    if (tag === 'details' || tag === 'summary') return true
    const text = typeof record.text === 'string' ? record.text.toLowerCase() : ''
    if (/\b(?:faq|frequently asked questions|q&a|accordion|collapsible|expandable)\b/i.test(text)) return true
    const role = typeof record.role === 'string' ? record.role.toLowerCase() : ''
    if (role.includes('button') && text.includes('question')) return true
    const attrs = record.attrs
    if (attrs && typeof attrs === 'object' && !Array.isArray(attrs)) {
      for (const [key, rawValue] of Object.entries(attrs as Record<string, unknown>)) {
        const attrKey = key.toLowerCase()
        const attrValue = typeof rawValue === 'string' ? rawValue.toLowerCase() : ''
        if (attrKey === 'aria-expanded' || attrKey.includes('accordion') || attrValue.includes('accordion') || attrValue.includes('collapse')) {
          return true
        }
      }
    }
    return Array.isArray(record.children) && record.children.some(visit)
  }
  return Array.isArray(value) ? value.some(visit) : visit(value)
}

/**
 * Detects if a JSON string is incomplete (truncated mid-output).
 * Returns an object with completion status and details about the truncation.
 */
function detectIncompleteJson(jsonStr: string): {
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
    JSON.parse(trimmed)
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

function extractValidationPath(message: string): string | undefined {
  const afterColon = message.split(':').slice(1).join(':').trim()
  const firstIssue = afterColon.split(';')[0]?.trim()
  const path = firstIssue?.split(':')[0]?.trim()
  return path || undefined
}

function expandCandidatesFromSectionEvidence(candidateTypes: Set<string>, sectionSlice: unknown): void {
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

function collectSectionPathIds(sectionSlice: unknown): Set<string> {
  const pathIds = new Set<string>()
  const visit = (value: unknown): void => {
    if (!value || typeof value !== 'object') return
    if (Array.isArray(value)) {
      value.forEach(visit)
      return
    }
    const record = value as Record<string, unknown>
    if (typeof record.pathId === 'string') {
      pathIds.add(record.pathId)
    }
    Object.values(record).forEach(visit)
  }
  visit(sectionSlice)
  return pathIds
}

function filterResourcesForSection(resources: ResourcesSummary | undefined, sectionSlice: unknown): ResourcesSummary | undefined {
  if (!resources) return undefined
  const pathIds = collectSectionPathIds(sectionSlice)
  if (pathIds.size === 0) {
    return {
      anchors: resources.anchors.slice(0, 12),
      images: resources.images.slice(0, 12),
      videos: resources.videos.slice(0, 4),
      forms: resources.forms.slice(0, 4),
      links: resources.links.slice(0, 12)
    }
  }
  const belongsToSection = (item: { pathId: string }) =>
    Array.from(pathIds).some(pathId => item.pathId === pathId || item.pathId.startsWith(`${pathId}.`))

  return {
    anchors: resources.anchors.filter(belongsToSection).slice(0, 20),
    images: resources.images.filter(belongsToSection).slice(0, 20),
    videos: resources.videos.filter(belongsToSection).slice(0, 6),
    forms: resources.forms.filter(belongsToSection).slice(0, 6),
    links: resources.links.slice(0, 12)
  }
}

function clampCompletionTokens(
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
          if (path.includes('/blog/') && template.templateKey.includes('post')) {
            score += 4
            routeScore += 4
          }
          if (/\/(?:blog|news|insights?|articles?)\/?$/.test(path) && template.templateKey.includes('index')) {
            score += 4
            routeScore += 4
          }
          return { template, score, routeScore }
        })
        .filter(candidate =>
          candidate.score > 0 &&
          (
            candidate.routeScore > 0 ||
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
      confidence: 0.8,
      source: 'model',
      reason: 'Selected deterministically by section detection harness from URL route hints and registered page templates.'
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
    modelMaxTokens: number
    telemetry: DetectionTelemetry
    webTools: ReturnType<typeof getWebFetchTools>
    preFlightFetch: Awaited<ReturnType<ReturnType<typeof getWebFetchTools>['fetchOutline']>>
    handlesUsed: Set<string>
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
      confidenceThreshold = CONFIDENCE_THRESHOLD,
      checkpointSession,
      checkpointService,
      globalSectionCache
    } = options

    const tasks = buildDetectionSectionPlan({
      pageUrl: url,
      sections: preFlightFetch.sections ?? []
    })
    if (tasks.length === 0) {
      throw new DetectionFailureError('Detection outline returned no sections to extract', {
        model: endpointModel,
        stage: 'validation',
        validationPath: 'outline.sections'
      })
    }

    if (checkpointSession && checkpointService) {
      await checkpointService.savePagePlan(checkpointSession, url, {
        url,
        generatedAt: new Date().toISOString(),
        sections: tasks
      }).catch(error => {
        console.warn('[Checkpoint] Failed to save page plan:', error)
      })
    }

    const usageTotals: TokenUsage = {}
    let requestCount = 0
    const sectionReuseStats = {
      freshSections: 0,
      reusedSections: 0,
      cacheHits: 0,
      cacheMisses: 0
    }
    const artifacts: SectionExtractionArtifact[] = []
    let pageSummaryForAssembly: DetectionPromptPayload['pageSummary'] | undefined

    const withTimeout = async <T>(promise: Promise<T>): Promise<T> => {
      let timeout: ReturnType<typeof setTimeout> | null = null
      try {
        return await Promise.race([
          promise,
          new Promise<T>((_, reject) => {
            timeout = setTimeout(() => reject(new Error(`web detection timeout after ${REQUEST_TIMEOUT_MS}ms`)), REQUEST_TIMEOUT_MS)
          })
        ])
      } finally {
        if (timeout) clearTimeout(timeout)
      }
    }

    const runJsonRequest = async (
      messages: ChatCompletionMessageParam[],
      metadata: Record<string, unknown> = {}
    ): Promise<ChatCompletion> => {
      const maxTokens = clampCompletionTokens(endpointModel, messages, effectiveMaxTokens)
      const payload: LLMRequestPayload = {
        model: endpointModel,
        messages,
        temperature: TEMPERATURE,
        max_tokens: maxTokens,
        response_format: { type: 'json_object' }
      }
      applyAllowedProviders(payload)
      const reasoningConfig = await getReasoningConfig(endpointModel)
      if (reasoningConfig) {
        payload.reasoning = reasoningConfig as Record<string, unknown>
      }
      return await telemetry.timePhase(
        'llm_call',
        async () => await withTimeout(client.chat.completions.create(payload)),
        response => ({
          ...metadata,
          maxTokens,
          totalTokens: response?.usage?.total_tokens ?? 0,
          promptTokens: response?.usage?.prompt_tokens ?? 0,
          completionTokens: response?.usage?.completion_tokens ?? 0
        })
      )
    }

    type SectionProcessingResult = {
      artifact: SectionExtractionArtifact
      pageSummary?: DetectionPromptPayload['pageSummary']
      usage: TokenUsage
      requestCount: number
      reuse: typeof sectionReuseStats
    }

    const processSectionTask = async (task: DetectionSectionTask): Promise<SectionProcessingResult> => {
      const sectionStart = Date.now()
      let localRequestCount = 0
      const sectionUsage: TokenUsage = {}
      const cached = checkpointSession && checkpointService
        ? await checkpointService.loadSectionResult(checkpointSession, url, task.sectionKey)
        : null
      if (cached) {
        return {
          artifact: {
            sectionKey: cached.sectionKey,
            sectionOrder: cached.sectionOrder,
            durationMs: cached.durationMs,
            components: cached.components,
            pageMetadata: cached.pageMetadata,
            requiredSectionEmpty: cached.llmDebug?.requiredSectionEmpty,
            satisfiedBySectionKey: cached.llmDebug?.satisfiedBySectionKey
          },
          usage: {},
          requestCount: 0,
          reuse: {
            freshSections: 0,
            reusedSections: 0,
            cacheHits: 0,
            cacheMisses: 0
          }
        }
      }

      try {
        const section = await webTools.getSection({ handle: preFlightFetch.handle, key: task.sectionKey })
        const sectionTaxonomy = classifySectionIntent({
          componentType: task.role,
          content: { section: section.slice },
          pageUrl: url
        })
        const candidateTypes = new Set(task.candidateTypes)
        sectionTaxonomy.allowedTypes.forEach(type => candidateTypes.add(type))
        expandCandidatesFromSectionEvidence(candidateTypes, section.slice)
        if (task.role === 'header') {
          candidateTypes.clear()
          candidateTypes.add('navbar')
        }
        if (task.role === 'footer') {
          candidateTypes.clear()
          candidateTypes.add('footer')
        }

        const filteredCandidateTypes = filterPageContentCandidateTypes(candidateTypes)

        const { prompt: catalogPrompt, components, pageSummary } = await buildDetectionPromptFromCatalog({
          telemetry,
          pageUrl: url,
          candidateTypes: filteredCandidateTypes,
          mode: DetectionConfig.sectionPromptMode,
          model: endpointModel,
          provider: `${OpenRouterConfig.baseUrl}|${ModelConfig.allowedProvider || 'any'}`
        })
        const allowedComponentTypes = components.map(component => component.type).sort()
        const summarizedSection = summarizeSectionNodes(section.slice, DetectionConfig.sectionSummaryEnabled)
        const sectionPayload = {
          url,
          finalUrl: preFlightFetch.finalUrl,
          sectionKey: task.sectionKey,
          sectionOrder: task.sectionOrder,
          role: task.role,
          intent: sectionTaxonomy.intent,
          intentEvidence: sectionTaxonomy.evidence,
          stats: section.stats,
          resourcesSummary: filterResourcesForSection(preFlightFetch.resourcesSummary, section.slice),
          nodes: summarizedSection.nodes
        }
        const messages: ChatCompletionMessageParam[] = [
          {
            role: 'system',
            content: [
              'You are a section extraction engine.',
              'Return only valid JSON with fields "sectionKey", "components", and optional "pageMetadata".',
              'Do not call tools. Do not include markdown, commentary, analysis, or trailing text.',
              'Extract only the provided section JSON. Keep components in visible DOM order.'
            ].join('\n')
          },
          {
            role: 'system',
            content: [
              catalogPrompt,
              '=== SECTION HARNESS RULES ===',
              `The sectionKey field must be exactly: ${task.sectionKey}`,
              `Allowed component types: ${allowedComponentTypes.join(', ')}`,
              'The component field must be exactly one allowed component type.',
              'Never emit generic wrappers such as section, container, wrapper, block, group, layout, or raw DOM/tag names.',
              'Do not invent copy, URLs, images, dates, categories, or placeholder content.',
              'If this section contains project/case-study/client-work/latest-project tiles, use card-grid, not content-feed.',
              'Use content-feed for real news, blog, article, story, media, press, dated, or chronological teaser listings; never use card-grid for those editorial feeds.',
              'One carousel, slider, tab panel, or responsive listing surface must become one component with nested items; never emit one top-level component per slide/card variant.',
              'Hidden or inactive slides/items marked by aria-hidden, hidden, data-active/current/index, carousel/slider classes, or responsive duplicate wrappers must not become separate top-level components.',
              'When desktop/mobile/list variants contain the same item titles or links, represent the source surface once using the richest visible variant.',
              'Every image.src MediaReference object must include mediaId, mediaType: "image", and url.',
              'card-grid.cards[] links must use href, never link or url.',
              'When nodes include bgColor evidence for a visible component surface, preserve that source CSS color in the component style fields supported by its schema; do not infer colors from brand palette.',
              'If no registered component can truthfully represent the section, return components: [].'
            ].join('\n\n')
          },
          {
            role: 'user',
            content: `Extract this single section:\n${JSON.stringify(sectionPayload)}`
          }
        ]
        const sectionPromptTokensEstimate = estimateMessageTokens(messages)
        const sectionApproxBytes =
          typeof section.stats?.approxBytes === 'number'
            ? section.stats.approxBytes
            : JSON.stringify(section.slice).length
        const sectionPayloadDebug = {
          sectionSummaryEnabled: summarizedSection.enabled,
          sectionOriginalBytes: summarizedSection.originalBytes,
          sectionSummarizedBytes: summarizedSection.summarizedBytes,
          sectionSummaryReductionRatio: summarizedSection.reductionRatio
        }

        const parseOutcome = (
          response: ChatCompletion,
          rawResult: string,
          extraDebug: Partial<DetectionFailureDebug> = {},
          isolateInvalidComponents = false
        ) => {
          const completionStatus = detectIncompleteJson(rawResult)
          const finishReason = response.choices[0]?.finish_reason || ''
          if (!completionStatus.isComplete || finishReason === 'length') {
            throw new DetectionFailureError(
              `Section ${task.sectionKey} exceeded output limit or returned incomplete JSON (${completionStatus.reason || 'finish_reason_length'}; finish_reason=${finishReason || 'unknown'})`,
              {
                model: endpointModel,
                stage: 'output_limit',
                rawResponse: rawResult,
                rawResponseLength: rawResult.length,
                finishReason,
                usage: response.usage ? { ...response.usage } : {},
                validationPath: completionStatus.reason,
                requestCount: localRequestCount + 1,
                toolCallCount: 0,
                promptTokensEstimate: sectionPromptTokensEstimate,
                effectiveCompletionTokens: Math.max(0, CONTEXT_BUDGET - sectionPromptTokensEstimate),
                sectionKey: task.sectionKey,
                sectionOrder: task.sectionOrder,
                sectionApproxBytes,
                ...sectionPayloadDebug,
                ...extraDebug
              }
            )
          }
          try {
            return parseSectionDetectionResponse({
              rawResponse: rawResult,
              sectionKey: task.sectionKey,
              availableComponents: components,
              url,
              confidenceThreshold,
              allowMissingSectionKey: false,
              isolateInvalidComponents
            })
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            throw new DetectionFailureError(message, {
              model: endpointModel,
              stage: message.includes('content is invalid') ? 'validation' : 'parsing',
              rawResponse: rawResult,
              rawResponseLength: rawResult.length,
              finishReason,
              usage: response.usage ? { ...response.usage } : {},
              validationPath: extractValidationPath(message),
              requestCount: localRequestCount + 1,
              toolCallCount: 0,
              promptTokensEstimate: sectionPromptTokensEstimate,
              effectiveCompletionTokens: Math.max(0, CONTEXT_BUDGET - sectionPromptTokensEstimate),
              sectionKey: task.sectionKey,
              sectionOrder: task.sectionOrder,
              sectionApproxBytes,
              ...sectionPayloadDebug,
              ...(responseMissingSectionKey(rawResult) ? { missingSectionKey: true } : {}),
              ...extraDebug
            })
          }
        }

        type FreshSectionRun = {
          artifact: SectionExtractionArtifact
          rawResult: string
          responseUsage: TokenUsage
          finishReason: string
          repairDebug: Partial<DetectionFailureDebug>
          parserDebug: Partial<DetectionFailureDebug>
        }
        let freshRun: FreshSectionRun | null = null
        const extractFreshSection = async (): Promise<SectionExtractionArtifact> => {
          let response = await runJsonRequest(messages, {
            sectionKey: task.sectionKey,
            sectionOrder: task.sectionOrder,
            role: task.role,
            attempt: 1,
            promptTokensEstimate: sectionPromptTokensEstimate,
            sectionApproxBytes,
            summarizerEnabled: summarizedSection.enabled,
            originalBytes: summarizedSection.originalBytes,
            summarizedBytes: summarizedSection.summarizedBytes
          })
          localRequestCount++
          let rawResult = response.choices[0]?.message?.content || ''
          let parsedSection
          let repairDebug: Partial<DetectionFailureDebug> = {}
          let parserDebug: Partial<DetectionFailureDebug> = responseMissingSectionKey(rawResult)
            ? { missingSectionKey: true }
            : {}
          try {
            parsedSection = parseOutcome(response, rawResult)
          } catch (firstError) {
            if (!(firstError instanceof DetectionFailureError) || firstError.debug.stage === 'output_limit') {
              throw firstError
            }
            if (firstError.message.includes(`sectionKey must be "${task.sectionKey}"`)) {
              throw firstError
            }
            const cappedPreviousJson = capRepairPreviousJson(rawResult)
            repairDebug = {
              repairPromptCapped: cappedPreviousJson.capped,
              repairPromptPreviousJsonChars: cappedPreviousJson.chars
            }
            messages.push({
              role: 'user',
              content: [
                'Your previous JSON failed strict validation.',
                `Validation error: ${firstError.message}`,
                `Validation path: ${firstError.debug.validationPath || 'unknown'}`,
                `The sectionKey must remain exactly ${task.sectionKey}.`,
                `Allowed component types: ${allowedComponentTypes.join(', ')}`,
                'Repair schema shape and component names only. Do not invent content. Return only JSON.',
                cappedPreviousJson.capped
                  ? `Previous JSON excerpt (capped to ${cappedPreviousJson.chars} chars):`
                  : 'Previous JSON:',
                cappedPreviousJson.text
              ].join('\n')
            })
            response = await runJsonRequest(messages, {
              sectionKey: task.sectionKey,
              sectionOrder: task.sectionOrder,
              role: task.role,
              attempt: 2,
              repair: true,
              promptTokensEstimate: estimateMessageTokens(messages),
              sectionApproxBytes,
              summarizerEnabled: summarizedSection.enabled,
              originalBytes: summarizedSection.originalBytes,
              summarizedBytes: summarizedSection.summarizedBytes
            })
            localRequestCount++
            rawResult = response.choices[0]?.message?.content || ''
            parsedSection = parseOutcome(response, rawResult, repairDebug, true)
            if (parsedSection.invalidComponents?.length) {
              throw new DetectionFailureError(
                `Section ${task.sectionKey} produced ${parsedSection.invalidComponents.length} invalid component${parsedSection.invalidComponents.length === 1 ? '' : 's'} after repair`,
                {
                  model: endpointModel,
                  stage: 'validation',
                  rawResponse: rawResult,
                  rawResponseLength: rawResult.length,
                  finishReason: response.choices[0]?.finish_reason || 'unknown',
                  usage: response.usage ? { ...response.usage } : {},
                  validationPath: `sections.${task.sectionKey}.components`,
                  requestCount: localRequestCount,
                  toolCallCount: 0,
                  promptTokensEstimate: sectionPromptTokensEstimate,
                  effectiveCompletionTokens: Math.max(0, CONTEXT_BUDGET - sectionPromptTokensEstimate),
                  sectionKey: task.sectionKey,
                  sectionOrder: task.sectionOrder,
                  sectionApproxBytes,
                  ...sectionPayloadDebug,
                  invalidComponents: parsedSection.invalidComponents,
                  invalidComponentReasons: summarizeInvalidComponents(parsedSection.invalidComponents),
                  invalidComponentCount: parsedSection.invalidComponents.length,
                  ...repairDebug
                }
              )
            }
          }

          const requiredSectionEmpty = task.required && section.stats.nodeCount > 0 && parsedSection.components.length === 0
          if (requiredSectionEmpty && parsedSection.invalidComponents?.length) {
            const invalidSummary = parsedSection.invalidComponents?.length
              ? `; ${parsedSection.invalidComponents.length} invalid component${parsedSection.invalidComponents.length === 1 ? '' : 's'} isolated`
              : ''
            throw new DetectionFailureError(
              `Required section ${task.sectionKey} produced no components${invalidSummary}`,
              {
                model: endpointModel,
                stage: 'validation',
                rawResponse: rawResult,
                rawResponseLength: rawResult.length,
                finishReason: response.choices[0]?.finish_reason || 'unknown',
                usage: response.usage ? { ...response.usage } : {},
                validationPath: `sections.${task.sectionKey}.components`,
                requestCount: localRequestCount,
                toolCallCount: 0,
                promptTokensEstimate: sectionPromptTokensEstimate,
                effectiveCompletionTokens: Math.max(0, CONTEXT_BUDGET - sectionPromptTokensEstimate),
                sectionKey: task.sectionKey,
                sectionOrder: task.sectionOrder,
                sectionApproxBytes,
                ...sectionPayloadDebug,
                invalidComponents: parsedSection.invalidComponents,
                invalidComponentReasons: summarizeInvalidComponents(parsedSection.invalidComponents),
                invalidComponentCount: parsedSection.invalidComponents?.length,
                requiredSectionEmpty,
                ...parserDebug,
                ...repairDebug
              }
            )
          }

          const responseUsage: TokenUsage = response.usage ? { ...response.usage } : {}
          freshRun = {
            artifact: {
              sectionKey: task.sectionKey,
              sectionOrder: task.sectionOrder,
              durationMs: Date.now() - sectionStart,
              components: parsedSection.components,
              pageMetadata: parsedSection.pageMetadata,
              invalidComponents: parsedSection.invalidComponents,
              requiredSectionEmpty
            },
            rawResult,
            responseUsage,
            finishReason: response.choices[0]?.finish_reason || 'unknown',
            repairDebug,
            parserDebug
          }
          return freshRun.artifact
        }

        const origin = (() => {
          try {
            return new URL(preFlightFetch.finalUrl || url).origin
          } catch {
            return 'unknown'
          }
        })()
        const reuseKey = DetectionConfig.globalSectionReuse && globalSectionCache
          ? globalSectionCache.createKey({
              role: task.role,
              origin,
              sectionSlice: section.slice,
              candidateTypes,
              model: endpointModel
            })
          : null
        const cacheResult = await (DetectionConfig.globalSectionReuse && globalSectionCache
          ? globalSectionCache.getOrCreate(
              reuseKey,
              { url, sectionKey: task.sectionKey },
              extractFreshSection
            )
          : Promise.resolve({
              artifact: await extractFreshSection(),
              provenance: {
                extractionMode: 'fresh' as const,
                cacheHit: false,
                cacheMissReason: DetectionConfig.globalSectionReuse ? 'cache_unavailable' : 'reuse_disabled'
              }
            }))

        const provenance: GlobalSectionReuseProvenance = cacheResult.provenance
        const reuseStats = {
          freshSections: provenance.extractionMode === 'reused' ? 0 : 1,
          reusedSections: provenance.extractionMode === 'reused' ? 1 : 0,
          cacheHits: provenance.cacheHit ? 1 : 0,
          cacheMisses: provenance.cacheHit ? 0 : 1
        }
        const completedFreshRun = freshRun as FreshSectionRun | null
        const artifact: SectionExtractionArtifact = {
          ...cacheResult.artifact,
          sectionKey: task.sectionKey,
          sectionOrder: task.sectionOrder,
          durationMs: Date.now() - sectionStart,
          pageMetadata: provenance.extractionMode === 'reused' ? undefined : cacheResult.artifact.pageMetadata
        }
        enrichNavbarRowStylesFromEvidence(artifact.components, section.slice)
        if (completedFreshRun && provenance.extractionMode === 'fresh') {
          const responseUsage = completedFreshRun.responseUsage
          sectionUsage.total_tokens = responseUsage.total_tokens ?? 0
          sectionUsage.prompt_tokens = responseUsage.prompt_tokens ?? 0
          sectionUsage.completion_tokens = responseUsage.completion_tokens ?? 0
          sectionUsage.reasoning_tokens = (responseUsage as TokenUsage).reasoning_tokens ?? 0
          sectionUsage.total_cost = (responseUsage as TokenUsage).total_cost ?? 0
        }

        if (checkpointSession && checkpointService) {
          await checkpointService.saveSectionResult(
            checkpointSession,
            url,
            task.sectionKey,
            task.sectionOrder,
            artifact.components,
            Date.now() - sectionStart,
            artifact.pageMetadata,
            {
              model: endpointModel,
              stage: 'llm_call',
              rawResponseLength: completedFreshRun && provenance.extractionMode === 'fresh' ? completedFreshRun.rawResult.length : 0,
              rawResponse: completedFreshRun && provenance.extractionMode === 'fresh' ? completedFreshRun.rawResult : undefined,
              finishReason: completedFreshRun && provenance.extractionMode === 'fresh' ? completedFreshRun.finishReason : 'cache_reuse',
              usage: completedFreshRun && provenance.extractionMode === 'fresh' ? completedFreshRun.responseUsage : {},
              requestCount: localRequestCount,
              toolCallCount: 0,
              promptTokensEstimate: sectionPromptTokensEstimate,
              effectiveCompletionTokens: Math.max(0, CONTEXT_BUDGET - sectionPromptTokensEstimate),
              sectionKey: task.sectionKey,
              sectionOrder: task.sectionOrder,
              sectionApproxBytes,
              sectionSummaryEnabled: summarizedSection.enabled,
              sectionOriginalBytes: summarizedSection.originalBytes,
              sectionSummarizedBytes: summarizedSection.summarizedBytes,
              sectionSummaryReductionRatio: summarizedSection.reductionRatio,
              invalidComponents: artifact.invalidComponents,
              invalidComponentReasons: summarizeInvalidComponents(artifact.invalidComponents),
              invalidComponentCount: artifact.invalidComponents?.length,
              requiredSectionEmpty: artifact.requiredSectionEmpty,
              extractionMode: provenance.extractionMode,
              reusedFromUrl: provenance.reusedFromUrl,
              reusedFromSectionKey: provenance.reusedFromSectionKey,
              sectionContentHash: provenance.sectionContentHash,
              reuseKey: provenance.reuseKey,
              reuseVersion: provenance.reuseVersion,
              cacheHit: provenance.cacheHit,
              cacheMissReason: provenance.cacheMissReason,
              ...(completedFreshRun && provenance.extractionMode === 'fresh' ? completedFreshRun.parserDebug : {}),
              ...(completedFreshRun && provenance.extractionMode === 'fresh' ? completedFreshRun.repairDebug : {})
            }
          )
        }

        // Build once per first uncached section to keep template catalog available for assembly.
        telemetry.recordPhase('section_extract', Date.now() - sectionStart, {
          sectionKey: task.sectionKey,
          sectionOrder: task.sectionOrder,
          role: task.role,
          extractionMode: provenance.extractionMode,
          cacheHit: provenance.cacheHit,
          requestCount: localRequestCount,
          promptTokensEstimate: sectionPromptTokensEstimate,
          sectionApproxBytes,
          summarizerEnabled: summarizedSection.enabled,
          originalBytes: summarizedSection.originalBytes,
          summarizedBytes: summarizedSection.summarizedBytes,
          summaryReductionRatio: summarizedSection.reductionRatio,
          componentCount: artifact.components.length
        })

        return {
          artifact,
          pageSummary,
          usage: sectionUsage,
          requestCount: localRequestCount,
          reuse: reuseStats
        }
      } catch (error) {
        const previousError = checkpointSession && checkpointService
          ? await checkpointService.loadSectionError(checkpointSession, url, task.sectionKey)
          : null
        if (checkpointSession && checkpointService) {
          await checkpointService.saveSectionError(
            checkpointSession,
            url,
            task.sectionKey,
            task.sectionOrder,
            error instanceof Error ? error : new Error(String(error)),
            (previousError?.attemptCount ?? 0) + 1,
            error instanceof DetectionFailureError
              ? (error.debug.stage === 'output_limit' ? 'output_limit' : error.debug.stage === 'llm_call' ? 'llm_call' : error.debug.stage === 'budget' ? 'budget' : 'parsing')
              : undefined,
            error instanceof DetectionFailureError ? {
              model: error.debug.model,
              stage: error.debug.stage,
              rawResponseLength: error.debug.rawResponseLength ?? error.debug.rawResponse?.length ?? 0,
              rawResponse: error.debug.rawResponse,
              finishReason: error.debug.finishReason,
              usage: error.debug.usage,
              validationPath: error.debug.validationPath,
              requestCount: error.debug.requestCount,
              toolCallCount: error.debug.toolCallCount,
              contextBudget: error.debug.contextBudget,
              minCompletionBudget: error.debug.minCompletionBudget,
              promptTokensEstimate: error.debug.promptTokensEstimate,
              effectiveCompletionTokens: error.debug.effectiveCompletionTokens,
              sectionKey: error.debug.sectionKey,
              sectionOrder: error.debug.sectionOrder,
              sectionApproxBytes: error.debug.sectionApproxBytes,
              sectionSummaryEnabled: error.debug.sectionSummaryEnabled,
              sectionOriginalBytes: error.debug.sectionOriginalBytes,
              sectionSummarizedBytes: error.debug.sectionSummarizedBytes,
              sectionSummaryReductionRatio: error.debug.sectionSummaryReductionRatio,
              invalidComponents: error.debug.invalidComponents,
              invalidComponentReasons: error.debug.invalidComponentReasons,
              invalidComponentCount: error.debug.invalidComponentCount,
              requiredSectionEmpty: error.debug.requiredSectionEmpty,
              parserRepair: error.debug.parserRepair,
              missingSectionKey: error.debug.missingSectionKey,
              repairPromptCapped: error.debug.repairPromptCapped,
              repairPromptPreviousJsonChars: error.debug.repairPromptPreviousJsonChars,
              extractionMode: error.debug.extractionMode,
              reusedFromUrl: error.debug.reusedFromUrl,
              reusedFromSectionKey: error.debug.reusedFromSectionKey,
              sectionContentHash: error.debug.sectionContentHash,
              reuseKey: error.debug.reuseKey,
              reuseVersion: error.debug.reuseVersion,
              cacheHit: error.debug.cacheHit,
              cacheMissReason: error.debug.cacheMissReason
            } : undefined
          )
        }
        throw error
      }
    }

    const sectionConcurrency = Math.max(1, DetectionConfig.sectionConcurrency)
    const sectionResults = DetectionConfig.detectionHarness === 'page-map'
      ? await (async (): Promise<SectionProcessingResult[]> => {
          const globalTasks = tasks.filter(task => task.role === 'header' || task.role === 'footer')
          const fillTasks = tasks.filter(task => task.role !== 'header' && task.role !== 'footer')
          const results: SectionProcessingResult[] = []

          if (globalTasks.length > 0) {
            results.push(...await mapWithConcurrency(globalTasks, sectionConcurrency, processSectionTask))
          }
          const pendingFillTasks: DetectionSectionTask[] = []
          for (const task of fillTasks) {
            const cached = checkpointSession && checkpointService
              ? await checkpointService.loadSectionResult(checkpointSession, url, task.sectionKey)
              : null
            if (cached) {
              results.push({
                artifact: {
                  sectionKey: cached.sectionKey,
                  sectionOrder: cached.sectionOrder,
                  durationMs: cached.durationMs,
                  components: cached.components,
                  pageMetadata: cached.pageMetadata,
                  requiredSectionEmpty: cached.llmDebug?.requiredSectionEmpty,
                  satisfiedBySectionKey: cached.llmDebug?.satisfiedBySectionKey
                },
                pageSummary: pageSummaryForAssembly,
                usage: {},
                requestCount: 0,
                reuse: { freshSections: 0, reusedSections: 0, cacheHits: 1, cacheMisses: 0 }
              })
            } else {
              pendingFillTasks.push(task)
            }
          }
          if (pendingFillTasks.length === 0) {
            return results.sort((a, b) => a.artifact.sectionOrder - b.artifact.sectionOrder)
          }

          const pageMap = await telemetry.timePhase(
            'page_map',
            async () => await buildPageMap({
              url,
              finalUrl: preFlightFetch.finalUrl,
              tasks: pendingFillTasks,
              getSection: async task => await webTools.getSection({ handle: preFlightFetch.handle, key: task.sectionKey })
            }),
            map => ({
              sectionCount: map?.sections.length ?? 0,
              originalBytes: map?.originalBytes ?? 0,
              packetBytes: map?.packetBytes ?? 0,
              sourceHash: map?.sourceHash,
              pageMapVersion: map?.version
            })
          )
          const dedicatedEditorialListing = isDedicatedEditorialListingUrl(url)
          for (const section of pageMap.sections) {
            const candidateTypes = new Set(section.candidateTypes)
            const taxonomy = classifySectionIntent({
              componentType: section.role,
              content: { section: section.packets },
              pageUrl: url
            })
            taxonomy.allowedTypes.forEach(type => candidateTypes.add(type))
            taxonomy.deniedTypes.forEach(type => candidateTypes.delete(type))
            expandCandidatesFromSectionEvidence(candidateTypes, section.packets)
            if (taxonomy.intent === 'editorial_feed' && candidateTypes.has('content-feed')) {
              candidateTypes.delete('card-grid')
            }
            if (taxonomy.intent !== 'editorial_feed' && !dedicatedEditorialListing && candidateTypes.has('card-grid')) {
              candidateTypes.delete('content-feed')
            }
            if (candidateTypes.has('accordion') && !hasAccordionEvidence(section.packets)) {
              candidateTypes.delete('accordion')
            }
            section.candidateTypes = filterPageContentCandidateTypes(candidateTypes)
          }
          if (checkpointSession && checkpointService) {
            await checkpointService.saveAggregated(
              checkpointSession,
              checkpointArtifactKey('page-map', url),
              pageMap
            ).catch(error => {
              console.warn('[Checkpoint] Failed to save page-map artifact:', error)
            })
          }

          const planCandidateTypes = new Set<string>()
          for (const section of pageMap.sections) {
            section.candidateTypes.forEach(type => planCandidateTypes.add(type))
          }
          const { components: planComponents, pageSummary } = await buildDetectionPromptFromCatalog({
            telemetry,
            pageUrl: url,
            candidateTypes: planCandidateTypes,
            mode: DetectionConfig.sectionPromptMode,
            model: endpointModel,
            provider: `${OpenRouterConfig.baseUrl}|${ModelConfig.allowedProvider || 'any'}`
          })
          pageSummaryForAssembly = pageSummary

          const planSectionKeys = pageMap.sections.map(section => section.sectionKey)
          const planPayload = {
            url,
            finalUrl: preFlightFetch.finalUrl,
            schemaVersion: DetectionConfig.planSchemaVersion,
            promptVersion: DetectionConfig.stagedPromptVersion,
            sections: pageMap.sections.map(section => ({
              sectionKey: section.sectionKey,
              sectionOrder: section.sectionOrder,
              role: section.role,
              required: section.required,
              candidateTypes: section.candidateTypes,
              stats: section.stats,
              packets: section.packets
            }))
          }
          const planMessages: ChatCompletionMessageParam[] = [
            {
              role: 'system',
              content: [
                'You are a high-recall component planning engine.',
                'Return only valid JSON with a "sections" array.',
                'Do not return final component content. Plan only component types and source evidence.',
                'Every returned sectionKey must exactly match a provided sectionKey.',
                'For each section, component must be one of that section candidateTypes values. candidateTypes are exclusive, not suggestions.',
                'If content-feed is not listed in that section candidateTypes, content-feed is invalid and must not be returned.',
                'For each planned component, return plannedComponentId, component, confidence, and evidenceRefs.',
                'plannedComponentId must be unique and stable, for example "<sectionKey>:0".',
                'evidenceRefs must reference provided source packet ids or pathId values.',
                'For visible static lists of non-editorial links, resources, services, or feature cards, prefer card-grid.',
                'Use accordion only for real collapsible FAQ/Q&A/details content with non-empty answer/body text for each item; never use accordion for ordinary navigation or "In this section" link lists.',
                'Use content-feed for real news, blog, article, story, media, press, dated, or chronological teaser listings, including latest-news modules on a home page.',
                'If a non-required section has no importable component, return plannedComponents: [] and emptyReason: duplicate, decorative, unsupported, or no_visible_content.',
                'Do not invent sections, components, or evidence references.'
              ].join('\n')
            },
            {
              role: 'user',
              content: `Plan components for this PageMap:\n${JSON.stringify(planPayload)}`
            }
          ]
          const planPromptTokensEstimate = estimateMessageTokens(planMessages)
          let planRequestCount = 0
          let planUsage: TokenUsage = {}
          const componentPlan = await telemetry.timePhase('component_plan', async (): Promise<ComponentPlan> => {
            const parsePlan = (response: ChatCompletion, rawResult: string, requestCountForError: number): ComponentPlan => {
              const completionStatus = detectIncompleteJson(rawResult)
              const finishReason = response.choices[0]?.finish_reason || ''
              if (!completionStatus.isComplete || finishReason === 'length') {
                throw new DetectionFailureError(
                  `ComponentPlan exceeded output limit or returned incomplete JSON (${completionStatus.reason || 'finish_reason_length'}; finish_reason=${finishReason || 'unknown'})`,
                  {
                    model: endpointModel,
                    stage: 'output_limit',
                    rawResponse: rawResult,
                    rawResponseLength: rawResult.length,
                    finishReason,
                    usage: response.usage ? { ...response.usage } : {},
                    validationPath: completionStatus.reason,
                    requestCount: requestCountForError,
                    promptTokensEstimate: planPromptTokensEstimate,
                    effectiveCompletionTokens: Math.max(0, CONTEXT_BUDGET - planPromptTokensEstimate)
                  }
                )
              }
              try {
                return parseComponentPlanResponse({
                  rawResponse: rawResult,
                  pageMap,
                  plannedSectionKeys: planSectionKeys,
                  availableComponents: planComponents
                })
              } catch (error) {
                throw new DetectionFailureError(error instanceof Error ? error.message : String(error), {
                  model: endpointModel,
                  stage: 'validation',
                  rawResponse: rawResult,
                  rawResponseLength: rawResult.length,
                  finishReason,
                  usage: response.usage ? { ...response.usage } : {},
                  validationPath: extractValidationPath(error instanceof Error ? error.message : String(error)),
                  requestCount: requestCountForError,
                  promptTokensEstimate: planPromptTokensEstimate,
                  effectiveCompletionTokens: Math.max(0, CONTEXT_BUDGET - planPromptTokensEstimate)
                })
              }
            }

            let response = await runJsonRequest(planMessages, {
              stage: 'component_plan',
              sectionCount: pageMap.sections.length,
              promptTokensEstimate: planPromptTokensEstimate,
              candidateTypeCount: planCandidateTypes.size,
              candidateTypes: Array.from(planCandidateTypes).sort(),
              pageMapBytes: JSON.stringify(planPayload).length,
              fillBatchConcurrency: DetectionConfig.fillBatchConcurrency
            })
            planRequestCount++
            planUsage = response.usage ? { ...response.usage } : {}
            let rawResult = response.choices[0]?.message?.content || ''
            try {
              return parsePlan(response, rawResult, planRequestCount)
            } catch (firstError) {
              if (firstError instanceof DetectionFailureError && firstError.debug.stage === 'output_limit') {
                throw firstError
              }
              const cappedPreviousJson = capRepairPreviousJson(rawResult)
              planMessages.push({
                role: 'user',
                content: [
                  'Your previous ComponentPlan JSON failed strict validation.',
                  `Validation error: ${firstError instanceof Error ? firstError.message : String(firstError)}`,
                  `Allowed section component types: ${JSON.stringify(planPayload.sections.map(section => ({ sectionKey: section.sectionKey, candidateTypes: section.candidateTypes })))}`,
                  'Repair schema shape only. Do not add sections, change section keys, invent evidence refs, or change source facts.',
                  'Replace any component not listed for its section with the best listed candidate type supported by the same evidence.',
                  cappedPreviousJson.capped
                    ? `Previous JSON excerpt (capped to ${cappedPreviousJson.chars} chars):`
                    : 'Previous JSON:',
                  cappedPreviousJson.text
                ].join('\n')
              })
              response = await runJsonRequest(planMessages, {
                stage: 'component_plan',
                repair: true,
                sectionCount: pageMap.sections.length,
                promptTokensEstimate: estimateMessageTokens(planMessages),
                candidateTypeCount: planCandidateTypes.size,
                candidateTypes: Array.from(planCandidateTypes).sort(),
                pageMapBytes: JSON.stringify(planPayload).length,
                fillBatchConcurrency: DetectionConfig.fillBatchConcurrency
              })
              planRequestCount++
              planUsage = response.usage ? { ...response.usage } : {}
              rawResult = response.choices[0]?.message?.content || ''
              return parsePlan(response, rawResult, planRequestCount)
            }
          }, plan => ({
            requestCount: planRequestCount,
            plannedSectionCount: plan?.sections.length ?? 0,
            plannedComponentCount: plan?.sections.reduce((sum, section) => sum + section.plannedComponents.length, 0) ?? 0,
            promptTokensEstimate: planPromptTokensEstimate,
            candidateTypeCount: planCandidateTypes.size,
            pageMapBytes: JSON.stringify(planPayload).length,
            fillBatchConcurrency: DetectionConfig.fillBatchConcurrency,
            planSchemaVersion: DetectionConfig.planSchemaVersion
          }))
          addTokenUsage(usageTotals, planUsage)
          requestCount += planRequestCount
          if (componentPlan.pageMetadata) {
            results.push({
              artifact: {
                sectionKey: '__page_plan_metadata__',
                sectionOrder: Number.MAX_SAFE_INTEGER,
                components: [],
                pageMetadata: componentPlan.pageMetadata
              },
              pageSummary,
              usage: {},
              requestCount: 0,
              reuse: { freshSections: 0, reusedSections: 0, cacheHits: 0, cacheMisses: 0 }
            })
          }
          if (checkpointSession && checkpointService) {
            await checkpointService.saveAggregated(
              checkpointSession,
              checkpointArtifactKey('component-plan', url),
              componentPlan
            ).catch(error => {
              console.warn('[Checkpoint] Failed to save component-plan artifact:', error)
            })
          }

          const emptyArtifacts = componentPlan.sections
            .filter(section => section.plannedComponents.length === 0)
            .map(section => {
              const mapSection = pageMap.sections.find(candidate => candidate.sectionKey === section.sectionKey)
              return {
                artifact: {
                  sectionKey: section.sectionKey,
                  sectionOrder: mapSection?.sectionOrder ?? 0,
                  components: []
                },
                pageSummary,
                usage: {},
                requestCount: 0,
                reuse: { freshSections: 0, reusedSections: 0, cacheHits: 0, cacheMisses: 0 }
              } satisfies SectionProcessingResult
            })
          results.push(...emptyArtifacts)

          const batches = buildFillBatches({
            pageMap,
            plan: componentPlan,
            maxPromptTokens: DetectionConfig.fillBatchMaxPromptTokens,
            maxSections: DetectionConfig.fillBatchMaxSections,
            maxComponents: DetectionConfig.fillBatchMaxComponents,
            evidenceSiblingWindow: DetectionConfig.fillEvidenceSiblingWindow,
            estimateTokens: value => estimateTextTokens(JSON.stringify(value))
          })
          const fillBatchOutcomes = await mapSettledWithConcurrency(batches, DetectionConfig.fillBatchConcurrency, async batch => {
            const queueStartedAt = performance.now()
            const { prompt: catalogPrompt, components: fillComponents } = await buildFillPromptFromCatalog({
              telemetry,
              pageUrl: url,
              candidateTypes: new Set(batch.candidateTypes),
              model: endpointModel,
              provider: `${OpenRouterConfig.baseUrl}|${ModelConfig.allowedProvider || 'any'}`
            })
            const fillPayload = {
              url,
              finalUrl: preFlightFetch.finalUrl,
              groupKey: batch.groupKey,
              schemaVersion: DetectionConfig.fillSchemaVersion,
              sourceSectionKeys: batch.sectionKeys,
              componentContract: batch.plannedComponents.map(component => ({
                plannedComponentId: component.plannedComponentId,
                component: component.component
              })),
              outputSkeleton: batch.sectionKeys.map(sectionKey => ({
                sectionKey,
                components: batch.plannedComponents
                  .filter(component => componentPlan.sections.some(section =>
                    section.sectionKey === sectionKey &&
                    section.plannedComponents.some(planned => planned.plannedComponentId === component.plannedComponentId)
                  ))
                  .map(component => ({
                    plannedComponentId: component.plannedComponentId,
                    component: component.component,
                    confidence: component.confidence,
                    content: {}
                  }))
              })),
              plannedComponents: batch.plannedComponents,
              sourcePackets: batch.sourcePackets
            }
            const fillMessages: ChatCompletionMessageParam[] = [
              {
                role: 'system',
                content: [
                  'You are a component content fill engine.',
                  'Return only valid JSON with a "sections" array.',
                  'Return one section object for each sourceSectionKeys value. sectionKey must be one of sourceSectionKeys, never groupKey.',
                  'Use outputSkeleton as the exact output shape. Copy every sectionKey, plannedComponentId, and component from outputSkeleton.',
                  'The componentContract list is authoritative. For each plannedComponentId, copy the exact component value from componentContract.',
                  'Use only the provided plannedComponentId values. Do not add, remove, rename, or change component types.',
                  'Extract content only from the provided sourcePackets. Do not invent copy, URLs, images, dates, categories, or placeholder content.',
                  'When sourcePackets include bgColor evidence for a visible component surface, preserve that source CSS color in the component style fields supported by its schema; do not infer colors from brand palette.',
                  'Each output component must include plannedComponentId, component, confidence, and content.',
                  'Every MediaReference image src must include mediaId, mediaType: "image", and url.',
                  'All same-site or relative SmartLink values must include type: "internal", pageId, and path.',
                  'Never emit placeholder CTA/button values. Omit optional CTA/button fields when label or href is missing.',
                  'cta-simple secondaryButton is optional. Include it only when the source shows a second visible CTA with non-empty label and valid href.',
                  'card-grid.cards[].href must be a SmartLink directly, never { text, href }, link, or url.',
                  'Feature item link objects must use { text, href: SmartLink }, never link.url.',
                  'logo-cloud.logos[] items must include id plus Image fields src, alt, and originalUrl when available.',
                  'headingLevel must be a number 1, 2, 3, 4, 5, or 6; never return strings like "h2".'
                ].join('\n')
              },
              {
                role: 'system',
                content: catalogPrompt
              },
              {
                role: 'user',
                content: `Fill this planned component batch:\n${JSON.stringify(fillPayload)}`
              }
            ]
            const fillPromptTokensEstimate = estimateMessageTokens(fillMessages)
            let fillRequestCount = 0
            let fillUsage: TokenUsage = {}
            let fillRepairCount = 0
            const fillPayloadBytes = JSON.stringify(fillPayload).length
            const fillResult = await telemetry.timePhase('fill_batch', async () => {
              const parseFill = (response: ChatCompletion, rawResult: string, requestCountForError: number) => {
                const completionStatus = detectIncompleteJson(rawResult)
                const finishReason = response.choices[0]?.finish_reason || ''
                if (!completionStatus.isComplete || finishReason === 'length') {
                  throw new DetectionFailureError(
                    `FillBatch ${batch.groupKey} exceeded output limit or returned incomplete JSON (${completionStatus.reason || 'finish_reason_length'}; finish_reason=${finishReason || 'unknown'})`,
                    {
                      model: endpointModel,
                      stage: 'output_limit',
                      rawResponse: rawResult,
                      rawResponseLength: rawResult.length,
                      finishReason,
                      usage: response.usage ? { ...response.usage } : {},
                      validationPath: completionStatus.reason,
                      requestCount: requestCountForError,
                      promptTokensEstimate: fillPromptTokensEstimate,
                      groupKey: batch.groupKey,
                      sectionKey: batch.sectionKeys.join(','),
                      effectiveCompletionTokens: Math.max(0, CONTEXT_BUDGET - fillPromptTokensEstimate)
                    }
                  )
                }
                try {
                  return parseFillBatchResponse({
                    rawResponse: rawResult,
                    batch,
                    plan: componentPlan,
                    pageMap,
                    availableComponents: fillComponents,
                    url,
                    confidenceThreshold
                  })
                } catch (error) {
                  throw new DetectionFailureError(error instanceof Error ? error.message : String(error), {
                    model: endpointModel,
                    stage: 'validation',
                    rawResponse: rawResult,
                    rawResponseLength: rawResult.length,
                    finishReason,
                    usage: response.usage ? { ...response.usage } : {},
                    validationPath: extractValidationPath(error instanceof Error ? error.message : String(error)),
                    requestCount: requestCountForError,
                    promptTokensEstimate: fillPromptTokensEstimate,
                    groupKey: batch.groupKey,
                    sectionKey: batch.sectionKeys.join(','),
                    effectiveCompletionTokens: Math.max(0, CONTEXT_BUDGET - fillPromptTokensEstimate)
                  })
                }
              }

              let response = await runJsonRequest(fillMessages, {
                stage: 'fill_batch',
                groupKey: batch.groupKey,
                sourceSectionKeys: batch.sectionKeys,
                plannedComponentCount: batch.plannedComponents.length,
                promptTokensEstimate: fillPromptTokensEstimate,
                sourcePacketCount: batch.sourcePacketCount,
                originalPacketBytes: batch.originalPacketBytes,
                scopedPacketBytes: batch.scopedPacketBytes,
                contractPromptBytes: catalogPrompt.length,
                fillPayloadBytes,
                splitReason: batch.splitReason,
                candidateTypeCount: batch.candidateTypes.length,
                candidateTypes: batch.candidateTypes,
                fillBatchConcurrency: DetectionConfig.fillBatchConcurrency
              })
              fillRequestCount++
              addTokenUsage(fillUsage, response.usage ? { ...response.usage } : {})
              let rawResult = response.choices[0]?.message?.content || ''
              try {
                return parseFill(response, rawResult, fillRequestCount)
              } catch (firstError) {
                if (firstError instanceof DetectionFailureError && firstError.debug.stage === 'output_limit') {
                  throw firstError
                }
                const cappedPreviousJson = capRepairPreviousJson(rawResult)
                fillMessages.push({
                  role: 'user',
                  content: [
                    'Your previous FillBatch JSON failed strict validation.',
                    `Validation error: ${firstError instanceof Error ? firstError.message : String(firstError)}`,
                    `Authoritative componentContract: ${JSON.stringify(fillPayload.componentContract)}`,
                    `Exact outputSkeleton to copy before filling content: ${JSON.stringify(fillPayload.outputSkeleton)}`,
                    'Repair schema shape only. Copy every plannedComponentId and component from outputSkeleton. Do not add planned IDs, remove planned IDs, change section keys, change component types, or invent content.',
                    cappedPreviousJson.capped
                      ? `Previous JSON excerpt (capped to ${cappedPreviousJson.chars} chars):`
                      : 'Previous JSON:',
                    cappedPreviousJson.text
                  ].join('\n')
                })
                response = await runJsonRequest(fillMessages, {
                  stage: 'fill_batch',
                  groupKey: batch.groupKey,
                  repair: true,
                  sourceSectionKeys: batch.sectionKeys,
                  plannedComponentCount: batch.plannedComponents.length,
                  promptTokensEstimate: estimateMessageTokens(fillMessages),
                  sourcePacketCount: batch.sourcePacketCount,
                  originalPacketBytes: batch.originalPacketBytes,
                  scopedPacketBytes: batch.scopedPacketBytes,
                  contractPromptBytes: catalogPrompt.length,
                  fillPayloadBytes,
                  splitReason: batch.splitReason,
                  candidateTypeCount: batch.candidateTypes.length,
                  candidateTypes: batch.candidateTypes,
                  fillBatchConcurrency: DetectionConfig.fillBatchConcurrency
                })
                fillRequestCount++
                fillRepairCount++
                addTokenUsage(fillUsage, response.usage ? { ...response.usage } : {})
                rawResult = response.choices[0]?.message?.content || ''
                return parseFill(response, rawResult, fillRequestCount)
              }
            }, result => ({
              groupKey: batch.groupKey,
              sourceSectionKeys: batch.sectionKeys,
              requestCount: fillRequestCount,
              repairCount: fillRepairCount,
              plannedComponentCount: batch.plannedComponents.length,
              componentCount: result?.artifacts.reduce((sum, artifact) => sum + artifact.components.length, 0) ?? 0,
              promptTokensEstimate: fillPromptTokensEstimate,
              sourcePacketCount: batch.sourcePacketCount,
              originalPacketBytes: batch.originalPacketBytes,
              scopedPacketBytes: batch.scopedPacketBytes,
              contractPromptBytes: catalogPrompt.length,
              fillPayloadBytes,
              splitReason: batch.splitReason,
              candidateTypeCount: batch.candidateTypes.length,
              candidateTypes: batch.candidateTypes,
              fillBatchConcurrency: DetectionConfig.fillBatchConcurrency,
              totalTokens: fillUsage.total_tokens ?? 0,
              promptTokens: fillUsage.prompt_tokens ?? 0,
              completionTokens: fillUsage.completion_tokens ?? 0,
              totalCost: fillUsage.total_cost ?? 0,
              batchWorkerElapsedMs: Math.round(performance.now() - queueStartedAt),
              fillSchemaVersion: DetectionConfig.fillSchemaVersion
            }))
            return { batch, fillResult, fillUsage, fillRequestCount, fillPromptTokensEstimate, fillRepairCount }
          })

          for (const outcome of fillBatchOutcomes) {
            if (!outcome.ok) continue
            const { batch, fillResult, fillUsage, fillRequestCount, fillPromptTokensEstimate } = outcome.result
            addTokenUsage(usageTotals, fillUsage)
            requestCount += fillRequestCount
            for (const artifact of fillResult.artifacts) {
              const sourceSectionPackets = pageMap.sections.find(section => section.sectionKey === artifact.sectionKey)?.packets
              enrichNavbarRowStylesFromEvidence(artifact.components, sourceSectionPackets)
              telemetry.recordPhase('section_extract', 0, {
                sectionKey: artifact.sectionKey,
                sectionOrder: artifact.sectionOrder,
                role: pageMap.sections.find(section => section.sectionKey === artifact.sectionKey)?.role,
                extractionMode: 'page-map-fill',
                cacheHit: false,
                requestCount: fillRequestCount,
                promptTokensEstimate: fillPromptTokensEstimate,
                groupKey: batch.groupKey,
                componentCount: artifact.components.length
              })
              results.push({
                artifact,
                pageSummary,
                usage: {},
                requestCount: 0,
                reuse: { freshSections: 1, reusedSections: 0, cacheHits: 0, cacheMisses: 0 }
              })
              if (checkpointSession && checkpointService) {
                await checkpointService.saveSectionResult(
                  checkpointSession,
                  url,
                  artifact.sectionKey,
                  artifact.sectionOrder,
                  artifact.components,
                  artifact.durationMs ?? 0,
                  artifact.pageMetadata,
                  {
                    model: endpointModel,
                    stage: 'llm_call',
                    finishReason: 'page_map_fill',
                    usage: fillUsage,
                    requestCount: fillRequestCount,
                    toolCallCount: 0,
                    promptTokensEstimate: fillPromptTokensEstimate,
                    effectiveCompletionTokens: Math.max(0, CONTEXT_BUDGET - fillPromptTokensEstimate),
                    sectionKey: artifact.sectionKey,
                    sectionOrder: artifact.sectionOrder,
                    extractionMode: 'fresh',
                    invalidComponents: artifact.invalidComponents,
                    invalidComponentReasons: summarizeInvalidComponents(artifact.invalidComponents),
                    invalidComponentCount: artifact.invalidComponents?.length
                  }
                ).catch(error => {
                  console.warn('[Checkpoint] Failed to save page-map fill section result:', error)
                })
              }
            }
            if (fillResult.pageMetadata) {
              results.push({
                artifact: {
                  sectionKey: `${batch.groupKey}:metadata`,
                  sectionOrder: Number.MAX_SAFE_INTEGER,
                  components: [],
                  pageMetadata: fillResult.pageMetadata
                },
                pageSummary,
                usage: {},
                requestCount: 0,
                reuse: { freshSections: 0, reusedSections: 0, cacheHits: 0, cacheMisses: 0 }
              })
            }
            if (checkpointSession && checkpointService) {
              await checkpointService.saveAggregated(
                checkpointSession,
                checkpointArtifactKey(`fill-batch-${batch.groupKey.replace(/[^a-z0-9_-]/gi, '-')}`, url),
                { batch, result: fillResult }
              ).catch(error => {
                console.warn('[Checkpoint] Failed to save fill-batch artifact:', error)
              })
            }
          }

          const failedFillBatches = fillBatchOutcomes.filter((outcome): outcome is Extract<typeof outcome, { ok: false }> => !outcome.ok)
          if (failedFillBatches.length > 0) {
            const firstFailure = failedFillBatches[0]
            const message = firstFailure.error instanceof Error ? firstFailure.error.message : String(firstFailure.error)
            const debug = firstFailure.error instanceof DetectionFailureError
              ? firstFailure.error.debug
              : {
                  model: endpointModel,
                  stage: 'validation' as const
                }
            throw new DetectionFailureError(
              `Page-map fill failed for ${firstFailure.item.groupKey} (${firstFailure.item.sectionKeys.join(', ')}): ${message}${failedFillBatches.length > 1 ? `; ${failedFillBatches.length - 1} additional fill batch failure(s)` : ''}`,
              {
                ...debug,
                model: debug.model ?? endpointModel,
                groupKey: firstFailure.item.groupKey,
                sectionKey: firstFailure.item.sectionKeys.join(','),
                promptTokensEstimate: debug.promptTokensEstimate ?? firstFailure.item.promptTokensEstimate
              }
            )
          }

          return results.sort((a, b) => a.artifact.sectionOrder - b.artifact.sectionOrder)
        })()
      : await mapWithConcurrency(tasks, sectionConcurrency, processSectionTask)
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
    const pageTemplate = this.selectPageTemplate(pageSummary, url, components)
    const pageMetadata = this.mergePageMetadata(this.buildPageMetadataFromHead(preFlightFetch.headMeta), artifacts)
    const accuracy = components.length === 0
      ? 0
      : Math.min(1, components.filter(component => component.confidence >= ConfidenceConfig.highConfidence).length / Math.min(components.length, 10))
    const promptTokens = usageTotals.prompt_tokens || 0
    const completionTokens = usageTotals.completion_tokens || 0
    const reasoningTokens = usageTotals.reasoning_tokens || 0
    const tokenUsage = usageTotals.total_tokens || 0
    const cost = usageTotals.total_cost || (await calculateCost(displayModel, promptTokens, completionTokens, reasoningTokens))
    const detectionResult: ImportDetectionResult = {
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
      outlineSections: preFlightFetch.sections,
      timingBreakdown: buildTimingBreakdown(telemetry.getPhaseRecords(), Date.now() - startTime),
      sourceHttpStatus: preFlightFetch.status,
      sourceFinalUrl: preFlightFetch.finalUrl
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
          model: providedModel,
          apiKey: providedApiKey,
          baseUrl = OpenRouterConfig.baseUrl  // TKT-065: Use config (supports xAI direct)
        } = options
        const model = providedModel || ModelConfig.primary
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
            sectionCount: result?.sections?.length ?? 0,
            handle: result?.handle
          })
        )
        if (preFlightFetch.handle) {
          handlesUsed.add(preFlightFetch.handle)
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
          modelMaxTokens,
          telemetry,
          webTools,
          preFlightFetch,
          handlesUsed,
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
