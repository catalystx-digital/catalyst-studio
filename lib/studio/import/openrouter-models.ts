/**
 * OpenRouter Model Configuration Service
 *
 * Fetches and caches model metadata from OpenRouter API to enable
 * dynamic capability detection, reasoning configuration, and pricing.
 *
 * Usage:
 *   const config = await getModelConfig('x-ai/grok-4.1-fast:free')
 *   if (await supportsReasoning(modelId)) { ... }
 *   const pricing = await getModelPricing(modelId)
 */

// =============================================================================
// Types
// =============================================================================

export interface OpenRouterModel {
  id: string
  canonical_slug: string
  name: string
  description: string
  context_length: number
  architecture: {
    modality: string
    input_modalities: string[]
    output_modalities: string[]
    tokenizer: string
  }
  pricing: {
    prompt: string
    completion: string
    request: string
    image: string
    web_search: string
    internal_reasoning: string
    input_cache_read?: string
    input_cache_write?: string
  }
  top_provider: {
    context_length: number
    max_completion_tokens: number
    is_moderated: boolean
  }
  supported_parameters: string[]
  default_parameters: {
    temperature: number | null
    top_p: number | null
    frequency_penalty: number | null
  }
}

export interface ModelPricing {
  promptPerMillion: number // Cost per 1M prompt tokens
  completionPerMillion: number // Cost per 1M completion tokens
  reasoningPerMillion: number // Cost per 1M reasoning tokens
  imagePerUnit: number // Cost per image
}

export interface ReasoningConfig {
  enabled?: boolean
  effort?: 'high' | 'medium' | 'low' | 'minimal'
  max_tokens?: number
}

import { OpenRouterConfig } from './config/import-config'

// =============================================================================
// Cache Configuration
// =============================================================================

const CACHE_TTL_MS = OpenRouterConfig.modelsCacheTtlMs
const API_URL = 'https://openrouter.ai/api/v1/models'

interface ModelCache {
  models: Map<string, OpenRouterModel>
  lastFetched: number
}

let cache: ModelCache | null = null

// =============================================================================
// Core Functions
// =============================================================================

/**
 * Fetches model list from OpenRouter API with caching.
 * Cache is invalidated after CACHE_TTL_MS.
 */
async function ensureCache(): Promise<Map<string, OpenRouterModel>> {
  const now = Date.now()

  if (cache && now - cache.lastFetched < CACHE_TTL_MS) {
    return cache.models
  }

  try {
    const response = await fetch(API_URL, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'CatalystStudio/1.0'
      }
    })

    if (!response.ok) {
      console.warn(`[OpenRouterModels] Failed to fetch models: ${response.status}`)
      // Return existing cache if available, even if stale
      if (cache) return cache.models
      return new Map()
    }

    const data = (await response.json()) as { data: OpenRouterModel[] }

    const models = new Map<string, OpenRouterModel>()
    for (const model of data.data) {
      models.set(model.id, model)
      // Also index by canonical_slug for lookup flexibility
      // But DON'T overwrite if the canonical_slug already exists as an exact model ID
      // This prevents :free/:exacto variants from overwriting the base model
      if (model.canonical_slug && model.canonical_slug !== model.id && !models.has(model.canonical_slug)) {
        models.set(model.canonical_slug, model)
      }
    }

    cache = { models, lastFetched: now }
    console.log(`[OpenRouterModels] Cached ${models.size} models`)

    return models
  } catch (error) {
    console.warn('[OpenRouterModels] Error fetching models:', error)
    if (cache) return cache.models
    return new Map()
  }
}

/**
 * Gets full model configuration by ID.
 * Handles both exact IDs ("x-ai/grok-4.1-fast:free") and base IDs ("x-ai/grok-4.1-fast").
 */
export async function getModelConfig(modelId: string): Promise<OpenRouterModel | null> {
  const models = await ensureCache()

  // Try exact match first
  if (models.has(modelId)) {
    return models.get(modelId)!
  }

  // Try without variant suffix (:free, :nitro, :floor, :online, :exacto, etc.)
  const baseId = modelId.replace(/:(free|nitro|floor|online|exacto)$/, '')
  if (models.has(baseId)) {
    return models.get(baseId)!
  }

  // Fuzzy match: find first model that starts with the given ID
  for (const [id, model] of models) {
    if (id.startsWith(modelId) || modelId.startsWith(id)) {
      return model
    }
  }

  return null
}

// =============================================================================
// Capability Detection
// =============================================================================

/**
 * Checks if model supports the `reasoning` parameter.
 */
export async function supportsReasoning(modelId: string): Promise<boolean> {
  const config = await getModelConfig(modelId)
  return config?.supported_parameters?.includes('reasoning') ?? false
}

