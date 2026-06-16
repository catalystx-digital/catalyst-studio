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
  normalizeImage,
  isRecord,
  extractLinkUrl,
  coerceBoolean,
  normalizeTokenList,
  pruneObjectAgainstContract,
  type LocalNormalizationWarning,
  type ComponentContentNormalizer
} from './shared-normalizer-utils'
import {
  containsHtmlTags,
  stripHtmlToText,
  convertPlainTextToHtml
} from '../string-utils'
import { isDefinitelyPageUrl } from '../../../../utils/url-transformer'
import { normalizeCtaBannerContent, normalizeCtaSimpleContent } from './cta-normalizers'
import { normalizeImageGalleryContent } from './media-normalizers'

function stableMediaIdFromUrl(url: string, fallback: string): string {
  const clean = url
    .replace(/^https?:\/\//i, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 48)
  return `detected:${clean || fallback}`
}

function normalizeImageObject(value: unknown, fallbackAlt: string | undefined, fallbackId: string): Record<string, any> | undefined {
  const normalized = normalizeImage(value, fallbackAlt)
  const url = normalized?.src ?? normalized?.originalUrl
  if (!url && !normalized?.mediaId) {
    return undefined
  }
  const alt = normalized?.alt ?? fallbackAlt
  return {
    src: {
      mediaId: normalized?.mediaId ?? stableMediaIdFromUrl(url ?? fallbackId, fallbackId),
      mediaType: 'image',
      ...(url ? { url } : {}),
      ...(alt ? { alt } : {})
    },
    ...(alt ? { alt } : {}),
    ...(url ? { originalUrl: normalized?.originalUrl ?? url } : {}),
    ...(normalized?.renditions ? { renditions: normalized.renditions } : {})
  }
}

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

function normalizeTextAlignment(value: unknown): 'left' | 'center' | 'right' | 'justify' | undefined {
  const normalized = normalizeString(value)?.toLowerCase()
  if (normalized === 'left' || normalized === 'center' || normalized === 'right' || normalized === 'justify') {
    return normalized
  }
  return undefined
}

function normalizeTextColumns(value: unknown): 1 | 2 | 3 | undefined {
  const numeric = typeof value === 'number'
    ? value
    : typeof value === 'string'
      ? Number.parseInt(value.trim(), 10)
      : undefined

  if (numeric === 1 || numeric === 2 || numeric === 3) {
    return numeric
  }
  return undefined
}

function normalizeHeadingLevel(value: unknown): 1 | 2 | 3 | 4 | 5 | 6 | undefined {
  const numeric = typeof value === 'number'
    ? value
    : typeof value === 'string'
      ? Number.parseInt(value.trim().replace(/^h/i, ''), 10)
      : undefined

  if (numeric === 1 || numeric === 2 || numeric === 3 || numeric === 4 || numeric === 5 || numeric === 6) {
    return numeric
  }
  return undefined
}

function pageIdFromPath(path: string): string {
  return path.replace(/^\/+|\/+$/g, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'home'
}

function normalizeContentSmartLink(value: unknown): Record<string, any> | undefined {
  if (isRecord(value)) {
    const type = normalizeString(value.type)?.toLowerCase()
    if (type === 'internal') {
      const path = extractLinkUrl(value.path ?? value.href ?? value.url)
      return path
        ? {
            type: 'internal',
            pageId: normalizeString(value.pageId) ?? pageIdFromPath(path),
            path
          }
        : undefined
    }
    if (type === 'external') {
      const url = extractLinkUrl(value.url ?? value.href)
      if (!url) return undefined
      const normalizedUrl = url.startsWith('//')
        ? `https:${url}`
        : /^[\w.-]+\.[a-z]{2,}(?:\/.*)?$/i.test(url)
          ? `https://${url}`
          : url
      return /^https?:\/\//i.test(normalizedUrl) ? { type: 'external', url: normalizedUrl } : undefined
    }
    if (type === 'email' || type === 'phone' || type === 'anchor') {
      const href = extractLinkUrl(value.href ?? value.url ?? value.path)
      return href ? { type, href } : undefined
    }
  }

  const raw = extractLinkUrl(value)
  if (!raw) return undefined
  const href = raw.startsWith('//')
    ? `https:${raw}`
    : /^[\w.-]+\.[a-z]{2,}(?:\/.*)?$/i.test(raw)
      ? `https://${raw}`
      : raw
  if (href.startsWith('#')) return { type: 'anchor', href }
  if (href.startsWith('mailto:')) return { type: 'email', href }
  if (href.startsWith('tel:')) return { type: 'phone', href }
  if (/^https?:\/\//i.test(href)) return { type: 'external', url: href }
  return { type: 'internal', pageId: pageIdFromPath(href), path: href }
}

function normalizeNavigationMenuItem(
  value: unknown,
  field: string,
  warnings: LocalNormalizationWarning[]
): Record<string, any> | undefined {
  if (!isRecord(value)) {
    warnings.push({
      issue: 'invalid-subcomponent',
      message: `Dropped ${field} because payload is not an object.`,
      field,
      childType: 'nav-menu-item'
    })
    return undefined
  }

  const label = normalizeString(value.label ?? value.text ?? value.title ?? value.name)
  const href = normalizeContentSmartLink(value.href ?? value.url ?? value.link ?? value.path)
  if (!label || !href) {
    warnings.push({
      issue: 'invalid-subcomponent',
      message: `Dropped ${field} missing label or href.`,
      field,
      childType: 'nav-menu-item'
    })
    return undefined
  }

  const children = Array.isArray(value.children)
    ? value.children
        .map((child, index) => normalizeNavigationMenuItem(child, `${field}.children.${index}`, warnings))
        .filter((child): child is Record<string, any> => Boolean(child))
    : undefined

  return {
    label,
    href,
    ...(normalizeString(value.description) ? { description: normalizeString(value.description) } : {}),
    ...(normalizeString(value.icon) ? { icon: normalizeString(value.icon) } : {}),
    ...(children && children.length > 0 ? { children } : {}),
    ...(typeof value.external === 'boolean' ? { external: value.external } : {})
  }
}

function normalizeSidemenuContentFields(
  contentFields: Record<string, any>,
  fieldPrefix: string,
  warnings: LocalNormalizationWarning[]
): Record<string, any> {
  const normalized: Record<string, any> = { ...contentFields }
  if (normalized.heading && !normalized.title) {
    normalized.title = normalized.heading
  }
  delete normalized.heading

  if (Array.isArray(normalized.menuItems) && !Array.isArray(normalized.items)) {
    normalized.items = normalized.menuItems
  }
  delete normalized.menuItems

  if (Array.isArray(normalized.links) && !Array.isArray(normalized.items)) {
    normalized.items = normalized.links
  }
  delete normalized.links

  if (Array.isArray(normalized.items)) {
    normalized.items = normalized.items
      .map((item, index) => normalizeNavigationMenuItem(item, `${fieldPrefix}.items.${index}`, warnings))
      .filter((item): item is Record<string, any> => Boolean(item))
  }

  if (Array.isArray(normalized.sections)) {
    normalized.sections = normalized.sections
      .map((section: unknown, sectionIndex: number) => {
        if (!isRecord(section)) {
          warnings.push({
            issue: 'invalid-subcomponent',
            message: `Dropped ${fieldPrefix}.sections.${sectionIndex} because payload is not an object.`,
            field: `${fieldPrefix}.sections`,
            childType: 'sidemenu'
          })
          return undefined
        }
        const rawItems = Array.isArray(section.items)
          ? section.items
          : Array.isArray(section.links)
            ? section.links
            : []
        const items = rawItems
          .map((item, itemIndex) => normalizeNavigationMenuItem(item, `${fieldPrefix}.sections.${sectionIndex}.items.${itemIndex}`, warnings))
          .filter((item): item is Record<string, any> => Boolean(item))
        if (items.length === 0) {
          return undefined
        }
        return {
          ...(normalizeString(section.heading ?? section.title) ? { heading: normalizeString(section.heading ?? section.title) } : {}),
          items
        }
      })
      .filter((section): section is { heading?: string; items: Record<string, any>[] } => Boolean(section))
  }

  return normalized
}

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

  const alignment = normalizeTextAlignment(normalized.alignment)
  if (alignment) normalized.alignment = alignment
  else delete normalized.alignment

  const columns = normalizeTextColumns(normalized.columns)
  if (columns) normalized.columns = columns
  else delete normalized.columns

  const headingLevel = normalizeHeadingLevel(normalized.headingLevel ?? normalized.level)
  if (headingLevel) normalized.headingLevel = headingLevel
  else delete normalized.headingLevel
  delete normalized.level

  const { result: pruned, warnings: pruneWarnings } = pruneObjectAgainstContract(normalized, 'text-block', {
    childType: 'text-block'
  })
  warnings.push(...pruneWarnings)

  return { content: pruned, warnings }
}

// ============================================================================
// HTML Block Normalizer
// ============================================================================

/**
 * Normalizes html-block component content.
 * Maps rich-content aliases into the current bodyHtml contract.
 */
export const normalizeHtmlBlockContent: ComponentContentNormalizer = (
  content: Record<string, any>,
  options: { parentCanonicalType: string; pageUrl?: string }
) => {
  const warnings: LocalNormalizationWarning[] = []
  const flattened = expandSourceRecord(content, {
    canonicalType: 'html-block',
    parentCanonicalType: options.parentCanonicalType,
    field: 'content',
    index: 0,
    pageUrl: options.pageUrl
  })

  const normalized: Record<string, any> = { ...flattened }
  const bodyHtml =
    normalizeString(flattened.bodyHtml) ??
    normalizeString(flattened.html) ??
    normalizeString(flattened.body) ??
    normalizeString(flattened.text) ??
    normalizeString(flattened.copy)

  if (bodyHtml) {
    normalized.bodyHtml = bodyHtml
  } else {
    delete normalized.bodyHtml
  }

  const sourceUrl = extractLinkUrl(flattened.sourceUrl ?? flattened.sourceURL ?? flattened.url ?? flattened.originalUrl)
  if (sourceUrl) {
    normalized.sourceUrl = sourceUrl
  }

  delete normalized.html
  delete normalized.body
  delete normalized.text
  delete normalized.copy
  delete normalized.sourceURL
  delete normalized.url
  delete normalized.originalUrl

  const { result: pruned, warnings: pruneWarnings } = pruneObjectAgainstContract(normalized, 'html-block', {
    childType: 'html-block'
  })
  warnings.push(...pruneWarnings)

  return { content: pruned, warnings }
}

function normalizeQuoteEnum<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  const normalized = normalizeString(value)?.toLowerCase()
  return allowed.find(entry => entry === normalized)
}

function normalizeQuoteAttribution(value: unknown, flattened: Record<string, any>): Record<string, any> | undefined {
  const source = isRecord(value) ? expandSourceRecord(value, { canonicalType: 'quote-attribution', parentCanonicalType: 'quote-block', field: 'attribution', index: 0 }) : {}
  const author = normalizeString(source.author ?? source.name ?? source.person ?? source.cite ?? flattened.author ?? flattened.name ?? flattened.person ?? flattened.cite)
  const title = normalizeString(source.title ?? source.role ?? source.jobTitle ?? flattened.authorTitle ?? flattened.role)
  const organization = normalizeString(source.organization ?? source.company ?? source.org ?? flattened.organization ?? flattened.company)
  const date = normalizeString(source.date ?? flattened.date)
  const image = normalizeImageObject(
    source.image ?? source.avatar ?? source.photo ?? flattened.avatar ?? flattened.image,
    author,
    'quote-attribution'
  )
  const attribution: Record<string, any> = {}
  if (author) attribution.author = author
  if (title) attribution.title = title
  if (organization) attribution.organization = organization
  if (date) attribution.date = date
  if (image) attribution.image = image
  return Object.keys(attribution).length > 0 ? attribution : undefined
}

export const normalizeQuoteBlockContent: ComponentContentNormalizer = (
  rawContent: Record<string, any>,
  options: { parentCanonicalType: string; pageUrl?: string }
) => {
  const warnings: LocalNormalizationWarning[] = []
  const flattened = expandSourceRecord(rawContent, {
    canonicalType: 'quote-block',
    parentCanonicalType: options.parentCanonicalType,
    field: 'content',
    index: 0,
    pageUrl: options.pageUrl
  })
  const normalized: Record<string, any> = { ...flattened }
  const quote = normalizeString(
    flattened.quote ?? flattened.text ?? flattened.body ?? flattened.copy ?? flattened.testimonial ?? flattened.review ?? flattened.content
  )
  if (quote) {
    normalized.quote = quote
  }

  const attribution = normalizeQuoteAttribution(flattened.attribution, flattened)
  if (attribution) normalized.attribution = attribution

  const icon = normalizeQuoteEnum(flattened.icon, ['quotes', 'none', 'custom'] as const)
  if (icon) normalized.icon = icon
  else delete normalized.icon

  const style = normalizeQuoteEnum(flattened.style ?? flattened.variant, ['default', 'bordered', 'highlighted', 'testimonial', 'pullquote'] as const)
  if (style) normalized.style = style
  else delete normalized.style

  const align = normalizeQuoteEnum(flattened.align ?? flattened.alignment, ['left', 'center', 'right'] as const)
  if (align) normalized.align = align
  else delete normalized.align

  const size = normalizeQuoteEnum(flattened.size, ['small', 'medium', 'large', 'xlarge'] as const)
  if (size) normalized.size = size
  else delete normalized.size

  if ('highlight' in normalized) normalized.highlight = coerceBoolean(normalized.highlight)

  delete normalized.text
  delete normalized.body
  delete normalized.copy
  delete normalized.testimonial
  delete normalized.review
  delete normalized.author
  delete normalized.name
  delete normalized.person
  delete normalized.cite
  delete normalized.role
  delete normalized.authorTitle
  delete normalized.organization
  delete normalized.company
  delete normalized.avatar
  delete normalized.image
  delete normalized.alignment
  delete normalized.variant

  const { result: pruned, warnings: pruneWarnings } = pruneObjectAgainstContract(normalized, 'quote-block', {
    childType: 'quote-block'
  })
  warnings.push(...pruneWarnings)
  return { content: pruned, warnings }
}

// ============================================================================
// Content Feed Normalizer
// ============================================================================

function normalizeSideNavigationContentFor(
  canonicalType: 'sidemenu' | 'sidebar-nav',
  content: Record<string, any>,
  options: { parentCanonicalType: string; pageUrl?: string }
): { content: Record<string, any>; warnings: LocalNormalizationWarning[] } {
  const warnings: LocalNormalizationWarning[] = []
  const flattened = expandSourceRecord(content, {
    canonicalType,
    parentCanonicalType: options.parentCanonicalType,
    field: 'content',
    index: 0,
    pageUrl: options.pageUrl
  })

  const normalized = normalizeSidemenuContentFields(flattened, 'content', warnings)
  const { result: pruned, warnings: pruneWarnings } = pruneObjectAgainstContract(normalized, canonicalType, {
    childType: canonicalType
  })
  warnings.push(...pruneWarnings)

  return { content: pruned, warnings }
}

export const normalizeSidemenuContent: ComponentContentNormalizer = (content, options) =>
  normalizeSideNavigationContentFor('sidemenu', content, options)

export const normalizeSidebarNavContent: ComponentContentNormalizer = (content, options) =>
  normalizeSideNavigationContentFor('sidebar-nav', content, options)

function isStructuredSmartLink(value: unknown): value is Record<string, any> {
  return isRecord(value) && typeof value.type === 'string'
}

function buildSmartLink(href: string): Record<string, any> | undefined {
  if (!href) {
    return undefined
  }
  const normalizedHref = href.startsWith('//')
    ? `https:${href}`
    : /^[\w.-]+\.[a-z]{2,}(?:\/.*)?$/i.test(href)
      ? `https://${href}`
      : href
  if (href.startsWith('#')) {
    return { type: 'anchor', href }
  }
  if (normalizedHref.startsWith('mailto:')) {
    return { type: 'email', href: normalizedHref }
  }
  if (normalizedHref.startsWith('tel:')) {
    return { type: 'phone', href: normalizedHref }
  }
  if (/^https?:\/\//i.test(normalizedHref)) {
    return { type: 'external', url: normalizedHref }
  }
  return {
    type: 'internal',
    pageId: normalizedHref.replace(/^\/+|\/+$/g, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'home',
    path: normalizedHref
  }
}

function normalizeStructuredFeedHref(value: Record<string, any>): Record<string, any> | undefined {
  const type = normalizeString(value.type)?.toLowerCase()
  if (type === 'internal') {
    const path = extractLinkUrl(value.path ?? value.href ?? value.url)
    if (!path) return undefined
    const generatedPageId = path.replace(/^\/+|\/+$/g, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'home'
    return {
      type: 'internal',
      pageId: normalizeString(value.pageId) ?? generatedPageId,
      path,
      ...(normalizeString(value.label) ? { label: normalizeString(value.label) } : {})
    }
  }
  if (type === 'external') {
    const url = extractLinkUrl(value.url ?? value.href)
    if (!url) return undefined
    const normalizedUrl = url.startsWith('//')
      ? `https:${url}`
      : /^[\w.-]+\.[a-z]{2,}(?:\/.*)?$/i.test(url)
        ? `https://${url}`
        : url
    if (!/^https?:\/\//i.test(normalizedUrl)) return undefined
    return {
      type: 'external',
      url: normalizedUrl,
      ...(normalizeString(value.label) ? { label: normalizeString(value.label) } : {}),
      ...(typeof value.openInNewTab === 'boolean' ? { openInNewTab: value.openInNewTab } : {})
    }
  }
  if (type === 'email' || type === 'phone' || type === 'anchor') {
    const href = extractLinkUrl(value.href ?? value.url ?? value.path)
    if (!href) return undefined
    return {
      type,
      href,
      ...(normalizeString(value.label) ? { label: normalizeString(value.label) } : {})
    }
  }
  return undefined
}

function normalizeFeedHref(record: Record<string, any>): unknown {
  if (isStructuredSmartLink(record.href)) {
    return normalizeStructuredFeedHref(record.href)
  }
  const candidate = record.href ?? record.url ?? record.link ?? record.path
  if (candidate == null) {
    return undefined
  }
  if (isStructuredSmartLink(candidate)) {
    return normalizeStructuredFeedHref(candidate)
  }
  const href = extractLinkUrl(candidate)
  if (!href) {
    return undefined
  }
  return buildSmartLink(href)
}

function normalizeFeedImage(
  imageSource: unknown,
  fallbackAlt: string | undefined,
  warnings: LocalNormalizationWarning[],
  context: { parentCanonicalType: string; pageUrl?: string; index: number }
): Record<string, any> | undefined {
  const imageWarnings: LocalNormalizationWarning[] = []
  const normalized = normalizeImage(imageSource, fallbackAlt, {
    field: `pinned.${context.index}.image`,
    warnings: imageWarnings,
    context: {
      canonicalType: 'content-feed',
      parentCanonicalType: context.parentCanonicalType,
      field: 'pinned',
      index: context.index,
      pageUrl: context.pageUrl
    }
  })

  warnings.push(...imageWarnings)

  if (!normalized) {
    return undefined
  }

  if (!normalized.src && !normalized.originalUrl) {
    warnings.push({
      issue: 'invalid-value',
      message: `Removed content-feed image at index ${context.index} because it has no renderable URL.`,
      field: `pinned.${context.index}.image`,
      childType: 'content-feed',
      details: { index: context.index, mediaId: normalized.mediaId }
    })
    return undefined
  }

  return {
    ...(normalized.mediaId
      ? {
          src: {
            mediaId: normalized.mediaId,
            mediaType: 'image',
            ...(normalized.src ? { url: normalized.src } : {}),
            ...(normalized.alt ? { alt: normalized.alt } : {})
          }
        }
      : {}),
    ...(normalized.alt ? { alt: normalized.alt } : {}),
    ...(normalized.originalUrl ?? normalized.src ? { originalUrl: normalized.originalUrl ?? normalized.src } : {}),
    ...(normalized.renditions ? { renditions: normalized.renditions } : {})
  }
}

const CONTENT_FEED_ENTRY_ALIAS_FIELDS = new Set([
  'id',
  'slug',
  'title',
  'headline',
  'name',
  'summary',
  'excerpt',
  'description',
  'body',
  'date',
  'publishDate',
  'publishedAt',
  'createdAt',
  'updatedAt',
  'href',
  'url',
  'link',
  'path',
  'image',
  'thumbnail',
  'thumbnailUrl',
  'imageUrl',
  'category',
  'categories',
  'tag',
  'tags',
  'author',
  'metadata'
])
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
  if (isRecord(normalized.source)) {
    normalized.source = {
      ...normalized.source,
      ...(normalized.source.pathPrefix ?? normalized.source.path ? { pathPrefix: normalized.source.pathPrefix ?? normalized.source.path } : {}),
      ...(normalized.source.ancestorId ?? normalized.source.ancestor ? { ancestorId: normalized.source.ancestorId ?? normalized.source.ancestor } : {}),
      ...(normalized.source.siteId ?? normalized.source.site ? { siteId: normalized.source.siteId ?? normalized.source.site } : {})
    }
    delete normalized.source.path
    delete normalized.source.ancestor
    delete normalized.source.site
  }

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

  const pinnedSource = normalized.pinned ?? flattened.pinned ?? flattened.items ?? flattened.posts ?? flattened.articles
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
    const unsupportedFields = Object.keys(record).filter(field => !CONTENT_FEED_ENTRY_ALIAS_FIELDS.has(field))
    if (unsupportedFields.length > 0) {
      warnings.push({
        issue: 'unknown-field',
        message: `Unsupported fields on content-feed pinned entry: ${unsupportedFields.join(', ')}`,
        field: 'pinned',
        childType: 'content-feed',
        details: { index, unsupportedFields }
      })
    }

    const title = normalizeString(record.title ?? record.headline ?? record.name)
    if (!title) {
      warnings.push({
        issue: 'missing-required-field',
        message: 'Dropped content-feed pinned entry without a title.',
        field: 'pinned',
        childType: 'content-feed',
        details: { index }
      })
      return
    }

    const excerpt = normalizeString(record.excerpt ?? record.summary ?? record.description ?? record.body)
    const href = normalizeFeedHref(record)
    const imageSource = record.image ?? record.thumbnail ?? record.thumbnailUrl ?? record.imageUrl
    const image = normalizeFeedImage(imageSource, title, warnings, {
      parentCanonicalType: options.parentCanonicalType,
      pageUrl: options.pageUrl,
      index
    })
    const category =
      normalizeString(record.category) ??
      (Array.isArray(record.categories) ? normalizeString(record.categories[0]) : undefined) ??
      normalizeString(record.tag) ??
      (Array.isArray(record.tags) ? normalizeString(record.tags[0]) : undefined)
    const date =
      normalizeString(record.date) ??
      normalizeString(record.publishDate) ??
      normalizeString(record.publishedAt) ??
      normalizeString(record.metadata?.publishDate) ??
      normalizeString(record.metadata?.date)
    const author =
      normalizeString(record.author) ??
      normalizeString(record.author?.name) ??
      normalizeString(record.metadata?.author) ??
      normalizeString(record.metadata?.author?.name)
    const metadata = {
      ...(isRecord(record.metadata) ? record.metadata : {}),
      ...(author ? { author } : {})
    }

    const pinnedItem: Record<string, any> = {
      title,
      ...(excerpt ? { excerpt } : {}),
      ...(href ? { href } : {}),
      ...(image ? { image } : {}),
      ...(date ? { date } : {}),
      ...(category ? { category } : {}),
      ...(Object.keys(metadata).length > 0 ? { metadata } : {})
    }
    pinned.push(pinnedItem)
  })

  if (pinned.length > 0) {
    normalized.pinned = pinned
  } else {
    delete normalized.pinned
  }
  delete normalized.items
  delete normalized.posts
  delete normalized.articles

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

  // Build content object from remaining fields. Column children can arrive as
  // `{ content: { props: ... } }`; flatten before component-specific pruning.
  let contentFields: Record<string, any> = {}
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
    const navContent = normalizeSidemenuContentFields(contentFields, `${columnName}.${index}.content`, warnings)
    for (const key of Object.keys(contentFields)) {
      delete contentFields[key]
    }
    Object.assign(contentFields, navContent)
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
    contentFields = expandSourceRecord(contentFields, {
      canonicalType: canonicalChild,
      parentCanonicalType: 'two-column',
      field: `${columnName}.${index}.content`,
      index,
      pageUrl: options.pageUrl
    })
    delete contentFields.content
    delete contentFields.data
    delete contentFields.fields
    delete contentFields.attributes
    delete contentFields.props
    delete contentFields.payload

    const childNormalizer = {
      'text-block': normalizeTextBlockContent,
      'html-block': normalizeHtmlBlockContent,
      'cta-simple': normalizeCtaSimpleContent,
      'cta-banner': normalizeCtaBannerContent,
      'image-gallery': normalizeImageGalleryContent,
      sidemenu: normalizeSidemenuContent,
      'sidebar-nav': normalizeSidebarNavContent
    }[canonicalChild] as ComponentContentNormalizer | undefined

    if (childNormalizer) {
      const childResult = childNormalizer(contentFields, {
        parentCanonicalType: 'two-column',
        pageUrl: options.pageUrl
      })
      normalized.content = childResult.content
      warnings.push(...childResult.warnings)
    } else {
      const { result: pruned, warnings: pruneWarnings } = pruneObjectAgainstContract(contentFields, canonicalChild, {
        field: `${columnName}.${index}.content`,
        childType: canonicalChild
      })
      normalized.content = pruned
      warnings.push(...pruneWarnings)
    }
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

function normalizeColumnRatio(value: unknown): '25-75' | '30-70' | '40-60' | '50-50' | '60-40' | '70-30' | '75-25' | undefined {
  const normalized = normalizeString(value)?.replace('/', '-')
  if (
    normalized === '25-75' ||
    normalized === '30-70' ||
    normalized === '40-60' ||
    normalized === '50-50' ||
    normalized === '60-40' ||
    normalized === '70-30' ||
    normalized === '75-25'
  ) {
    return normalized
  }
  return undefined
}

function normalizeTwoColumnGap(value: unknown): 'small' | 'medium' | 'large' | undefined {
  const normalized = normalizeString(value)?.toLowerCase()
  if (normalized === 'small' || normalized === 'sm' || normalized === 'compact') return 'small'
  if (normalized === 'large' || normalized === 'lg' || normalized === 'wide') return 'large'
  if (normalized === 'medium' || normalized === 'md' || normalized === 'default') return 'medium'
  return undefined
}

function normalizeVerticalAlignment(value: unknown): 'top' | 'center' | 'bottom' | undefined {
  const normalized = normalizeString(value)?.toLowerCase()
  if (normalized === 'top' || normalized === 'start') return 'top'
  if (normalized === 'center' || normalized === 'middle') return 'center'
  if (normalized === 'bottom' || normalized === 'end') return 'bottom'
  return undefined
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
    if (Array.isArray(areas.left) && !Array.isArray(normalized.leftColumn)) {
      normalized.leftColumn = normalizeColumnArray(
        areas.left as unknown[],
        'leftColumn',
        options,
        warnings
      )
    }
    if (Array.isArray(areas.right) && !Array.isArray(normalized.rightColumn)) {
      normalized.rightColumn = normalizeColumnArray(
        areas.right as unknown[],
        'rightColumn',
        options,
        warnings
      )
    }
    delete normalized.areas
  }

  const columnRatio = normalizeColumnRatio(normalized.columnRatio ?? normalized.ratio)
  if (columnRatio) normalized.columnRatio = columnRatio
  else delete normalized.columnRatio
  delete normalized.ratio

  const gap = normalizeTwoColumnGap(normalized.gap)
  if (gap) normalized.gap = gap
  else delete normalized.gap

  const verticalAlignment = normalizeVerticalAlignment(normalized.verticalAlignment ?? normalized.alignItems)
  if (verticalAlignment) normalized.verticalAlignment = verticalAlignment
  else delete normalized.verticalAlignment
  delete normalized.alignItems

  if ('reverseOnMobile' in normalized) {
    normalized.reverseOnMobile = coerceBoolean(normalized.reverseOnMobile)
  }

  const { result: pruned, warnings: pruneWarnings } = pruneObjectAgainstContract(normalized, 'two-column', {
    childType: 'two-column'
  })
  warnings.push(...pruneWarnings)

  return { content: pruned, warnings }
}
