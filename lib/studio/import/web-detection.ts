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
  ChatCompletionAssistantMessageParam,
  ChatCompletionMessageParam,
  ChatCompletionTool
} from 'openai/resources/chat/completions'
import { getWebFetchTools } from './services/web-tools'
import { isAssetUrl } from './services/sitemap-discovery.service'
import { buildDetectionPromptFromCatalog } from './detection/prompt-builder'
import { parseDetectionResponse } from './detection/response-parser'
import type { DetectedComponent, ImportDetectionOptions, ImportDetectionResult } from './detection/types'
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
  DetectionConfig,
  OpenRouterConfig,
  WebToolsConfig
} from './config'
import { safeStringify } from './utils/json-parsing'

// Use centralized config values
const LOG_WEB_TOOL_INPUT = LoggingConfig.logWebToolInput
const LOG_WEB_TOOL_OUTPUT = LoggingConfig.logWebToolOutput
const MAX_LOG_LENGTH = LoggingConfig.maxLogLength

function truncateForLog(value: unknown): string {
  const serialized = safeStringify(value)
  if (!Number.isFinite(MAX_LOG_LENGTH) || MAX_LOG_LENGTH <= 0) {
    return serialized
  }
  return serialized.length > MAX_LOG_LENGTH
    ? `${serialized.slice(0, MAX_LOG_LENGTH)}.[truncated ${serialized.length - MAX_LOG_LENGTH} chars]`
    : serialized
}

function logWebToolCall(
  phase: 'INPUT' | 'OUTPUT' | 'ERROR',
  name: string,
  payload: unknown
): void {
  const shouldLog =
    (phase === 'INPUT' && LOG_WEB_TOOL_INPUT) ||
    (phase === 'OUTPUT' && LOG_WEB_TOOL_OUTPUT) ||
    (phase === 'ERROR' && (LOG_WEB_TOOL_INPUT || LOG_WEB_TOOL_OUTPUT))

  if (!shouldLog) {
    return
  }
  console.log(`[ImportWebTool][${phase}] ${name}: ${truncateForLog(payload)}`)
}

function selectForceFetchSections(sectionKeys: string[], fetchedKeys: Set<string>, limit: number): string[] {
  const missing = sectionKeys.filter(key => !fetchedKeys.has(key))
  if (limit <= 0 || missing.length <= limit) return missing.slice(0, Math.max(0, limit))

  const selected: string[] = []
  const footer = missing.find(key => key.toLowerCase().includes('footer'))
  const header = missing.find(key => key.toLowerCase().includes('header'))
  if (header) selected.push(header)

  const reserveFooter = footer && !selected.includes(footer) ? 1 : 0
  const mainLimit = Math.max(0, limit - selected.length - reserveFooter)
  for (const key of missing) {
    if (selected.length >= limit - reserveFooter) break
    if (key === header || key === footer) continue
    if (key.toLowerCase().includes('main') || selected.length < mainLimit) {
      selected.push(key)
    }
  }
  for (const key of missing) {
    if (selected.length >= limit - reserveFooter) break
    if (!selected.includes(key) && key !== footer) selected.push(key)
  }
  if (footer && selected.length < limit && !selected.includes(footer)) selected.push(footer)
  return selected.slice(0, limit)
}

// Use centralized configuration
const CONFIDENCE_THRESHOLD = ConfidenceConfig.detection
const TEMPERATURE = ModelConfig.temperature.detection
const DEFAULT_DETECTION_MODEL = ModelConfig.primary
const CONTEXT_BUDGET = TokenConfig.contextBudget
const MIN_COMPLETION_BUDGET = TokenConfig.minCompletionBudget
const USER_MAX_TOKENS = TokenConfig.maxCompletionTokens // User's requested max (from env)
const REQUEST_TIMEOUT_MS = TimeoutConfig.perRequestMs
const TOOL_LOOP_GUARD = DetectionConfig.toolLoopGuard
const MAX_FORCE_FETCH_SECTIONS = WebToolsConfig.maxForceFetchSections

let registryInitialization: Promise<void> | null = null

/**
 * Extended tool call with vendor-specific fields (e.g., Gemini thought_signature).
 */
