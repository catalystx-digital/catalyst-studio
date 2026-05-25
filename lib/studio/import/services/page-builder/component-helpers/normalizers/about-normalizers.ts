/**
 * About Component Normalizers
 *
 * Normalizers for about/team display components.
 *
 * @module about-normalizers
 */

import {
  expandSourceRecord,
  pruneObjectAgainstContract,
  type ComponentContentNormalizer,
  type LocalNormalizationWarning
} from './shared-normalizer-utils'

const TEAM_GRID_COLUMN_VALUES: Record<string, Set<number>> = {
  mobile: new Set([1, 2]),
  tablet: new Set([2, 3]),
  desktop: new Set([3, 4, 5]),
  large: new Set([4, 5, 6])
}

function coerceTeamGridColumnValue(key: string, value: unknown): unknown {
  if (typeof value !== 'string') {
    return value
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return value
  }

  const parsed = Number(trimmed)
  if (Number.isInteger(parsed) && TEAM_GRID_COLUMN_VALUES[key]?.has(parsed)) {
    return parsed
  }

  return value
}

function normalizeTeamGridColumns(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return value
  }

  const normalized: Record<string, unknown> = { ...(value as Record<string, unknown>) }
  for (const key of Object.keys(TEAM_GRID_COLUMN_VALUES)) {
    if (key in normalized) {
      normalized[key] = coerceTeamGridColumnValue(key, normalized[key])
    }
  }

  return normalized
}

/**
 * Normalizes team-grid component content.
 * Coerces schema-valid responsive column strings emitted by models while
 * preserving strict validation for out-of-range or non-numeric values.
 */
export const normalizeTeamGridContent: ComponentContentNormalizer = (
  rawContent: Record<string, any>,
  options: { parentCanonicalType: string; pageUrl?: string }
) => {
  const warnings: LocalNormalizationWarning[] = []
  const flattened = expandSourceRecord(rawContent, {
    canonicalType: 'team-grid',
    parentCanonicalType: options.parentCanonicalType,
    field: 'content',
    index: 0,
    pageUrl: options.pageUrl
  })

  const normalized: Record<string, any> = { ...flattened }
  if ('columns' in normalized) {
    normalized.columns = normalizeTeamGridColumns(normalized.columns)
  }

  const { result: pruned, warnings: pruneWarnings } = pruneObjectAgainstContract(normalized, 'team-grid', {
    childType: 'team-grid'
  })
  if (pruneWarnings.length > 0) {
    warnings.push(...pruneWarnings)
  }

  return { content: pruned, warnings }
}
