/**
 * Shared Normalizer Utilities
 *
 * Common helper functions used across component content normalizers.
 * Extracted from component-helpers.ts for modularity.
 *
 * @module shared-normalizer-utils
 */

import { getComponentContractByCanonicalType } from '@/lib/studio/components/catalog/component-contracts'
import {
  expandSourceRecord,
  normalizeImage,
  type NormalizedImageValue
} from '../../subcomponent-normalizers'
import {
  normalizeString,
  normalizeBooleanFlag,
  isRecord
} from '../string-utils'
import { normalizeTokenList } from '../canonical-types'
import type { NormalizationIssueCode } from '../../normalization-telemetry'

// Re-export commonly used utilities for convenience
export { expandSourceRecord, normalizeImage, type NormalizedImageValue }
export { normalizeString, normalizeBooleanFlag, isRecord }
export { normalizeTokenList }

/**
 * Local normalization warning type used by all normalizers.
 */
export type LocalNormalizationWarning = {
  issue: NormalizationIssueCode
  message: string
  field?: string
  childType?: string
  details?: Record<string, unknown>
}

/**
 * Normalizer function signature for component content.
 */
export type ComponentContentNormalizer = (
  content: Record<string, any>,
  options: { parentCanonicalType: string; pageUrl?: string }
) => { content: Record<string, any>; warnings: LocalNormalizationWarning[] }

/**
 * Extracts a URL from various input formats.
 * Handles nested objects with url/href/link keys.
 *
 * @param value - Value to extract URL from
 * @returns Extracted URL string or undefined
 */
export function extractLinkUrl(value: unknown): string | undefined {
  const visited = new Set<unknown>()

  const visit = (input: unknown): string | undefined => {
    if (typeof input === 'string') {
      return normalizeString(input)
    }

    if (!input || typeof input !== 'object') {
      return undefined
    }

    if (visited.has(input)) {
      return undefined
    }
    visited.add(input)

    if (Array.isArray(input)) {
      for (const entry of input) {
        const result = visit(entry)
        if (result) {
          return result
        }
      }
      return undefined
    }

    const record = input as Record<string, unknown>
    const keys = ['url', 'href', 'link', 'originalUrl', 'src', 'value', 'permalink', 'path']
    for (const key of keys) {
      if (key in record) {
        const result = visit(record[key])
        if (result) {
          return result
        }
      }
    }
    return undefined
  }

  return visit(value)
}

/**
 * Checks if a value is present (non-null, non-empty).
 *
 * @param value - Value to check
 * @returns True if value is present
 */
export function isValuePresent(value: unknown): boolean {
  if (value == null) {
    return false
  }
  if (typeof value === 'string') {
    return value.trim().length > 0
  }
  if (Array.isArray(value)) {
    return value.length > 0
  }
  if (typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>).length > 0
  }
  return true
}

/**
 * Prunes an object to only contain keys allowed by the component contract.
 *
 * @param value - Object to prune
 * @param canonicalType - Component type to validate against
 * @param context - Context for warning messages
 * @returns Pruned object and any warnings
 */
export function pruneObjectAgainstContract(
  value: Record<string, any>,
  canonicalType: string,
  context: { field?: string; childType?: string }
): { result: Record<string, any>; warnings: LocalNormalizationWarning[] } {
  const warnings: LocalNormalizationWarning[] = []
  const contract = getComponentContractByCanonicalType(canonicalType)
  if (!contract || !contract.propsMeta) {
    return { result: { ...value }, warnings }
  }

  // Schema-first: propsMeta is derived from schema or legacy propsMeta in contract
  const propsMeta = contract.propsMeta
  const allowedKeys = new Set(Object.keys(propsMeta))
  const alwaysAllowed = new Set(['id', 'type', 'metadata'])
  const normalized: Record<string, any> = {}

  for (const [key, raw] of Object.entries(value)) {
    if (allowedKeys.has(key) || alwaysAllowed.has(key)) {
      normalized[key] = raw
    } else {
      warnings.push({
        issue: 'unknown-field',
        message: `Removed unsupported field "${key}" from ${canonicalType}.`,
        field: context.field ?? key,
        childType: context.childType ?? canonicalType,
        details: { field: key }
      })
    }
  }

  for (const [key, meta] of Object.entries(propsMeta)) {
    const existing = normalized[key]
    if (typeof existing === 'string') {
      normalized[key] = existing.trim()
    }

    if (meta.required && !isValuePresent(existing)) {
      warnings.push({
        issue: 'missing-required-field',
        message: `Normalized ${canonicalType} is missing required "${key}" field.`,
        field: context.field ?? key,
        childType: context.childType ?? canonicalType,
        details: { field: key }
      })
    }
  }

  if ('metadata' in normalized) {
    const metaValue = normalized.metadata
    if (isRecord(metaValue)) {
      const metadata: Record<string, unknown> = {}
      const category = normalizeString(metaValue.category)
      const date = normalizeString(metaValue.date)
      const tags = Array.isArray(metaValue.tags)
        ? Array.from(
            new Set(
              metaValue.tags
                .map(tag => normalizeString(tag))
                .filter((tag): tag is string => typeof tag === 'string' && tag.length > 0)
            )
          )
        : undefined

      if (category) {
        metadata.category = category
      }
      if (date) {
        metadata.date = date
      }
      if (tags && tags.length > 0) {
        metadata.tags = tags
      }

      normalized.metadata = Object.keys(metadata).length > 0 ? metadata : undefined
      if (!normalized.metadata) {
        delete normalized.metadata
      }
    } else {
      delete normalized.metadata
    }
  }

  return { result: normalized, warnings }
}