/**
 * Gets the model's max completion tokens from OpenRouter.
 * This is the actual model limit, not an arbitrary cap.
 * Falls back to the provided default if model config is unavailable.
 */
export async function getModelMaxCompletionTokens(
  modelId: string,
  fallback: number = 50000
): Promise<number> {
  // TKT-065: xAI direct models have known limits.
  // grok-4.1-fast variants have 30K max output tokens per OpenRouter.
  // We can't query xAI's API for model metadata, so hardcode known limits.
  const isXaiDirectModel = /^grok-\d/.test(modelId)
  if (isXaiDirectModel) {
    // Grok 4.1 Fast: 30,000 max completion tokens
    // Source: https://openrouter.ai/x-ai/grok-4.1-fast
    return 30000
  }

  const config = await getModelConfig(modelId)
  const modelLimit = config?.top_provider?.max_completion_tokens
  if (modelLimit && modelLimit > 0) {
    return modelLimit
  }
  return fallback
}


// =============================================================================
// Pricing
// =============================================================================

/**
 * Gets pricing information for a model.
 * Returns costs per million tokens.
 * Internal only - used by calculateCost()
 */
async function getModelPricing(modelId: string): Promise<ModelPricing> {
  const config = await getModelConfig(modelId)

  const defaultPricing: ModelPricing = {
    promptPerMillion: 0.15, // Default to cheap model pricing
    completionPerMillion: 0.6,
    reasoningPerMillion: 0,
    imagePerUnit: 0
  }

  if (!config) return defaultPricing

  // OpenRouter returns price per token as string, convert to per-million
  const toPerMillion = (perToken: string): number => {
    const val = parseFloat(perToken)
    return isNaN(val) ? 0 : val * 1_000_000
  }

  return {
    promptPerMillion: toPerMillion(config.pricing.prompt),
    completionPerMillion: toPerMillion(config.pricing.completion),
    reasoningPerMillion: toPerMillion(config.pricing.internal_reasoning),
    imagePerUnit: parseFloat(config.pricing.image) || 0
  }
}

/**
 * Calculates cost for a given token usage.
 */
export async function calculateCost(
  modelId: string,
  promptTokens: number,
  completionTokens: number,
  reasoningTokens: number = 0
): Promise<number> {
  const pricing = await getModelPricing(modelId)

  return (
    (promptTokens / 1_000_000) * pricing.promptPerMillion +
    (completionTokens / 1_000_000) * pricing.completionPerMillion +
    (reasoningTokens / 1_000_000) * pricing.reasoningPerMillion
  )
}

// =============================================================================
// Reasoning Configuration
// =============================================================================

/**
 * Gets reasoning configuration for a model.
 *
 * Strategy:
 * 1. Models without reasoning support → don't send param (undefined)
 * 2. Models with mandatory reasoning (have reasoning_effort) → use { effort: 'low' }
 * 3. Models with optional reasoning → disable with { enabled: false }
 *
 * This prevents reasoning tokens from consuming the max_tokens budget
 * and truncating JSON output, while avoiding 400 errors on mandatory
 * reasoning models like openai/gpt-oss-120b.
 *
 * Detection heuristic: Models with `reasoning_effort` in supported_parameters
 * have mandatory reasoning that cannot be disabled.
 */
export async function getReasoningConfig(
  modelId: string
): Promise<ReasoningConfig | undefined> {
  // TKT-065: Detect xAI direct API models by their naming convention.
  // xAI models like "grok-4-1-fast-reasoning" or "grok-4-fast" use xAI's native
  // format (no provider prefix). These models ALWAYS support reasoning param.
  // When not found in OpenRouter's model catalog, we must explicitly disable
  // reasoning to prevent it from consuming the output token budget.
  const isXaiDirectModel = /^grok-\d/.test(modelId)

  const config = await getModelConfig(modelId)

  // xAI direct models: Always disable reasoning to prevent token consumption
  // These won't be in OpenRouter's catalog, so config will be null
  if (isXaiDirectModel && !config) {
    return { enabled: false, max_tokens: 0 }
  }

  // Model doesn't support reasoning param at all - don't send anything
  if (!config?.supported_parameters?.includes('reasoning')) {
    return undefined
  }

  // Model has reasoning_effort = MANDATORY reasoning (e.g., openai/gpt-oss-120b)
  // Cannot disable, so use lowest effort to minimize token usage
  if (config.supported_parameters.includes('reasoning_effort')) {
    return { effort: 'low' }
  }

  // Model supports reasoning but NOT reasoning_effort = OPTIONAL reasoning
  // Disable to save tokens from being consumed by internal reasoning
  // TKT-065: Added max_tokens: 0 to explicitly reserve zero tokens for reasoning.
  // This prevents providers from allocating reasoning budget despite enabled: false.
  return { enabled: false, max_tokens: 0 }
}

