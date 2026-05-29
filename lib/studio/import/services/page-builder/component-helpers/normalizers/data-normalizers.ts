/**
 * Data Component Normalizers
 *
 * Normalizers for data display components.
 *
 * @module data-normalizers
 */

import {
  expandSourceRecord,
  isRecord,
  normalizeString,
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

function slugFromLabel(label: string): string {
  return label
    .replace(/<[^>]+>/g, ' ')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 48) || 'stat'
}

function coerceFiniteNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value !== 'string') {
    return undefined
  }
  const trimmed = value.trim().replace(/,/g, '')
  if (!trimmed) {
    return undefined
  }
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : undefined
}

function normalizeStatDelta(value: unknown, source: Record<string, any>): Record<string, any> | undefined {
  const raw = isRecord(value) ? value : source
  const deltaValue = coerceFiniteNumber(raw.value ?? raw.deltaValue ?? raw.change ?? raw.percentChange)
  const label = normalizeString(raw.label ?? raw.deltaLabel ?? raw.changeLabel)
  const trendRaw = normalizeString(raw.trend ?? raw.direction)?.toLowerCase()
  const trend =
    trendRaw === 'up' || trendRaw === 'increase' || trendRaw === 'positive'
      ? 'up'
      : trendRaw === 'down' || trendRaw === 'decrease' || trendRaw === 'negative'
        ? 'down'
        : deltaValue !== undefined && deltaValue < 0
          ? 'down'
          : deltaValue !== undefined && deltaValue > 0
            ? 'up'
            : undefined

  const delta: Record<string, any> = {}
  if (deltaValue !== undefined) delta.value = deltaValue
  if (label) delta.label = label
  if (trend) delta.trend = trend
  return Object.keys(delta).length > 0 ? delta : undefined
}

function normalizeStatItem(
  item: unknown,
  index: number,
  warnings: LocalNormalizationWarning[]
): Record<string, any> | undefined {
  if (!isRecord(item)) {
    warnings.push({
      issue: 'invalid-subcomponent',
      message: `Dropped statistic at index ${index} because payload is not an object.`,
      field: 'stats',
      childType: 'stat-item',
      details: { index, valueType: typeof item }
    })
    return undefined
  }

  const flattened = expandSourceRecord(item, {
    canonicalType: 'stat-item',
    parentCanonicalType: 'statistics',
    field: 'stats',
    index
  })
  const label = normalizeString(flattened.label ?? flattened.name ?? flattened.title ?? flattened.caption ?? flattened.text)
  const rawValue = flattened.value ?? flattened.number ?? flattened.count ?? flattened.metric ?? flattened.stat ?? flattened.amount
  const numericValue = coerceFiniteNumber(rawValue)
  const stringValue = normalizeString(rawValue)

  if (!label || (numericValue === undefined && !stringValue)) {
    warnings.push({
      issue: 'missing-required-field',
      message: `Dropped statistic at index ${index} because label or value is missing.`,
      field: 'stats',
      childType: 'stat-item',
      details: { index, labelPresent: Boolean(label), valuePresent: numericValue !== undefined || Boolean(stringValue) }
    })
    return undefined
  }

  const stat: Record<string, any> = {
    id: normalizeString(flattened.id) ?? `stat-${slugFromLabel(label)}`,
    value: numericValue ?? stringValue,
    label
  }
  const prefix = normalizeString(flattened.prefix)
  const suffix = normalizeString(flattened.suffix ?? flattened.unit)
  const icon = normalizeString(flattened.icon)
  const description = normalizeString(flattened.description ?? flattened.supportingText)
  const decimalPlaces = coerceFiniteNumber(flattened.decimalPlaces)
  const animationDuration = coerceFiniteNumber(flattened.animationDuration)
  const delta = normalizeStatDelta(flattened.delta, flattened)

  if (prefix) stat.prefix = prefix
  if (suffix) stat.suffix = suffix
  if (icon) stat.icon = icon
  if (description) stat.description = description
  if (decimalPlaces !== undefined && Number.isInteger(decimalPlaces) && decimalPlaces >= 0) stat.decimalPlaces = decimalPlaces
  if (animationDuration !== undefined && animationDuration > 0) stat.animationDuration = animationDuration
  if (delta) stat.delta = delta

  return stat
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
  const statsSource = flattened.stats ?? flattened.items ?? flattened.metrics ?? flattened.numbers ?? flattened.kpis
  if (Array.isArray(statsSource)) {
    normalized.stats = statsSource
      .map((item, index) => normalizeStatItem(item, index, warnings))
      .filter((item): item is Record<string, any> => Boolean(item))
  }

  const layout = normalizeString(normalized.layout ?? normalized.variant)?.toLowerCase()
  if (layout === 'row' || layout === 'horizontal') normalized.layout = 'row'
  else if (layout === 'grid' || layout === 'cards') normalized.layout = 'grid'

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
