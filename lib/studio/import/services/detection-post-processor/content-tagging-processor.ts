/**
 * Content Tagging Processor
 *
 * Handles content type tagging for components including:
 * - Page component tagging (blog posts, articles)
 * - Listing component tagging (card grids, blog lists)
 * - Content type inference from headings, URLs, and item properties
 *
 * @module content-tagging-processor
 */

import { canonicalizeComponentType } from '../page-builder/component-helpers'
import { ComponentType } from '@/lib/studio/components/cms/_core/types'
import type { DetectedComponent, PageMetadata } from '@/lib/studio/import/detection/types'
import {
  DETAIL_COMPONENT_TYPES,
  CONTENT_TYPE_TAG_ALLOWLIST,
  matchTagFromPath,
  matchTagFromHeading,
  normalizeContentTypeTag,
  type ContentTypeTag
} from './content-type-patterns'
import { normalizeString, isPlainObject, normalizeHref } from './utils'
import { getListingComponentTypes } from '@/lib/studio/components/cms/_core/definition-loader'

interface ContentTaggingOptions {
  pageUrl?: string
  pageMetadata?: PageMetadata
}

/**
 * Tags page components (blog-post, article-header, author-bio) with content type.
 */
export function tagPageComponents(
  components: DetectedComponent[],
  options: ContentTaggingOptions
): void {
  const detailComponents = components.filter(component =>
    DETAIL_COMPONENT_TYPES.has(canonicalizeComponentType(String(component.type)) ?? '')
  )
  if (detailComponents.length === 0) {
    return
  }

  const pageMetadataTag = normalizeContentTypeTag(
    options.pageMetadata?.contentTypeTag ?? options.pageMetadata?.pageTag
  )
  const urlTag = matchTagFromUrl(options.pageUrl)
  const headingParts: string[] = []
  const hrefs: string[] = []

  for (const component of detailComponents) {
    const content = isPlainObject(component.content) ? (component.content as Record<string, any>) : {}
    const headingFields = [
      content.heading,
      content.title,
      content.label,
      content.sectionTitle,
      content.category,
      content.section
    ]
    for (const heading of headingFields) {
      const normalized = normalizeString(heading)
      if (normalized) {
        headingParts.push(normalized)
      }
    }

    collectHrefCandidates(content, hrefs, options.pageUrl)
  }

  const hrefTag = hrefs.length > 0 ? inferTagFromHrefList(hrefs, options.pageUrl) : undefined
  const headingTag = headingParts.length > 0 ? matchTagFromHeading(headingParts.join(' ')) : undefined
  const resolvedTag = pageMetadataTag ?? urlTag ?? hrefTag ?? headingTag
  if (!resolvedTag) {
    return
  }

  for (const component of detailComponents) {
    component.metadata = {
      ...(component.metadata ?? {}),
      contentTypeTag: component.metadata?.contentTypeTag ?? resolvedTag,
      pageTag: component.metadata?.pageTag ?? resolvedTag
    }
  }

  if (options.pageMetadata) {
    if (!options.pageMetadata.pageTag) {
      options.pageMetadata.pageTag = resolvedTag
    }
    if (!options.pageMetadata.contentTypeTag) {
      options.pageMetadata.contentTypeTag = resolvedTag
    }
  }
}

/**
 * Tags listing components (card-grid, blog-list, feature-grid) with content type.
 */
export function tagListingComponents(
  components: DetectedComponent[],
  options: ContentTaggingOptions
): void {
  let pageTag = normalizeContentTypeTag(
    options.pageMetadata?.pageTag ?? options.pageMetadata?.contentTypeTag
  )

  const listingTypes = getListingComponentTypes()
  for (const component of components) {
    const canonical = canonicalizeComponentType(String(component.type))
    if (!canonical || !listingTypes.has(canonical)) {
      continue
    }

    const { heading, subheading, items } = extractListingContent(component, canonical)
    if (!items.length && !heading) {
      continue
    }

    const hrefs = items
      .map(item => normalizeHref((item as any)?.link ?? (item as any)?.href ?? (item as any)?.url, options.pageUrl))
      .filter((value): value is string => Boolean(value))

    const existingTag = normalizeContentTypeTag(component.metadata?.contentTypeTag)
    const inferredTag = inferContentTypeTag({
      canonical,
      heading,
      subheading,
      hrefs,
      items,
      pageUrl: options.pageUrl
    })
    const tag = existingTag ?? inferredTag
    if (!tag) {
      continue
    }

    component.metadata = {
      ...(component.metadata ?? {}),
      contentTypeTag: tag,
      pageTag: component.metadata?.pageTag ?? tag
    }

    if (!pageTag) {
      pageTag = tag
    }
  }

  if (pageTag && options.pageMetadata) {
    if (!options.pageMetadata.pageTag) {
      options.pageMetadata.pageTag = pageTag
    }
    if (!options.pageMetadata.contentTypeTag) {
      options.pageMetadata.contentTypeTag = pageTag
    }
  }
}

