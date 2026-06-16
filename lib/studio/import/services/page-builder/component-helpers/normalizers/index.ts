/**
 * Component Content Normalizers Module
 *
 * This module exports all component content normalizers for the import pipeline.
 * Normalizers transform raw detection results into CMS-compatible formats.
 *
 * @module normalizers
 */

// Re-export shared utilities and types
export {
  type LocalNormalizationWarning,
  type ComponentContentNormalizer,
  extractLinkUrl,
  isValuePresent,
  pruneObjectAgainstContract,
  normalizeOverlayOpacityValue,
  isLikelyColorOrGradient,
  normalizeHeroBackgroundFocalPoint,
  type HeroBackgroundFocalPoint,
  coerceBoolean
} from './shared-normalizer-utils'

// Hero normalizers
export {
  normalizeHeroSimpleContent,
  normalizeHeroBannerContent,
  normalizeHeroWithImageContent,
  normalizeHeroCarouselContent,
  normalizeHeroSplitContent
} from './hero-normalizers'

// Navigation normalizers
export {
  normalizeNavbarContent,
  normalizeFooterContent,
  normalizeBreadcrumbsContent
} from './nav-normalizers'

// Content normalizers
export {
  normalizeTimelineContent,
  normalizeTextBlockContent,
  normalizeHtmlBlockContent,
  normalizeQuoteBlockContent,
  normalizeSidemenuContent,
  normalizeSidebarNavContent,
  normalizeContentFeedContent,
  normalizeTwoColumnContent
} from './content-normalizers'

// CTA normalizers
export {
  normalizeCtaWithFormContent,
  normalizeCtaSimpleContent,
  normalizeCtaBannerContent
} from './cta-normalizers'

// Blog normalizers
export {
  normalizeBlogListContent,
  normalizeBlogPostContent,
  normalizeArticleHeaderContent
} from './blog-normalizers'

// About normalizers
export {
  normalizeTeamGridContent
} from './about-normalizers'

// Media normalizers
export {
  normalizeImageGalleryContent,
  normalizeVideoEmbedContent
} from './media-normalizers'

// Data normalizers
export {
  normalizeStatisticsContent
} from './data-normalizers'

// Feature normalizers
export {
  normalizeFeatureGridContent
} from './feature-normalizers'

// Social proof normalizers
export {
  normalizeLogoCloudContent,
  normalizeTestimonialsContent
} from './social-proof-normalizers'

/**
 * Map of component types to their content normalizers.
 * Use this to look up the appropriate normalizer for a component type.
 */
import { normalizeHeroSimpleContent, normalizeHeroBannerContent, normalizeHeroWithImageContent, normalizeHeroCarouselContent, normalizeHeroSplitContent } from './hero-normalizers'
import { normalizeNavbarContent, normalizeFooterContent, normalizeBreadcrumbsContent } from './nav-normalizers'
import { normalizeTimelineContent, normalizeTextBlockContent, normalizeHtmlBlockContent, normalizeQuoteBlockContent, normalizeSidemenuContent, normalizeSidebarNavContent, normalizeContentFeedContent, normalizeTwoColumnContent } from './content-normalizers'
import { normalizeCtaWithFormContent, normalizeCtaSimpleContent, normalizeCtaBannerContent } from './cta-normalizers'
import { normalizeBlogListContent, normalizeBlogPostContent, normalizeArticleHeaderContent } from './blog-normalizers'
import { normalizeTeamGridContent } from './about-normalizers'
import { normalizeImageGalleryContent, normalizeVideoEmbedContent } from './media-normalizers'
import { normalizeStatisticsContent } from './data-normalizers'
import { normalizeFeatureGridContent } from './feature-normalizers'
import { normalizeLogoCloudContent, normalizeTestimonialsContent } from './social-proof-normalizers'
import type { ComponentContentNormalizer } from './shared-normalizer-utils'

export const COMPONENT_CONTENT_NORMALIZERS: Record<string, ComponentContentNormalizer> = {
  'hero-with-image': normalizeHeroWithImageContent,
  'hero-banner': normalizeHeroBannerContent,
  'hero-simple': normalizeHeroSimpleContent,
  'hero-carousel': normalizeHeroCarouselContent,
  'hero-split': normalizeHeroSplitContent,
  'image-gallery': normalizeImageGalleryContent,
  'video-embed': normalizeVideoEmbedContent,
  breadcrumbs: normalizeBreadcrumbsContent,
  navbar: normalizeNavbarContent,
  footer: normalizeFooterContent,
  timeline: normalizeTimelineContent,
  'cta-banner': normalizeCtaBannerContent,
  'cta-with-form': normalizeCtaWithFormContent,
  'text-block': normalizeTextBlockContent,
  'html-block': normalizeHtmlBlockContent,
  'quote-block': normalizeQuoteBlockContent,
  sidemenu: normalizeSidemenuContent,
  'sidebar-nav': normalizeSidebarNavContent,
  statistics: normalizeStatisticsContent,
  'content-feed': normalizeContentFeedContent,
  'blog-list': normalizeBlogListContent,
  'blog-post': normalizeBlogPostContent,
  'article-header': normalizeArticleHeaderContent,
  'team-grid': normalizeTeamGridContent,
  'feature-grid': normalizeFeatureGridContent,
  'cta-simple': normalizeCtaSimpleContent,
  'two-column': normalizeTwoColumnContent,
  'logo-cloud': normalizeLogoCloudContent,
  testimonials: normalizeTestimonialsContent
}
