/**
 * Unified Canonicalization Module
 *
 * Single source of truth for component type canonicalization.
 * Uses AliasRegistry for dynamic alias resolution instead of hardcoded switch.
 *
 * @module canonicalization
 */

import { ComponentType } from '@/lib/studio/components/cms/_core/types'
import { resolveAlias } from './alias-registry'

/**
 * Canonicalizes a component type string to a canonical string representation.
 * Handles common aliases and variations.
 *
 * Normalization strategy:
 * 1. Strip whitespace and convert to lowercase
 * 2. Remove version suffix (e.g., "-v2")
 * 3. Collapse spaces/underscores to hyphens
 * 4. Remove non-alphanumeric characters (except hyphens)
 * 5. Apply alias mapping via AliasRegistry
 * 6. Return canonical string or normalized alias for unknown types
 *
 * @param value - Component type string
 * @returns Canonical type string or null for invalid input
 *
 * @example
 * canonicalizeComponentType('nav-bar') // 'navbar'
 * canonicalizeComponentType('blog-article') // 'blog-post'
 * canonicalizeComponentType('unknown') // 'unknown'
 */
export function canonicalizeComponentType(
  value: string | undefined | null
): string | null {
  if (!value) {
    return null
  }

  // Normalize input
  const normalized = String(value).trim().toLowerCase()
  if (!normalized) {
    return null
  }

  // Remove version suffix (e.g., "-v2")
  const withoutVersion = normalized.replace(/-v\d+$/i, '')

  // Collapse spaces/underscores to hyphens
  const collapsed = withoutVersion.replace(/[\s_]+/g, '-')

  // Remove non-alphanumeric characters (except hyphens)
  const alias = collapsed.replace(/[^a-z0-9-]/g, '')

  // Resolve alias via registry
  const canonical = resolveAlias(alias)

  // Return canonical type or normalized alias for unknown types
  return canonical || alias
}