/**
 * Listing content extraction result.
 */
export interface ListingExtraction {
  heading?: string
  subheading?: string
  items: Array<Record<string, any>>
  layout: 'card-grid' | 'list'
}

/**
 * Extracts listing content from a component.
 */
export function extractListingContent(component: DetectedComponent, canonical: string): ListingExtraction {
  const rawContent = component.content as Record<string, any> | undefined
  const heading = normalizeString(
    rawContent?.heading ?? rawContent?.title ?? rawContent?.label ?? rawContent?.sectionTitle
  )
  const subheading = normalizeString(rawContent?.subheading ?? rawContent?.description)

  const toItemArray = (value: unknown): Array<Record<string, any>> =>
    Array.isArray(value) ? value.filter(entry => entry && typeof entry === 'object') : []

  if (canonical === ComponentType.BlogList) {
    const posts = toItemArray(rawContent?.posts ?? rawContent?.items)
    return { heading, subheading, items: posts, layout: 'list' }
  }

  if (canonical === ComponentType.FeatureGrid) {
    const features = toItemArray(rawContent?.features ?? rawContent?.items ?? rawContent?.cards)
    return { heading, subheading, items: features, layout: 'card-grid' }
  }

  const cards = toItemArray(rawContent?.cards ?? rawContent?.items ?? rawContent?.features)
  return { heading, subheading, items: cards, layout: 'card-grid' }
}

/**
 * Collects href candidates from content recursively.
 */
export function collectHrefCandidates(
  value: unknown,
  hrefs: string[],
  pageUrl?: string,
  depth = 0
): void {
  if (depth > 3 || value == null) {
    return
  }

  if (typeof value === 'string') {
    const normalized = normalizeHref(value, pageUrl)
    if (normalized) {
      hrefs.push(normalized)
    }
    return
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      collectHrefCandidates(entry, hrefs, pageUrl, depth + 1)
    }
    return
  }

  if (isPlainObject(value)) {
    const record = value as Record<string, unknown>
    for (const [key, entry] of Object.entries(record)) {
      if (['href', 'link', 'url', 'permalink', 'path'].includes(key.toLowerCase())) {
        collectHrefCandidates(entry, hrefs, pageUrl, depth + 1)
      } else if (Array.isArray(entry) || isPlainObject(entry)) {
        collectHrefCandidates(entry, hrefs, pageUrl, depth + 1)
      }
    }
  }
}

/**
 * Infers content type tag from a list of hrefs.
 */
export function inferTagFromHrefList(hrefs: string[], pageUrl?: string): ContentTypeTag | undefined {
  const normalized = hrefs
    .map(href => normalizeHref(href, pageUrl))
    .filter((value): value is string => Boolean(value))
  const counts = new Map<ContentTypeTag, number>()
  for (const href of normalized) {
    const tag = matchTagFromPath(href)
    if (tag) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1)
    }
  }

  let best: ContentTypeTag | undefined
  let bestCount = 0
  for (const [tag, count] of counts.entries()) {
    if (count > bestCount) {
      best = tag
      bestCount = count
    }
  }

  if (!best) {
    return undefined
  }

  if (bestCount < 2 && normalized.length > 3) {
    return undefined
  }

  return best
}

/**
 * Checks if a tag has support from hrefs.
 */
export function hasTagSupportFromHrefs(
  tag: ContentTypeTag,
  hrefs: string[],
  pageUrl?: string
): boolean {
  if (!CONTENT_TYPE_TAG_ALLOWLIST.has(tag)) {
    return false
  }
  const normalized = hrefs
    .map(href => normalizeHref(href, pageUrl))
    .filter((value): value is string => Boolean(value))

  const matchCount = normalized.filter(path => matchTagFromPath(path) === tag).length
  if (matchCount >= 2) {
    return true
  }
  if (matchCount === 1 && normalized.length >= 3) {
    const prefix = deriveAllowlistedPrefix(normalized, pageUrl)
    return Boolean(prefix && matchTagFromPath(prefix) === tag)
  }
  return false
}

