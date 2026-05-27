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
 * Normalizes body-like aliases into the current text-block body contract.
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
    normalizeString(flattened.bodyHtml) ??
    normalizeString(flattened.bodyText) ??
    normalizeString(flattened.text) ??
    normalizeString(flattened.copy) ??
    normalizeString(flattened.html)

  if (bodyCandidate) {
    normalized.body = bodyCandidate
  }
  delete normalized.bodyHtml
  delete normalized.bodyText
  delete normalized.text
  delete normalized.copy
  delete normalized.html

  return { content: normalized, warnings }
}

// ============================================================================
// Content Feed Normalizer
// ============================================================================

function isStructuredSmartLink(value: unknown): value is Record<string, any> {
  return isRecord(value) && typeof value.type === 'string'
}

function normalizeFeedHref(record: Record<string, any>): unknown {
  if (isStructuredSmartLink(record.href)) {
    return record.href
  }
  if (record.href == null) {
    return undefined
  }
  return extractLinkUrl(record.href)
}

function normalizeFeedImage(imageSource: unknown, warnings: LocalNormalizationWarning[]): Record<string, any> | undefined {
  if (typeof imageSource === 'string') {
    const trimmed = imageSource.trim()
    if (!trimmed || isDefinitelyPageUrl(trimmed)) {
      return undefined
    }
    if (isLikelyImageUrl(trimmed)) {
      return { src: trimmed }
    }
    warnings.push({
      issue: 'invalid_structure',
      message: `Dropped suspicious feed image URL that doesn't look like an image: "${trimmed.substring(0, 100)}"`,
      field: 'image',
      childType: 'content-feed'
    })
    return undefined
  }

  if (!isRecord(imageSource)) {
    return undefined
  }

  if (isRecord(imageSource.src)) {
    return imageSource
  }

  const src = normalizeString(imageSource.src ?? imageSource.url ?? imageSource.href)
  const alt = normalizeString(
    imageSource.alt ?? imageSource.title ?? imageSource.caption ?? imageSource.description
  )
  if (!src || isDefinitelyPageUrl(src)) {
    return undefined
  }
  if (isLikelyImageUrl(src)) {
    return { src, ...(alt ? { alt } : {}) }
  }
  warnings.push({
    issue: 'invalid_structure',
    message: `Dropped suspicious feed image URL that doesn't look like an image: "${src.substring(0, 100)}"`,
    field: 'image',
    childType: 'content-feed'
  })
  return undefined
}

const CONTENT_FEED_PINNED_FIELDS = new Set(['title', 'excerpt', 'date', 'href', 'image', 'category'])
const STATIC_PROJECT_FEED_HEADING_PATTERN = /\b(projects?|latest work|client work|case stud(?:y|ies)|portfolio)\b/i

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

  const headingText = [normalizeString(normalized.heading), normalizeString(normalized.subheading)]
    .filter(Boolean)
    .join(' ')
  if (STATIC_PROJECT_FEED_HEADING_PATTERN.test(headingText)) {
    warnings.push({
      issue: 'invalid-value',
      message: 'Project, client-work, portfolio, and case-study sections must use card-grid, not content-feed.',
      field: 'heading',
      childType: 'content-feed',
      details: { heading: normalizeString(normalized.heading), subheading: normalizeString(normalized.subheading) }
    })
  }

  const layout = normalizeString(normalized.layout)
  if (layout !== 'list' && layout !== 'card-grid') {
    normalized.layout = 'card-grid'
  }

  const pinnedSource = normalized.pinned ?? flattened.pinned
  const pinnedArray = Array.isArray(pinnedSource) ? pinnedSource : []
  if (pinnedSource != null && !Array.isArray(pinnedSource)) {
    warnings.push({
      issue: 'invalid-subcomponent',
      message: 'Expected pinned entries to be an array.',
      field: 'pinned',
      childType: 'content-feed'
    })
  }

  const pinned: Record<string, any>[] = []
  pinnedArray.forEach((entry, index) => {
    if (!isRecord(entry)) {
      warnings.push({
        issue: 'invalid-subcomponent',
        message: 'Expected pinned feed entry to be an object.',
        field: 'pinned',
        childType: 'content-feed',
        details: { index }
      })
      return
    }

    const record: Record<string, any> = { ...entry }
    const unsupportedFields = Object.keys(record).filter(field => !CONTENT_FEED_PINNED_FIELDS.has(field))
    if (unsupportedFields.length > 0) {
      warnings.push({
        issue: 'unknown-field',
        message: `Unsupported fields on content-feed pinned entry: ${unsupportedFields.join(', ')}`,
        field: 'pinned',
        childType: 'content-feed',
        details: { index, unsupportedFields }
      })
      return
    }

    const title = normalizeString(record.title)
    const excerpt = normalizeString(record.excerpt)
    const href = normalizeFeedHref(record)

    const image = normalizeFeedImage(record.image, warnings)
    const pinnedItem: Record<string, any> = {
      title,
      ...(excerpt ? { excerpt } : {}),
      ...(href ? { href } : {}),
      ...(image ? { image } : {}),
      ...(normalizeString(record.date) ? { date: normalizeString(record.date) } : {}),
      ...(normalizeString(record.category) ? { category: normalizeString(record.category) } : {})
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
  const skipKeys = new Set(['type', 'component', 'kind', 'id', 'content'])

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

  if (canonicalChild === 'sidemenu' || canonicalChild === 'sidebar-nav') {
    if (contentFields.heading && !contentFields.title) {
      contentFields.title = contentFields.heading
      delete contentFields.heading
    }
    if (Array.isArray(contentFields.menuItems) && !Array.isArray(contentFields.items)) {
      contentFields.items = contentFields.menuItems
      delete contentFields.menuItems
    }
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
