/**
 * Feature Component Normalizers
 *
 * Normalizers for feature display components.
 *
 * @module feature-normalizers
 */

import {
  expandSourceRecord,
  pruneObjectAgainstContract,
  type ComponentContentNormalizer
} from './shared-normalizer-utils'

function normalizeGridColumns(value: unknown): unknown {
  const parsed = typeof value === 'string' ? Number(value.trim()) : value
  if (!Number.isInteger(parsed)) {
    return value
  }

  return Math.min(4, Math.max(2, parsed as number))
}

export const normalizeFeatureGridContent: ComponentContentNormalizer = (
  rawContent: Record<string, any>,
  options: { parentCanonicalType: string; pageUrl?: string }
) => {
  const flattened = expandSourceRecord(rawContent, {
    canonicalType: 'feature-grid',
    parentCanonicalType: options.parentCanonicalType,
    field: 'content',
    index: 0,
    pageUrl: options.pageUrl
  })
  const normalized: Record<string, any> = { ...flattened }

  if ('columns' in normalized) {
    normalized.columns = normalizeGridColumns(normalized.columns)
  }

  const { result, warnings } = pruneObjectAgainstContract(normalized, 'feature-grid', {
    childType: 'feature-grid'
  })
  return { content: result, warnings }
}