/**
 * Derives allowlisted prefix from paths.
 */
export function deriveAllowlistedPrefix(paths: string[], pageUrl?: string): string | undefined {
  const counts = new Map<string, number>()
  const register = (path: string | undefined) => {
    if (!path) {
      return
    }
    const tag = matchTagFromPath(path)
    if (!tag) {
      return
    }
    const segments = path.split('/').filter(Boolean)
    const matchedSegment = segments.find(segment => CONTENT_TYPE_TAG_ALLOWLIST.has(segment))
    const prefix = matchedSegment ? `/${matchedSegment}` : path.match(/\/[a-z0-9-]+/i)?.[0]
    if (prefix) {
      counts.set(prefix, (counts.get(prefix) ?? 0) + 1)
    }
  }

  for (const path of paths) {
    register(path)
  }
  register(pageUrl ? normalizeHref(pageUrl) : undefined)

  let best: string | undefined
  let bestCount = 0
  for (const [prefix, count] of counts.entries()) {
    if (count > bestCount && prefix) {
      best = prefix
      bestCount = count
    }
  }
  return bestCount >= 2 ? best : undefined
}

/**
 * Matches tag from URL.
 */
export function matchTagFromUrl(value?: string): ContentTypeTag | undefined {
  if (!value) {
    return undefined
  }
  try {
    const url = new URL(value)
    const pathTag = matchTagFromPath(url.pathname)
    if (pathTag) {
      return pathTag
    }
    const host = url.hostname.toLowerCase()
    if (/^blogs?\./.test(host) || /\.blogs?\./.test(host)) {
      return 'blog'
    }
  } catch {
    const normalized = normalizeHref(value)
    if (normalized) {
      return matchTagFromPath(normalized)
    }
  }
  return undefined
}

/**
 * Content type inference parameters.
 */
interface InferContentTypeParams {
  canonical: string
  heading?: string
  subheading?: string
  hrefs: string[]
  items: Array<Record<string, any>>
  pageUrl?: string
}

/**
 * Infers content type tag from multiple signals.
 */
