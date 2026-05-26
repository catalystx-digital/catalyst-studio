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
import { buildDetectionPromptFromCatalog } from './detection/prompt-builder'
import { parseDetectionResponse, parseSectionDetectionResponse } from './detection/response-parser'
import { buildDetectionSectionPlan, type DetectionSectionTask } from './detection/section-plan'
import { aggregateSectionArtifacts, type SectionExtractionArtifact } from './detection/section-aggregation'
import { classifySectionIntent } from './detection/section-taxonomy'
import type { DetectedComponent, DetectedPageTemplate, DetectionPromptPayload, ImportDetectionOptions, ImportDetectionResult, InvalidDetectedComponent, PageMetadata } from './detection/types'
import { traceMemory } from './utils/memory-trace'
import { createDetectionTelemetry } from './telemetry/detection-telemetry'
import type { DetectionTelemetry } from './telemetry/detection-telemetry'
import { applyAllowedProviders, createLLMClient, validateLLMApiKey } from './services/llm-client'
import { getReasoningConfig, calculateCost, getModelMaxCompletionTokens } from './openrouter-models'
import {
  ModelConfig,
  TokenConfig,
  TimeoutConfig,
  ConfidenceConfig,
  LoggingConfig,
  OpenRouterConfig
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
  sectionApproxBytes?: number
  parserRepair?: 'missing_section_key_injected'
  missingSectionKey?: boolean
  repairPromptCapped?: boolean
  repairPromptPreviousJsonChars?: number
  invalidComponents?: InvalidDetectedComponent[]
  invalidComponentCount?: number
}

export class DetectionFailureError extends Error {
  readonly debug: DetectionFailureDebug

  constructor(message: string, debug: DetectionFailureDebug) {
    super(message)
    this.name = 'DetectionFailureError'
    this.debug = debug
  }
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
      checkpointService
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

