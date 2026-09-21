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
/**
 * Path cues, matched by matchTagFromPath below.
 *
 * DECLARATION ORDER IS NOT LOAD-BEARING. matchTagFromPath used to return the
 * first declared tag whose pattern matched, which made this table hostile to
 * change: adding /articles/ to `blog` would silently have stolen
 * /resources/articles/ from `resources`, purely because `blog` sits higher in
 * the object literal. Two bugs lived here as a result — /updates/ was
 * unreachable for `changelog`, and `blog` had no cue for insights, articles or
 * posts even though section-plan.ts:42, prompt-builder.ts:117 and
 * web-detection.ts:440 all treat those as first-class editorial routes.
 *
 * Matching is now explicit (see matchTagFromPath):
 *
 *   1. Every tag whose cues match the path is collected, with WHERE it matched
 *      and HOW MUCH text it matched.
 *   2. The match nearest the start of the path wins. A URL's leading segment is
 *      its section, so /resources/articles/ is a resources page that happens to
 *      contain articles, and /blog/resources/ is the reverse.
 *   3. Ties on position are broken by the longer literal match.
 *   4. Anything still tied is a genuine ambiguity and must be listed in
 *      PATH_CUE_TIE_BREAKS below, with a stated reason. As of this writing the
 *      whole table contains exactly one: /updates/.
 *
 * Adding a cue here is therefore additive. It can only claim paths that no
 * shallower cue already claims, and if it does collide head-on with another tag
 * the tie-break test in __tests__/content-type-patterns.test.ts fails and names
 * the pair.
 */
