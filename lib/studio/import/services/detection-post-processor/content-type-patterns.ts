/**
 * Content Type Patterns
 *
 * Constants and patterns for content type detection in post-processing.
 * Extracted from detection-post-processor.ts
 *
 * @module content-type-patterns
 */

import { ComponentType } from '@/lib/studio/components/cms/_core/types'
import { getDetailComponentTypes } from '@/lib/studio/components/cms/_core/definition-loader'

/**
 * Component types that indicate detail/single-item pages.
 */
export const DETAIL_COMPONENT_TYPES = getDetailComponentTypes()

/**
 * Supported content type tags for listing pages.
 */
export const CONTENT_TYPE_TAGS = [
  // Core content
  'news', 'events', 'blog',
  // E-commerce
  'products', 'collections', 'shop',
  // Resources & Portfolio
  'resources', 'showcase', 'projects',
  // SaaS-specific
  'pricing', 'features', 'changelog', 'docs',
  // Support & Nonprofit
  'support', 'donate'
] as const

export type ContentTypeTag = (typeof CONTENT_TYPE_TAGS)[number]

export const CONTENT_TYPE_TAG_ALLOWLIST = new Set<string>(CONTENT_TYPE_TAGS)

/**
 * URL path patterns for each content type.
 */
export const CONTENT_TYPE_PATH_CUES: Record<ContentTypeTag, RegExp[]> = {
  // Core content
  news: [/\/news(\/|$)/, /\/press(\/|$)/, /\/media(\/|$)/, /\/stories(\/|$)/, /\/updates?(\/|$)/],
  events: [/\/event(s)?(\/|$)/, /\/whatson(\/|$)/, /\/whats[-_]on(\/|$)/, /\/calendar(\/|$)/, /\/webinar(s)?(\/|$)/],
  blog: [/\/blog(s)?(\/|$)/],

  // E-commerce
  products: [/\/product(s)?(\/|$)/, /\/catalog(ue)?(\/|$)/, /\/merchandise(\/|$)/, /\/merch(\/|$)/],
  collections: [/\/collection(s)?(\/|$)/, /\/categor(y|ies)(\/|$)/, /\/department(s)?(\/|$)/],
  shop: [/\/shop(\/|$)/, /\/store(\/|$)/],

  // Resources & Portfolio
  resources: [/\/resource(s)?(\/|$)/, /\/library(\/|$)/, /\/guide(s)?(\/|$)/, /\/download(s)?(\/|$)/],
  showcase: [/\/showcase(\/|$)/, /\/portfolio(\/|$)/, /\/case-stud(y|ies)(\/|$)/, /\/customers?(\/|$)/, /\/work(\/|$)/],
  projects: [/\/project(s)?(\/|$)/, /\/research(\/|$)/],

  // SaaS-specific
  pricing: [/\/pricing(\/|$)/, /\/plans?(\/|$)/, /\/tiers?(\/|$)/],
  features: [/\/features?(\/|$)/, /\/capabilities(\/|$)/],
  changelog: [/\/changelog(\/|$)/, /\/releases?(\/|$)/, /\/updates?(\/|$)/, /\/whats[-_]?new(\/|$)/],
  docs: [/\/docs?(\/|$)/, /\/documentation(\/|$)/, /\/api(\/|$)/, /\/reference(\/|$)/],

  // Support (help desk, FAQ, knowledge base)
  support: [/\/support(\/|$)/, /\/help(\/|$)/, /\/faq(\/|$)/, /\/knowledge[-_]?base(\/|$)/, /\/contact[-_]?us(\/|$)/],

  // Donate (nonprofit giving)
  donate: [/\/donate(\/|$)/, /\/donation(s)?(\/|$)/, /\/give(\/|$)/, /\/giving(\/|$)/, /\/ways[-_]?to[-_]?give(\/|$)/, /\/foundation(\/|$)/, /\/fundrais(e|ing)(\/|$)/, /\/make[-_]?a[-_]?difference(\/|$)/]
}

/**
 * Heading text patterns for each content type.
 */
