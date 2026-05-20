/**
 * String Utilities for Component Normalization
 *
 * Common string manipulation functions extracted from component-helpers.ts
 *
 * @module string-utils
 */

const SUMMARY_MAX_LENGTH = 90

/**
 * Normalizes typographic characters for proper display.
 * Converts ASCII approximations to proper Unicode characters.
 *
 * - Ellipsis: `...` → `…`
 * - En-dash: `--` (not followed by another dash) → `–`
 * - Em-dash: `---` → `—`
 *
 * Note: Curly quotes are NOT auto-converted because:
 * 1. Context-dependent (opening vs closing) is error-prone
 * 2. Technical content often needs straight quotes (code, JSON)
 * 3. AI models can be prompted to use curly quotes when appropriate
 *
 * @param value - String to normalize
 * @returns String with proper typographic characters
 */
export function normalizeTypographicCharacters(value: string): string {
  return (
    value
      // Em-dash first (3 dashes) - must come before en-dash
      .replace(/---/g, '—')
      // En-dash (2 dashes, not followed by another dash)
      .replace(/--(?!-)/g, '–')
      // Ellipsis (3 periods)
      .replace(/\.{3}/g, '…')
  )
}

/**
 * Clamps a summary string to a maximum length.
 * Uses proper Unicode ellipsis character (…) for truncation.
 *
 * @param value - Value to clamp
 * @returns Clamped string or undefined
 */
export function clampSummary(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }
  const trimmed = value.trim()
  if (!trimmed) {
    return undefined
  }
  if (trimmed.length <= SUMMARY_MAX_LENGTH) {
    return normalizeTypographicCharacters(trimmed)
  }
  // Use Unicode ellipsis (…) - single character, so only subtract 1
  const truncated = trimmed.slice(0, SUMMARY_MAX_LENGTH - 1).trimEnd()
  return truncated ? `${truncated}…` : trimmed.slice(0, SUMMARY_MAX_LENGTH)
}

/**
 * Extracts summary from a JSON string.
 *
 * @param value - JSON string potentially containing a summary field
 * @returns Extracted summary or undefined
 */
export function extractSummaryFromJsonString(value: string | undefined): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }
  const trimmed = value.trim()
  if (!trimmed) {
    return undefined
  }
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed)
      if (parsed && typeof parsed === 'object') {
        const summary = (parsed as Record<string, unknown>).summary
        if (typeof summary === 'string') {
          const summaryTrimmed = summary.trim()
          return summaryTrimmed.length > 0 ? summaryTrimmed : undefined
        }
      }
    } catch {
      return undefined
    }
  }
  return trimmed
}

/**
 * Extracts the first sentence from a string.
 * Also normalizes typographic characters.
 *
 * @param value - Text to extract first sentence from
 * @returns First sentence or full text if no sentence ending found
 */
export function extractFirstSentence(value: string | undefined): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }
  const normalized = value.replace(/\s+/g, ' ').trim()
  if (!normalized) {
    return undefined
  }
  const match = /(.+?[.!?])(\s|$)/.exec(normalized)
  if (match && match[1]) {
    return normalizeTypographicCharacters(match[1].trim())
  }
  return normalizeTypographicCharacters(normalized)
}

/**
 * Common stop words for text processing.
 */
export const STOP_WORDS = new Set([
  'and',
  'the',
  'a',
  'an',
  'of',
  'to',
  'for',
  'in',
  'on',
  'at',
  'by',
  'with',
  'our',
  'your'
])

/**
 * Normalizes a string value.
 * Trims whitespace and converts typographic characters.
 *
 * @param value - Value to normalize
 * @returns Trimmed and normalized string or undefined
 */
export function normalizeString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }
  const trimmed = value.trim()
  if (trimmed.length === 0) {
    return undefined
  }
  return normalizeTypographicCharacters(trimmed)
}

/**
 * Checks if a string contains HTML tags.
 *
 * @param value - String to check
 * @returns True if contains HTML tags
 */
export function containsHtmlTags(value: string): boolean {
  return /<\/?[a-z][^>]*>/i.test(value)
}

/**
 * Strips HTML tags to plain text.
 *
 * @param value - HTML string
 * @returns Plain text
 */
export function stripHtmlToText(value: string): string {
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

/**
 * Converts plain text to HTML paragraphs.
 *
 * @param value - Plain text
 * @returns HTML with paragraphs
 */
export function convertPlainTextToHtml(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) {
    return ''
  }
  if (containsHtmlTags(trimmed)) {
    return trimmed
  }

  const paragraphs = trimmed
    .split(/\n\s*\n+/)
    .map(part => part.trim())
    .filter(Boolean)
    .map(part => `<p>${escapeHtml(part)}</p>`)

  if (paragraphs.length > 0) {
    return paragraphs.join('\n\n')
  }

  return `<p>${escapeHtml(trimmed)}</p>`
}

/**
 * Escapes HTML special characters.
 *
 * @param value - String to escape
 * @returns Escaped string
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Normalizes a boolean flag from various input types.
 *
 * @param value - Value to normalize
 * @returns Boolean or undefined
 */
export function normalizeBooleanFlag(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') {
    return value
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (!normalized) {
      return undefined
    }
    if (['true', 'yes', 'y', '1', 'on'].includes(normalized)) {
      return true
    }
    if (['false', 'no', 'n', '0', 'off'].includes(normalized)) {
      return false
    }
  }

  if (typeof value === 'number') {
    if (value === 1) {
      return true
    }
    if (value === 0) {
      return false
    }
  }

  return undefined
}

/**
 * Checks if value is a plain object (not array).
 *
 * @param value - Value to check
 * @returns True if plain object
 */
export function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