/**
 * Normalizes an overlay opacity value to a 0-1 range.
 *
 * @param value - Opacity value (number, string, or percent)
 * @returns Normalized opacity between 0 and 1, or undefined
 */
export function normalizeOverlayOpacityValue(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const clamped = Math.max(0, Math.min(1, value))
    return clamped
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) {
      return undefined
    }

    const isPercent = trimmed.endsWith('%')
    const numericPortion = isPercent ? trimmed.slice(0, -1) : trimmed
    const parsed = Number.parseFloat(numericPortion)
    if (!Number.isFinite(parsed)) {
      return undefined
    }

    let normalized = isPercent ? parsed / 100 : parsed
    if (!isPercent && normalized > 1 && normalized <= 100) {
      normalized = normalized / 100
    }

    if (!Number.isFinite(normalized)) {
      return undefined
    }

    return Math.max(0, Math.min(1, normalized))
  }
  return undefined
}

/**
 * Checks if a string value looks like a CSS color or gradient.
 *
 * @param value - String to check
 * @returns True if value appears to be a color or gradient
 */
export function isLikelyColorOrGradient(value: string): boolean {
  const normalized = value.trim().toLowerCase()
  if (!normalized) {
    return false
  }

  return (
    normalized.startsWith('#') ||
    normalized.startsWith('rgb') ||
    normalized.startsWith('hsl') ||
    normalized.startsWith('var(') ||
    normalized.startsWith('color-mix(') ||
    normalized.includes('gradient')
  )
}

/**
 * Hero background focal point values.
 */
export type HeroBackgroundFocalPoint = 'center' | 'top' | 'bottom' | 'left' | 'right'

/**
 * Normalizes a hero background focal point value.
 *
 * @param value - Focal point string
 * @returns Normalized focal point or undefined
 */
export function normalizeHeroBackgroundFocalPoint(value: unknown): HeroBackgroundFocalPoint | undefined {
  if (typeof value !== 'string') {
    return undefined
  }

  const normalized = value.trim().toLowerCase()
  if (!normalized) {
    return undefined
  }

  const directMap: Record<string, HeroBackgroundFocalPoint> = {
    center: 'center',
    centre: 'center',
    middle: 'center',
    'center center': 'center',
    'centre centre': 'center',
    'middle center': 'center',
    top: 'top',
    'top center': 'top',
    'center top': 'top',
    bottom: 'bottom',
    'bottom center': 'bottom',
    'center bottom': 'bottom',
    left: 'left',
    'center left': 'left',
    'left center': 'left',
    right: 'right',
    'center right': 'right',
    'right center': 'right'
  }

  if (directMap[normalized]) {
    return directMap[normalized]
  }

  const condensed = normalized.replace(/\s+/g, ' ')
  if (condensed.includes('top')) {
    return 'top'
  }
  if (condensed.includes('bottom')) {
    return 'bottom'
  }
  if (condensed.includes('left')) {
    return 'left'
  }
  if (condensed.includes('right')) {
    return 'right'
  }
  if (condensed.includes('center') || condensed.includes('centre') || condensed.includes('middle')) {
    return 'center'
  }

  return undefined
}

/**
 * Coerces a value to a boolean.
 *
 * @param value - Value to coerce
 * @returns Boolean value
 */
export function coerceBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value
  }
  if (typeof value === 'number') {
    return value !== 0
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (!normalized) {
      return false
    }
    if (normalized === 'false' || normalized === '0' || normalized === 'no' || normalized === 'off') {
      return false
    }
    return ['true', '1', 'yes', 'on', 'progress', 'progressive', 'enabled'].includes(normalized)
  }
  return false
}