export const CONTENT_TYPE_HEADING_CUES: Record<ContentTypeTag, RegExp[]> = {
  // Core content
  news: [/\bnews\b/, /press/, /media/, /update(s)?/, /headline(s)?/],
  events: [/\bevent(s)?\b/, /what'?s on/, /calendar/, /webinar/, /conference/, /workshop/],
  blog: [/\bblog\b/, /\bpost(s)?\b/, /article(s)?\b/, /story|stories/],

  // E-commerce
  products: [/\bproduct(s)?\b/, /catalog/, /merch/],
  collections: [/\bcollection(s)?\b/, /\bcategor(y|ies)\b/, /\bdepartment(s)?\b/, /\bbrowse\b/],
  shop: [/\bshop(s)?\b/, /\bstore\b/],

  // Resources & Portfolio
  resources: [/\bresource(s)?\b/, /library/, /download(s)?/, /guide(s)?/],
  showcase: [/\bshowcase\b/, /portfolio/, /case study|case studies/, /our work/, /customers/],
  projects: [/\bproject(s)?\b/, /research/],

  // SaaS-specific
  pricing: [/\bpricing\b/, /\bplans?\b/, /\btiers?\b/, /\bsubscription\b/],
  features: [/\bfeatures?\b/, /\bcapabilities\b/, /\bwhat we offer\b/],
  changelog: [/\bchangelog\b/, /\breleases?\b/, /\bwhat'?s new\b/, /\brelease notes\b/],
  docs: [/\bdocs?\b/, /\bdocumentation\b/, /\bapi\b/, /\breference\b/, /\bdeveloper\b/],

  // Support (help desk, FAQ, knowledge base)
  support: [/\bsupport\b/, /\bhelp\b/, /\bfaq\b/, /\bknowledge base\b/, /\bcontact us\b/, /\bget help\b/, /\bcustomer service\b/],

  // Donate (nonprofit giving)
  donate: [/\bsupport\s+us\b/, /\bsupport\s+the\b/, /\bdonate\b/, /\bdonation(s)?\b/, /\bgive\b/, /\bgiving\b/, /\bways\s+to\s+give\b/, /\bfundrais(e|ing)\b/, /\bmake\s+a\s+difference\b/, /\bhelp\s+us\b/, /\bget\s+involved\b/]
}

/**
 * Matches a path to a content type tag.
 *
 * @param path - URL path to check
 * @returns Matching content type tag or undefined
 */
export function matchTagFromPath(path?: string): ContentTypeTag | undefined {
  if (!path) {
    return undefined
  }
  const lower = path.toLowerCase()
  for (const [tag, patterns] of Object.entries(CONTENT_TYPE_PATH_CUES) as Array<[ContentTypeTag, RegExp[]]>) {
    if (patterns.some(regex => regex.test(lower))) {
      return tag
    }
  }
  return undefined
}

/**
 * Matches heading text to a content type tag.
 *
 * @param text - Heading text to check
 * @returns Matching content type tag or undefined
 */
export function matchTagFromHeading(text?: string): ContentTypeTag | undefined {
  if (!text) {
    return undefined
  }
  const lower = text.toLowerCase()
  for (const [tag, patterns] of Object.entries(CONTENT_TYPE_HEADING_CUES) as Array<[ContentTypeTag, RegExp[]]>) {
    if (patterns.some(regex => regex.test(lower))) {
      return tag
    }
  }
  return undefined
}

/**
 * Normalizes a content type value to a valid tag.
 *
 * @param value - Content type value
 * @returns Normalized content type tag or undefined
 */
export function normalizeContentTypeTag(value: unknown): ContentTypeTag | undefined {
  if (typeof value !== 'string') {
    return undefined
  }
  const normalized = value.trim().toLowerCase()
  if (!normalized) {
    return undefined
  }
  const aliasMap: Record<string, ContentTypeTag> = {
    // Core content
    article: 'news',
    articles: 'news',
    story: 'news',
    stories: 'news',
    update: 'news',
    updates: 'news',
    event: 'events',

    // E-commerce
    product: 'products',
    catalog: 'products',
    collection: 'collections',
    category: 'collections',
    categories: 'collections',
    department: 'collections',
    departments: 'collections',
    store: 'shop',
    shops: 'shop',

    // Resources & Portfolio
    resource: 'resources',
    project: 'projects',

    // SaaS-specific
    plans: 'pricing',
    plan: 'pricing',
    tiers: 'pricing',
    tier: 'pricing',
    feature: 'features',
    capabilities: 'features',
    releases: 'changelog',
    release: 'changelog',
    'whats-new': 'changelog',
    documentation: 'docs',
    api: 'docs',
    reference: 'docs',

    // Support (help desk)
    help: 'support',
    faq: 'support',
    'knowledge-base': 'support',
    'contact-us': 'support',

    // Donate (nonprofit)
    donation: 'donate',
    donations: 'donate',
    give: 'donate',
    giving: 'donate',
    fundraising: 'donate',
    foundation: 'donate',
    'ways-to-give': 'donate'
  }
  const mapped = aliasMap[normalized]
  if (mapped) {
    return mapped
  }
  return CONTENT_TYPE_TAG_ALLOWLIST.has(normalized) ? (normalized as ContentTypeTag) : undefined
}

/**
 * Gets the URL prefix for a content type tag.
 *
 * @param tag - Content type tag
 * @returns URL prefix (e.g., '/news')
 */
export function getContentTypePrefixUrl(tag: ContentTypeTag): string {
  return `/${tag}`
}
