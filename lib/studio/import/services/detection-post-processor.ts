/**
 * Detection Post-Processor
 *
 * Main entry point for post-processing detected components.
 * This module orchestrates various specialized processors to:
 * - Normalize navigation structures
 * - Assign page regions (header, hero, main, footer)
 * - Promote hero backgrounds from DOM
 * - Remove duplicate inline CTAs
 * - Tag components with content types
 * - Transform URLs from source site to relative paths
 *
 * @module detection-post-processor
 */

import type { DetectedComponent, PageMetadata } from '@/lib/studio/import/detection/types'
import type { ResourcesSummary } from './web-tools'
import type { ImportDesignProfile, PresentationSkeletonSelection } from '../types/design-profile.types'
import { UrlTransformConfig } from '../config/import-config'
import { transformComponentUrls, extractOrigin } from '../utils/url-transformer'

// Import from decomposed processor modules
import { cloneComponent } from './detection-post-processor/utils'
import { assignHeaderRegions, assignHeroRegions } from './detection-post-processor/region-processor'
import { collapseDuplicateGlobalNavigation, normalizeMultiRowNavigation } from './detection-post-processor/navigation-processor'
import { promoteHeroBackground } from './detection-post-processor/hero-processor'
import { removeInlineCtas } from './detection-post-processor/cta-processor'
import { mergeHeroWithAdjacentCta } from './detection-post-processor/hero-cta-merger'
import { tagPageComponents, tagListingComponents } from './detection-post-processor/content-tagging-processor'
import { enrichComponentImages } from './detection-post-processor/image-enrichment-processor'
import { enrichHeroContent } from './detection-post-processor/hero-content-enrichment'
import { recoverMissingHomepageHero } from './detection-post-processor/hero-recovery-processor'
import { completeCardGridsFromSource } from './detection-post-processor/card-grid-completion-processor'
import { collapseAdjacentHeroSlides, enrichHeroCarouselFromSource } from './detection-post-processor/hero-carousel-processor'
import { unwrapJsonContent } from './detection-post-processor/json-unwrap-processor'
import { collapseDuplicateListingSurfaces } from './detection-post-processor/structural-deduplication-processor'
import { promoteSourceFeatureTilesToCardGrid } from './detection-post-processor/feature-tile-grid-processor'
import { enrichSourceNewsListing } from './detection-post-processor/source-news-processor'
import { applyDesignFit } from './detection-post-processor/design-fit-processor'
import { telemetryCollector, withTelemetry, withConfidenceCheck } from './detection-post-processor/telemetry'
import { checkProcessorSkip } from './detection-post-processor/confidence-config'

/**
 * Options for the post-processor.
 */
interface PostProcessorOptions {
  domSnapshot?: string | null
  pageUrl?: string
  resourcesSummary?: ResourcesSummary
  pageMetadata?: PageMetadata
  designProfile?: ImportDesignProfile | null
  presentationSkeleton?: PresentationSkeletonSelection | null
}

/**
 * Adjusts detected components by applying various post-processing transformations.
 *
 * Processing pipeline:
 * 1. Clone all components to avoid mutation
 * 2. Unwrap JSON content (nav-menu-item arrays, bodyHtml wrappers)
 * 3. Normalize multi-row navigation (utility vs primary nav)
 * 4. Assign header regions to navbar-adjacent components
 * 5. Assign hero regions to hero-type components
 * 6. Promote hero backgrounds from DOM snapshot
 * 7. Enrich components with images from DOM snapshot (missed by LLM)
 * 8. Enrich hero components with text from DOM (for overlaid text on backgrounds)
 * 9. Remove inline CTAs that duplicate adjacent content
 * 10. Merge hero + simple CTA banner into single hero with subheading
 * 11. Tag page components (blog posts, articles) with content type
 * 12. Tag listing components (card grids, blog lists) with content type
 * 13. Transform URLs from source site to relative/target format
 *
 * @param components - Array of detected components
 * @param options - Processing options
 * @returns Processed components array
 */
