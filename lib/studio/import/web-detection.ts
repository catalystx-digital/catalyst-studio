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
import { jsonrepair } from 'jsonrepair'

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

function truncateStringsForPrompt(value: unknown, maxStringLength: number): unknown {
  if (typeof value === 'string') {
    return value.length > maxStringLength
      ? `${value.slice(0, maxStringLength)}...[truncated ${value.length - maxStringLength} chars]`
      : value
  }
  if (Array.isArray(value)) {
    return value.map(item => truncateStringsForPrompt(item, maxStringLength))
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, truncateStringsForPrompt(item, maxStringLength)])
    )
  }
  return value
}

function compactToolContentForPrompt(toolContent: Record<string, unknown>, maxChars: number): Record<string, unknown> {
  let stringLimit = 12000
  let compacted: Record<string, unknown> = toolContent
  while (stringLimit >= 1000) {
    compacted = truncateStringsForPrompt(toolContent, stringLimit) as Record<string, unknown>
    if (JSON.stringify(compacted).length <= maxChars) return compacted
    stringLimit = Math.floor(stringLimit / 2)
  }

  const result: Record<string, unknown> = {}
  let used = 2
  for (const [key, value] of Object.entries(compacted)) {
    const entry = JSON.stringify({ [key]: value })
    if (used + entry.length > maxChars) {
      result[key] = { omitted: true, reason: 'IMPORT_DIRECT_PROMPT_MAX_CHARS exceeded' }
      break
    }
    result[key] = value
    used += entry.length + 1
  }
  return result
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
const DIRECT_PROMPT_MAX_CHARS = WebToolsConfig.directPromptMaxChars

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

/**
 * Metadata about JSON continuation recovery when LLM output was incomplete.
 */
interface ContinuationMetadata {
  /** Whether the result was recovered via continuation requests */
  wasRecovered: boolean
  /** Number of continuation attempts made */
  attempts: number
  /** Whether the JSON is complete after continuation */
  isComplete: boolean
  /** Log of each continuation attempt */
  recoveryLog: Array<{
    attempt: number
    reason: string
    truncationPoint?: string
    finishReason: string
    charsBefore: number
    charsAdded: number
    charsAfter: number
  }>
}

interface ConversationOutcome {
  rawResult: string
  response: ChatCompletion
  usage: TokenUsage
  requestCount: number
  toolCallCount: number
  /** Continuation metadata if JSON was recovered via continuation */
  continuationMetadata?: ContinuationMetadata
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
 * Maximum number of continuation attempts when JSON output is incomplete.
 * Each continuation adds the truncated response as assistant prefill and asks model to continue.
 * Can be configured via IMPORT_MAX_CONTINUATION_ATTEMPTS env variable.
 * Default: 5 attempts (increased from 3 to handle larger pages)
 */
const MAX_CONTINUATION_ATTEMPTS = LoggingConfig.maxContinuationAttempts

/**
 * Strips markdown code fences from LLM output.
 * Models often wrap JSON in ```json ... ``` when asked to continue.
 * This removes those markers to get clean JSON for concatenation.
 */
function stripMarkdownFences(text: string): string {
  if (!text) return text

  // Remove leading ```json or ```
  let result = text.replace(/^```(?:json)?\s*/i, '')

  // Remove trailing ```
  result = result.replace(/\s*```\s*$/i, '')

  // Also handle cases where ``` appears mid-string (from concatenation)
  // Replace ```json``` or `````` patterns that appear between JSON parts
  result = result.replace(/\}\s*```(?:json)?```\s*\[/g, '},\n[')
  result = result.replace(/\]\s*```(?:json)?```\s*\{/g, '],\n{')
  result = result.replace(/\}\s*```(?:json)?```\s*\{/g, '},\n{')
  result = result.replace(/\]\s*```(?:json)?```\s*\[/g, '],\n[')

  // Clean up any remaining embedded ``` markers
  result = result.replace(/```(?:json)?/gi, '')

  return result.trim()
}

/**
 * Finds overlapping content between the end of first string and start of second.
 * Returns the overlap length to prevent duplicate concatenation.
 *
 * Example: first = "hello wor", second = "orld!" => overlap = 2 ("or")
 */
function findOverlapLength(first: string, second: string, maxLookback: number = 200): number {
  if (!first || !second) return 0

  // Look for overlapping content at the boundary
  const endOfFirst = first.slice(-maxLookback)

  for (let overlapLen = Math.min(endOfFirst.length, second.length); overlapLen > 0; overlapLen--) {
    const endPart = endOfFirst.slice(-overlapLen)
    const startPart = second.slice(0, overlapLen)
    if (endPart === startPart) {
      return overlapLen
    }
  }

  return 0
}

/**
 * Merges prefill content with continuation, handling overlapping content.
 * LLMs sometimes repeat content from where they were asked to continue.
 * Also handles misaligned continuations where the LLM drops characters.
 */
function mergeContinuation(prefill: string, continuation: string): { merged: string; overlapRemoved: number; fixApplied?: string } {
  // Check for misaligned continuation patterns FIRST
  // These patterns indicate the LLM dropped characters, not overlapped
  const prefillEndsWithStringValue = /"\s*$/.test(prefill)
  const trimmedCont = continuation.trim()

  // Pattern 1: prefill ends with `"value"` and continuation starts with `key":` (missing `, "`)
  // Example: prefill = `"nav-menu-item"`, continuation = `id": "value"`
  // Should be: `"nav-menu-item", "id": "value"`
  const continuationStartsWithKey = /^[a-zA-Z_][a-zA-Z0-9_]*":\s*/.test(trimmedCont)
  if (prefillEndsWithStringValue && continuationStartsWithKey) {
    return {
      merged: prefill + ', "' + trimmedCont,
      overlapRemoved: 0,
      fixApplied: 'inserted_comma_quote'
    }
  }

  // Pattern 2: prefill ends with `"value"` and continuation starts with `"key":` (missing `, `)
  const continuationStartsWithQuotedKey = /^"[a-zA-Z_][a-zA-Z0-9_]*":\s*/.test(trimmedCont)
  if (prefillEndsWithStringValue && continuationStartsWithQuotedKey) {
    return {
      merged: prefill + ', ' + trimmedCont,
      overlapRemoved: 0,
      fixApplied: 'inserted_comma'
    }
  }

  // Pattern 3: Object restart - LLM restarts entire object mid-stream
  // Example: prefill ends with `"id": "nav-menu-item-credit-management",\n"`
  //          continuation starts with `{"type":"nav-menu-item"...`
  // The LLM decided to restart the object from scratch instead of continuing
  // Solution: Find the last complete array item boundary in prefill and truncate there
  const continuationStartsWithObject = /^\s*\{/.test(trimmedCont)
  if (continuationStartsWithObject) {
    // Check if prefill is mid-object (has unclosed braces after last }, or after array [)
    // Find the last position where we have a complete item (after }, or {[ for empty array)
    const lastCompleteItemMatch = prefill.match(/^([\s\S]*\})\s*,?\s*$/m)
    if (lastCompleteItemMatch) {
      // Check if there's incomplete content after the last complete object
      const lastCompletePos = lastCompleteItemMatch[1].length
      const remainder = prefill.slice(lastCompletePos).trim()

      // If remainder contains partial object start (like `,\n"` or just has partial content)
      // then we're mid-object and should truncate
      if (remainder && (remainder.includes('"') || remainder.includes(','))) {
        const truncatedPrefill = lastCompleteItemMatch[1] + ', '
        return {
          merged: truncatedPrefill + trimmedCont,
          overlapRemoved: prefill.length - truncatedPrefill.length,
          fixApplied: 'object_restart_truncate'
        }
      }
    }

    // Alternative: find the last `},` or `}\n` pattern which indicates end of array item
    const lastArrayItemEnd = prefill.lastIndexOf('},')
    const lastArrayItemEndNewline = prefill.lastIndexOf('}\n')
    const bestEnd = Math.max(lastArrayItemEnd, lastArrayItemEndNewline)

    if (bestEnd > 0) {
      // Check if there's meaningful content after this point that looks incomplete
      const afterEnd = prefill.slice(bestEnd + 1).trim()
      // If what remains looks like a partial object (has quotes, commas but no closing brace)
      if (afterEnd && !afterEnd.endsWith('}') && (afterEnd.includes('"') || afterEnd.startsWith(','))) {
        const truncatedPrefill = prefill.slice(0, bestEnd + 1) + ' '
        return {
          merged: truncatedPrefill + trimmedCont,
          overlapRemoved: prefill.length - truncatedPrefill.length,
          fixApplied: 'object_restart_after_item'
        }
      }
    }
  }

  // Now check for actual overlapping content (for larger overlaps, not single chars)
  const overlap = findOverlapLength(prefill, continuation)
  if (overlap > 3) {  // Only consider meaningful overlaps (> 3 chars)
    return {
      merged: prefill + continuation.slice(overlap),
      overlapRemoved: overlap
    }
  }

  return { merged: prefill + continuation, overlapRemoved: 0 }
}

/**
 * Extracts the first complete JSON object from a string.
 * Handles cases where LLM duplicates content during continuation,
 * resulting in multiple JSON objects concatenated together.
 */
function extractFirstCompleteJsonObject(text: string): string | null {
  if (!text) return null

  const trimmed = text.trim()
  if (!trimmed.startsWith('{')) return null

  let depth = 0
  let inString = false
  let escape = false

  for (let i = 0; i < trimmed.length; i++) {
    const char = trimmed[i]

    if (escape) {
      escape = false
      continue
    }

    if (char === '\\' && inString) {
      escape = true
      continue
    }

    if (char === '"' && !escape) {
      inString = !inString
      continue
    }

    if (inString) continue

    if (char === '{') {
      depth++
    } else if (char === '}') {
      depth--
      if (depth === 0) {
        // Found complete object
        const extracted = trimmed.slice(0, i + 1)
        // Verify it's valid JSON
        try {
          JSON.parse(extracted)
          return extracted
        } catch {
          // Keep searching - this wasn't valid
          continue
        }
      }
    }
  }

  return null
}

/**
 * Repairs JSON using jsonrepair library.
 * Handles common LLM output issues like missing brackets, markdown fences, etc.
 * Also handles duplicate JSON from continuation responses.
 */
function repairJsonOutput(jsonStr: string): { repaired: string; wasRepaired: boolean; error?: string } {
  if (!jsonStr) return { repaired: jsonStr, wasRepaired: false }

  try {
    // First strip markdown fences
    const stripped = stripMarkdownFences(jsonStr)

    // Try to parse as-is first
    try {
      JSON.parse(stripped)
      return { repaired: stripped, wasRepaired: stripped !== jsonStr }
    } catch {
      // Needs repair
    }

    // Try extracting just the first complete JSON object
    // This handles cases where LLM duplicates content during continuation
    const firstObject = extractFirstCompleteJsonObject(stripped)
    if (firstObject) {
      const discardedLength = stripped.length - firstObject.length
      if (LoggingConfig.logOutput && discardedLength > 0) {
        console.log(`[Detection] Extracted first complete JSON object, discarded ${discardedLength} chars of duplicate content`)
      }
      return { repaired: firstObject, wasRepaired: true }
    }

    // Use jsonrepair to fix issues
    const repaired = jsonrepair(stripped)
    if (LoggingConfig.logOutput) {
      console.log(`[Detection] JSON repaired successfully via jsonrepair`)
    }
    return { repaired, wasRepaired: true }
  } catch (err) {
    return {
      repaired: jsonStr,
      wasRepaired: false,
      error: err instanceof Error ? err.message : 'Unknown repair error'
    }
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
      const argsStr = tc.function?.arguments || '{}'
      let args: WebToolArgs = {}
      try {
        args = JSON.parse(argsStr) as WebToolArgs
      } catch {
        // ignore and fall back to empty args object
      }

      try {
        if (name === 'fetch_outline') {
          logWebToolCall('INPUT', name, args)
          const normalizedArgs: WebToolArgs = { ...args }
          if (typeof normalizedArgs.stripScriptsStyles === 'undefined') normalizedArgs.stripScriptsStyles = true
          if (typeof normalizedArgs.collapseWhitespace === 'undefined') normalizedArgs.collapseWhitespace = true
          if (!normalizedArgs.url) normalizedArgs.url = params.url
          const fetchArgs = { ...normalizedArgs, url: normalizedArgs.url || params.url }

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

  // Continuation logic: If JSON is incomplete, ask model to continue from where it left off
  let continuationAttempts = 0
  let completionStatus = detectIncompleteJson(result)
  const continuationLog: Array<{
    attempt: number
    reason: string
    truncationPoint?: string
    finishReason: string
    charsBefore: number
    charsAdded: number
    charsAfter: number
  }> = []

  // TKT-065 FIX: Grok fails with tool response flow but works with direct content.
  // When JSON is incomplete and we have tool responses, try fresh conversation FIRST
  // before falling back to continuation logic.
  const hasToolResponses = params.messages.some(msg => msg.role === 'tool')
  if (!completionStatus.isComplete && hasToolResponses) {
    if (LoggingConfig.logOutput) {
      console.log(`[TKT-065] Incomplete JSON from tool flow, trying fresh conversation with direct content`)
    }

    // Extract tool response content from messages (store parsed objects, not strings)
    const toolContent: Record<string, unknown> = {}
    for (const msg of params.messages) {
      if (msg.role === 'tool' && 'content' in msg && typeof msg.content === 'string') {
        try {
          const parsed = JSON.parse(msg.content)
          if (parsed.key) toolContent[parsed.key] = parsed
          else if (parsed.handle && parsed.sections) toolContent['outline'] = parsed
        } catch {
          // Not JSON, skip
        }
      }
    }

    // Save original messages
    const originalMessages = [...params.messages]
    const systemPrompt = params.messages[0]

    // Modify messages array IN PLACE (createRequest closes over this array)
    params.messages.length = 0
    params.messages.push(systemPrompt)
    const compactedToolContent = compactToolContentForPrompt(toolContent, DIRECT_PROMPT_MAX_CHARS)
    const freshUserContent = `Extract components from: ${params.url}\n\nPage data:\n${JSON.stringify(compactedToolContent)}`
    params.messages.push({
      role: 'user',
      content: freshUserContent
    })

    if (LoggingConfig.logOutput) {
      console.log(`[TKT-065] Fresh request: ${params.messages.length} messages, user content: ${freshUserContent.length} chars`)
      console.log(`[TKT-065] Tool content keys: ${Object.keys(toolContent).join(', ')}`)
    }

    try {
      // Use JSON mode (true) and disallow tools (true) for fresh request
      response = await params.withTimeout(params.createRequest(true, true))
      requestCount++
      const freshResult = response.choices[0]?.message?.content || ''
      const freshCompletionStatus = detectIncompleteJson(freshResult)

      if (freshCompletionStatus.isComplete) {
        // Fresh approach worked! Use this result
        result = freshResult
        finishReason = response.choices[0]?.finish_reason || ''
        completionStatus = freshCompletionStatus
        if (LoggingConfig.logOutput) {
          console.log(`[TKT-065] Fresh conversation succeeded: ${freshResult.length} chars, complete JSON`)
        }
      } else {
        if (LoggingConfig.logOutput) {
          console.log(`[TKT-065] Fresh conversation also incomplete (${freshResult.length} chars), falling back to continuation`)
        }
      }
    } catch (freshError) {
      if (LoggingConfig.logOutput) {
        console.log(`[TKT-065] Fresh conversation failed:`, freshError)
      }
    }

    // Restore original messages for continuation logic
    params.messages.length = 0
    for (const msg of originalMessages) {
      params.messages.push(msg)
    }
  }

  while (!completionStatus.isComplete && continuationAttempts < MAX_CONTINUATION_ATTEMPTS) {
    continuationAttempts++
    const charsBefore = result.length

    if (LoggingConfig.logOutput) {
      console.log(`\n=== LLM CONTINUATION ATTEMPT ${continuationAttempts}/${MAX_CONTINUATION_ATTEMPTS} ===`)
      console.log(`    reason: ${completionStatus.reason}`)
      console.log(`    truncation_point: "${completionStatus.truncationPoint || ''}"`)
      console.log(`    finish_reason: ${finishReason}`)
      console.log(`    current_length: ${result.length} chars`)
      console.log(`    ⚠️ LLM stopped prematurely with incomplete JSON. Requesting continuation...`)
    } else {
      console.log(`[Detection] Incomplete JSON detected (attempt ${continuationAttempts}/${MAX_CONTINUATION_ATTEMPTS}):`, {
        reason: completionStatus.reason,
        truncationPoint: completionStatus.truncationPoint,
        finishReason,
        resultLength: result.length
      })
    }

    // Remove the last assistant message if it exists (we'll replace it with prefill)
    const lastMsg = params.messages[params.messages.length - 1]
    if (lastMsg?.role === 'assistant') {
      params.messages.pop()
    }

    // Add the incomplete response as assistant prefill (model continues from here)
    // Note: The content cannot end with whitespace per Anthropic/OpenRouter rules
    const prefillContent = result.trimEnd()
    params.messages.push({
      role: 'assistant',
      content: prefillContent
    } as ChatCompletionMessageParam)

    // Add a user message asking to continue
    params.messages.push({
      role: 'user',
      content: 'Continue the JSON output from exactly where you left off. Do not restart, do not repeat any content, just continue the JSON structure to completion.'
    })

    try {
      response = await params.withTimeout(params.createRequest(true, true))
      requestCount++
      const continuationContent = response.choices[0]?.message?.content || ''
      finishReason = response.choices[0]?.finish_reason || ''

      if (continuationContent.trim()) {
        // Strip markdown fences from continuation (models often wrap in ```json)
        const cleanedContinuation = stripMarkdownFences(continuationContent)

        // Merge with overlap detection (LLMs sometimes repeat content at boundaries)
        const mergeResult = mergeContinuation(prefillContent, cleanedContinuation)
        result = mergeResult.merged
        const effectiveCharsAdded = cleanedContinuation.length - mergeResult.overlapRemoved

        // Log continuation details
        continuationLog.push({
          attempt: continuationAttempts,
          reason: completionStatus.reason || 'unknown',
          truncationPoint: completionStatus.truncationPoint,
          finishReason,
          charsBefore,
          charsAdded: effectiveCharsAdded,
          charsAfter: result.length
        })

        if (LoggingConfig.logOutput) {
          const wasStripped = cleanedContinuation !== continuationContent
          const overlapNote = mergeResult.overlapRemoved > 0 ? ` (${mergeResult.overlapRemoved} overlap removed)` : ''
          const fixNote = mergeResult.fixApplied ? ` (fix: ${mergeResult.fixApplied})` : ''
          console.log(`    ✓ Continuation received: +${effectiveCharsAdded} chars${wasStripped ? ' (markdown stripped)' : ''}${overlapNote}${fixNote}`)
          console.log(`    total_length: ${result.length} chars`)
        } else {
          console.log(`[Detection] Continuation received: +${effectiveCharsAdded} chars, total: ${result.length} chars`)
        }
      }

      // Record the combined message for conversation history
      // First remove our prefill and user prompt
      params.messages.pop() // Remove user "continue" message
      params.messages.pop() // Remove assistant prefill
      // Add combined result as assistant message
      params.messages.push({
        role: 'assistant',
        content: result
      } as ChatCompletionMessageParam)

      completionStatus = detectIncompleteJson(result)
    } catch (err) {
      console.warn(`[Detection] Continuation attempt ${continuationAttempts} failed:`, err)
      break
    }
  }

  // Final continuation summary
  const wasRecoveredViaContinuation = continuationAttempts > 0
  const isCompleteAfterContinuation = completionStatus.isComplete

  if (!completionStatus.isComplete && continuationAttempts >= MAX_CONTINUATION_ATTEMPTS) {
    if (LoggingConfig.logOutput) {
      console.log(`\n=== LLM CONTINUATION SUMMARY ===`)
      console.log(`    status: ⚠️ INCOMPLETE (max attempts reached)`)
      console.log(`    attempts: ${continuationAttempts}/${MAX_CONTINUATION_ATTEMPTS}`)
      console.log(`    final_length: ${result.length} chars`)
      console.log(`    recovery_log:`, JSON.stringify(continuationLog, null, 2))
      console.log(`=== END CONTINUATION SUMMARY ===\n`)
    } else {
      console.warn(`[Detection] JSON still incomplete after ${MAX_CONTINUATION_ATTEMPTS} continuation attempts. Proceeding with partial result.`)
    }
  } else if (completionStatus.isComplete && continuationAttempts > 0) {
    if (LoggingConfig.logOutput) {
      console.log(`\n=== LLM CONTINUATION SUMMARY ===`)
      console.log(`    status: ✓ COMPLETE (recovered via continuation)`)
      console.log(`    attempts: ${continuationAttempts}`)
      console.log(`    final_length: ${result.length} chars`)
      console.log(`    recovery_log:`, JSON.stringify(continuationLog, null, 2))
      console.log(`=== END CONTINUATION SUMMARY ===\n`)
    } else {
      console.log(`[Detection] JSON completed successfully after ${continuationAttempts} continuation attempt(s)`)
    }
  }

  // Final JSON repair pass - handles any remaining markdown fences and syntax issues
  const repairResult = repairJsonOutput(result)
  if (repairResult.wasRepaired) {
    if (LoggingConfig.logOutput) {
      console.log(`[Detection] JSON repaired successfully`)
      if (repairResult.error) {
        console.log(`[Detection] Repair had warnings: ${repairResult.error}`)
      }
    }
    result = repairResult.repaired

    // Re-check completion status after repair
    completionStatus = detectIncompleteJson(result)
  }

  return {
    rawResult: result,
    response,
    usage: response.usage ? { ...response.usage } : {},
    requestCount,
    toolCallCount,
    // Include continuation metadata for downstream consumers
    continuationMetadata: wasRecoveredViaContinuation ? {
      wasRecovered: true,
      attempts: continuationAttempts,
      isComplete: completionStatus.isComplete, // Use updated status after repair
      recoveryLog: continuationLog
    } : undefined
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
          const contMeta = conversationOutcome.continuationMetadata

          // Determine the output status flag
          let outputStatusFlag = ''
          if (contMeta?.wasRecovered) {
            if (contMeta.isComplete) {
              outputStatusFlag = `    🔄 RECOVERED VIA CONTINUATION (${contMeta.attempts} attempt(s)) - JSON is now complete`
            } else {
              outputStatusFlag = `    ⚠️ PARTIALLY RECOVERED VIA CONTINUATION (${contMeta.attempts} attempt(s)) - JSON still incomplete`
            }
          }

          console.log(`=== LLM RAW OUTPUT (FULL, length=${totalLen}) ===`)
          console.log(`    finish_reason: ${finishReason}`)
          console.log(`    prompt_tokens: ${usage.prompt_tokens || 0}`)
          console.log(`    completion_tokens: ${usage.completion_tokens || 0}`)
          console.log(`    total_tokens: ${usage.total_tokens || 0}`)
          console.log(`    model_max_completion_tokens: ${modelMaxTokens}`)
          console.log(`    effective_max_tokens: ${effectiveMaxTokens}`)

          // Show continuation status prominently
          if (outputStatusFlag) {
            console.log(outputStatusFlag)
            console.log(`    Note: The JSON below is the COMBINED result after continuation requests.`)
          } else if (finishReason === 'length') {
            console.log(`    ⚠️ WARNING: Output truncated due to max_tokens limit!`)
            console.log(`    The model stopped because it hit the completion token limit.`)
            console.log(`    Consider increasing IMPORT_DETECT_MAX_TOKENS in .env.local.`)
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
          outlineSections: lastFetch?.sections
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
