/**
 * Content Component Normalizers
 *
 * Normalizers for timeline, text-block, content-feed, and two-column components.
 * Extracted from component-helpers.ts for modularity.
 *
 * @module content-normalizers
 */

import { canonicalizeComponentType } from '../canonical-types'
import {
  expandSourceRecord,
  normalizeString,
  isRecord,
  extractLinkUrl,
  coerceBoolean,
  normalizeTokenList,
  type LocalNormalizationWarning,
  type ComponentContentNormalizer
} from './shared-normalizer-utils'
import {
  containsHtmlTags,
  stripHtmlToText,
  convertPlainTextToHtml
} from '../string-utils'
import { isLikelyImageUrl, isDefinitelyPageUrl } from '../../../../utils/url-transformer'

// ============================================================================
// Timeline Normalizer Helpers
// ============================================================================

const PROGRESS_VARIANT_TOKEN_CHECKS: Array<(token: string) => boolean> = [
  token => token.includes('progress-bar'),
  token => token.includes('progressbar'),
  token => token.includes('progress-step'),
  token => token.includes('progressstep'),
  token => token.includes('progress-tracker'),
  token => token.includes('progressindicator'),
  token => token.includes('stepper'),
  token => token.includes('step-indicator'),
  token => token.includes('breadcrumb-progress')
]

function gatherTimelineVariantTokens(source: Record<string, any>): string[] {
  const tokens: string[] = []
  const pushTokens = (value: unknown, splitWhitespace = false) => {
    if (Array.isArray(value)) {
      value.forEach(entry => pushTokens(entry, splitWhitespace))
      return
    }
    if (typeof value === 'string') {
      if (splitWhitespace) {
        value
          .split(/\s+/)
          .map(token => token.trim())
          .filter(Boolean)
          .forEach(token => tokens.push(token))
      } else if (value.trim().length > 0) {
        tokens.push(value)
      }
    }
  }

  pushTokens(source.semanticTokens)
  pushTokens(source.tokens)
  pushTokens(source.classList)
  pushTokens(source.className, true)

  if (isRecord(source.metadata)) {
    const metadata = source.metadata as Record<string, any>
    pushTokens(metadata.keywords)
    pushTokens(metadata.patterns)
  }

  return normalizeTokenList(tokens)
}

const PROGRESS_FLAG_FIELDS = [
  'progressVariant',
  'isProgress',
  'progress',
  'progressLayout',
  'progressIndicator',
  'progressBar',
  'showProgress'
]

function resolveTimelineVariant(source: Record<string, any>): 'progress' | undefined {
  const explicitVariant = normalizeString(source.variant ?? source.layoutVariant ?? source.styleVariant)
  if (explicitVariant === 'progress') {
    return 'progress'
  }

  for (const field of PROGRESS_FLAG_FIELDS) {
    if (field in source) {
      const value = source[field]
      if (coerceBoolean(value)) {
        return 'progress'
      }
      if (typeof value === 'string' && normalizeString(value) === 'progress') {
        return 'progress'
      }
    }
  }

  const tokens = gatherTimelineVariantTokens(source)
  const hasComposite = tokens.some(token => PROGRESS_VARIANT_TOKEN_CHECKS.some(check => check(token)))
  if (hasComposite) {
    return 'progress'
  }

  const hasProgressWord = tokens.some(token => token.includes('progress'))
  const hasStepWord = tokens.some(token => token.includes('step'))
  if (hasProgressWord && hasStepWord) {
    return 'progress'
  }

  return undefined
}