interface ExtendedToolCall {
  id: string
  type: string
  function: {
    name: string
    arguments: string
  }
  extra_content?: Record<string, unknown>
}

/**
 * Extended assistant message with vendor-specific fields.
 * Extends OpenAI types to include Gemini reasoning_details, etc.
 */
interface ExtendedAssistantMessage {
  role: 'assistant'
  content?: string | null
  tool_calls?: ExtendedToolCall[]
  refusal?: string | null
  audio?: unknown
  reasoning_details?: unknown
  function_call?: {
    name: string
    arguments: string
  }
  name?: string
}

/**
 * Arguments for web tool function calls.
 */
interface WebToolArgs {
  url?: string
  handle?: string
  selector?: string
  stripScriptsStyles?: boolean
  collapseWhitespace?: boolean
  [key: string]: unknown
}

/**
 * LLM chat completion request payload.
 */
interface LLMRequestPayload {
  model: string
  messages: ChatCompletionMessageParam[]
  temperature: number
  max_tokens: number
  tools?: ChatCompletionTool[]
  response_format?: { type: 'json_object' }
  reasoning?: Record<string, unknown>
  [key: string]: unknown
}

/**
 * Message content chunk types for multi-modal messages.
 */
interface TextContentChunk {
  type: 'text'
  text: string
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

interface ConversationOutcome {
  rawResult: string
  response: ChatCompletion
  usage: TokenUsage
  requestCount: number
  toolCallCount: number
}

interface ConversationParams {
  createRequest: (useJsonMode: boolean, disallowTools?: boolean) => Promise<ChatCompletion>
  withTimeout: <T>(promise: Promise<T>) => Promise<T>
  initialJsonMode: boolean
  telemetry: DetectionTelemetry
  webTools: ReturnType<typeof getWebFetchTools>
  handlesUsed: Set<string>
  url: string
  messages: ChatCompletionMessageParam[]
}

function estimateMessageTokens(messages: ChatCompletionMessageParam[]): number {
  const CHAR_PER_TOKEN = 4
  let totalChars = 0
  for (const message of messages) {
    if (!message?.content) continue
    if (typeof message.content === 'string') {
      totalChars += message.content.length
      continue
    }
    if (Array.isArray(message.content)) {
      for (const chunk of message.content as unknown[]) {
        if (!chunk) continue
        if (typeof chunk === 'string') {
          totalChars += chunk.length
        } else if (chunk && typeof chunk === 'object' && 'text' in chunk && typeof (chunk as { text?: unknown }).text === 'string') {
          totalChars += ((chunk as { text: string }).text).length
        }
      }
    }
  }
  return Math.max(1, Math.ceil(totalChars / CHAR_PER_TOKEN))
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

function clampCompletionTokens(
  model: string,
  messages: ChatCompletionMessageParam[],
  requested: number
): number {
  const promptTokens = estimateMessageTokens(messages)
  const available = Math.max(MIN_COMPLETION_BUDGET, CONTEXT_BUDGET - promptTokens)
  if (requested <= available) {
    return requested
  }
  const clamped = Math.max(MIN_COMPLETION_BUDGET, available)
  console.warn(
    `[DetectionService] Reducing max_tokens from ${requested} to ${clamped} for ${model} (prompt≈${promptTokens} tokens, budget=${CONTEXT_BUDGET}).`
  )
  return clamped
}

async function runDetectionConversation(params: ConversationParams): Promise<ConversationOutcome> {
  let requestJsonMode = params.initialJsonMode
  let response = await params.withTimeout(params.createRequest(requestJsonMode))
  let requestCount = 1
  let toolCallCount = 0

  // Track outline and fetched sections to ensure ALL sections are fetched
  let outlineResult: { handle: string; sections: Array<{ key: string }> } | null = null
  const fetchedSectionKeys = new Set<string>()

  const recordAssistantMessage = (completion?: ChatCompletion): void => {
    const assistantMessage = completion?.choices?.[0]?.message
    if (!assistantMessage || assistantMessage.role !== 'assistant') {
      return
    }

    // Cast to extended type that includes vendor-specific fields
    const extendedMsg = assistantMessage as unknown as ExtendedAssistantMessage

    // Log full response structure for debugging Gemini reasoning_details
    if (LoggingConfig.logOutput) {
      console.log('[LLM Response] Full message keys:', Object.keys(extendedMsg))
      if (extendedMsg.reasoning_details) {
        console.log('[LLM Response] reasoning_details:', JSON.stringify(extendedMsg.reasoning_details, null, 2))
      }
      if (extendedMsg.tool_calls?.length) {
        console.log('[LLM Response] First tool_call keys:', Object.keys(extendedMsg.tool_calls[0]))
        console.log('[LLM Response] First tool_call:', JSON.stringify(extendedMsg.tool_calls[0], null, 2))
      }
    }

    // Build message to record with extended fields for Gemini compatibility
    const messageToRecord: ExtendedAssistantMessage = {
      role: 'assistant',
      content: assistantMessage.content ?? ''
    }

    // Preserve reasoning_details if present (required for Gemini 3 Pro multi-turn)
    if (extendedMsg.reasoning_details) {
      messageToRecord.reasoning_details = extendedMsg.reasoning_details
    }

    if (extendedMsg.tool_calls?.length) {
      // Preserve full tool_calls including extra_content for Gemini thought signatures.
      // Gemini 3 Pro returns thought_signature tokens in extra_content.google.thought_signature
      // that must be passed back in subsequent requests for multi-turn tool calling.
      messageToRecord.tool_calls = extendedMsg.tool_calls.map((tc: ExtendedToolCall) => {
        const toolCall: ExtendedToolCall = {
          id: tc.id,
          type: tc.type,
          function: tc.function
        }
        // Preserve extra_content if present (contains Gemini thought_signature)
        if (tc.extra_content) {
          toolCall.extra_content = tc.extra_content
        }
        return toolCall
      })
    }
    if (assistantMessage.refusal) {
      messageToRecord.refusal = assistantMessage.refusal
    }
    if (assistantMessage.audio) {
      messageToRecord.audio = assistantMessage.audio
    }
    if (assistantMessage.function_call) {
      messageToRecord.function_call = assistantMessage.function_call
    }
    if ((assistantMessage as unknown as { name?: string }).name) {
      messageToRecord.name = (assistantMessage as unknown as { name: string }).name
    }
    params.messages.push(messageToRecord as ChatCompletionMessageParam)
  }

  recordAssistantMessage(response)
  let toolCalls = response.choices[0]?.message?.tool_calls
  let guard = 0

  while (Array.isArray(toolCalls) && toolCalls.length > 0 && guard < TOOL_LOOP_GUARD) {
    toolCallCount += toolCalls.length

    for (const tc of toolCalls) {
      if (tc.type !== 'function') {
        continue
      }
      const name = tc.function?.name
      const argsStr = tc.function?.arguments
      if (typeof argsStr !== 'string' || argsStr.trim().length === 0) {
        throw new Error(`Detection tool call ${name || 'unknown'} omitted JSON arguments`)
      }
      let args: WebToolArgs
      try {
        args = JSON.parse(argsStr) as WebToolArgs
      } catch (error) {
        throw new Error(
          `Detection tool call ${name || 'unknown'} returned malformed JSON arguments: ${
            error instanceof Error ? error.message : String(error)
          }`
        )
      }

      try {
        if (name === 'fetch_outline') {
          logWebToolCall('INPUT', name, args)
          const normalizedArgs: WebToolArgs = { ...args }
          if (typeof normalizedArgs.stripScriptsStyles === 'undefined') normalizedArgs.stripScriptsStyles = true
          if (typeof normalizedArgs.collapseWhitespace === 'undefined') normalizedArgs.collapseWhitespace = true
          if (typeof normalizedArgs.url !== 'string' || normalizedArgs.url.trim().length === 0) {
            throw new Error('fetch_outline requires a non-empty url argument')
          }
          const fetchArgs = { ...normalizedArgs, url: normalizedArgs.url }

          const result = await params.telemetry.timePhase('fetch', () => params.webTools.fetchOutline(fetchArgs), fetchResult => ({
            status: fetchResult?.status,
            contentLength: fetchResult?.contentLength ?? 0,
            sectionCount: Array.isArray(fetchResult?.sections) ? fetchResult.sections.length : 0,
            fromCache: Boolean(fetchResult?.fromCache),
            timeout: Boolean(fetchResult?.timeout),
            error: Boolean(fetchResult?.error)
          }))
          if (result?.handle) {
            params.handlesUsed.add(result.handle)
          }
          logWebToolCall('OUTPUT', name, result)
          params.messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result) })

          // Capture outline for tracking which sections need to be fetched
          if (result?.handle && Array.isArray(result?.sections)) {
            outlineResult = { handle: result.handle, sections: result.sections }
            if (LoggingConfig.logOutput) {
              console.log(`[SectionTracker] Outline captured: ${result.sections.length} sections available`)
            }
          }
        } else if (name === 'get_section') {
          logWebToolCall('INPUT', name, args)
          const result = await params.webTools.getSection(args as { handle: string; key: string })
          if (result?.handle) {
            params.handlesUsed.add(result.handle)
          }
          logWebToolCall('OUTPUT', name, result)
          params.messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result) })

