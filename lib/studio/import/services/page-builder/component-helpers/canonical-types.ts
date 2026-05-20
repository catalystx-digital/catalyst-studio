/**
 * Canonical Type Utilities
 *
 * Type mapping and canonicalization functions extracted from component-helpers.ts
 *
 * @module canonical-types
 */

import { ComponentType as CmsComponentType } from '@/lib/studio/components/cms/_core/types'
import { canonicalizeComponentType as unifiedCanonicalize } from '@/lib/studio/components/cms/_core/canonicalization'

/**
 * Canonicalizes a component type string to its standard form.
 * Handles common aliases and variations.
 *
 * @deprecated Use the unified canonicalization module instead.
 * Import from '@/lib/studio/components/cms/_core/canonicalization'
 *
 * This function delegates to the unified implementation for backward compatibility.
 *
 * @param value - Component type string
 * @returns Canonicalized type or undefined
 *
 * @example
 * canonicalizeComponentType('nav-bar') // 'navbar'
 * canonicalizeComponentType('blog-article') // 'blog-post'
 */
export function canonicalizeComponentType(value: string | undefined | null): string | undefined {
  const result = unifiedCanonicalize(value)
  // Convert null to undefined for backward compatibility
  return result !== null ? result : undefined
}

/**
 * Normalizes a CMS component key.
 *
 * @param value - Component key
 * @returns Normalized key
 */
export function normalizeCmsComponentKey(value: string): string {
  return value
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
}

// Build lookup map for CMS component types
const CMS_COMPONENT_TYPE_LOOKUP: Map<string, CmsComponentType> = new Map(
  (Object.values(CmsComponentType) as string[]).map(value => [
    normalizeCmsComponentKey(value),
    value as CmsComponentType
  ])
)

/**
 * Converts a string to a CmsComponentType enum value.
 *
 * @param value - Component type string
 * @returns CmsComponentType or undefined
 */
export function toCmsComponentType(value: string | undefined | null): CmsComponentType | undefined {
  if (!value) {
    return undefined
  }
  return CMS_COMPONENT_TYPE_LOOKUP.get(normalizeCmsComponentKey(value))
}

/**
 * Component region types.
 */
export type ComponentRegion = 'header' | 'hero' | 'main' | 'sidebar' | 'footer'

/**
 * Normalizes a component region value.
 *
 * @param value - Region value
 * @returns Normalized region or undefined
 */
export function normalizeComponentRegionValue(value: unknown): ComponentRegion | undefined {
  if (typeof value !== 'string') {
    return undefined
  }
  const lower = value.trim().toLowerCase()

  // Primary mappings
  if (lower === 'header' || lower === 'navbar' || lower === 'nav' || lower === 'navigation') {
    return 'header'
  }
  if (lower === 'hero') {
    return 'hero'
  }
  if (lower === 'footer') {
    return 'footer'
  }
  if (lower === 'sidebar' || lower === 'side') {
    return 'sidebar'
  }
  if (lower === 'main' || lower === 'content' || lower === 'body') {
    return 'main'
  }

  // Check for partial matches
  if (lower.includes('hero')) {
    return 'hero'
  }
  if (lower.includes('header') || lower.includes('nav')) {
    return 'header'
  }
  if (lower.includes('footer')) {
    return 'footer'
  }
  if (lower.includes('sidebar') || lower.includes('side')) {
    return 'sidebar'
  }

  return 'main'
}

/**
 * Normalizes a token list, filtering out empty values.
 *
 * @param tokens - Array of tokens
 * @returns Normalized token list
 */
export function normalizeTokenList(tokens: string[] | undefined): string[] {
  if (!Array.isArray(tokens)) {
    return []
  }
  return tokens
    .map(t => (typeof t === 'string' ? t.trim() : ''))
    .filter(t => t.length > 0)
}