function normalizeTimelineActionValue(
  raw: unknown,
  context: { parentCanonicalType: string; field: string; pageUrl?: string; index?: number }
): { action?: Record<string, any>; warning?: LocalNormalizationWarning } {
  if (!isRecord(raw)) {
    return {
      warning: {
        issue: 'invalid-subcomponent',
        message: `Dropped ${context.field} because payload is not an object.`,
        field: context.field,
        childType: 'timeline-action',
        details: { valueType: typeof raw, index: context.index }
      }
    }
  }

  const flattened = expandSourceRecord(raw, {
    canonicalType: 'timeline-action',
    parentCanonicalType: context.parentCanonicalType,
    field: context.field,
    index: context.index ?? 0,
    pageUrl: context.pageUrl
  })

  const text = normalizeString(flattened.text ?? flattened.label ?? flattened.title ?? flattened.name)
  const url = extractLinkUrl(flattened.url ?? flattened.href ?? flattened.link)
  const variant = normalizeString(flattened.variant ?? flattened.style ?? flattened.theme)

  if (!text || !url) {
    return {
      warning: {
        issue: 'missing-required-field',
        message: `Dropped ${context.field} because label or url is missing.`,
        field: context.field,
        childType: 'timeline-action',
        details: { index: context.index, textPresent: Boolean(text), urlPresent: Boolean(url) }
      }
    }
  }

  const action: Record<string, any> = {
    type: 'timeline-action',
    text,
    url
  }
  if (variant) {
    action.variant = variant
  }

  return { action }
}

// ============================================================================
// Timeline Normalizer
// ============================================================================

/**
 * Normalizes timeline component content.
 * Handles progress variant detection and footer CTA normalization.
 */
export const normalizeTimelineContent: ComponentContentNormalizer = (
  rawContent: Record<string, any>,
  options: { parentCanonicalType: string; pageUrl?: string }
) => {
  const warnings: LocalNormalizationWarning[] = []
  const flattened = expandSourceRecord(rawContent, {
    canonicalType: 'timeline',
    parentCanonicalType: options.parentCanonicalType,
    field: 'content',
    index: 0,
    pageUrl: options.pageUrl
  })

  const normalized: Record<string, any> = { ...flattened }
  const timelineVariant = resolveTimelineVariant(flattened)
  if (timelineVariant) {
    normalized.variant = timelineVariant
  }

  const footerCandidate =
    normalized.footerCta ??
    normalized.footerCTA ??
    normalized.sectionCta ??
    normalized.sectionCTA ??
    normalized.cta ??
    normalized.callToAction

  ;['footerCTA', 'sectionCta', 'sectionCTA', 'cta', 'callToAction'].forEach(alias => {
    if (alias in normalized) {
      delete normalized[alias]
    }
  })

  if (footerCandidate) {
    const { action, warning } = normalizeTimelineActionValue(footerCandidate, {
      parentCanonicalType: options.parentCanonicalType,
      field: 'footerCta',
      pageUrl: options.pageUrl
    })
    if (warning) {
      warnings.push(warning)
    }
    if (action) {
      normalized.footerCta = action
    } else if ('footerCta' in normalized) {
      delete normalized.footerCta
    }
  }

  return { content: normalized, warnings }
}

// ============================================================================
// Text Block Normalizer
// ============================================================================

/**
 * Normalizes text-block component content.
 * Handles body/bodyHtml conversion and HTML detection.
 */
export const normalizeTextBlockContent: ComponentContentNormalizer = (
  content: Record<string, any>,
  options: { parentCanonicalType: string; pageUrl?: string }
) => {
  const warnings: LocalNormalizationWarning[] = []
  const flattened = expandSourceRecord(content, {
    canonicalType: 'text-block',
    parentCanonicalType: options.parentCanonicalType,
    field: 'content',
    index: 0,
    pageUrl: options.pageUrl
  })

  const normalized: Record<string, any> = { ...flattened }
  const bodyCandidate =
    normalizeString(flattened.body) ??
    normalizeString(flattened.bodyText) ??
    normalizeString(flattened.text) ??
    normalizeString(flattened.copy) ??
    normalizeString(flattened.html)

  let resolvedBodyHtml = normalizeString(flattened.bodyHtml)
  if (!resolvedBodyHtml && bodyCandidate && containsHtmlTags(bodyCandidate)) {
    resolvedBodyHtml = bodyCandidate
  }
  if (!resolvedBodyHtml && bodyCandidate) {
    resolvedBodyHtml = convertPlainTextToHtml(bodyCandidate)
  }

  if (!normalized.body && bodyCandidate) {
    normalized.body = bodyCandidate
  }
  if (!normalized.body && normalized.bodyHtml) {
    const plain = stripHtmlToText(normalized.bodyHtml)
    if (plain) {
      normalized.body = plain
    }
  }
  if (resolvedBodyHtml) {
    normalized.bodyHtml = resolvedBodyHtml
  }

  return { content: normalized, warnings }
}

