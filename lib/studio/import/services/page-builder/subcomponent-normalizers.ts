import { createHash } from 'crypto'

import { isProcessableUrl, isLikelyImageUrl, isDefinitelyPageUrl } from '../../utils/url-transformer'
import type { NormalizationIssueCode } from './normalization-telemetry'

export interface SubcomponentNormalizerContext {
  canonicalType: string
  parentCanonicalType: string
  field: string
  index: number
  pageUrl?: string
}

export interface SubcomponentNormalizationWarning {
  issue: NormalizationIssueCode
  message: string
  details?: Record<string, unknown>
}

export interface SubcomponentNormalizationResult {
  value: Record<string, any> | null
  warnings: SubcomponentNormalizationWarning[]
  contractOverride?: string
}

export type SubcomponentNormalizer = (
  input: unknown,
  context: SubcomponentNormalizerContext
) => SubcomponentNormalizationResult

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function normalizeString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function extractFirstSentence(value: string | undefined): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }
  const normalized = value.replace(/\s+/g, ' ').trim()
  if (!normalized) {
    return undefined
  }
  const match = /(.+?[.!?])(\s|$)/.exec(normalized)
  if (match && match[1]) {
    return match[1].trim()
  }
  return normalized
}

const NESTED_SOURCE_KEYS = ['content', 'data', 'fields', 'attributes', 'props', 'payload'] as const

export interface FlattenContext {
  canonicalType?: string
  parentCanonicalType?: string
  field?: string
  index?: number
  pageUrl?: string
}

export function expandSourceRecord(input: Record<string, any>, context?: FlattenContext): Record<string, any> {
  const merged: Record<string, any> = { ...input }
  const visited = new Set<Record<string, any>>()
  const queue: Record<string, any>[] = []
  const flattened = new Set<string>()

  const enqueue = (value: unknown) => {
    if (isRecord(value) && !visited.has(value)) {
      visited.add(value)
      queue.push(value)
    }
  }

  enqueue(input)

  while (queue.length > 0) {
    const current = queue.shift()!
    for (const key of NESTED_SOURCE_KEYS) {
      const nested = current[key]
      if (!isRecord(nested)) {
        continue
      }

      enqueue(nested)

      for (const [nestedKey, nestedValue] of Object.entries(nested)) {
        if (merged[nestedKey] === undefined && nestedValue !== undefined) {
          merged[nestedKey] = nestedValue
          flattened.add(`${key}.${nestedKey}`)
        }
        if (isRecord(nestedValue)) {
          enqueue(nestedValue)
        }
      }
    }
  }

  if (flattened.size > 0) {
    const details = {
      canonicalType: context?.canonicalType,
      parentCanonicalType: context?.parentCanonicalType,
      field: context?.field,
      index: context?.index,
      pageUrl: context?.pageUrl,
      flattenedKeys: Array.from(flattened)
    }
    console.debug('[SubcomponentNormalizer] auto-flattened payload', details)
  }

  return merged
}

function buildFlattenContext(
  canonicalType: string,
  context: SubcomponentNormalizerContext,
  overrides: Partial<FlattenContext> = {}
): FlattenContext {
  return {
    canonicalType,
    parentCanonicalType: context.parentCanonicalType,
    field: overrides.field ?? context.field,
    index: overrides.index ?? context.index,
    pageUrl: overrides.pageUrl ?? context.pageUrl,
    ...overrides
  }
}

function pickFirstString(source: Record<string, any>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = source[key]
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim()
    }
  }
  return undefined
}

function coerceArray(value: unknown): string[] | undefined {
  if (!value) {
    return undefined
  }
  if (Array.isArray(value)) {
    const normalized = value
      .map(entry => (typeof entry === 'string' ? entry.trim() : String(entry ?? '').trim()))
      .filter(entry => entry.length > 0)
    return normalized.length > 0 ? Array.from(new Set(normalized)) : undefined
  }
  if (typeof value === 'string') {
    const parts = value
      .split(/[;,|]/)
      .map(entry => entry.trim())
      .filter(Boolean)
    return parts.length > 0 ? Array.from(new Set(parts)) : [value.trim()]
  }
  return undefined
}

export interface NormalizedImageValue {
  src?: string
  alt?: string
  mediaId?: string
  originalUrl?: string
  focalPoint?: string
  renditions?: Array<{
    src: string
    width?: number | null
    height?: number | null
  }>
}

type UrlBucket = 'signed' | 'public' | 'explicit' | 'original'

const MEDIA_VALUE_KEYS = new Set(['src', 'image', 'asset', 'media', 'file', 'logo', 'picture', 'photo', 'thumbnail', 'value'])
const URL_BUCKET_KEY_LOOKUP = new Map<string, UrlBucket>([
  ['signedurl', 'signed'],
  ['signed_url', 'signed'],
  ['publicurl', 'public'],
  ['public_url', 'public'],
  ['cdnurl', 'public'],
  ['asseturl', 'public'],
  ['originalurl', 'original'],
  ['original_url', 'original']
])
const ALT_TEXT_KEYS = ['alt', 'altText', 'description', 'title', 'name', 'label', 'caption']

export interface NormalizeImageOptions {
  context?: SubcomponentNormalizerContext
  warnings?: SubcomponentNormalizationWarning[]
  field?: string
}