          // Track which sections have been fetched
          const sectionKey = (args as { key?: string })?.key
          if (sectionKey) {
            fetchedSectionKeys.add(sectionKey)
            if (LoggingConfig.logOutput) {
              console.log(`[SectionTracker] Section fetched: ${sectionKey} (${fetchedSectionKeys.size} total)`)
            }
          }
        } else {
          params.messages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: JSON.stringify({ error: true, message: `Unknown tool: ${name}` })
          })
        }
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err)
        logWebToolCall('ERROR', name || 'unknown', { args, error: errorMessage })
        params.messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: JSON.stringify({ error: true, message: errorMessage || 'tool error' })
        })
      }
    }

    guard++
    response = await params.withTimeout(params.createRequest(requestJsonMode))
    requestCount++
    recordAssistantMessage(response)
    toolCalls = response.choices[0]?.message?.tool_calls
  }

  // FORCE-FETCH MISSING SECTIONS: Ensure ALL sections from outline are fetched
  // This prevents LLM from prematurely stopping and missing page content
  if (outlineResult && outlineResult.sections.length > 0) {
    const allSectionKeys = outlineResult.sections.map(s => s.key)
    const allMissingSections = allSectionKeys.filter(key => !fetchedSectionKeys.has(key))
    const missingSections = selectForceFetchSections(allSectionKeys, fetchedSectionKeys, MAX_FORCE_FETCH_SECTIONS)

    if (missingSections.length > 0) {
      console.log(`[SectionTracker] LLM skipped ${allMissingSections.length} sections. Force-fetching ${missingSections.length}/${allMissingSections.length}: ${missingSections.join(', ')}`)

      // Generate unique IDs for fake tool calls
      let fakeToolCallId = Date.now()

      for (const sectionKey of missingSections) {
        try {
          const sectionResult = await params.webTools.getSection({
            handle: outlineResult.handle,
            key: sectionKey
          })

          if (sectionResult) {
            // Add fake assistant message requesting this section
            const fakeAssistantMsg: ChatCompletionAssistantMessageParam = {
              role: 'assistant',
              content: null,
              tool_calls: [{
                id: `force_fetch_${fakeToolCallId++}`,
                type: 'function' as const,
                function: {
                  name: 'get_section',
                  arguments: JSON.stringify({ handle: outlineResult.handle, key: sectionKey })
                }
              }]
            }
            params.messages.push(fakeAssistantMsg)

            // Add the tool response
            params.messages.push({
              role: 'tool',
              tool_call_id: fakeAssistantMsg.tool_calls![0].id,
              content: JSON.stringify(sectionResult)
            })

            fetchedSectionKeys.add(sectionKey)
            logWebToolCall('OUTPUT', 'get_section (force-fetched)', { key: sectionKey, stats: sectionResult.stats })
          }
        } catch (err) {
          console.warn(`[SectionTracker] Failed to force-fetch section ${sectionKey}:`, err)
        }
      }

      console.log(`[SectionTracker] Force-fetch complete. Total sections now: ${fetchedSectionKeys.size}/${allSectionKeys.length}`)

      // After force-fetching, we need to ask the LLM to re-analyze with all sections
      // Add a user message prompting re-analysis
      params.messages.push({
        role: 'user',
        content: 'I have fetched additional page sections that were missed. Please analyze ALL the section data provided above and extract components from the ENTIRE page. Make sure to include components from every section, especially any course content, subject lists, curriculum details, or other content that may have been in the later sections.'
      })

      // Make another LLM request with all sections now available
      response = await params.withTimeout(params.createRequest(true, true)) // JSON mode, no tools
      requestCount++
      recordAssistantMessage(response)
    } else {
      if (LoggingConfig.logOutput) {
        console.log(`[SectionTracker] All ${allSectionKeys.length} sections were fetched by LLM`)
      }
    }
  }

  let result = response.choices[0]?.message?.content || ''
  let finishReason = response.choices[0]?.finish_reason || ''

  const completionStatus = detectIncompleteJson(result)
  if (!completionStatus.isComplete) {
    throw new Error(
      `Detection model returned invalid JSON (${completionStatus.reason || 'parse_error'}; finish_reason=${finishReason || 'unknown'})`
    )
  }

  return {
    rawResult: result,
    response,
    usage: response.usage ? { ...response.usage } : {},
    requestCount,
    toolCallCount
  }
}