// ============================================================================
// Content Feed Normalizer
// ============================================================================

/**
 * Normalizes content-feed component content.
 * Handles layout validation and pinned items normalization.
 */
export const normalizeContentFeedContent: ComponentContentNormalizer = (
  content: Record<string, any>,
  options: { parentCanonicalType: string; pageUrl?: string }
) => {
  const warnings: LocalNormalizationWarning[] = []
  const flattened = expandSourceRecord(content, {
    canonicalType: 'content-feed',
    parentCanonicalType: options.parentCanonicalType,
    field: 'content',
    index: 0,
    pageUrl: options.pageUrl
  })

  const normalized: Record<string, any> = { ...flattened }

  const layout = normalizeString(normalized.layout)
  if (layout !== 'list' && layout !== 'card-grid') {
    normalized.layout = 'card-grid'
  }

  const pinnedSource = normalized.pinned ?? flattened.pinned
  const pinnedArray = Array.isArray(pinnedSource) ? pinnedSource : []
  if (pinnedSource != null && !Array.isArray(pinnedSource)) {
    warnings.push({
      issue: 'invalid-subcomponent',
      message: 'Expected pinned entries to be an array; coercing to empty list.',
      field: 'pinned',
      childType: 'card-item'
    })
  }

  const pinned: Record<string, any>[] = []
  pinnedArray.forEach((entry, index) => {
    const record: Record<string, any> = isRecord(entry) ? { ...entry } : { title: normalizeString(entry as any) }

    const title =
      normalizeString(record.title) ??
      normalizeString(record.heading) ??
      normalizeString(record.label) ??
      normalizeString(record.text) ??
      `Pinned item ${index + 1}`
    const summary =
      normalizeString(record.summary) ??
      normalizeString(record.description) ??
      normalizeString(record.excerpt) ??
      normalizeString(record.body) ??
      undefined
    const href = extractLinkUrl(record.href ?? record.url ?? record.link)

    const imageSource = record.image ?? record.thumbnail ?? record.media
    let image: Record<string, any> | undefined
    if (typeof imageSource === 'string') {
      const trimmed = imageSource.trim()
      // Validate that the URL looks like an image, not a page URL
      // LLM sometimes confuses link hrefs (e.g., "/info/") with image sources
      if (trimmed && !isDefinitelyPageUrl(trimmed)) {
        // Only use URLs that look like actual images
        if (isLikelyImageUrl(trimmed)) {
          image = { src: trimmed }
        } else {
          // Log warning for suspicious image URL that's not clearly a page
          // but also doesn't look like an image
          warnings.push({
            issue: 'invalid_structure',
            message: `Dropped suspicious card image URL that doesn't look like an image: "${trimmed.substring(0, 100)}"`,
            field: 'image',
            childType: 'card-item'
          })
        }
      }
    } else if (isRecord(imageSource)) {
      const src = normalizeString(imageSource.src ?? imageSource.url ?? imageSource.href)
      const alt = normalizeString(
        imageSource.alt ?? imageSource.title ?? imageSource.caption ?? imageSource.description
      )
      // Apply the same validation for object-style image sources
      if (src && !isDefinitelyPageUrl(src)) {
        if (isLikelyImageUrl(src)) {
          image = { src, ...(alt ? { alt } : {}) }
        } else {
          warnings.push({
            issue: 'invalid_structure',
            message: `Dropped suspicious card image URL that doesn't look like an image: "${src.substring(0, 100)}"`,
            field: 'image',
            childType: 'card-item'
          })
        }
      }
    }

    // Also extract bgColor for cards without images (color cards)
    const bgColor = normalizeString(record.bgColor ?? record.backgroundColor ?? record.color)

    const rawId = normalizeString(record.id ?? record.key)
    const idSeed = normalizeString(rawId ?? href ?? title)
    const fallbackId = idSeed
      ? `pinned-${idSeed
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '') || index + 1}`
      : `pinned-${index + 1}`
    const pinnedItem: Record<string, any> = {
      type: canonicalizeComponentType((record.type ?? record.component ?? record.kind) as string) ?? 'card-item',
      id: rawId || fallbackId,
      title,
      ...(summary ? { summary } : {}),
      ...(href ? { href } : {}),
      ...(image ? { image } : {}),
      // Include bgColor for color cards (cards with background color but no image)
      ...(bgColor && !image ? { bgColor } : {})
    }
    pinned.push(pinnedItem)
  })

  if (pinned.length > 0) {
    normalized.pinned = pinned
  } else {
    delete normalized.pinned
  }

  return { content: normalized, warnings }
}

