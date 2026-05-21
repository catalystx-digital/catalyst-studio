/**
 * LLM-Based Design System Generator
 *
 * Generates shadcn-compatible design system tokens from user prompts.
 * Used by greenfield website workflow when no inspiration URL is provided.
 *
 * @module design-system/prompt-design-system-generator
 */

import { createLLMClient, validateLLMApiKey } from '@/lib/studio/import/services/llm-client'
import { ModelConfig, OpenRouterConfig } from '@/lib/studio/import/config'
import { SHADCN_DEFAULTS, getShadcnVariablesWithDefaults } from './shadcn-defaults'
import type { ShadcnDesignSystemTokens } from './shadcn-transformer'

/**
 * Options for design system generation
 */
export interface GenerateDesignSystemOptions {
  /** User's prompt describing the website */
  prompt: string
  /** API key for LLM (defaults to OPENROUTER_API_KEY) */
  apiKey?: string
  /** Model to use (defaults to typeExtraction model) */
  model?: string
}

/**
 * Result of design system generation
 */
export interface GenerateDesignSystemResult {
  /** Generated design system tokens */
  tokens: ShadcnDesignSystemTokens
  /** Whether colors were extracted from prompt or defaults used */
  hasCustomColors: boolean
  /** Theme mode (light/dark) */
  mode: 'light' | 'dark'
  /** Generation metadata */
  metadata: {
    model: string
    promptLength: number
    generatedAt: string
  }
}

/**
 * LLM response structure for design system generation
 */
interface LLMDesignSystemResponse {
  mode: 'light' | 'dark'
  colors: {
    primary?: string      // HSL values without hsl() wrapper, e.g., "220 70% 50%"
    secondary?: string
    accent?: string
    background?: string
    foreground?: string
    muted?: string
    border?: string
  }
  typography?: {
    fontFamily?: string
    borderRadius?: string // e.g., "0.5rem"
  }
  reasoning?: string
}

/**
 * System prompt for design system generation
 */
const SYSTEM_PROMPT = `You are a professional UI/UX designer specializing in creating modern, cohesive design systems.

Your task is to generate a design system based on the user's website description. The design system should use shadcn/ui conventions with HSL color values.

IMPORTANT: Return ONLY valid JSON, no markdown code blocks, no explanations outside the JSON.

Output format:
{
  "mode": "light" | "dark",
  "colors": {
    "primary": "H S% L%",
    "secondary": "H S% L%",
    "accent": "H S% L%",
    "background": "H S% L%",
    "foreground": "H S% L%",
    "muted": "H S% L%",
    "border": "H S% L%"
  },
  "typography": {
    "fontFamily": "Inter, system-ui, sans-serif",
    "borderRadius": "0.5rem"
  },
  "reasoning": "Brief explanation of design choices"
}

Guidelines:
1. HSL values should be in format "H S% L%" (e.g., "220 70% 50%") WITHOUT the hsl() wrapper
2. For "modern tech startup" → Use blues, clean whites, minimal accents
3. For "warm/cozy" → Use warm earth tones, browns, oranges
4. For "professional/corporate" → Use navy blues, grays, conservative palette
5. For "creative/playful" → Use vibrant colors, purples, pinks, gradients
6. For "eco/nature" → Use greens, earth tones, natural colors
7. For "luxury/studio" → Use deep colors, golds, blacks
8. If user mentions "dark theme" → Set mode to "dark" and adjust colors accordingly
9. Ensure sufficient contrast between background and foreground
10. Keep accent colors complementary to primary`

/**
 * Generate design system tokens from a user prompt using LLM
 *
 * @param options - Generation options including prompt
 * @returns Generated design system tokens
 *
 * @example
 * ```typescript
 * const result = await generateDesignSystemFromPrompt({
 *   prompt: "A modern tech startup with a clean blue theme"
 * })
 * // result.tokens contains shadcn CSS variables
 * ```
 */