export function normalizeImage(
  value: unknown,
  fallbackAlt?: string,
  options?: NormalizeImageOptions
): NormalizedImageValue | undefined {
  if (!value) {
    return undefined
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    // Must be a processable URL
    if (!isProcessableUrl(trimmed)) {
      return undefined
    }
    // Reject URLs that are clearly page URLs (e.g., "/info/", "/kidsinfo/")
    // These are sometimes mistakenly provided as image sources by LLM detection
    if (isDefinitelyPageUrl(trimmed)) {
      if (options?.warnings) {
        options.warnings.push({
          issue: 'invalid-value',
          message: `Rejected page URL "${trimmed.substring(0, 80)}" as image source`,
          details: { field: options.field ?? 'image', url: trimmed }
        })
      }
      return undefined
    }
    // Warn but still accept URLs that don't clearly look like images
    // (could be dynamic image URLs without extensions)
    if (!isLikelyImageUrl(trimmed)) {
      if (options?.warnings) {
        options.warnings.push({
          issue: 'suspicious-value',
          message: `URL "${trimmed.substring(0, 80)}" may not be an image (no image extension/path)`,
          details: { field: options.field ?? 'image', url: trimmed }
        })
      }
    }
    return {
      src: trimmed,
      ...(fallbackAlt ? { alt: fallbackAlt } : {})
    }
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      const normalized = normalizeImage(entry, fallbackAlt, options)
      if (normalized) {
        return normalized
      }
    }
    return undefined
  }

  if (!isRecord(value)) {
    return undefined
  }

  const visited = new WeakSet<object>()
  const urlBuckets: Record<UrlBucket, Set<string>> = {
    signed: new Set(),
    public: new Set(),
    explicit: new Set(),
    original: new Set()
  }
  const altCandidates: string[] = []
  let mediaId: string | undefined

  const addUrlCandidate = (bucket: UrlBucket, candidate: unknown) => {
    if (typeof candidate !== 'string') {
      return
    }
    const trimmed = candidate.trim()
    if (!trimmed || !isProcessableUrl(trimmed)) {
      return
    }
    // Reject page URLs that were mistakenly provided as image sources
    if (isDefinitelyPageUrl(trimmed)) {
      if (options?.warnings) {
        options.warnings.push({
          issue: 'invalid-value',
          message: `Rejected page URL "${trimmed.substring(0, 80)}" as image candidate`,
          details: { field: options?.field ?? 'image', url: trimmed, bucket }
        })
      }
      return
    }
    urlBuckets[bucket].add(trimmed)
  }

  const recordAltCandidate = (candidate: unknown) => {
    if (typeof candidate !== 'string') {
      return
    }
    const trimmed = candidate.trim()
    if (trimmed.length > 0) {
      altCandidates.push(trimmed)
    }
  }

  const visit = (input: Record<string, any>) => {
    if (visited.has(input)) {
      return
    }
    visited.add(input)

    if (typeof input.mediaId === 'string' && input.mediaId.trim().length > 0 && !mediaId) {
      mediaId = input.mediaId.trim()
    }

    ALT_TEXT_KEYS.forEach(key => {
      if (key in input) {
        recordAltCandidate(input[key])
      }
    })

    for (const [key, raw] of Object.entries(input)) {
      const normalizedKey = key.trim().toLowerCase()
      const bucket =
        URL_BUCKET_KEY_LOOKUP.get(normalizedKey) ??
        (normalizedKey === 'src' ||
        normalizedKey.endsWith('src') ||
        normalizedKey === 'url' ||
        normalizedKey.endsWith('url') ||
        normalizedKey === 'href' ||
        normalizedKey === 'link' ||
        normalizedKey === 'path' ||
        normalizedKey === 'value' ||
        normalizedKey.includes('image') ||
        normalizedKey.includes('media') ||
        normalizedKey.includes('asset') ||
        normalizedKey.includes('logo') ||
        normalizedKey.includes('photo') ||
        normalizedKey.includes('thumb')
          ? 'explicit'
          : undefined)

      if (typeof raw === 'string') {
        addUrlCandidate(bucket ?? ('explicit' as UrlBucket), raw)
        continue
      }

      if (Array.isArray(raw)) {
        raw.forEach(entry => {
          if (typeof entry === 'string') {
            addUrlCandidate(bucket ?? ('explicit' as UrlBucket), entry)
          } else if (isRecord(entry)) {
            visit(entry)
          }
        })
        continue
      }

      if (isRecord(raw)) {
        if (bucket || MEDIA_VALUE_KEYS.has(normalizedKey)) {
          visit(raw)
        }
      }
    }
  }

  visit(value)

  const pickFromBucket = (bucket: UrlBucket): string | undefined => {
    const first = urlBuckets[bucket].values().next()
    return first.done ? undefined : first.value
  }

  const resolvedSrc =
    pickFromBucket('signed') ?? pickFromBucket('public') ?? pickFromBucket('explicit') ?? pickFromBucket('original')
  const resolvedOriginal = pickFromBucket('original') ?? undefined
  const altText = altCandidates.find(candidate => candidate.length > 0) ?? fallbackAlt

  if (!resolvedSrc && !mediaId) {
    return undefined
  }

  const normalized: NormalizedImageValue = {}
  if (mediaId) {
    normalized.mediaId = mediaId
  }
  if (resolvedSrc) {
    normalized.src = resolvedSrc
  }
  if (resolvedOriginal) {
    normalized.originalUrl = resolvedOriginal
  } else if (normalized.src) {
    normalized.originalUrl = normalized.src
  }
  if (altText) {
    normalized.alt = altText
  }

  if (normalized.mediaId && !normalized.src && options?.context && options?.warnings && options.field) {
    recordMissingMediaSrc(normalized, options.context, options.warnings, options.field)
  }
  return normalized
}

function recordMissingMediaSrc(
  media: NormalizedImageValue | undefined,
  context: SubcomponentNormalizerContext,
  warnings: SubcomponentNormalizationWarning[],
  field: string
): void {
  if (!media) {
    return
  }
  const mediaId = typeof media.mediaId === 'string' ? media.mediaId.trim() : ''
  if (!mediaId) {
    return
  }
  const hasSrc = typeof media.src === 'string' && media.src.trim().length > 0
  if (hasSrc) {
    return
  }

  warnings.push({
    issue: 'media-src-missing',
    message: `Media asset ${mediaId} is missing a usable URL after normalization.`,
    details: {
      canonicalType: context.canonicalType,
      parentCanonicalType: context.parentCanonicalType,
      field,
      index: context.index,
      pageUrl: context.pageUrl,
      mediaId
    }
  })
}