// ============================================================================
// Two Column Normalizer
// ============================================================================

/**
 * Normalizes a column child component.
 * Handles direct LLM output format where children are objects with type, title, image, etc.
 * at the top level (not nested under content).
 */
function normalizeColumnChild(
  entry: Record<string, any>,
  columnName: string,
  index: number,
  options: { parentCanonicalType: string; pageUrl?: string },
  warnings: LocalNormalizationWarning[]
): Record<string, any> | null {
  // Get the child type - LLM outputs type at root level
  const childType = normalizeString(entry.type ?? entry.component ?? entry.kind)

  if (!childType) {
    warnings.push({
      issue: 'invalid-subcomponent',
      message: `Dropped ${columnName}[${index}] missing type field.`,
      field: columnName,
      childType: undefined,
      details: { index, keys: Object.keys(entry) }
    })
    return null
  }

  // Canonicalize the child type
  const canonicalChild = canonicalizeComponentType(childType) ?? childType

  // Build normalized child structure
  // LLM outputs flat structure like { type: 'card-item', title: '...', image: {...} }
  // We need to wrap these in { type, content: {...} } format for CMS
  const normalized: Record<string, any> = {
    type: canonicalChild
  }

  // Copy id if present
  if (entry.id) {
    normalized.id = entry.id
  } else {
    // Generate stable id
    const idSource = normalizeString(entry.title ?? entry.heading ?? entry.label ?? entry.name)
    if (idSource) {
      normalized.id = `${columnName}-${index}-${idSource.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30)}`
    } else {
      normalized.id = `${columnName}-${index}`
    }
  }

  // Build content object from remaining fields
  const contentFields: Record<string, any> = {}
  const skipKeys = new Set(['type', 'component', 'kind', 'id'])

  for (const [key, value] of Object.entries(entry)) {
    if (skipKeys.has(key)) continue
    if (value !== undefined && value !== null) {
      contentFields[key] = value
    }
  }

  // Handle nested content if already structured correctly
  if (isRecord(entry.content)) {
    // Merge existing content fields
    Object.assign(contentFields, entry.content)
  }

  // Ensure bodyHtml for HTML content (html-block components)
  const body = contentFields.body
  const hasExistingBodyHtml = typeof contentFields.bodyHtml === 'string' && contentFields.bodyHtml.trim().length > 0

  // For html-block components, prioritize bodyHtml field
  if (canonicalChild === 'html-block') {
    // Ensure bodyHtml is set from various sources
    if (!hasExistingBodyHtml) {
      if (typeof body === 'string' && body.trim().length > 0) {
        contentFields.bodyHtml = body
      } else if (typeof contentFields.text === 'string' && contentFields.text.trim().length > 0) {
        contentFields.bodyHtml = contentFields.text
      } else if (typeof contentFields.html === 'string' && contentFields.html.trim().length > 0) {
        contentFields.bodyHtml = contentFields.html
      }
    }
  } else {
    // Generic text content handling
    if (typeof body === 'string' && containsHtmlTags(body) && !hasExistingBodyHtml) {
      contentFields.bodyHtml = body
    } else if (!hasExistingBodyHtml && typeof contentFields.text === 'string' && containsHtmlTags(contentFields.text)) {
      contentFields.bodyHtml = contentFields.text
    }
  }

  // Only add content if there are fields
  if (Object.keys(contentFields).length > 0) {
    normalized.content = contentFields
  }

  return normalized
}

