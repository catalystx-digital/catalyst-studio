import OpenAI from 'openai'
import { ModelConfig, OpenRouterConfig, TimeoutConfig } from '../config'

interface ApiKeyValidationMessages {
  missing?: string
  invalid?: string
}

interface CreateLLMClientOptions {
  apiKey: string
  baseURL?: string
  referer?: string
  title: string
}

/**
 * Sanitizes a string value for use in HTTP headers.
 * Handles non-ASCII characters by encoding or removing them.
 * @internal Exported for testing purposes
 */
export function sanitizeHeaderValue(value: string | undefined): string | undefined {
  if (!value) {
    return undefined
  }
  const trimmed = value.trim()
  if (!trimmed) {
    return undefined
  }
  const hasNonAscii = /[^\x00-\xFF]/.test(trimmed)
  if (!hasNonAscii) {
    return trimmed
  }
  try {
    return encodeURI(trimmed)
  } catch {
    const cleaned = trimmed.replace(/[^\x00-\xFF]/g, '')
    return cleaned || undefined
  }
}

export function validateLLMApiKey(apiKey: string | undefined, messages?: ApiKeyValidationMessages): string {
  if (!apiKey) {
    throw new Error(
      messages?.missing ?? 'API key is required for studio LLM operations. Set OPENROUTER_API_KEY or provide apiKey in options.'
    )
  }
  if (typeof apiKey !== 'string') {
    throw new Error(messages?.invalid ?? 'Invalid API key format. API key must be a non-empty string.')
  }
  const trimmedKey = apiKey.trim()
  if (!trimmedKey) {
    throw new Error(messages?.invalid ?? 'Invalid API key format. API key must be a non-empty string.')
  }
  return trimmedKey
}

export function createLLMClient(options: CreateLLMClientOptions): OpenAI {
  const headers: Record<string, string> = {
    'X-Title': sanitizeHeaderValue(options.title) ?? 'Catalyst LLM Client',
    'X-Include-Usage': 'true'
  }
  const refererHeader = sanitizeHeaderValue(options.referer)
  if (refererHeader) {
    headers['HTTP-Referer'] = refererHeader
  }

  return new OpenAI({
    apiKey: options.apiKey,
    baseURL: options.baseURL || OpenRouterConfig.baseUrl,
    timeout: TimeoutConfig.perRequestMs,
    defaultHeaders: headers
  })
}

function getAllowedProvidersFromEnv(rawValue: string | undefined): string[] {
  if (!rawValue) {
    return []
  }
  return rawValue
    .split(',')
    .map(value => value.trim())
    .filter(value => value.length > 0)
}

export function applyAllowedProviders(payload: Record<string, unknown>): void {
  if (!payload || typeof payload !== 'object') {
    return
  }
  const providers = getAllowedProvidersFromEnv(ModelConfig.allowedProvider)
  if (!providers.length) {
    return
  }
  ;(payload as Record<string, unknown>).provider = { only: providers }
}
