/**
 * Detection Post-Processor Module
 *
 * This module provides post-processing utilities for detected components.
 * The main processing logic has been decomposed into specialized processors
 * for better maintainability.
 *
 * @module detection-post-processor
 */

// Navigation patterns
export {
  UTILITY_NAV_LABELS,
  PRIMARY_NAV_PATTERNS,
  SIDEMENU_HREF_PATTERNS,
  SIDEMENU_LABEL_INDICATORS,
  isUtilityNavLabel,
  isPrimaryNavLabel,
  type MenuItemLike
} from './navigation-patterns'

// Content type patterns
export {
  DETAIL_COMPONENT_TYPES,
  CONTENT_TYPE_TAGS,
  CONTENT_TYPE_TAG_ALLOWLIST,
  CONTENT_TYPE_PATH_CUES,
  CONTENT_TYPE_HEADING_CUES,
  matchTagFromPath,
  matchTagFromHeading,
  normalizeContentTypeTag,
  getContentTypePrefixUrl,
  type ContentTypeTag
} from './content-type-patterns'

// Utility functions
export {
  cloneComponent,
  cloneValue,
  normalizeString,
  isPlainObject,
  escapeRegex,
  normalizeHref,
  derivePathPrefix,
  resolveAssetUrl
} from './utils'

// Region assignment
export {
  assignHeaderRegions,
  assignHeroRegions,
  applyRegion,
  getComponentRegion,
  type ComponentRegion
} from './region-processor'

// Navigation processor
export {
  normalizeMultiRowNavigation,
  looksLikeSectionSidemenu
} from './navigation-processor'

// Hero processor
export {
  promoteHeroBackground
} from './hero-processor'

// Hero-CTA merger
export {
  mergeHeroWithAdjacentCta
} from './hero-cta-merger'

// CTA processor
export {
  removeInlineCtas
} from './cta-processor'

// Content tagging processor
export {
  tagPageComponents,
  tagListingComponents,
  extractListingContent,
  collectHrefCandidates,
  inferTagFromHrefList,
  hasTagSupportFromHrefs,
  deriveAllowlistedPrefix,
  matchTagFromUrl,
  inferContentTypeTag,
  hasDateField,
  hasPriceField,
  hasLocationField,
  type ListingExtraction
} from './content-tagging-processor'

// Content feed processor
export {
  promoteContentFeeds,
  ensureContentFeedFromAnchors
} from './content-feed-processor'

// Image enrichment processor
export {
  enrichComponentImages,
  type ImageEnrichmentOptions
} from './image-enrichment-processor'

// Hero content enrichment processor
export {
  enrichHeroContent,
  type HeroContentEnrichmentOptions
} from './hero-content-enrichment'

// JSON unwrap processor
export {
  unwrapJsonContent
} from './json-unwrap-processor'

// Processing engine (generic rule-driven processors)
export {
  executeMultiRowDetection,
  executeBackgroundPromotion,
  executeDeduplication,
  executeContentFeedPromotion
} from './processing-engine'

// Confidence threshold configuration
export {
  DEFAULT_CONFIDENCE_THRESHOLDS,
  PROCESSOR_THRESHOLDS,
  shouldSkipProcessor,
  shouldSkipComponent,
  shouldFlagForReview,
  getThresholdForProcessor,
  calculateAverageConfidence,
  checkProcessorSkip,
  type ConfidenceThresholds,
  type SkipCheckResult
} from './confidence-config'

// Telemetry
export {
  telemetryCollector,
  withTelemetry,
  withConfidenceCheck,
  recordSkippedProcessor,
  type TypeChange,
  type ProcessorTelemetry,
  type ImportTelemetry,
  type SkippedProcessorTelemetry
} from './telemetry'

// Main post-processor is in ../detection-post-processor.ts
// Import adjustDetectedComponents from there directly