export const CONTENT_TYPE_PATH_CUES: Record<ContentTypeTag, RegExp[]> = {
  // Core content
  news: [/\/news(\/|$)/, /\/press(\/|$)/, /\/media(\/|$)/, /\/stories(\/|$)/, /\/updates?(\/|$)/],
  events: [/\/event(s)?(\/|$)/, /\/whatson(\/|$)/, /\/whats[-_]on(\/|$)/, /\/calendar(\/|$)/, /\/webinar(s)?(\/|$)/],
  // `insights`, `articles` and `posts` are the editorial routes that
  // section-plan.ts, prompt-builder.ts and web-detection.ts already offer
  // blog-list for. Without them those pages were detected as editorial
  // listings and then given no contentTypeTag, so no CMS source binding was
  // ever generated for them.
  blog: [/\/blog(s)?(\/|$)/, /\/insight(s)?(\/|$)/, /\/article(s)?(\/|$)/, /\/post(s)?(\/|$)/],

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
 * Head-on collisions between two tags, and who wins.
 *
 * A collision is head-on when two tags match the same place in the path with
 * the same amount of text, so neither position nor length can separate them.
 * Those are the only cases a human has to decide, and each one is decided here
 * rather than by where the tag happens to sit in CONTENT_TYPE_PATH_CUES.
 */
export const PATH_CUE_TIE_BREAKS: ReadonlyArray<{
  pattern: RegExp
  winner: ContentTypeTag
  contenders: readonly ContentTypeTag[]
  reason: string
}> = [
  {
    // A bare /updates/ is news, not release notes.
    //
    // Three reasons. First, the rest of this file already says so and has for
    // as long as it has existed: CONTENT_TYPE_HEADING_CUES lists /update(s)?/
    // under `news`, and normalizeContentTypeTag maps the literal strings
    // 'update' and 'updates' to `news`. Having the path table disagree with the
    // heading table and the alias map would produce a page whose URL says one
    // thing and whose title says another.
    //
    // Second, a product that publishes release notes almost always names that
    // route /changelog, /releases or /whats-new, and `changelog` still claims
    // all three outright — it loses nothing here. A site that names a route
    // /updates is far more often publishing announcements.
    //
    // Third, this is also what shipped before this change, by accident, because
    // `news` was declared first. Keeping the same answer means the decision is
    // now written down without changing anyone's output.
    pattern: /\/updates?(\/|$)/,
    winner: 'news',
    contenders: ['news', 'changelog'],
    reason: 'A bare /updates/ route is announcements; release notes live at /changelog, /releases or /whats-new.'
  }
]

/**
 * One tag's best match against a path: where it matched and how much it matched.
 */
export interface PathCueMatch {
  tag: ContentTypeTag
  /** Index in the path where the cue matched. Lower means a shallower segment. */
  index: number
  /** Length of the matched text. Longer means a more specific cue. */
  length: number
}

/**
 * Collects every tag whose cues match the path, best first.
 *
 * Ordering is by position (shallowest segment first), then by matched length
 * (most specific first), then by CONTENT_TYPE_TAGS order purely so the result
 * is deterministic. Entries that are equal on both position and length are a
 * head-on collision; PATH_CUE_TIE_BREAKS decides those, and the test suite
 * fails if one exists that is not listed there.
 *
 * Exported so tests can assert the absence of undeclared collisions.
 *
 * @param path - URL path to check
 * @returns Matching tags, best first
 */
export function collectPathCueMatches(path?: string): PathCueMatch[] {
  if (!path) {
    return []
  }
  const lower = path.toLowerCase()
  const matches: PathCueMatch[] = []

  for (const [tag, patterns] of Object.entries(CONTENT_TYPE_PATH_CUES) as Array<[ContentTypeTag, RegExp[]]>) {
    let best: PathCueMatch | undefined
    for (const regex of patterns) {
      const match = lower.match(regex)
      if (!match || match.index === undefined) {
        continue
      }
      const candidate: PathCueMatch = { tag, index: match.index, length: match[0].length }
      if (!best || candidate.index < best.index || (candidate.index === best.index && candidate.length > best.length)) {
        best = candidate
      }
    }
    if (best) {
      matches.push(best)
    }
  }

  const declarationRank = (tag: ContentTypeTag): number => CONTENT_TYPE_TAGS.indexOf(tag)
  matches.sort((a, b) => a.index - b.index || b.length - a.length || declarationRank(a.tag) - declarationRank(b.tag))
  return matches
}

/**
 * Returns the tags that are tied for best on a path, or an empty array if one
 * tag wins outright. A tie of two or more must be listed in
 * PATH_CUE_TIE_BREAKS.
 *
 * @param path - URL path to check
 * @returns Tied tags, or an empty array when there is no tie
 */
export function findPathCueTie(path?: string): ContentTypeTag[] {
  const matches = collectPathCueMatches(path)
  if (matches.length < 2) {
    return []
  }
  const best = matches[0]
  const tied = matches.filter(match => match.index === best.index && match.length === best.length)
  return tied.length > 1 ? tied.map(match => match.tag) : []
}

/**
 * Matches a path to a content type tag.
 *
 * The tag whose cue matches nearest the start of the path wins, because the
 * leading segment of a URL is its section: /resources/articles/ is a resources
 * page, /blog/resources/ is a blog. Position ties go to the longer literal
 * match, and anything still tied is decided by PATH_CUE_TIE_BREAKS. Where a tag
 * sits in CONTENT_TYPE_PATH_CUES has no effect on the answer.
 *
 * @param path - URL path to check
 * @returns Matching content type tag or undefined
 */
export function matchTagFromPath(path?: string): ContentTypeTag | undefined {
  const matches = collectPathCueMatches(path)
  if (matches.length === 0) {
    return undefined
  }

  const best = matches[0]
  const tied = matches.filter(match => match.index === best.index && match.length === best.length)
  if (tied.length === 1) {
    return best.tag
  }

  const lower = (path as string).toLowerCase()
  for (const rule of PATH_CUE_TIE_BREAKS) {
    if (rule.pattern.test(lower) && tied.some(match => match.tag === rule.winner)) {
      return rule.winner
    }
  }

  // No declared rule for this collision. The test suite fails on any such case,
  // so reaching here means a cue was added without deciding the collision it
  // created; fall back to something deterministic rather than arbitrary.
  return best.tag
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
