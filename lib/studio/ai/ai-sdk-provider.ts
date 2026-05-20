/**
 * AI SDK Provider Factory
 *
 * Creates AI SDK models using @openrouter/ai-sdk-provider with baseURL override.
 *
 * KEY INSIGHT: @openrouter/ai-sdk-provider implements v2 spec (AI SDK 5 compatible)
 * and supports baseURL override. By pointing baseURL to xAI's API (api.x.ai/v1),
 * we get a v2-compatible client that calls xAI directly.
 *
 * This is simpler and more reliable than using @ai-sdk/xai or @ai-sdk/openai
 * which have v1/v3 spec version mismatches with AI SDK 5.
 *
 * @module lib/studio/ai/ai-sdk-provider
 */

import { createOpenRouter } from '@openrouter/ai-sdk-provider'

/**
 * Get the model ID in the appropriate format.
 * - For OpenRouter: needs provider prefix (x-ai/grok-4)
 * - For xAI direct: just the model name (grok-4)
 */
function getModelId(modelEnvVar?: string): string {
  const model = modelEnvVar || process.env.IMPORT_MODEL_CHAIN || process.env.OPENROUTER_MODEL || 'grok-4-1-fast-non-reasoning'
  const baseURL = process.env.OPENROUTER_BASE_URL

  // If using xAI direct (baseURL points to api.x.ai), strip provider prefix
  if (baseURL?.includes('api.x.ai') && model.includes('/')) {
    return model.split('/').pop() || model
  }

  // If using OpenRouter and model has no prefix, add x-ai/ prefix
  if (!baseURL?.includes('api.x.ai') && !model.includes('/')) {
    return `x-ai/${model}`
  }

  return model
}

/**
 * Create an AI SDK compatible model.
 *
 * Uses @openrouter/ai-sdk-provider with optional baseURL override.
 * When OPENROUTER_BASE_URL points to xAI (api.x.ai/v1), requests go directly
 * to xAI's API instead of OpenRouter.
 *
 * @param modelOverride - Optional model override. If not provided, uses env vars.
 * @returns AI SDK compatible model (v2 spec)
 *
 * @example
 * ```typescript
 * import { createAIModel } from '@/lib/studio/ai/ai-sdk-provider'
 *
 * const model = createAIModel()
 * const result = await streamText({ model, ... })
 * ```
 */
export function createAIModel(modelOverride?: string) {
  const apiKey = process.env.OPENROUTER_API_KEY
  const baseURL = process.env.OPENROUTER_BASE_URL

  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not configured')
  }

  const modelId = getModelId(modelOverride)

  // Create OpenRouter provider with optional baseURL override
  // When baseURL points to xAI, this effectively becomes an xAI client
  const openrouter = createOpenRouter({ apiKey, baseURL })

  const mode = baseURL?.includes('api.x.ai') ? 'xAI direct' : 'OpenRouter'
  console.info(`[ai-sdk-provider] Using ${mode}`, {
    model: modelId,
    baseURL: baseURL || 'default (openrouter.ai)'
  })

  return openrouter(modelId)
}

/**
 * Create an AI SDK model specifically for workflow routing.
 * Uses a faster model for quick routing decisions.
 */
export function createWorkflowRouterModel() {
  // For workflow routing, prefer a fast model
  const routerModel = process.env.WORKFLOW_ROUTER_MODEL || process.env.IMPORT_MODEL_CHAIN || process.env.OPENROUTER_MODEL

  return createAIModel(routerModel)
}
