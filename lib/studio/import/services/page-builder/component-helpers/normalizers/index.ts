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
  normalizeHeroWithImageContent
} from './hero-normalizers'

// Navigation normalizers
export {
  normalizeNavbarContent,
  normalizeBreadcrumbsContent
} from './nav-normalizers'

// Content normalizers
export {
  normalizeTimelineContent,
  normalizeTextBlockContent,
  normalizeContentFeedContent,
  normalizeTwoColumnContent
} from './content-normalizers'

// CTA normalizers
export {
  normalizeCtaWithFormContent,
  normalizeCtaSimpleContent
} from './cta-normalizers'

// Blog normalizers
export {
  normalizeBlogPostContent,
  normalizeArticleHeaderContent
} from './blog-normalizers'

// About normalizers
export {
  normalizeTeamGridContent
} from './about-normalizers'

// Media normalizers
export {
  normalizeVideoEmbedContent
} from './media-normalizers'

// Data normalizers
export {
  normalizeStatisticsContent
} from './data-normalizers'

/**
 * Map of component types to their content normalizers.
 * Use this to look up the appropriate normalizer for a component type.
 */
import { normalizeHeroSimpleContent, normalizeHeroWithImageContent } from './hero-normalizers'
import { normalizeNavbarContent, normalizeBreadcrumbsContent } from './nav-normalizers'
import { normalizeTimelineContent, normalizeTextBlockContent, normalizeContentFeedContent, normalizeTwoColumnContent } from './content-normalizers'
import { normalizeCtaWithFormContent, normalizeCtaSimpleContent } from './cta-normalizers'
import { normalizeBlogPostContent, normalizeArticleHeaderContent } from './blog-normalizers'
import { normalizeTeamGridContent } from './about-normalizers'
import { normalizeVideoEmbedContent } from './media-normalizers'
import { normalizeStatisticsContent } from './data-normalizers'
import type { ComponentContentNormalizer } from './shared-normalizer-utils'

export const COMPONENT_CONTENT_NORMALIZERS: Record<string, ComponentContentNormalizer> = {
  'hero-with-image': normalizeHeroWithImageContent,
  'hero-simple': normalizeHeroSimpleContent,
  'video-embed': normalizeVideoEmbedContent,
  breadcrumbs: normalizeBreadcrumbsContent,
  navbar: normalizeNavbarContent,
  timeline: normalizeTimelineContent,
  'cta-with-form': normalizeCtaWithFormContent,
  'text-block': normalizeTextBlockContent,
  statistics: normalizeStatisticsContent,
  'content-feed': normalizeContentFeedContent,
  'blog-post': normalizeBlogPostContent,
  'article-header': normalizeArticleHeaderContent,
  'team-grid': normalizeTeamGridContent,
  'cta-simple': normalizeCtaSimpleContent,
  'two-column': normalizeTwoColumnContent
}