function extractUrl(value: unknown): string | undefined {
  if (!value) {
    return undefined
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : undefined
  }
  if (isRecord(value)) {
    const candidates = [
      value.url,
      value.href,
      value.link,
      value.originalUrl,
      (value.value as unknown),
      (value.source as unknown)
    ]
    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim().length > 0) {
        return candidate.trim()
      }
    }
  }
  return undefined
}

function normalizeBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') {
    return value
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (['true', 'yes', '1', 'on'].includes(normalized)) {
      return true
    }
    if (['false', 'no', '0', 'off'].includes(normalized)) {
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

function normalizeNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string') {
    const normalized = value.trim().replace(/[^0-9.:-]/g, '')
    if (!normalized) {
      return undefined
    }
    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function coerceString(value: unknown): string | undefined {
  if (isNonEmptyString(value)) {
    return value.trim()
  }
  if (typeof value === 'number') {
    return String(value)
  }
  return undefined
}

function coerceRichText(value: unknown): string | undefined {
  if (isNonEmptyString(value)) {
    return value.trim()
  }
  if (Array.isArray(value)) {
    const parts = value
      .map(entry => coerceString(entry))
      .filter((entry): entry is string => !!entry)
    const joined = parts.join(' ').trim()
    return joined.length > 0 ? joined : undefined
  }
  if (isRecord(value)) {
    const text =
      pickFirstString(value, ['text', 'content', 'html', 'markdown', 'raw']) ??
      (Array.isArray(value.blocks)
        ? value.blocks
            .map(block => (isRecord(block) ? pickFirstString(block, ['text', 'content']) : undefined))
            .filter((entry): entry is string => !!entry)
            .join('\n')
        : undefined)
    return text && text.trim().length > 0 ? text.trim() : undefined
  }
  return undefined
}

function uniqueStrings(value: unknown): string[] | undefined {
  const raw = coerceArray(value)
  if (!raw || raw.length === 0) {
    return undefined
  }
  return Array.from(new Set(raw.map(entry => entry.trim()).filter(Boolean)))
}

function coerceObjectArray(value: unknown): Record<string, any>[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value.filter((item): item is Record<string, any> => isRecord(item))
}

function sanitizeId(candidate: string): string | undefined {
  const trimmed = candidate.trim()
  if (!trimmed) {
    return undefined
  }
  const normalized = trimmed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return normalized || undefined
}

function computeStableId(
  type: string,
  context: SubcomponentNormalizerContext,
  source: Record<string, any>
): string {
  const sanitizedType = sanitizeId(type)
  const candidates = [
    source.id,
    source.slug,
    source.slugId,
    source.key,
    source.href,
    source.link,
    source.url,
    source.heading,
    source.title,
    source.name
  ].filter((value): value is string => typeof value === 'string')

  for (const candidate of candidates) {
    const sanitizedCandidate = sanitizeId(candidate)
    if (!sanitizedCandidate) {
      continue
    }

    let normalized = sanitizedCandidate
    if (sanitizedType) {
      const normalizedPrefix = `${sanitizedType}-`
      while (normalized.startsWith(normalizedPrefix)) {
        normalized = normalized.slice(normalizedPrefix.length)
      }

      if (!normalized || normalized === sanitizedType) {
        continue
      }
    }

    if (!normalized) {
      continue
    }

    return `${type}-${normalized}`
  }

  const hash = createHash('sha1')
  hash.update(context.parentCanonicalType)
  hash.update('|')
  hash.update(context.field)
  hash.update('|')
  hash.update(String(context.index))
  hash.update('|')
  hash.update(type)
  if (context.pageUrl) {
    hash.update('|')
    hash.update(context.pageUrl)
  }

  const fingerprint = hash.digest('hex').slice(0, 12)
  return `${type}-${fingerprint}`
}

type SubcomponentMutator = (params: {
  record: Record<string, any>
  context: SubcomponentNormalizerContext
  warnings: SubcomponentNormalizationWarning[]
}) => void

function passthroughSubcomponent(
  input: unknown,
  context: SubcomponentNormalizerContext,
  canonicalType: string,
  mutate?: SubcomponentMutator
): SubcomponentNormalizationResult {
  const warnings: SubcomponentNormalizationWarning[] = []
  if (!isRecord(input)) {
    warnings.push({
      issue: 'invalid-subcomponent',
      message: `Expected object payload for ${canonicalType} but received ${typeof input}.`,
      details: { valueType: typeof input }
    })
    return { value: null, warnings }
  }

  const normalized: Record<string, any> = { ...(input as Record<string, any>) }
  if (typeof normalized.type !== 'string') {
    normalized.type = canonicalType
  }

  if (mutate) {
    mutate({ record: normalized, context, warnings })
  }

  return { value: normalized, warnings }
}

function normalizeCardMediaFields(
  record: Record<string, any>,
  context: SubcomponentNormalizerContext,
  warnings: SubcomponentNormalizationWarning[]
): void {
  const fallbackAlt =
    pickFirstString(record, ['imageAlt', 'title', 'heading', 'label', 'name']) ??
    pickFirstString(record, ['description', 'summary'])

  const candidateKeys = ['image', 'media', 'thumbnail', 'coverImage', 'photo']
  for (const key of candidateKeys) {
    if (!(key in record)) {
      continue
    }
    const normalized = normalizeImage(record[key], fallbackAlt, {
      context,
      warnings,
      field: 'image'
    })
    if (normalized) {
      record.image = normalized
      if (key !== 'image') {
        delete record[key]
      }
      return
    }
  }
  if ('image' in record && record.image && typeof record.image !== 'object') {
    delete record.image
  }
}

function normalizeAccordionItem(
  input: unknown,
  context: SubcomponentNormalizerContext
): SubcomponentNormalizationResult {
  const warnings: SubcomponentNormalizationWarning[] = []
  if (!isRecord(input)) {
    warnings.push({
      issue: 'invalid-subcomponent',
      message: `Expected object payload for accordion-item but received ${typeof input}.`,
      details: { valueType: typeof input }
    })
    return { value: null, warnings }
  }

  const source = expandSourceRecord(input, buildFlattenContext('accordion-item', context))

  const title = pickFirstString(source, ['title', 'heading', 'label', 'question'])
  const content =
    pickFirstString(source, ['content', 'body', 'description', 'answer', 'text']) ?? coerceRichText(source.content)
  const icon = pickFirstString(source, ['icon', 'iconName'])
  const defaultOpen =
    normalizeBoolean(source.defaultOpen) ??
    normalizeBoolean(source.open) ??
    normalizeBoolean(source.expanded) ??
    normalizeBoolean(source.isOpen)

  const normalized: Record<string, any> = {
    type: 'accordion-item',
    id: computeStableId('accordion-item', context, source)
  }

  if (title) {
    normalized.title = title
  }
  if (content) {
    normalized.content = content
  }
  if (icon) {
    normalized.icon = icon
  }
  if (defaultOpen !== undefined) {
    normalized.defaultOpen = defaultOpen
  }

  return { value: normalized, warnings }
}

function normalizeTabItem(
  input: unknown,
  context: SubcomponentNormalizerContext
): SubcomponentNormalizationResult {
  const warnings: SubcomponentNormalizationWarning[] = []
  if (!isRecord(input)) {
    warnings.push({
      issue: 'invalid-subcomponent',
      message: `Expected object payload for tab-item but received ${typeof input}.`,
      details: { valueType: typeof input }
    })
    return { value: null, warnings }
  }

  const source = expandSourceRecord(input, buildFlattenContext('tab-item', context))

  const label = pickFirstString(source, ['label', 'title', 'heading', 'tab'])
  const content =
    pickFirstString(source, ['content', 'body', 'description', 'text']) ?? coerceRichText(source.content)
  const icon = pickFirstString(source, ['icon', 'iconName'])
  const disabled = normalizeBoolean(source.disabled) ?? normalizeBoolean(source.isDisabled)
  const badgeCandidate = pickFirstString(source, ['badge', 'count', 'status'])
  const badge =
    badgeCandidate ??
    (typeof source.badge === 'number' ? String(source.badge) : undefined) ??
    (typeof source.count === 'number' ? String(source.count) : undefined)

  const normalized: Record<string, any> = {
    type: 'tab-item',
    id: computeStableId('tab-item', context, source)
  }

  if (label) {
    normalized.label = label
  }
  if (content) {
    normalized.content = content
  }
  if (icon) {
    normalized.icon = icon
  }
  if (disabled !== undefined) {
    normalized.disabled = disabled
  }
  if (badge) {
    normalized.badge = badge
  }

  return { value: normalized, warnings }
}

function buildLinkObject(source: Record<string, any> | undefined): { text: string; url: string } | undefined {
  if (!source) {
    return undefined
  }
  const flattened = expandSourceRecord(source, { canonicalType: 'link-object' })
  const text = pickFirstString(flattened, ['text', 'label', 'title', 'name'])
  const url = extractUrl(flattened.url ?? flattened.href ?? flattened.link)
  if (text && url) {
    return { text, url }
  }
  return undefined
}

function normalizeFeatureItem(
  input: unknown,
  context: SubcomponentNormalizerContext
): SubcomponentNormalizationResult {
  const warnings: SubcomponentNormalizationWarning[] = []
  if (!isRecord(input)) {
    warnings.push({
      issue: 'invalid-subcomponent',
      message: `Expected object payload for feature-item but received ${typeof input}.`,
      details: { valueType: typeof input }
    })
    return { value: null, warnings }
  }

  const flattened = expandSourceRecord(input, buildFlattenContext('feature-item', context))
  const normalized: Record<string, any> = { ...flattened }

  if (typeof normalized.type !== 'string' || normalized.type.trim().length === 0) {
    normalized.type = 'feature-item'
  }

  const descriptionCandidate =
    normalizeString(normalized.description) ??
    normalizeString(flattened.description) ??
    normalizeString(flattened.body) ??
    normalizeString(flattened.summary) ??
    normalizeString(flattened.text)
  if (descriptionCandidate) {
    normalized.description = descriptionCandidate
  }

  let titleCandidate =
    normalizeString(normalized.title) ??
    normalizeString(normalized.heading) ??
    normalizeString(normalized.label) ??
    normalizeString(normalized.name)

  if (!titleCandidate && descriptionCandidate) {
    titleCandidate = extractFirstSentence(descriptionCandidate)
  }

  if (!titleCandidate) {
    const altCandidate =
      normalizeString(isRecord(flattened.icon) ? flattened.icon.alt : undefined) ??
      normalizeString(flattened.iconAlt) ??
      normalizeString(flattened.imageAlt) ??
      normalizeString(flattened.mediaAlt) ??
      normalizeString(flattened.alt)
    if (altCandidate) {
      titleCandidate = altCandidate
    }
  }

  if (titleCandidate) {
    normalized.title = titleCandidate
  }

  if (typeof normalized.id !== 'string' || normalized.id.trim().length === 0) {
    const link = extractUrl(flattened.link ?? flattened.href ?? flattened.url)
    const hashSource = [titleCandidate, descriptionCandidate, link].filter(Boolean).join('|')
    const fallbackId = hashSource
      ? `feature-${createHash('md5').update(hashSource).digest('hex').slice(0, 8)}`
      : `feature-${context.index + 1}`
    normalized.id = fallbackId
  }

  return { value: normalized, warnings }
}

function normalizeFilterChip(
  input: unknown,
  context: SubcomponentNormalizerContext
): SubcomponentNormalizationResult {
  const warnings: SubcomponentNormalizationWarning[] = []

  if (typeof input !== 'string' && !isRecord(input)) {
    warnings.push({
      issue: 'invalid-subcomponent',
      message: `Expected string or object payload for filter-chip but received ${typeof input}.`,
      details: { valueType: typeof input }
    })
    return { value: null, warnings }
  }

  const baseRecord = typeof input === 'string' ? { label: input } : (input as Record<string, any>)
  const flattened = expandSourceRecord(baseRecord, buildFlattenContext('filter-chip', context))
  const label = pickFirstString(flattened, ['label', 'text', 'title', 'name'])

  if (!label) {
    warnings.push({
      issue: 'missing-required-field',
      message: 'Dropped filter-chip missing label or text.',
      details: {
        parentCanonicalType: context.parentCanonicalType,
        field: context.field,
        index: context.index,
        pageUrl: context.pageUrl
      }
    })
    return { value: null, warnings }
  }

  const normalized: Record<string, any> = {
    type: 'filter-chip',
    id: computeStableId('filter-chip', context, flattened),
    label: label.trim()
  }

  const valueCandidate = pickFirstString(flattened, ['value', 'slug', 'key', 'category', 'filter'])
  if (valueCandidate) {
    normalized.value = valueCandidate
  }

  const href = extractUrl(flattened.href ?? flattened.url ?? flattened.link)
  if (href) {
    normalized.href = href
  }

  const icon = pickFirstString(flattened, ['icon', 'emoji', 'symbol'])
  if (icon) {
    normalized.icon = icon
  }

  const isActive = normalizeBoolean(flattened.isActive ?? flattened.active ?? flattened.selected ?? flattened.current)
  if (isActive !== undefined) {
    normalized.isActive = isActive
  }

  return { value: normalized, warnings }
}

function normalizeShowcaseSection(
  input: unknown,
  context: SubcomponentNormalizerContext
): SubcomponentNormalizationResult {
  const warnings: SubcomponentNormalizationWarning[] = []
  if (!isRecord(input)) {
    warnings.push({
      issue: 'invalid-subcomponent',
      message: `Expected object payload for showcase-section but received ${typeof input}.`,
      details: { valueType: typeof input }
    })
    return { value: null, warnings }
  }

  const source = expandSourceRecord(input, buildFlattenContext('showcase-section', context))

  const title = pickFirstString(source, ['title', 'heading', 'name'])
  const description = pickFirstString(source, ['description', 'body', 'summary', 'text'])
  const imageFallbackAlt = pickFirstString(source, ['imageAlt', 'imageTitle']) ?? title ?? description
  const image =
    normalizeImage(source.image, imageFallbackAlt, { context, warnings, field: 'image' }) ??
    normalizeImage(source.media, imageFallbackAlt, { context, warnings, field: 'image' }) ??
    normalizeImage(source.imageUrl, imageFallbackAlt, { context, warnings, field: 'image' }) ??
    normalizeImage(isRecord(source) && 'heroImage' in source ? source.heroImage : undefined, imageFallbackAlt, { context, warnings, field: 'image' }) ??
    normalizeImage(isRecord(source) && isRecord(source.media) ? source.media.image : undefined, imageFallbackAlt, { context, warnings, field: 'image' })

  const featuresRaw =
    (Array.isArray(source.features) ? source.features : undefined) ??
    (isRecord(source) && Array.isArray(source.items) ? (source.items as unknown[]) : undefined)

  const features: Array<{ icon?: string; text: string }> = []
  if (Array.isArray(featuresRaw)) {
    featuresRaw.forEach(raw => {
      if (isRecord(raw)) {
        const flattenedFeature = expandSourceRecord(raw, {
          canonicalType: 'showcase-feature',
          parentCanonicalType: context.parentCanonicalType,
          field: context.field,
          pageUrl: context.pageUrl
        })
        const text =
          pickFirstString(flattenedFeature, ['text', 'description', 'title', 'label']) ??
          coerceRichText(flattenedFeature.content) ??
          (typeof raw === 'string' ? raw : undefined)
        const icon = pickFirstString(flattenedFeature, ['icon', 'iconName', 'glyph'])
        if (text) {
          features.push(icon ? { icon, text } : { text })
        }
      } else if (typeof raw === 'string' && raw.trim()) {
        features.push({ text: raw.trim() })
      }
    })
  }

  const cta =
    buildLinkObject(isRecord(source.cta) ? (source.cta as Record<string, any>) : undefined) ??
    (() => {
      const text = pickFirstString(source, ['ctaText', 'buttonText', 'linkText'])
      const url = extractUrl(source.cta) ?? extractUrl(source.link) ?? extractUrl(source.href)
      if (text && url) {
        return { text, url }
      }
      return undefined
    })()

  const imagePositionCandidate = pickFirstString(source, ['imagePosition', 'imageSide', 'layout'])
  const imagePosition =
    imagePositionCandidate && ['left', 'right'].includes(imagePositionCandidate.trim().toLowerCase())
      ? (imagePositionCandidate.trim().toLowerCase() as 'left' | 'right')
      : undefined

  const normalized: Record<string, any> = {
    type: 'showcase-section',
    id: computeStableId('showcase-section', context, source)
  }

  if (image) {
    normalized.image = image
  }
  if (title) {
    normalized.title = title
  }
  if (description) {
    normalized.description = description
  }
  if (features.length > 0) {
    normalized.features = features
  }
  if (cta) {
    normalized.cta = cta
  }
  if (imagePosition) {
    normalized.imagePosition = imagePosition
  }

  return { value: normalized, warnings }
}

const TIMELINE_EVENT_TYPES = new Set(['milestone', 'event', 'achievement', 'default'])

function normalizeTimelineEvent(
  input: unknown,
  context: SubcomponentNormalizerContext
): SubcomponentNormalizationResult {
  const warnings: SubcomponentNormalizationWarning[] = []
  if (!isRecord(input)) {
    warnings.push({
      issue: 'invalid-subcomponent',
      message: `Expected object payload for timeline-event but received ${typeof input}.`,
      details: { valueType: typeof input }
    })
    return { value: null, warnings }
  }

  const source = expandSourceRecord(input, buildFlattenContext('timeline-event', context))

  const date =
    pickFirstString(source, ['date', 'eventDate', 'timestamp']) ??
    (typeof source.date === 'number' ? new Date(source.date).toISOString() : undefined)
  const title = pickFirstString(source, ['title', 'heading', 'name'])
  const description =
    pickFirstString(source, ['description', 'body', 'summary', 'text']) ?? coerceRichText(source.description)
  const icon = pickFirstString(source, ['icon', 'iconName'])

  const typeCandidate = pickFirstString(source, ['type', 'eventType', 'category'])
  const normalizedType =
    typeCandidate && TIMELINE_EVENT_TYPES.has(typeCandidate.trim().toLowerCase())
      ? (typeCandidate.trim().toLowerCase() as 'milestone' | 'event' | 'achievement' | 'default')
      : undefined

  const link =
    buildLinkObject(isRecord(source.link) ? (source.link as Record<string, any>) : undefined) ??
    (() => {
      const text = pickFirstString(source, ['linkText', 'ctaText'])
      const url = extractUrl(source.link) ?? extractUrl(source.href) ?? extractUrl(source.url)
      if (text && url) {
        return { text, url }
      }
      return undefined
    })()

  const imageFallbackAlt = title ?? description
  const image =
    normalizeImage(source.image, imageFallbackAlt, { context, warnings, field: 'image' }) ??
    normalizeImage(source.media, imageFallbackAlt, { context, warnings, field: 'image' }) ??
    normalizeImage(isRecord(source) && 'thumbnail' in source ? source.thumbnail : undefined, imageFallbackAlt, { context, warnings, field: 'image' }) ??
    normalizeImage(isRecord(source) && 'imageUrl' in source ? source.imageUrl : undefined, imageFallbackAlt, { context, warnings, field: 'image' })

  const normalized: Record<string, any> = {
    type: 'timeline-event',
    id: computeStableId('timeline-event', context, source)
  }

  if (date) {
    normalized.date = date
  }
  if (title) {
    normalized.title = title
  }
  if (description) {
    normalized.description = description
  }
  if (icon) {
    normalized.icon = icon
  }
  if (normalizedType) {
    normalized.type = normalizedType
  }
  if (link) {
    normalized.link = link
  }
  if (image) {
    normalized.image = image
  }

  return { value: normalized, warnings }
}

function normalizeTimelineAction(
  input: unknown,
  context: SubcomponentNormalizerContext
): SubcomponentNormalizationResult {
  const warnings: SubcomponentNormalizationWarning[] = []
  if (!isRecord(input)) {
    warnings.push({
      issue: 'invalid-subcomponent',
      message: `Expected object payload for timeline-action but received ${typeof input}.`,
      details: { valueType: typeof input }
    })
    return { value: null, warnings }
  }

  const source = expandSourceRecord(input, buildFlattenContext('timeline-action', context))
  const text = pickFirstString(source, ['text', 'label', 'title', 'name'])
  const url = extractUrl(source.url ?? source.href ?? source.link)
  const variant = pickFirstString(source, ['variant', 'style', 'theme'])

  if (!text || !url) {
    warnings.push({
      issue: 'missing-required-field',
      message: 'Timeline action missing text or url; dropping entry.',
      details: {
        canonicalType: 'timeline-action',
        textPresent: Boolean(text),
        urlPresent: Boolean(url),
        index: context.index,
        field: context.field
      }
    })
    return { value: null, warnings }
  }

  const normalized: Record<string, any> = {
    type: 'timeline-action',
    id: computeStableId('timeline-action', context, source),
    text,
    url
  }

  if (variant) {
    normalized.variant = variant
  }

  return { value: normalized, warnings }
}

const TEAM_MEMBER_DISPLAY_MODES = new Set(['full', 'compact', 'modal'])

function normalizeEducationEntries(
  raw: unknown,
  context: SubcomponentNormalizerContext
): Array<{ degree: string; institution: string; year?: string }> | undefined {
  const records = coerceObjectArray(raw)
  if (records.length === 0) {
    return undefined
  }
  const entries: Array<{ degree: string; institution: string; year?: string }> = []
  records.forEach((entry, index) => {
    const flattened = expandSourceRecord(entry, buildFlattenContext('team-member-education', context, { field: 'education', index }))
    const degree = pickFirstString(flattened, ['degree', 'program', 'qualification', 'title'])
    const institution = pickFirstString(flattened, ['institution', 'school', 'university', 'college'])
    const year = pickFirstString(flattened, ['year', 'date', 'completion'])
    if (degree && institution) {
      entries.push(year ? { degree, institution, year } : { degree, institution })
    }
  })
  return entries.length > 0 ? entries : undefined
}

function normalizeExperienceEntries(
  raw: unknown,
  context: SubcomponentNormalizerContext
): Array<{ position: string; company: string; duration?: string; description?: string }> | undefined {
  const records = coerceObjectArray(raw)
  if (records.length === 0) {
    return undefined
  }
  const entries: Array<{ position: string; company: string; duration?: string; description?: string }> = []
  records.forEach((entry, index) => {
    const flattened = expandSourceRecord(entry, buildFlattenContext('team-member-experience', context, { field: 'experience', index }))
    const position = pickFirstString(flattened, ['position', 'role', 'title'])
    const company = pickFirstString(flattened, ['company', 'organization', 'employer'])
    const duration = pickFirstString(flattened, ['duration', 'dates', 'years'])
    const description =
      pickFirstString(flattened, ['description', 'summary', 'details']) ?? coerceRichText(flattened.description)
    if (position && company) {
      const normalizedEntry: { position: string; company: string; duration?: string; description?: string } = {
        position,
        company
      }
      if (duration) {
        normalizedEntry.duration = duration
      }
      if (description) {
        normalizedEntry.description = description
      }
      entries.push(normalizedEntry)
    }
  })
  return entries.length > 0 ? entries : undefined
}

function normalizeTeamMember(
  input: unknown,
  context: SubcomponentNormalizerContext
): SubcomponentNormalizationResult {
  const warnings: SubcomponentNormalizationWarning[] = []
  if (!isRecord(input)) {
    warnings.push({
      issue: 'invalid-subcomponent',
      message: `Expected object payload for team-member but received ${typeof input}.`,
      details: { valueType: typeof input }
    })
    return { value: null, warnings }
  }

  const source = expandSourceRecord(input, buildFlattenContext('team-member', context))

  const name = pickFirstString(source, ['name', 'fullName', 'title'])
  const title = pickFirstString(source, ['title', 'role', 'position'])
  const department = pickFirstString(source, ['department', 'team', 'group'])

  const photoFallbackAlt = name ?? title
  const photoAsset =
    normalizeImage(source.photo, photoFallbackAlt, { context, warnings, field: 'photo' }) ??
    normalizeImage(source.image, photoFallbackAlt, { context, warnings, field: 'photo' }) ??
    normalizeImage(source.avatar, photoFallbackAlt, { context, warnings, field: 'photo' }) ??
    normalizeImage(isRecord(source) && 'headshot' in source ? source.headshot : undefined, photoFallbackAlt, { context, warnings, field: 'photo' })
  const photo = photoAsset?.src ?? pickFirstString(source, ['photo', 'image', 'avatar'])
  const photoAlt = photoAsset?.alt ?? pickFirstString(source, ['photoAlt', 'imageAlt', 'alt'])

  const bio =
    pickFirstString(source, ['bio', 'biography', 'description', 'summary']) ??
    coerceRichText(source.bio ?? source.description)

  const email = pickFirstString(source, ['email', 'mail'])
  const phone = pickFirstString(source, ['phone', 'phoneNumber', 'contact'])

  const social = isRecord(source.social) ? (source.social as Record<string, unknown>) : undefined
  const linkedin =
    pickFirstString(source, ['linkedin', 'linkedIn']) ??
    (social ? pickFirstString(social, ['linkedin', 'linkedIn']) : undefined)
  const twitter =
    pickFirstString(source, ['twitter', 'x']) ?? (social ? pickFirstString(social, ['twitter', 'x']) : undefined)
  const facebook =
    pickFirstString(source, ['facebook']) ?? (social ? pickFirstString(social, ['facebook']) : undefined)
  const instagram =
    pickFirstString(source, ['instagram']) ?? (social ? pickFirstString(social, ['instagram']) : undefined)
  const github =
    pickFirstString(source, ['github']) ?? (social ? pickFirstString(social, ['github']) : undefined)

  const skills =
    uniqueStrings(source.skills) ??
    uniqueStrings((social as Record<string, unknown> | undefined)?.skills) ??
    uniqueStrings(isRecord(source) && 'expertise' in source ? source.expertise : undefined)
  const education = normalizeEducationEntries(source.education ?? (isRecord(source) && 'educationHistory' in source ? source.educationHistory : undefined), context)
  const experience = normalizeExperienceEntries(source.experience ?? (isRecord(source) && 'workHistory' in source ? source.workHistory : undefined), context)
  const achievements = uniqueStrings(source.achievements ?? (isRecord(source) && 'awards' in source ? source.awards : undefined))

  const displayModeCandidate = pickFirstString(source, ['displayMode', 'layout', 'variant'])
  const displayMode =
    displayModeCandidate && TEAM_MEMBER_DISPLAY_MODES.has(displayModeCandidate.trim().toLowerCase())
      ? (displayModeCandidate.trim().toLowerCase() as 'full' | 'compact' | 'modal')
      : undefined

  const normalized: Record<string, any> = {
    type: 'team-member',
    id: computeStableId('team-member', context, source)
  }

  if (name) {
    normalized.name = name
  }
  if (title) {
    normalized.title = title
  }
  if (department) {
    normalized.department = department
  }
  if (photoAsset?.mediaId) {
    normalized.photoMediaId = photoAsset.mediaId
  }
  if (photoAsset?.originalUrl) {
    normalized.photoOriginalUrl = photoAsset.originalUrl
  }
  if (photo) {
    normalized.photo = photo
  }
  if (photoAlt) {
    normalized.photoAlt = photoAlt
  }
  if (bio) {
    normalized.bio = bio
  }
  if (email) {
    normalized.email = email
  }
  if (phone) {
    normalized.phone = phone
  }
  if (linkedin) {
    normalized.linkedin = linkedin
  }
  if (twitter) {
    normalized.twitter = twitter
  }
  if (facebook) {
    normalized.facebook = facebook
  }
  if (instagram) {
    normalized.instagram = instagram
  }
  if (github) {
    normalized.github = github
  }
  if (skills && skills.length > 0) {
    normalized.skills = skills
  }
  if (education && education.length > 0) {
    normalized.education = education
  }
  if (experience && experience.length > 0) {
    normalized.experience = experience
  }
  if (achievements && achievements.length > 0) {
    normalized.achievements = achievements
  }
  if (displayMode) {
    normalized.displayMode = displayMode
  }

  return { value: normalized, warnings }
}

function normalizeBlogCard(
  input: unknown,
  context: SubcomponentNormalizerContext
): SubcomponentNormalizationResult {
  const warnings: SubcomponentNormalizationWarning[] = []
  if (!isRecord(input)) {
    warnings.push({
      issue: 'invalid-subcomponent',
      message: `Expected object payload for blog-card but received ${typeof input}.`,
      details: { valueType: typeof input }
    })
    return { value: null, warnings }
  }

  const source = expandSourceRecord(input, buildFlattenContext('blog-card', context))

  const title = pickFirstString(source, ['title', 'heading', 'name'])
  const excerpt = pickFirstString(source, ['excerpt', 'summary', 'description', 'teaser', 'body'])
  const thumbnail =
    pickFirstString(source, ['thumbnail', 'image', 'imageUrl']) ??
    normalizeImage(source.thumbnail)?.src ??
    normalizeImage(source.image)?.src

  const authorSource = isRecord(source.author) ? (source.author as Record<string, any>) : undefined
  const authorName =
    pickFirstString(source, ['author', 'authorName', 'byline']) ??
    (authorSource ? pickFirstString(authorSource, ['name', 'fullName']) : undefined)
  const authorAvatar =
    pickFirstString(source, ['authorAvatar']) ??
    (authorSource ? pickFirstString(authorSource, ['avatar']) : undefined) ??
    normalizeImage(authorSource)?.src

  const publishDate =
    pickFirstString(source, ['publishDate', 'published', 'date']) ??
    (typeof source.date === 'number' ? new Date(source.date).toISOString() : undefined)
  const updatedDate = pickFirstString(source, ['updatedDate', 'updated', 'modified'])
  const readingTime =
    normalizeNumber(source.readingTime) ??
    normalizeNumber((authorSource as Record<string, unknown> | undefined)?.readingTime) ??
    normalizeNumber(isRecord(source) && 'readingMinutes' in source ? source.readingMinutes : undefined)

  const categories = uniqueStrings(source.categories ?? (isRecord(source) && 'category' in source ? source.category : undefined))
  const tags = uniqueStrings(source.tags)

  const slugCandidate =
    pickFirstString(source, ['slug', 'path']) ??
    (typeof source.url === 'string' ? source.url : undefined) ??
    extractUrl(source.link)
  const slug = slugCandidate
    ? (() => {
        const trimmed = slugCandidate.trim()
        if (trimmed.startsWith('http')) {
          try {
            const url = new URL(trimmed)
            return url.pathname.replace(/^\/+/, '')
          } catch {
            return trimmed
          }
        }
        return trimmed
      })()
    : undefined

  const featured = normalizeBoolean(source.featured) ?? normalizeBoolean(isRecord(source) && 'isFeatured' in source ? source.isFeatured : undefined)
  const likes = normalizeNumber(source.likes)
  const comments = normalizeNumber(source.comments)
  const views = normalizeNumber(source.views)

  const normalized: Record<string, any> = {
    type: 'blog-card',
    id: computeStableId('blog-card', context, source)
  }

  if (title) {
    normalized.title = title
  }
  if (excerpt) {
    normalized.excerpt = excerpt
  }
  if (thumbnail) {
    normalized.thumbnail = thumbnail
  }
  if (authorName) {
    normalized.author = authorAvatar ? { name: authorName, avatar: authorAvatar } : { name: authorName }
  }
  if (publishDate) {
    normalized.publishDate = publishDate
  }
  if (updatedDate) {
    normalized.updatedDate = updatedDate
  }
  if (readingTime !== undefined) {
    normalized.readingTime = readingTime
  }
  if (categories && categories.length > 0) {
    normalized.categories = categories
  }
  if (tags && tags.length > 0) {
    normalized.tags = tags
  }
  if (slug) {
    normalized.slug = slug
  }
  if (featured !== undefined) {
    normalized.featured = featured
  }
  if (likes !== undefined) {
    normalized.likes = likes
  }
  if (comments !== undefined) {
    normalized.comments = comments
  }
  if (views !== undefined) {
    normalized.views = views
  }

  return { value: normalized, warnings }
}

export const SUBCOMPONENT_NORMALIZERS: Record<string, SubcomponentNormalizer> = {
  'card-item': (input, context) =>
    passthroughSubcomponent(input, context, 'card-item', ({ record, context, warnings }) => {
      normalizeCardMediaFields(record, context, warnings)
    }),
  'promo-item': (input, context) =>
    passthroughSubcomponent(input, context, 'promo-item', ({ record, context, warnings }) => {
      normalizeCardMediaFields(record, context, warnings)
    }),
  'nav-menu-item': (input, context) => passthroughSubcomponent(input, context, 'nav-menu-item'),
  columnitem: (input, context) => passthroughSubcomponent(input, context, 'columnItem'),
  sociallinkitem: (input, context) => passthroughSubcomponent(input, context, 'socialLinkItem'),
  'accordion-item': (input, context) => normalizeAccordionItem(input, context),
  'tab-item': (input, context) => normalizeTabItem(input, context),
  'feature-item': (input, context) => normalizeFeatureItem(input, context),
  'showcase-section': (input, context) => normalizeShowcaseSection(input, context),
  'testimonial-item': (input, context) => passthroughSubcomponent(input, context, 'testimonial-item'),
  'timeline-event': (input, context) => normalizeTimelineEvent(input, context),
  'timeline-action': (input, context) => normalizeTimelineAction(input, context),
  'team-member': (input, context) => normalizeTeamMember(input, context),
  'blog-card': (input, context) => normalizeBlogCard(input, context),
  'filter-chip': (input, context) => normalizeFilterChip(input, context)
}
