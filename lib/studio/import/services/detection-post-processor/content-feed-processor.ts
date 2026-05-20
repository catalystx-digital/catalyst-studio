/**
 * Content Feed Processor
 *
 * Handles content feed component processing including:
 * - Promotion of card-grid/blog-list to content-feed (via ProcessingEngine)
 * - Creation of content-feed from anchor analysis
 *
 * @module content-feed-processor
 */

import { canonicalizeComponentType } from '../page-builder/component-helpers'
import { ComponentType, type AIComponentMetadata } from '@/lib/studio/components/cms/_core/types'
import type { DetectedComponent, PageMetadata } from '@/lib/studio/import/detection/types'
import type { ResourcesSummary } from '../web-tools'
import { normalizeString, normalizeHref, derivePathPrefix } from './utils'
import { applyRegion } from './region-processor'
import { executeContentFeedPromotion } from './processing-engine'
import { ContentFeedDef } from '@/lib/studio/components/cms/content/content-feed/content-feed.def'

interface ContentFeedProcessorOptions {
  pageUrl?: string
  pageMetadata?: PageMetadata
  resourcesSummary?: ResourcesSummary
}

/**
 * Promotes card-grid/blog-list/feature-grid to content-feed when news/blog patterns are detected.
 *
 * @deprecated This post-processor is a fallback safety net. The LLM should now detect content-feed
 * directly thanks to comprehensive directives in component .def.ts files (via getDirectives()).
 * Once validated that the LLM consistently chooses content-feed for news sections, this function
 * can be removed. Enable CONTENT_FEED_DEBUG=true to monitor promotion counts during validation.
 *
 * Refactored to use ProcessingEngine with declarative rules from ContentFeedDef.
 */
export function promoteContentFeeds(
  components: DetectedComponent[],
  pageUrl?: string,
  pageMetadata?: PageMetadata
): void {
  // Delegate to ProcessingEngine with rules from ContentFeedDef
  const rules = ContentFeedDef.processing?.contentFeedPromotion
  if (!rules) {
    return
  }

  executeContentFeedPromotion(components, rules, pageUrl)
}

/**
 * Creates content-feed from anchor analysis when no listing components exist.
 */
export function ensureContentFeedFromAnchors(
  components: DetectedComponent[],
  options: ContentFeedProcessorOptions
): void {
  const resources = options.resourcesSummary
  if (!resources?.anchors?.length) {
    return
  }

  const canonicalTypes = new Set(
    components.map(component => canonicalizeComponentType(String(component.type)))
  )
  if (
    canonicalTypes.has(ComponentType.ContentFeed) ||
    canonicalTypes.has(ComponentType.BlogList) ||
    canonicalTypes.has(ComponentType.CardGrid)
  ) {
    return
  }

  const anchors = resources.anchors
    .map(anchor => ({
      href: normalizeHref(anchor.href, options.pageUrl),
      text: normalizeString(anchor.textPreview)
    }))
    .filter((entry): entry is { href: string; text: string | undefined } => Boolean(entry.href))

  const newsAnchors = anchors.filter(entry => {
    const hrefLower = entry.href.toLowerCase()
    const textLower = (entry.text || '').toLowerCase()
    const hrefMatches =
      hrefLower.includes('/news') ||
      hrefLower.includes('/blog') ||
      hrefLower.includes('/stories') ||
      hrefLower.includes('/press') ||
      hrefLower.includes('/updates')
    const textMatches =
      textLower.includes('news') ||
      textLower.includes('story') ||
      textLower.includes('stories') ||
      textLower.includes('update') ||
      textLower.includes('latest')
    return hrefMatches || textMatches
  })

  const uniqueHrefs = Array.from(new Set(newsAnchors.map(entry => entry.href)))
  if (uniqueHrefs.length < 3) {
    return
  }

  const pathPrefix = derivePathPrefix(uniqueHrefs, options.pageUrl)
  const pathMatches = pathPrefix
    ? uniqueHrefs.filter(href => (normalizeHref(href, options.pageUrl) || '').startsWith(pathPrefix))
    : []
  const sharedRatio = uniqueHrefs.length > 0 ? pathMatches.length / uniqueHrefs.length : 0

  if (!pathPrefix || sharedRatio < 0.6) {
    return
  }

  const headingCandidate = newsAnchors.find(anchor => (anchor.text || '').toLowerCase().includes('news'))
  const limit = Math.min(uniqueHrefs.length, 12)
  const confidence = Math.min(0.62 + uniqueHrefs.length * 0.02, 0.82)

  const feed: DetectedComponent = {
    component: ComponentType.ContentFeed,
    type: ComponentType.ContentFeed,
    confidence,
    content: {
      heading: headingCandidate?.text,
      layout: 'card-grid',
      limit,
      sorting: { field: 'publishDate', direction: 'desc' },
      source: {
        contentTypes: ['news'],
        pathPrefix,
        includeDescendants: true
      }
    },
    metadata: {
      source: 'resources-summary',
      pathPrefix,
      anchorCount: uniqueHrefs.length,
      contentTypeTag: 'news',
      region: 'main'
    } as unknown as AIComponentMetadata,
    location: 'main'
  }

  applyRegion(feed, 'main')

  const footerIndex = components.findIndex(
    component => canonicalizeComponentType(String(component.type)) === ComponentType.Footer
  )
  if (footerIndex >= 0) {
    components.splice(footerIndex, 0, feed)
  } else {
    components.push(feed)
  }
}