export async function generateDesignSystemFromPrompt(
  options: GenerateDesignSystemOptions
): Promise<GenerateDesignSystemResult> {
  const { prompt, apiKey, model } = options

  // Validate inputs
  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    // Return defaults if no prompt
    return createDefaultResult(prompt)
  }

  // Check for API key
  const resolvedApiKey = apiKey || process.env.OPENROUTER_API_KEY
  if (!resolvedApiKey) {
    console.warn('[PromptDesignSystemGenerator] No API key available, using defaults')
    return createDefaultResult(prompt)
  }

  // TKT-088: Use env model to support xAI direct API (which doesn't have openai/gpt-4o-mini)
  const baseUrl = OpenRouterConfig.baseUrl
  const isXaiDirect = baseUrl.includes('api.x.ai')
  const configuredModel =
    model?.trim() ||
    (isXaiDirect ? process.env.OPENROUTER_MODEL?.trim() : process.env.IMPORT_MODEL_CHAIN?.split('|')[0]?.trim()) ||
    process.env.OPENROUTER_MODEL?.trim() ||
    ModelConfig.typeExtraction
  const resolvedModel = isXaiDirect && configuredModel.includes('/')
    ? configuredModel.split('/').pop() || configuredModel
    : configuredModel

  try {
    const validatedKey = validateLLMApiKey(resolvedApiKey)
    const client = createLLMClient({
      apiKey: validatedKey,
      baseURL: baseUrl,
      title: 'Catalyst Design System Generator',
    })

    const response = await client.chat.completions.create({
      model: resolvedModel,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Generate a design system for this website: ${prompt.trim()}` },
      ],
      temperature: 0.7,
      max_tokens: 1000,
      response_format: { type: 'json_object' },
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      console.warn('[PromptDesignSystemGenerator] Empty LLM response, using defaults')
      return createDefaultResult(prompt)
    }

    // Parse LLM response
    const parsed = parseDesignSystemResponse(content)
    if (!parsed) {
      console.warn('[PromptDesignSystemGenerator] Failed to parse LLM response, using defaults')
      return createDefaultResult(prompt)
    }

    // Convert to shadcn tokens
    const customVariables = convertToShadcnVariables(parsed)
    const tokens = createTokensFromParsed(parsed, customVariables, prompt)

    return {
      tokens,
      hasCustomColors: Object.keys(customVariables).length > 0,
      mode: parsed.mode || 'light',
      metadata: {
        model: resolvedModel,
        promptLength: prompt.length,
        generatedAt: new Date().toISOString(),
      },
    }
  } catch (error) {
    console.error('[PromptDesignSystemGenerator] LLM call failed:', error)
    return createDefaultResult(prompt)
  }
}

/**
 * Parse LLM response JSON
 */
function parseDesignSystemResponse(content: string): LLMDesignSystemResponse | null {
  try {
    // Try direct JSON parse
    const parsed = JSON.parse(content)
    return parsed as LLMDesignSystemResponse
  } catch {
    // Try to extract JSON from markdown code block
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1].trim()) as LLMDesignSystemResponse
      } catch {
        return null
      }
    }
    return null
  }
}

/**
 * Convert parsed LLM response to shadcn CSS variables
 */
function convertToShadcnVariables(parsed: LLMDesignSystemResponse): Record<string, string> {
  const variables: Record<string, string> = {}

  if (parsed.colors) {
    // Map LLM colors to shadcn variable names
    if (parsed.colors.primary) {
      variables['--primary'] = parsed.colors.primary
      variables['--primary-foreground'] = getForegroundForHsl(parsed.colors.primary)
      variables['--ring'] = parsed.colors.primary
    }
    if (parsed.colors.secondary) {
      variables['--secondary'] = parsed.colors.secondary
      variables['--secondary-foreground'] = getForegroundForHsl(parsed.colors.secondary)
    }
    if (parsed.colors.accent) {
      variables['--accent'] = parsed.colors.accent
      variables['--accent-foreground'] = getForegroundForHsl(parsed.colors.accent)
    }
    if (parsed.colors.background) {
      variables['--background'] = parsed.colors.background
    }
    if (parsed.colors.foreground) {
      variables['--foreground'] = parsed.colors.foreground
    }
    if (parsed.colors.muted) {
      variables['--muted'] = parsed.colors.muted
      variables['--muted-foreground'] = adjustLightness(parsed.colors.muted, -30)
    }
    if (parsed.colors.border) {
      variables['--border'] = parsed.colors.border
      variables['--input'] = parsed.colors.border
    }
  }

  if (parsed.typography?.borderRadius) {
    variables['--radius'] = parsed.typography.borderRadius
  }

  return variables
}

/**
 * Get appropriate foreground color for a background HSL value
 */
function getForegroundForHsl(hsl: string): string {
  // Parse HSL: "H S% L%"
  const parts = hsl.split(/\s+/)
  if (parts.length < 3) return '0 0% 100%' // Default white

  const lightness = parseFloat(parts[2])
  // If background is dark (L < 50%), use light foreground
  return lightness < 50 ? '0 0% 98%' : '0 0% 9%'
}

/**
 * Adjust lightness of an HSL value
 */
function adjustLightness(hsl: string, delta: number): string {
  const parts = hsl.split(/\s+/)
  if (parts.length < 3) return hsl

  const h = parts[0]
  const s = parts[1]
  let l = parseFloat(parts[2])
  l = Math.max(0, Math.min(100, l + delta))

  return `${h} ${s} ${l}%`
}

/**
 * Create tokens from parsed response
 */
function createTokensFromParsed(
  parsed: LLMDesignSystemResponse,
  customVariables: Record<string, string>,
  prompt: string
): ShadcnDesignSystemTokens {
  const mergedVariables = getShadcnVariablesWithDefaults(customVariables, parsed.mode || 'light')

  return {
    variables: mergedVariables,
    extraction: {
      timestamp: new Date().toISOString(),
      confidence: 0.8,
      source: 'llm-prompt',
      detectedCount: Object.keys(customVariables).length,
      defaultCount: Object.keys(SHADCN_DEFAULTS).length - Object.keys(customVariables).length,
      promptSource: prompt.substring(0, 100), // Store truncated prompt for reference
    },
  }
}

/**
 * Create default result when LLM is unavailable
 */
function createDefaultResult(prompt: string): GenerateDesignSystemResult {
  // Simple mode detection from prompt
  const promptLower = (prompt || '').toLowerCase()
  const mode = promptLower.includes('dark') ? 'dark' : 'light'

  return {
    tokens: {
      variables: getShadcnVariablesWithDefaults({}, mode),
      extraction: {
        timestamp: new Date().toISOString(),
        confidence: 0.5,
        source: 'default',
        detectedCount: 0,
        defaultCount: Object.keys(SHADCN_DEFAULTS).length,
      },
    },
    hasCustomColors: false,
    mode,
    metadata: {
      model: 'default',
      promptLength: prompt?.length || 0,
      generatedAt: new Date().toISOString(),
    },
  }
}