export function inferContentTypeTag(params: InferContentTypeParams): ContentTypeTag | undefined {
  type SignalSource = 'heading' | 'href' | 'item' | 'page' | 'context'
  type SignalScores = Record<SignalSource, number>
  const signals = new Map<ContentTypeTag, SignalScores>()
  const addScore = (tag: ContentTypeTag, value: number, source: SignalSource): void => {
    const current = signals.get(tag) ?? { heading: 0, href: 0, item: 0, page: 0, context: 0 }
    current[source] += value
    signals.set(tag, current)
  }

  if (params.canonical === ComponentType.BlogList) {
    addScore('blog', 1.5, 'context')
    addScore('news', 0.5, 'context')
  }

  const headingText = [params.heading, params.subheading].filter(Boolean).join(' ').toLowerCase()
  if (headingText) {
    // Core content
    if (/\bnews\b|press|media|update|updates|headlines/.test(headingText)) {
      addScore('news', 3, 'heading')
    }
    if (/\blatest\b/.test(headingText)) {
      addScore('news', 1, 'heading')
    }
    if (/\bblog\b|articles?\b|posts?\b|stories\b/.test(headingText)) {
      addScore('blog', 3, 'heading')
    }
    if (/\bevent(s)?\b|what'?s on|calendar|webinar|workshop|conference/.test(headingText)) {
      addScore('events', 3, 'heading')
    }

    // E-commerce
    if (/\bproduct(s)?\b|catalog|merch/.test(headingText)) {
      addScore('products', 2.25, 'heading')
    }
    if (/\bcollection(s)?\b|categor(y|ies)\b|department(s)?\b|browse\b/.test(headingText)) {
      addScore('collections', 3, 'heading')
    }
    if (/\bshop(s)?\b|store\b/.test(headingText)) {
      addScore('shop', 3, 'heading')
      addScore('products', 1, 'heading')
    }

    // Resources & Portfolio
    if (/\bresource(s)?\b|library|downloads?|guides?/.test(headingText)) {
      addScore('resources', 3, 'heading')
    }
    if (/\bshowcase\b|portfolio\b|case studies?\b|our work/.test(headingText)) {
      addScore('showcase', 3, 'heading')
    }
    if (/\bproject(s)?\b|research\b/.test(headingText)) {
      addScore('projects', 3, 'heading')
    }

    // SaaS-specific
    if (/\bpricing\b|plans?\b|tiers?\b|subscription/.test(headingText)) {
      addScore('pricing', 3, 'heading')
    }
    if (/\bfeatures?\b|capabilities\b|what we offer/.test(headingText)) {
      addScore('features', 3, 'heading')
    }
    if (/\bchangelog\b|releases?\b|what'?s new|release notes/.test(headingText)) {
      addScore('changelog', 3, 'heading')
    }
    if (/\bdocs?\b|documentation\b|api\b|reference\b|developer/.test(headingText)) {
      addScore('docs', 3, 'heading')
    }

    // Support (help desk, FAQ)
    if (/\bsupport\b|\bhelp\b|\bfaq\b|knowledge base|contact us|get help|customer service/.test(headingText)) {
      addScore('support', 3, 'heading')
    }

    // Donate (nonprofit giving)
    if (/\bsupport\s+us\b|\bsupport\s+the\b|\bdonate\b|\bdonation(s)?\b|\bgive\b|\bgiving\b|\bways\s+to\s+give\b|\bfundrais(e|ing)\b|\bmake\s+a\s+difference\b|\bhelp\s+us\b|\bget\s+involved\b/.test(headingText)) {
      addScore('donate', 3, 'heading')
    }
  }

  const hrefs = params.hrefs || []
  for (const href of hrefs) {
    const lower = href.toLowerCase()
    // Core content
    if (/news|press|media|story|stories|update/.test(lower)) {
      addScore('news', 1.5, 'href')
    }
    if (/blog/.test(lower)) {
      addScore('blog', 2, 'href')
    }
    if (/event|events|calendar|whatson|whats-on|whats_on|webinar|conference|meetup/.test(lower)) {
      addScore('events', 2, 'href')
    }

    // E-commerce
    if (/product|products|catalog|merch|merchandise/.test(lower)) {
      addScore('products', 2, 'href')
    }
    if (/collection|collections|category|categories|department/.test(lower)) {
      addScore('collections', 2, 'href')
    }
    if (/shop|store/.test(lower)) {
      addScore('shop', 1.5, 'href')
    }

    // Resources & Portfolio
    if (/resource|resources|library|download|guide|whitepaper/.test(lower)) {
      addScore('resources', 2, 'href')
    }
    if (/showcase|portfolio|case-study|case-studies|customers|work/.test(lower)) {
      addScore('showcase', 1.5, 'href')
    }
    if (/project|projects|research/.test(lower)) {
      addScore('projects', 1.5, 'href')
    }

    // SaaS-specific
    if (/pricing|plans?|tiers?/.test(lower)) {
      addScore('pricing', 2, 'href')
    }
    if (/features?|capabilities/.test(lower)) {
      addScore('features', 2, 'href')
    }
    if (/changelog|releases?|whats-new|whats_new/.test(lower)) {
      addScore('changelog', 2, 'href')
    }
    if (/docs?|documentation|api|reference/.test(lower)) {
      addScore('docs', 2, 'href')
    }

    // Support (help desk)
    if (/support|help|faq|knowledge-base|contact-us/.test(lower)) {
      addScore('support', 2, 'href')
    }

    // Donate (nonprofit)
    if (/donate|donation|give|giving|ways-to-give|foundation|fundrais/.test(lower)) {
      addScore('donate', 2, 'href')
    }
  }

  if (params.pageUrl) {
    const path = normalizeHref(params.pageUrl)
    const lowerPath = (path || '').toLowerCase()
    // Core content
    if (/\/news\b|\/news\//.test(lowerPath)) {
      addScore('news', 1, 'page')
    }
    if (/\/blog\b|\/blog\//.test(lowerPath)) {
      addScore('blog', 1, 'page')
    }
    if (/\/events?\b|\/events?\//.test(lowerPath)) {
      addScore('events', 1, 'page')
    }

    // E-commerce
    if (/\/products?\b|\/products?\//.test(lowerPath)) {
      addScore('products', 1, 'page')
    }
    if (/\/collections?\b|\/collections?\/|\/categor(y|ies)\b/.test(lowerPath)) {
      addScore('collections', 1, 'page')
    }
    if (/\/shop\b|\/store\b/.test(lowerPath)) {
      addScore('shop', 1, 'page')
    }

    // Resources & Portfolio
    if (/\/projects?\b|\/projects?\//.test(lowerPath)) {
      addScore('projects', 1, 'page')
    }

    // SaaS-specific
    if (/\/pricing\b|\/plans?\b/.test(lowerPath)) {
      addScore('pricing', 1, 'page')
    }
    if (/\/features?\b/.test(lowerPath)) {
      addScore('features', 1, 'page')
    }
    if (/\/changelog\b|\/releases?\b|\/whats-new\b/.test(lowerPath)) {
      addScore('changelog', 1, 'page')
    }
    if (/\/docs?\b|\/documentation\b|\/api\b/.test(lowerPath)) {
      addScore('docs', 1, 'page')
    }

    // Support (help desk)
    if (/\/support\b|\/help\b|\/faq\b/.test(lowerPath)) {
      addScore('support', 1, 'page')
    }

    // Donate (nonprofit)
    if (/\/donate\b|\/donation\b|\/give\b|\/foundation\b|\/ways-to-give\b/.test(lowerPath)) {
      addScore('donate', 1, 'page')
    }
  }

  const items = params.items ?? []
  const itemsWithDate = items.filter(item => hasDateField(item)).length
  if (itemsWithDate >= 2 || (items.length >= 3 && itemsWithDate / items.length >= 0.4)) {
    addScore('news', 1.5, 'item')
    addScore('blog', 1, 'item')
    addScore('events', 0.75, 'item')
  }

  const itemsWithPrice = items.filter(item => hasPriceField(item)).length
  if (itemsWithPrice >= 2 || (items.length > 0 && itemsWithPrice / items.length >= 0.34)) {
    addScore('products', 2, 'item')
    addScore('shop', 0.75, 'item')
  }

  const itemsWithLocation = items.filter(item => hasLocationField(item)).length
  if (itemsWithLocation > 0 && itemsWithDate > 0) {
    addScore('events', 1.5, 'item')
  }

  const scored = Array.from(signals.entries())
    .map(([tag, parts]) => ({
      tag,
      score: parts.heading + parts.href + parts.item + parts.page + parts.context,
      parts
    }))
    .sort((a, b) => b.score - a.score)

  const [best, runnerUp] = scored
  if (!best || best.score < 2) {
    return undefined
  }
  if (runnerUp && best.score - runnerUp.score < 0.75) {
    return undefined
  }

  const signalsPresent = ['heading', 'href', 'item', 'page', 'context'] as const
  const signalCount = signalsPresent.filter(key => best.parts[key] > 0).length
  const headingOnly =
    best.parts.heading > 0 &&
    best.parts.href === 0 &&
    best.parts.item === 0 &&
    best.parts.page === 0 &&
    best.parts.context === 0

  if (headingOnly) {
    return undefined
  }

  if (signalCount === 1 && best.score < 3) {
    return undefined
  }

  return best.tag
}

/**
 * Checks if item has a date field.
 */
export function hasDateField(item: Record<string, any>): boolean {
  const dateFields = ['publishDate', 'published', 'date', 'updatedAt', 'createdAt', 'startDate', 'eventDate']
  return dateFields.some(field => {
    const value = item[field] ?? item?.metadata?.[field]
    return typeof value === 'string' ? value.trim().length > 0 : typeof value === 'number'
  })
}

/**
 * Checks if item has a price field.
 */
export function hasPriceField(item: Record<string, any>): boolean {
  const priceFields = ['price', 'priceText', 'cost', 'amount']
  return priceFields.some(field => {
    const value = item[field] ?? item?.metadata?.[field]
    if (typeof value === 'number') {
      return true
    }
    if (typeof value === 'string') {
      return /\d/.test(value) && /[$€£¥]|usd|eur|gbp|aud|cad/i.test(value)
    }
    return false
  })
}

/**
 * Checks if item has a location field.
 */
export function hasLocationField(item: Record<string, any>): boolean {
  const locationFields = ['location', 'venue', 'address', 'city']
  return locationFields.some(field => {
    const value = item[field] ?? item?.metadata?.[field]
    return typeof value === 'string' && value.trim().length > 0
  })
}