/**
 * Converts LLM tuple format [type, confidence, props] to object format.
 * Returns the original entry if it's already an object.
 */
function convertTupleToObject(entry: unknown): Record<string, any> | null {
  // Handle tuple format: [type, confidence, props]
  if (Array.isArray(entry) && entry.length >= 2) {
    const [type, second, third] = entry
    if (typeof type === 'string') {
      // Format: [type, confidence, props] or [type, props]
      if (typeof second === 'number' && isRecord(third)) {
        return { type, confidence: second, ...third }
      }
      // Format: [type, props] (no confidence)
      if (isRecord(second)) {
        return { type, ...second }
      }
      // Format: [type, confidence] (no props)
      if (typeof second === 'number') {
        return { type, confidence: second }
      }
    }
  }

  // Already an object
  if (isRecord(entry)) {
    return entry as Record<string, any>
  }

  return null
}

/**
 * Normalizes a column array (leftColumn or rightColumn).
 * Handles both LLM tuple format [type, confidence, props] and object format { type, ... }.
 */
function normalizeColumnArray(
  entries: unknown[] | undefined,
  columnName: string,
  options: { parentCanonicalType: string; pageUrl?: string },
  warnings: LocalNormalizationWarning[]
): Record<string, any>[] {
  if (!Array.isArray(entries)) {
    return []
  }

  const normalized: Record<string, any>[] = []

  entries.forEach((entry, index) => {
    // Convert tuple format to object format
    const entryObj = convertTupleToObject(entry)

    if (!entryObj) {
      warnings.push({
        issue: 'invalid-subcomponent',
        message: `Dropped ${columnName}[${index}] - not a valid component (expected object or tuple).`,
        field: columnName,
        childType: undefined,
        details: { index, valueType: typeof entry, isArray: Array.isArray(entry) }
      })
      return
    }

    const child = normalizeColumnChild(entryObj, columnName, index, options, warnings)
    if (child) {
      normalized.push(child)
    }
  })

  return normalized
}

/**
 * Normalizes two-column component content.
 * Properly handles nested children in leftColumn/rightColumn arrays.
 */
export const normalizeTwoColumnContent: ComponentContentNormalizer = (
  content: Record<string, any>,
  options: { parentCanonicalType: string; pageUrl?: string }
) => {
  const warnings: LocalNormalizationWarning[] = []
  const flattened = expandSourceRecord(content, {
    canonicalType: 'two-column',
    parentCanonicalType: options.parentCanonicalType,
    field: 'content',
    index: 0,
    pageUrl: options.pageUrl
  })

  const normalized: Record<string, any> = { ...flattened }

  // Normalize leftColumn array
  if (Array.isArray(flattened.leftColumn)) {
    normalized.leftColumn = normalizeColumnArray(
      flattened.leftColumn,
      'leftColumn',
      options,
      warnings
    )
  }

  // Normalize rightColumn array
  if (Array.isArray(flattened.rightColumn)) {
    normalized.rightColumn = normalizeColumnArray(
      flattened.rightColumn,
      'rightColumn',
      options,
      warnings
    )
  }

  // Handle areas.left/right as well
  if (isRecord(flattened.areas)) {
    const areas = flattened.areas as Record<string, unknown>
    if (!normalized.areas) {
      normalized.areas = {}
    }
    if (Array.isArray(areas.left)) {
      (normalized.areas as Record<string, any>).left = normalizeColumnArray(
        areas.left as unknown[],
        'areas.left',
        options,
        warnings
      )
    }
    if (Array.isArray(areas.right)) {
      (normalized.areas as Record<string, any>).right = normalizeColumnArray(
        areas.right as unknown[],
        'areas.right',
        options,
        warnings
      )
    }
  }

  return { content: normalized, warnings }
}