function summarizeRegistry(stats?: {
  before?: DetectionRegistryStats
  after?: DetectionRegistryStats
  initialized: boolean
  skipped?: boolean
  untracked?: boolean
 }): Record<string, unknown> {
  if (!stats) return {}
  const before = stats.before || { componentCount: 0, patternCacheEntries: 0, catalogCached: false, cacheAgeMs: null }
  const after = stats.after || before
  const delta = after.componentCount - before.componentCount
  return {
    beforeComponentCount: before.componentCount,
    afterComponentCount: after.componentCount,
    registryDelta: delta,
    patternCacheEntries: after.patternCacheEntries,
    catalogCached: after.catalogCached,
    cacheAgeMs: after.cacheAgeMs,
    initialized: stats.initialized,
    skipped: stats.skipped ?? !stats.initialized,
    untracked: stats.untracked ?? false
  }
}

/**
 * Service for detecting components using web-based LLMs
 */
export class DetectionService {
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

        // Release the preflight handle if we're continuing
        if (preFlightFetch.handle) {
          handlesUsed.add(preFlightFetch.handle)
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
        }, stats => summarizeRegistry(stats))

        // Progress: registry seeding complete (step 1 of 4)
        onProgress?.({
          subsystemProgress: { id: 'llm_detection', current: 1, total: 4 },
          message: 'Preparing detection catalog...',
        })

        const { prompt: catalogPrompt, components, pageSummary } = await buildDetectionPromptFromCatalog({ telemetry })

        // Progress: prompt building complete (step 2 of 4)
        onProgress?.({
          subsystemProgress: { id: 'llm_detection', current: 2, total: 4 },
          message: 'Analyzing page with AI...',
        })

        const client = createLLMClient({
          apiKey,
          baseURL: baseUrl,
          referer: url,
          title: 'Catalyst Studio Web Detection'
        })

        const systemMsg: ChatCompletionMessageParam = {
          role: 'system',
          content: [
            'You are a component extraction engine that must use the provided tools to fetch and analyze pages.',
            'Rules:',
            '1) Use tools to fetch page data; do not browse yourself.',
            '2) Preserve strict top-to-bottom order of components in output.',
            '3) For any URL attributes (href/src/etc), extract verbatim as in HTML, including all query params. Do not modify or simplify URLs.',
            '4) Call fetch_outline first; then fetch header/footer and multiple main slices (not just the first) until all visible sections are covered—news/list blocks often sit mid-page.',
            '5) Keep token use low, but never stop before you have inspected enough main slices to capture every rendered section.',
            '6) Apply CONTENT REFERENCE RULES (content[] elements must include a type; single content must include type).',
            '7) Follow TEMPLATE COMPLIANCE guidance to collapse granular fragments into required canonical components (e.g., blog-post, blog-list) before returning JSON.',
            '8) Return only a JSON object with fields "components" and "pageMetadata" as specified.',
            '9) IMPORTANT: DOM nodes may have a "bgImage" field containing a CSS background-image URL. When you see bgImage on a card, section, or container element, use it as the image source (image.src) for that component. This is how decorative images from CSS are exposed.',
            '10) DOM nodes may also have a "bgColor" field containing a CSS background-color in hex format (e.g., "#008ccc"). Use this for card/section styling - cards with distinct bgColor values are likely category cards or visual sections that should preserve their brand color identity. Map bgColor to a theme or accent color in the component props.',
            '11) IMPORTANT: Watch for linked-image + text-block patterns. When you see <a><img src="..."></a> immediately followed by a text container (li, div with text, etc.), these form a SINGLE card. The img.src becomes image.src, the img.alt or text block title becomes the card title. Group these as card-grid cards, NOT separate components.',
            '12) Before finalizing, run this completeness checklist and backfill any gaps:',
            '   - hero-carousel.slides[] lists every visible slide with full copy, media, and CTAs.',
            '   - hero-with-image includes heading, copy, image.src + alt, layout/theme, and ctaButtons[] using the "variant" field (default|secondary|outline|ghost|link|destructive) following shadcn/ui button variants.',
            '   - card-grid.cards[] enumerates each card-item/promo-item with titles, descriptions, media (check for: 1) bgImage field, 2) backgroundColor from bgColor field, 3) sibling/child <img> elements), link/linkText strings, and stable ids (card-item-...). For promo tiles where <a><img></a> precedes a text block, use the img.src as image.src.',
            '   - feature-grid.features[] contains feature-item entries with icon, title, description, and optional link.',
            '   - footer columns[].links[], socialLinks[], and legalLinks[] are populated with nav-menu-item/socialLinkItem objects using stable ids (nav-menu-item-..., social-...) and proper platform/external flags.',
            '   - nav-menu-item entries include id, label, href, external (true/false), and children[] when dropdowns are present; omit summaries that duplicate column copy.',
            '   - cta-with-form includes heading/subheading, placeholder, buttonText, formAction, emailFieldName, success/error messaging, and privacy text/link.',
            '   If any checklist item is missing or empty while the UI renders content, call get_section for the relevant DOM and fix it before responding.'
          ].join('\n')
        }

        const developerMsg: ChatCompletionMessageParam = {
          role: 'system',
          content: [
            catalogPrompt,
            'Use fetch_outline on the URL provided below. Then request get_section for header, footer, and sequential main slices (grab at least the first 6 slices when the outline shows many) until the hero and mid-page content blocks/lists are captured. Obey URL fidelity rules.',
            'When forms, feature grids, or footers appear, explicitly fetch the corresponding sections so you can extract every field (CTA form inputs/actions, feature-item lists, footer columns/social/legal links). Continue requesting sections until the contract outputs are complete, especially for news/resource listings.'
          ].join('\n\n')
        }

        const userMsg: ChatCompletionMessageParam = {
          role: 'user',
          content: `Extract components from: ${url}. Do not rely on memory; use the tools to fetch the page. Then return only the required JSON.`
        }

        const tools: ChatCompletionTool[] = [
          {
            type: 'function',
            function: {
              name: 'fetch_outline',
              description: 'Fetch and preprocess an HTML page, returning head meta, sections, and resources summary.',
              parameters: {
                type: 'object',
                properties: {
                  url: { type: 'string' },
                  UserAgent: { type: 'string' },
                  timeoutMs: { type: 'number' },
                  maxSizeBytes: { type: 'number' },
                  stripScriptsStyles: { type: 'boolean' },
                  collapseWhitespace: { type: 'boolean' }
                },
                required: ['url']
              }
            }
          },
          {
            type: 'function',
            function: {
              name: 'get_section',
              description: 'Return a slice of the preprocessed semantic DOM for a section key.',
              parameters: {
                type: 'object',
                properties: {
                  handle: { type: 'string' },
                  key: { type: 'string' }
                },
                required: ['handle', 'key']
              }
            }
          }
        ]

        const messages: ChatCompletionMessageParam[] = [systemMsg, developerMsg, userMsg]

        if (LoggingConfig.logPrompt) {
          console.log('=== LLM PROMPT (BEGIN) ===')
          console.log(
            messages
              .map(m => `${m.role.toUpperCase()}: ${typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}`)
              .join('\n\n')
          )
          console.log('=== LLM PROMPT (END) ===')
        }

        const createRequest = async (
          useJsonMode: boolean,
          disallowTools: boolean = false
        ): Promise<ChatCompletion> => {
          const payload: LLMRequestPayload = {
            model: endpointModel,
            messages,
            temperature: TEMPERATURE,
            max_tokens: clampCompletionTokens(endpointModel, messages, effectiveMaxTokens)
          }
          if (!disallowTools) {
            payload.tools = tools
          }
          if (useJsonMode) {
            payload.response_format = { type: 'json_object' }
          }
          applyAllowedProviders(payload)

          // Configure reasoning based on model capabilities
          // - Mandatory reasoning models (have reasoning_effort): use { effort: 'low' }
          // - Optional reasoning models: disable with { enabled: false }
          // - Non-reasoning models: don't send param
          const reasoningConfig = await getReasoningConfig(endpointModel)
          if (reasoningConfig) {
            payload.reasoning = reasoningConfig as Record<string, unknown>
          }

          // Log message count and any assistant messages with tool_calls for debugging
          const assistantMsgsWithToolCalls = messages.filter(
            (m): m is ChatCompletionMessageParam & { role: 'assistant'; tool_calls: unknown[] } =>
              m.role === 'assistant' && Array.isArray((m as ExtendedAssistantMessage).tool_calls) && (m as ExtendedAssistantMessage).tool_calls!.length > 0
          )
          if (LoggingConfig.logPrompt || assistantMsgsWithToolCalls.length > 0) {
            console.log(`[LLM Request] Sending ${messages.length} messages, ${assistantMsgsWithToolCalls.length} have tool_calls`)
            assistantMsgsWithToolCalls.forEach((m, i: number) => {
              console.log(`[LLM Request] Assistant message ${i} tool_calls:`, JSON.stringify((m as ExtendedAssistantMessage).tool_calls, null, 2))
            })
          }

          try {
            return await client.chat.completions.create(payload)
          } catch (err: unknown) {
            // Log full error details for debugging
            const errorObj = err as { error?: unknown; message?: string }
            if (errorObj?.error) {
              console.error('[LLM Request Error] Full error object:', JSON.stringify(errorObj.error, null, 2))
            }
            if (errorObj?.message) {
              console.error('[LLM Request Error] Message:', errorObj.message)
            }
            throw err
          }
        }

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

        const normalizedModelId = endpointModel.toLowerCase()
        const hasTools = tools.length > 0
        const shouldDelayJsonMode = hasTools || normalizedModelId.includes('gemini') || normalizedModelId.includes('grok')
        // Reuse webTools from earlier in function (line 450) - avoid redeclaration

        const conversationOutcome = await telemetry.timePhase(
          'llm_call',
          async () =>
            await runDetectionConversation({
              createRequest,
              withTimeout,
              initialJsonMode: !shouldDelayJsonMode,
              telemetry,
              webTools,
              handlesUsed,
              url,
              messages
            }),
          outcome => ({
            requestCount: outcome?.requestCount ?? 0,
            toolCallCount: outcome?.toolCallCount ?? 0,
            totalTokens: outcome?.usage?.total_tokens ?? 0,
            promptTokens: outcome?.usage?.prompt_tokens ?? 0,
            completionTokens: outcome?.usage?.completion_tokens ?? 0,
            handlesTracked: handlesUsed.size
          })
        )

        // Progress: LLM call complete (step 3 of 4)
        onProgress?.({
          subsystemProgress: { id: 'llm_detection', current: 3, total: 4 },
          message: 'Parsing detection results...',
        })

        if (LoggingConfig.logOutput) {
          const totalLen = conversationOutcome.rawResult?.length || 0
          const finishReason = conversationOutcome.response?.choices?.[0]?.finish_reason || 'unknown'
          const usage = conversationOutcome.usage || {}
          console.log(`=== LLM RAW OUTPUT (FULL, length=${totalLen}) ===`)
          console.log(`    finish_reason: ${finishReason}`)
          console.log(`    prompt_tokens: ${usage.prompt_tokens || 0}`)
          console.log(`    completion_tokens: ${usage.completion_tokens || 0}`)
          console.log(`    total_tokens: ${usage.total_tokens || 0}`)
          console.log(`    model_max_completion_tokens: ${modelMaxTokens}`)
          console.log(`    effective_max_tokens: ${effectiveMaxTokens}`)

          if (finishReason === 'length') {
            console.log(`    ⚠️ WARNING: Output truncated due to max_tokens limit!`)
            console.log(`    The model stopped because it hit the completion token limit. Strict detection will reject invalid JSON.`)
          } else if (finishReason === 'stop') {
            console.log(`    ✓ Output completed normally (model sent stop token)`)
          }

          console.log(conversationOutcome.rawResult)
          console.log('=== END LLM RAW OUTPUT ===')
        }

        const parsed = await telemetry.timePhase('canonicalization', () =>
          parseDetectionResponse({
            rawResponse: conversationOutcome.rawResult,
            availableComponents: components,
            pageSummary,
            url,
            confidenceThreshold
          }),
        result => ({
          componentCount: result?.components.length ?? 0,
          templateKey: result?.pageTemplate?.templateKey,
          accuracy: result?.accuracy ?? 0
        }))

        if (LoggingConfig.memoryTrace) {
          const cacheStats = webTools.getCacheStats()
          console.log('[ImportMemory] detect:web-tools-cache', { url, ...cacheStats })
        }

        const usage: TokenUsage = conversationOutcome.usage || {}
        const tokenUsage = usage.total_tokens || 0
        const promptTokens = usage.prompt_tokens || 0
        const completionTokens = usage.completion_tokens || 0
        const reasoningTokens = usage.reasoning_tokens || 0
        const cost =
          usage.total_cost ||
          (await calculateCost(model, promptTokens, completionTokens, reasoningTokens))

        if (LoggingConfig.logOutput) {
          console.log('=== LLM OUTPUT (ORDERED COMPONENTS) ===')
          parsed.components.forEach((c, i) => {
            console.log(`${i + 1}. ${c.component} (type: ${c.type}) confidence=${c.confidence}`)
          })
          console.log('=== END LLM OUTPUT ===')
        }

        const lastFetch = webTools.getLastFetchOutline()
        const detectionResult = {
          components: includeContent
            ? parsed.components
            : parsed.components.map(({ content, ...rest }) => ({ ...rest, content: {} })),
          pageTemplate: parsed.pageTemplate,
          pageMetadata: parsed.pageMetadata,
          processingTime: Date.now() - startTime,
          modelUsed: model,
          tokenUsage,
          promptTokens,
          completionTokens,
          cost,
          pageUrl: url,
          accuracy: parsed.accuracy,
          resourcesSummary: lastFetch?.resourcesSummary,
          outlineSections: lastFetch?.sections,
          sourceHttpStatus: lastFetch?.status,
          sourceFinalUrl: lastFetch?.finalUrl
        }

        telemetry.flush({
          totalDurationMs: Date.now() - startTime,
          tokenUsage,
          requestCount: conversationOutcome.requestCount,
          toolCallCount: conversationOutcome.toolCallCount,
          componentCount: detectionResult.components.length,
          templateKey: detectionResult.pageTemplate?.templateKey,
          accuracy: detectionResult.accuracy ?? 0,
          cost
        })

        // Progress: detection complete (step 4 of 4)
        onProgress?.({
          subsystemComplete: 'llm_detection',
          message: `Detected ${parsed.components.length} components`,
        })

        traceMemory('detect:complete', { url, components: parsed.components.length })
        return detectionResult
      } catch (error) {
        // Report detection error
        onProgress?.({
          subsystemError: { id: 'llm_detection', error: error instanceof Error ? error.message : 'Unknown error' },
        })
        console.error('Web detection error:', error)
        throw new Error(`Web detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
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
