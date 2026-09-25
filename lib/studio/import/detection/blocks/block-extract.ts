import { APIError } from 'openai'
import type { ChatCompletion, ChatCompletionMessageParam } from 'openai/resources/chat/completions'
import { ConfidenceConfig, DetectionConfig, ModelConfig, OpenRouterConfig } from '@/lib/studio/import/config'
import { applyAllowedProviders, type createLLMClient } from '@/lib/studio/import/services/llm-client'
import { getReasoningConfig } from '@/lib/studio/import/openrouter-models'
import {
  capRepairPreviousJson,
  clampCompletionTokens,
  detectIncompleteJson,
  DetectionFailureError,
  extractValidationPath,
  isDedicatedEditorialListingUrl,
  type DetectionFailureDebug,
  type TokenUsage
} from '@/lib/studio/import/web-detection'
import type { DetectionTelemetry } from '@/lib/studio/import/telemetry/detection-telemetry'
import { buildDetectionPromptFromCatalog } from '../prompt-builder'
import { parseSectionDetectionResponse } from '../response-parser'
import type { BlockCatalogueOverride } from './block-catalogue'
import type { BlockInput } from './block-input'
import type { selectBlockCandidates } from './block-pick'

// Exported for the lab to record the production stall limit.
export const STALL_TIMEOUT_MS = 120_000
// Exported for the lab to record the production retry limit.
export const INFRASTRUCTURE_RETRIES = 2
export const PROVIDER_ERROR_RETRIES = 4

class BlockReplyTruncationError extends Error {}

export function assertCompleteBlockReply(rawResponse: string, finishReason: string) {
  const completion = detectIncompleteJson(rawResponse)
  if (finishReason === 'length' || (!completion.isComplete && completion.reason !== 'parse_error')) {
    throw new BlockReplyTruncationError('Reply truncated: ' + (completion.reason || finishReason))
  }
}

export type BlockReplyState = {
  requestCount: number
  rawResponse: string
  finishReason: string
  stage: DetectionFailureDebug['stage']
  repairDebug: Partial<DetectionFailureDebug>
}

// The fill and lab repair paths share the same request, retry, and validation loop.
export async function runBlockReply<TRequest, TParsed>({
  messages, createRequest, call, measureCall, validate, onResponse, sectionKey, allowedTypes, state,
  stallTimeoutMs = STALL_TIMEOUT_MS,
  infrastructureRetries = INFRASTRUCTURE_RETRIES,
  providerErrorRetries = PROVIDER_ERROR_RETRIES,
  validationRetries = 1
}: {
  messages: ChatCompletionMessageParam[]
  createRequest: (messages: ChatCompletionMessageParam[]) => TRequest | Promise<TRequest>
  call: (request: TRequest, signal: AbortSignal, attempt: number, repair: boolean) => Promise<ChatCompletion>
  measureCall?: (operation: () => Promise<ChatCompletion>, attempt: number, repair: boolean) => Promise<ChatCompletion>
  validate: (rawResponse: string) => TParsed
  onResponse?: (response: ChatCompletion) => void
  sectionKey: string
  allowedTypes: string[]
  state: BlockReplyState
  stallTimeoutMs?: number
  infrastructureRetries?: number
  providerErrorRetries?: number
  validationRetries?: number
}): Promise<TParsed> {
  let infrastructureRetryCount = 0
  let providerErrorRetryCount = 0
  for (let repair = 0; ; repair++) {
    const request = await createRequest(messages)
    for (;;) {
      const controller = new AbortController()
      let timer: ReturnType<typeof setTimeout> | undefined
      let timedOut = false
      let truncated = false
      let providerResponseError = false
      try {
        state.stage = 'llm_call'
        state.requestCount++
        const operation = () => Promise.race([
          call(request, controller.signal, state.requestCount, repair > 0),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => {
              timedOut = true
              controller.abort()
              reject(new Error('Call timeout after ' + stallTimeoutMs + 'ms'))
            }, stallTimeoutMs)
          })
        ])
        const response = await (measureCall ? measureCall(operation, state.requestCount, repair > 0) : operation())
        onResponse?.(response)
        const choice = response.choices?.[0]
        if (!choice) {
          const providerError = (response as ChatCompletion & { error?: { message?: string; code?: number | string } }).error
          const providerCode = Number(providerError?.code)
          providerResponseError = providerError?.code == null || (Number.isFinite(providerCode) && (providerCode === 429 || providerCode >= 500))
          throw new Error(providerError
            ? 'Block extraction provider error' + (providerError.code != null ? ' (' + providerError.code + ')' : '') + (providerError.message ? ': ' + providerError.message : '')
            : 'Block extraction response must include choices[0]')
        }
        state.rawResponse = choice.message?.content || ''
        state.finishReason = choice.finish_reason || 'unknown'
        try { assertCompleteBlockReply(state.rawResponse, state.finishReason) }
        catch (error) {
          if (error instanceof BlockReplyTruncationError) {
            truncated = true
            state.stage = 'output_limit'
          }
          throw error
        }
        break
      } catch (error) {
        const timeout = timedOut || (error instanceof Error && ['APIConnectionTimeoutError', 'TimeoutError'].includes(error.name))
        if ((timeout || truncated) && infrastructureRetryCount < infrastructureRetries) {
          infrastructureRetryCount++
          continue
        }
        const providerHttpError = error instanceof APIError && (error.status === 429 || (error.status != null && error.status >= 500))
        if ((providerResponseError || providerHttpError) && providerErrorRetryCount < providerErrorRetries) {
          providerErrorRetryCount++
          if (timer) clearTimeout(timer)
          await new Promise(resolve => setTimeout(resolve, 1000 * 2 ** (providerErrorRetryCount - 1)))
          continue
        }
        throw error
      } finally {
        if (timer) clearTimeout(timer)
      }
    }
    try {
      state.stage = 'validation'
      return validate(state.rawResponse)
    } catch (error) {
      if (repair >= validationRetries) throw error
      const message = error instanceof Error ? error.message : String(error)
      const capped = capRepairPreviousJson(state.rawResponse)
      state.repairDebug = { repairPromptCapped: capped.capped, repairPromptPreviousJsonChars: capped.chars }
      messages.push({
        role: 'user',
        content: [
          'Your previous JSON failed strict validation.',
          'Validation error: ' + message,
          'Validation path: ' + (extractValidationPath(message) || 'unknown'),
          'The sectionKey must remain exactly ' + sectionKey + '.',
          'Allowed component types: ' + allowedTypes.join(', '),
          'Repair schema shape and component names only. Do not invent content. Return only JSON.',
          capped.capped ? 'Previous JSON excerpt (capped to ' + capped.chars + ' chars):' : 'Previous JSON:',
          capped.text
        ].join('\n')
      })
    }
  }
}