export function adjustDetectedComponents(
  components: DetectedComponent[] | undefined,
  options: PostProcessorOptions = {}
): DetectedComponent[] {
  const baseComponents = Array.isArray(components) ? components : []
  const cloned = baseComponents.map(component => cloneComponent(component))

  // Start telemetry session
  const importId = `import-${Date.now()}`
  telemetryCollector.startSession(importId, options.pageUrl || 'unknown')

  // JSON unwrapping (must be first to convert nav-menu-item arrays and bodyHtml wrappers)
  withTelemetry('jsonUnwrap', cloned, (c) => unwrapJsonContent(c))

  // Navigation processing (type-changing - check confidence first)
  withConfidenceCheck('navigationNormalize', cloned, (c) => normalizeMultiRowNavigation(c, options.pageUrl), checkProcessorSkip)
  withTelemetry('navigationDeduplication', cloned, (c) => {
    const deduped = collapseDuplicateGlobalNavigation(c)
    c.splice(0, c.length, ...deduped)
  })

  // Region assignment
  withTelemetry('headerRegions', cloned, (c) => assignHeaderRegions(c))
  withTelemetry('heroRegions', cloned, (c) => assignHeroRegions(c))

  // Hero background promotion
  withTelemetry('heroBackground', cloned, (c) => promoteHeroBackground(c, {
    domSnapshot: options.domSnapshot,
    pageUrl: options.pageUrl
  }))

  // Image enrichment from DOM snapshot
  // Scans DOM for images missed by LLM detection and enriches components
  withTelemetry('imageEnrichment', cloned, (c) => enrichComponentImages(c, {
    domSnapshot: options.domSnapshot,
    pageUrl: options.pageUrl
  }))

  // Hero content enrichment from DOM snapshot
  // Extracts text content for heroes when LLM misses text overlaid on background images
  withTelemetry('heroContentEnrichment', cloned, (c) => enrichHeroContent(c, {
    domSnapshot: options.domSnapshot,
    pageUrl: options.pageUrl
  }))

  withTelemetry('heroRecovery', cloned, (c) => recoverMissingHomepageHero(c, {
    domSnapshot: options.domSnapshot,
    pageUrl: options.pageUrl
  }))

  withTelemetry('cardGridCompletion', cloned, (c) => completeCardGridsFromSource(c, {
    domSnapshot: options.domSnapshot,
    pageUrl: options.pageUrl
  }))

  withTelemetry('featureTileGridPromotion', cloned, (c) => {
    const promoted = promoteSourceFeatureTilesToCardGrid(c, {
      domSnapshot: options.domSnapshot,
      pageUrl: options.pageUrl
    })
    c.splice(0, c.length, ...promoted)
  })

  withTelemetry('heroCarouselCollapse', cloned, (c) => {
    const collapsed = collapseAdjacentHeroSlides(c)
    c.splice(0, c.length, ...collapsed)
  })
  withTelemetry('heroCarouselSourceEnrichment', cloned, (c) => {
    const enriched = enrichHeroCarouselFromSource(c, {
      domSnapshot: options.domSnapshot,
      pageUrl: options.pageUrl
    })
    c.splice(0, c.length, ...enriched)
  })

  // CTA cleanup
  withTelemetry('ctaCleanup', cloned, (c) => removeInlineCtas(c))

  // Merge hero + simple CTA banner into single hero with subheading (type-changing - check confidence first)
  // This handles cases where org names are detected as separate CTA banners
  withConfidenceCheck('heroCtaMerge', cloned, (c) => mergeHeroWithAdjacentCta(c), checkProcessorSkip)

  // Content type tagging
  withTelemetry('pageTagging', cloned, (c) => tagPageComponents(c, {
    pageUrl: options.pageUrl,
    pageMetadata: options.pageMetadata
  }))
  withTelemetry('listingTagging', cloned, (c) => tagListingComponents(c, {
    pageUrl: options.pageUrl,
    pageMetadata: options.pageMetadata
  }))

  withTelemetry('sourceNewsEnrichment', cloned, (c) => {
    const enriched = enrichSourceNewsListing(c, {
      domSnapshot: options.domSnapshot,
      pageUrl: options.pageUrl
    })
    c.splice(0, c.length, ...enriched)
  })

  withTelemetry('structuralDeduplication', cloned, (c) => {
    const deduped = collapseDuplicateListingSurfaces(c)
    c.splice(0, c.length, ...deduped)
  })

  withTelemetry('heroCarouselCollapseAfterDedupe', cloned, (c) => {
    const collapsed = collapseAdjacentHeroSlides(c)
    c.splice(0, c.length, ...collapsed)
  })
  withTelemetry('heroCarouselSourceEnrichmentAfterDedupe', cloned, (c) => {
    const enriched = enrichHeroCarouselFromSource(c, {
      domSnapshot: options.domSnapshot,
      pageUrl: options.pageUrl
    })
    c.splice(0, c.length, ...enriched)
  })

  if (options.designProfile || options.presentationSkeleton) {
    withTelemetry('designFit', cloned, (c) => {
      const result = applyDesignFit(c, {
        designProfile: options.designProfile,
        skeleton: options.presentationSkeleton
      })
      c.splice(0, c.length, ...result.components)
      if (result.mutations.length > 0 || result.diagnostics.length > 0) {
        console.log('[DesignFit] Applied source-aware presentation fit', {
          pageUrl: options.pageUrl,
          skeleton: options.presentationSkeleton?.key ?? 'unknown',
          mutations: result.mutations.length,
          diagnostics: result.diagnostics.length
        })
      }
    })
  }

  // Transform URLs from source site to relative/target format
  const transformed = transformSourceUrls(cloned, options.pageUrl)

  // End telemetry session
  telemetryCollector.endSession()

  return transformed
}

/**
 * Transforms absolute URLs from the source site to relative paths.
 * This ensures imported content links point to the new site, not the source.
 *
 * @param components - Components to transform
 * @param pageUrl - Page URL used to determine source origin
 * @returns Components with transformed URLs
 */
function transformSourceUrls(
  components: DetectedComponent[],
  pageUrl?: string
): DetectedComponent[] {
  // Skip if URL transformation is disabled
  if (!UrlTransformConfig.enabled) {
    return components
  }

  // Extract source origin from page URL
  const sourceOrigin = extractOrigin(pageUrl)
  if (!sourceOrigin) {
    // No valid origin to transform from, skip transformation
    return components
  }

  // Transform all URLs in components
  const { components: transformed, stats } = transformComponentUrls(
    components as unknown as Array<{ content?: Record<string, unknown>; [key: string]: unknown }>,
    sourceOrigin,
    UrlTransformConfig.mode
  )

  // Log stats if enabled
  if (UrlTransformConfig.logStats && stats.total > 0) {
    console.log(
      `[URL Transform] Transformed ${stats.transformed}/${stats.total} URLs from ${sourceOrigin}`
    )
  }

  return transformed as unknown as DetectedComponent[]
}
