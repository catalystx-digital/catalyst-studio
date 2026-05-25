/**
 * Unified Field Type Normalizer
 *
 * Centralizes type normalization logic used across multiple layers:
 * - 'ui': Property editor (transforms 'url' → 'externalUrl')
 * - 'validation': Detection/validation (preserves 'url' → 'url')
 * - 'universal': Export/schema adapter (preserves 'url' → 'url')
 */

import { getAllValueObjectNames } from '@/lib/studio/components/cms/_core/value-objects/registry-lookup'

export type NormalizationLayer = 'ui' | 'validation' | 'universal'

// Cache of value object names for fast lookup
let valueObjectNamesSet: Set<string> | null = null

function getValueObjectNamesSet(): Set<string> {
  if (!valueObjectNamesSet) {
    valueObjectNamesSet = new Set(getAllValueObjectNames())
  }
  return valueObjectNamesSet
}

export interface NormalizedFieldType {
  type: string
  options?: Array<{ label: string; value: string | number }>
  items?: NormalizedFieldType
  fields?: Record<string, NormalizedFieldType>
  allowedTypes?: string[]
}

/**
 * Normalize a raw type string to a standardized field type
 *
 * @param rawType - The raw type string from propsMeta or schema
 * @param options - Optional configuration including layer context
 * @returns Normalized field type with optional metadata (options, etc.)
 */
export function normalizeFieldType(
  rawType: string,
  options?: { layer?: NormalizationLayer }
): NormalizedFieldType {
  const layer = options?.layer ?? 'universal'
  const raw = (rawType || '').trim()
  const lower = raw.toLowerCase()
  const collapsed = lower.replace(/[\s_-]+/g, '')

  // Arrays (detect first to avoid inner keyword hijacking like 'image' inside generics)
  // Matches: Array<...>, ...[], or mentions of 'array'
  if (/^array\s*<.*>$/i.test(raw) || /\[\s*\]$/.test(lower) || lower.includes('array')) {
    return { type: 'array' }
  }

  // Explicit content reference tokens
  if (lower === 'contentreference' || lower === 'reference' || lower === 'content') {
    return { type: 'reference' }
  }

  // Explicit content array tokens
  if (lower === 'content[]' || /array\s*<\s*content\s*>/.test(lower) || lower === 'contentreference[]') {
    return { type: 'array' }
  }

  // Object-like shapes (should not be treated as component/media)
  // Examples: "{ a:string; image?:string }", "object", etc.
  if (lower.startsWith('{') || lower.includes('object') || /\{\s*[^}]+\s*\}/.test(raw)) {
    return { type: 'object' }
  }

  // HTML/rich text
  if (lower.includes('html') || collapsed.includes('richtext') || lower === 'xhtml') {
    return { type: 'richText' }
  }

  // Boolean
  if (lower === 'bool' || lower === 'boolean') {
    return { type: 'boolean' }
  }

  // Media/File/Image (only after ruling out arrays)
  if (['media', 'image', 'file', 'asset'].some(k => lower.includes(k))) {
    return { type: 'media' }
  }

  // Number (support unit suffixes like number(ms), number(px))
  if (lower.startsWith('number') || lower === 'integer' || lower === 'float' || lower === 'decimal') {
    return { type: 'number' }
  }

  // URL - LAYER-AWARE TRANSFORMATION
  // UI layer: 'url' → 'externalUrl' (for property editor)
  // Validation/Universal layers: 'url' → 'url' (for detection/export)
  if (lower === 'url' || lower === 'link') {
    return { type: layer === 'ui' ? 'externalUrl' : 'url' }
  }

  // Enum as union of quoted strings: 'left'|'center'|'right'
  const unionStringMatch = raw.match(/'(?:[^']+)'(?:\s*\|\s*'(?:[^']+)')+/)
  if (unionStringMatch) {
    const parts = raw
      .split('|')
      .map(s => s.trim())
      .map(s => s.replace(/^'+|'+$/g, ''))
    const options = parts.map(p => ({ label: p, value: p }))
    return { type: 'select', options }
  }

  // Enum as union of numbers: 1|2|3
  const unionNumberMatch = raw.match(/^(\d+\s*(?:\|\s*\d+)+)$/)
  if (unionNumberMatch) {
    const parts = raw
      .split('|')
      .map(s => s.trim())
      .map(s => Number(s))
      .filter(n => !Number.isNaN(n))
    const options = parts.map(n => ({ label: String(n), value: n }))
    return { type: 'select', options }
  }

  if (lower === 'json') {
    return { type: 'json' }
  }

  // Additional simple types for UI layer compatibility
  if (layer === 'ui') {
    const uiSpecificTypes: Record<string, string> = {
      'text': 'text',
      'markdown': 'markdown',
      'date': 'date',
      'datetime': 'datetime',
      'time': 'time',
      'color': 'color',
      'video': 'video',
      'email': 'email',
      'phone': 'phone',
      'icon': 'icon',
    }
    const uiType = uiSpecificTypes[lower]
    if (uiType) {
      return { type: uiType }
    }
  }

  // Value objects from registry (Logo, MenuItem, CTAButton, etc.) are objects
  // Check the raw type (not lowercased) since value object names are PascalCase
  if (getValueObjectNamesSet().has(raw)) {
    return { type: 'object' }
  }

  // Default to string
  return { type: 'string' }
}