    const runJsonRequest = async (messages: ChatCompletionMessageParam[]): Promise<ChatCompletion> => {
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
          totalTokens: response?.usage?.total_tokens ?? 0,
          promptTokens: response?.usage?.prompt_tokens ?? 0,
          completionTokens: response?.usage?.completion_tokens ?? 0
        })
      )
    }

    for (const task of tasks) {
      const sectionStart = Date.now()
      const cached = checkpointSession && checkpointService
        ? await checkpointService.loadSectionResult(checkpointSession, url, task.sectionKey)
        : null
      if (cached) {
        artifacts.push({
          sectionKey: cached.sectionKey,
          sectionOrder: cached.sectionOrder,
          components: cached.components,
          pageMetadata: cached.pageMetadata
        })
        continue
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
        if (task.role === 'header') candidateTypes.add('navbar')
        if (task.role === 'footer') candidateTypes.add('footer')

        const { prompt: catalogPrompt, components, pageSummary } = await buildDetectionPromptFromCatalog({
          telemetry,
          pageUrl: url,
          candidateTypes
        })
        pageSummaryForAssembly = pageSummary
        const allowedComponentTypes = components.map(component => component.type).sort()
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
          nodes: section.slice
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
              'Use content-feed only for real dated news/blog/article/resource teaser listings.',
              'Every image.src MediaReference object must include mediaId, mediaType: "image", and url.',
              'card-grid.cards[] links must use href, never link or url.',
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
                requestCount: requestCount + 1,
                toolCallCount: 0,
                promptTokensEstimate: sectionPromptTokensEstimate,
                effectiveCompletionTokens: Math.max(0, CONTEXT_BUDGET - sectionPromptTokensEstimate),
                sectionKey: task.sectionKey,
                sectionOrder: task.sectionOrder,
                sectionApproxBytes,
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
              allowMissingSectionKey: true,
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
              requestCount: requestCount + 1,
              toolCallCount: 0,
              promptTokensEstimate: sectionPromptTokensEstimate,
              effectiveCompletionTokens: Math.max(0, CONTEXT_BUDGET - sectionPromptTokensEstimate),
              sectionKey: task.sectionKey,
              sectionOrder: task.sectionOrder,
              sectionApproxBytes,
              ...(responseMissingSectionKey(rawResult)
                ? {
                    parserRepair: 'missing_section_key_injected' as const,
                    missingSectionKey: true
                  }
                : {}),
              ...extraDebug
            })
          }
        }

        let response = await runJsonRequest(messages)
        requestCount++
        let rawResult = response.choices[0]?.message?.content || ''
        let parsedSection
        let repairDebug: Partial<DetectionFailureDebug> = {}
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
          response = await runJsonRequest(messages)
          requestCount++
          rawResult = response.choices[0]?.message?.content || ''
          parsedSection = parseOutcome(response, rawResult, repairDebug, true)
        }

        if (task.required && section.stats.nodeCount > 0 && parsedSection.components.length === 0) {
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
              requestCount,
              toolCallCount: 0,
              promptTokensEstimate: sectionPromptTokensEstimate,
              effectiveCompletionTokens: Math.max(0, CONTEXT_BUDGET - sectionPromptTokensEstimate),
              sectionKey: task.sectionKey,
              sectionOrder: task.sectionOrder,
              sectionApproxBytes,
              invalidComponents: parsedSection.invalidComponents,
              invalidComponentCount: parsedSection.invalidComponents?.length,
              ...repairDebug
            }
          )
        }

        const responseUsage: TokenUsage = response.usage ? { ...response.usage } : {}
        usageTotals.total_tokens = (usageTotals.total_tokens ?? 0) + (responseUsage.total_tokens ?? 0)
        usageTotals.prompt_tokens = (usageTotals.prompt_tokens ?? 0) + (responseUsage.prompt_tokens ?? 0)
        usageTotals.completion_tokens = (usageTotals.completion_tokens ?? 0) + (responseUsage.completion_tokens ?? 0)
        usageTotals.reasoning_tokens = (usageTotals.reasoning_tokens ?? 0) + ((responseUsage as TokenUsage).reasoning_tokens ?? 0)
        usageTotals.total_cost = (usageTotals.total_cost ?? 0) + ((responseUsage as TokenUsage).total_cost ?? 0)

        const artifact: SectionExtractionArtifact = {
          sectionKey: task.sectionKey,
          sectionOrder: task.sectionOrder,
          components: parsedSection.components,
          pageMetadata: parsedSection.pageMetadata,
          invalidComponents: parsedSection.invalidComponents
        }
        artifacts.push(artifact)

        if (checkpointSession && checkpointService) {
          await checkpointService.saveSectionResult(
            checkpointSession,
            url,
            task.sectionKey,
            task.sectionOrder,
            parsedSection.components,
            Date.now() - sectionStart,
            parsedSection.pageMetadata,
            {
              model: endpointModel,
              stage: 'llm_call',
              rawResponseLength: rawResult.length,
              rawResponse: rawResult,
              finishReason: response.choices[0]?.finish_reason || 'unknown',
              usage: responseUsage,
              requestCount,
              toolCallCount: 0,
              promptTokensEstimate: sectionPromptTokensEstimate,
              effectiveCompletionTokens: Math.max(0, CONTEXT_BUDGET - sectionPromptTokensEstimate),
              sectionKey: task.sectionKey,
              sectionOrder: task.sectionOrder,
              sectionApproxBytes,
              invalidComponents: parsedSection.invalidComponents,
              invalidComponentCount: parsedSection.invalidComponents?.length,
              ...(responseMissingSectionKey(rawResult)
                ? {
                    parserRepair: 'missing_section_key_injected' as const,
                    missingSectionKey: true
                  }
                : {}),
              ...repairDebug
            }
          )
        }

        // Build once per first uncached section to keep template catalog available for assembly.
        void pageSummary
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
              invalidComponents: error.debug.invalidComponents,
              invalidComponentCount: error.debug.invalidComponentCount,
              parserRepair: error.debug.parserRepair,
              missingSectionKey: error.debug.missingSectionKey,
              repairPromptCapped: error.debug.repairPromptCapped,
              repairPromptPreviousJsonChars: error.debug.repairPromptPreviousJsonChars
            } : undefined
          )
        }
        throw error
      }
    }

    const pageSummary = pageSummaryForAssembly ?? (await buildDetectionPromptFromCatalog({ telemetry, pageUrl: url })).pageSummary
    const components = aggregateSectionArtifacts(tasks, artifacts)
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
      cost
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

        // Early redirect detection: Check for redirects before expensive LLM detection
        // This saves tokens by detecting redirect pages (external redirects, meta refresh, JS redirects)
        const webTools = getWebFetchTools()
        const preFlightFetch = await webTools.fetchOutline({ url, stripScriptsStyles: true, collapseWhitespace: true })
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

        const {
          model: providedModel,
          apiKey: providedApiKey,
          baseUrl = OpenRouterConfig.baseUrl,  // TKT-065: Use config (supports xAI direct)
          includeContent = true,
          confidenceThreshold = CONFIDENCE_THRESHOLD
        } = options
        const model = providedModel || ModelConfig.primary

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

        const telemetry = createDetectionTelemetry({ url, model })

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
