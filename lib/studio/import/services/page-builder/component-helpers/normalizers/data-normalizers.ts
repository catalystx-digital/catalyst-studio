/**
 * Data Component Normalizers
 *
 * Normalizers for data display components.
 *
 * @module data-normalizers
 */

import {
  expandSourceRecord,
  pruneObjectAgainstContract,
  type ComponentContentNormalizer,
  type LocalNormalizationWarning
} from './shared-normalizer-utils'

const STATISTICS_COLUMN_VALUES = new Set([2, 3, 4])

function normalizeStatisticsColumns(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return value
  }

  const parsed = Number(trimmed)
  if (Number.isInteger(parsed) && STATISTICS_COLUMN_VALUES.has(parsed)) {
    return parsed
  }

  return value
}

/**
 * Normalizes statistics component content.
 * Coerces schema-valid numeric column strings emitted by models while preserving
 * strict validation for out-of-range or non-numeric values.
 */
export const normalizeStatisticsContent: ComponentContentNormalizer = (
  rawContent: Record<string, any>,
  options: { parentCanonicalType: string; pageUrl?: string }
) => {
  const warnings: LocalNormalizationWarning[] = []
  const flattened = expandSourceRecord(rawContent, {
    canonicalType: 'statistics',
    parentCanonicalType: options.parentCanonicalType,
    field: 'content',
    index: 0,
    pageUrl: options.pageUrl
  })

  const normalized: Record<string, any> = { ...flattened }
  if ('columns' in normalized) {
    normalized.columns = normalizeStatisticsColumns(normalized.columns)
  }

  const { result: pruned, warnings: pruneWarnings } = pruneObjectAgainstContract(normalized, 'statistics', {
    childType: 'statistics'
  })
  if (pruneWarnings.length > 0) {
    warnings.push(...pruneWarnings)
  }

  return { content: pruned, warnings }
}