export async function extractBlock({
  blockInput,
  allowedTypes,
  selection,
  pageOutline,
  client,
  endpointModel,
  effectiveMaxTokens,
  telemetry,
  confidenceThreshold = ConfidenceConfig.detection,
  catalogueOverride
}: {
  blockInput: BlockInput & { url: string; finalUrl?: string }
  allowedTypes: string[]
  selection: ReturnType<typeof selectBlockCandidates>
  pageOutline: string
  client: ReturnType<typeof createLLMClient>
  endpointModel: string
  effectiveMaxTokens: number
  telemetry: DetectionTelemetry
  confidenceThreshold?: number
  catalogueOverride?: BlockCatalogueOverride
}) {
  const started = Date.now()
  const { url, sectionKey, block } = blockInput
  const { prompt, components, pageSummary } = await buildDetectionPromptFromCatalog({
    telemetry,
    pageUrl: url,
    candidateTypes: catalogueOverride ? undefined : allowedTypes,
    catalogueContractOverride: catalogueOverride?.contract,
    omitCatalogueRules: catalogueOverride?.omitRules,
    mode: DetectionConfig.sectionPromptMode,
    model: endpointModel,
    provider: OpenRouterConfig.baseUrl + '|' + (ModelConfig.allowedProvider || 'any')
  })
  const availableComponents = catalogueOverride
    ? Object.entries(catalogueOverride.types)
      .filter(([type]) => allowedTypes.includes(type))
      .map(([type, description]) => ({ type, description, confidence: 1 }))
    : components
  const actual = availableComponents.map(component => component.type).sort()
  if (JSON.stringify([...new Set(allowedTypes)].sort()) !== JSON.stringify(actual)) {
    throw new Error('Requested types differ from rendered production contracts')
  }
  const payload = {
    url,
    finalUrl: blockInput.finalUrl,
    sectionKey,
    sectionOrder: block.order - 1,
    role: selection.task.role,
    intent: selection.taxonomy.intent,
    intentEvidence: selection.taxonomy.evidence,
    stats: blockInput.stats,
    resourcesSummary: blockInput.resourcesSummary,
    nodes: blockInput.nodes
  }
  const harnessRules = [
        '=== SECTION HARNESS RULES ===',
        'The sectionKey field must be exactly: ' + sectionKey,
        'Allowed component types: ' + actual.join(', '),
        'The component field must be exactly one allowed component type.',
        'Never emit generic wrappers such as section, container, wrapper, block, group, layout, or raw DOM/tag names.',
        'Do not invent copy, URLs, images, dates, categories, or placeholder content.',
        'If this section contains project/case-study/client-work/latest-project tiles, use card-grid, not content-feed.',
        'One carousel, slider, tab panel, or responsive listing surface must become one component with nested items; never emit one top-level component per slide/card variant.',
        'Hidden or inactive slides/items marked by aria-hidden, hidden, data-active/current/index, carousel/slider classes, or responsive duplicate wrappers must not become separate top-level components.',
        'When desktop/mobile/list variants contain the same item titles or links, represent the source surface once using the richest visible variant.',
        'Every image.src MediaReference object must include mediaId, mediaType: "image", and url.',
        'card-grid.cards[] links must use href, never link or url.',
        isDedicatedEditorialListingUrl(url)
          ? 'This URL is a dedicated editorial listing/archive page. Use blog-list for article/news teaser lists; content-feed and card-grid must not represent the primary article list.'
          : 'Use content-feed for real news, blog, article, story, media, press, dated, or chronological teaser listings; never use card-grid for those editorial feeds.',
        'When nodes include bgColor evidence for a visible component surface, preserve that source CSS color in the component style fields supported by its schema; do not infer colors from brand palette.',
        'If no registered component can truthfully represent the section, return components: [].'
  ]
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
        prompt,
        ...harnessRules.filter(rule => !catalogueOverride || !catalogueOverride.omitRules.some(fragment => rule.includes(fragment)))
      ].join('\n\n')
    },
    {
      role: 'user',
      content: 'Page outline: ' + pageOutline + '\nExtract this single section:\n' + JSON.stringify(payload)
    }
  ]
  const usage: TokenUsage = {}
  const state: BlockReplyState = { requestCount: 0, rawResponse: '', finishReason: '', stage: 'llm_call', repairDebug: {} }
  try {
    const parsed = await runBlockReply({
      messages, sectionKey, allowedTypes: actual, state,
      createRequest: async currentMessages => {
        const reasoning = await getReasoningConfig(endpointModel)
        const request = {
          model: endpointModel,
          messages: [...currentMessages],
          temperature: ModelConfig.temperature.detection,
          max_tokens: clampCompletionTokens(endpointModel, currentMessages, effectiveMaxTokens),
          response_format: { type: 'json_object' as const },
          ...(reasoning ? { reasoning } : {})
        }
        applyAllowedProviders(request)
        return request
      },
      call: (request, signal) => client.chat.completions.create(request, { signal, maxRetries: 0 }),
      measureCall: (operation, attempt, repair) => telemetry.timePhase('llm_call',
        operation,
        response => ({
          sectionKey, sectionOrder: block.order - 1, role: block.region, attempt, repair,
          totalTokens: response?.usage?.total_tokens ?? 0,
          promptTokens: response?.usage?.prompt_tokens ?? 0,
          completionTokens: response?.usage?.completion_tokens ?? 0
        })),
      onResponse: response => {
        const responseUsage = response.usage as (TokenUsage & { cost?: number }) | undefined
        usage.prompt_tokens = (usage.prompt_tokens ?? 0) + (responseUsage?.prompt_tokens ?? 0)
        usage.completion_tokens = (usage.completion_tokens ?? 0) + (responseUsage?.completion_tokens ?? 0)
        usage.total_tokens = (usage.total_tokens ?? 0) + (responseUsage?.total_tokens ?? 0)
        usage.reasoning_tokens = (usage.reasoning_tokens ?? 0) + (responseUsage?.reasoning_tokens ?? 0)
        usage.total_cost = (usage.total_cost ?? 0) + (responseUsage?.total_cost ?? responseUsage?.cost ?? 0)
      },
      validate: rawResponse => parseSectionDetectionResponse({
        rawResponse, sectionKey, availableComponents, url, confidenceThreshold,
        allowMissingSectionKey: false,
        ...(catalogueOverride ? { validateContent: ({ canonicalType, content }: { canonicalType: string; content: Record<string, unknown> }) => catalogueOverride.validateContent(canonicalType, content) } : {})
      })
    })
    return {
      artifact: { ...parsed, sectionOrder: block.order - 1, durationMs: Date.now() - started },
      pageSummary, usage, requestCount: state.requestCount,
      debug: { model: endpointModel, stage: state.stage, rawResponse: state.rawResponse, rawResponseLength: state.rawResponse.length, finishReason: state.finishReason, usage, requestCount: state.requestCount, ...state.repairDebug }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new DetectionFailureError(message, {
      model: endpointModel,
      stage: state.stage,
      sectionKey,
      sectionOrder: block.order - 1,
      rawResponse: state.rawResponse,
      rawResponseLength: state.rawResponse.length,
      finishReason: state.finishReason,
      usage,
      requestCount: state.requestCount,
      validationPath: extractValidationPath(message),
      ...state.repairDebug
    })
  }
}
