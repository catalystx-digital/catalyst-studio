/**
 * Component Helpers Module
 *
 * This module provides component normalization and transformation utilities
 * for the import pipeline. It's been decomposed from the original 2,794 line
 * component-helpers.ts file.
 *
 * Note: This module does NOT re-export from ../component-helpers.ts to avoid
 * circular dependencies. Import generateComponentId, extractComponentProps,
 * and canonicalizeComponentType directly from ../component-helpers.ts
 *
 * @module component-helpers
 */

// String utilities
export {
  clampSummary,
  extractSummaryFromJsonString,
  extractFirstSentence,
  STOP_WORDS,
  normalizeString,
  containsHtmlTags,
  stripHtmlToText,
  convertPlainTextToHtml,
  escapeHtml,
  normalizeBooleanFlag,
  isRecord
} from './string-utils'

// Canonical type utilities
export {
  canonicalizeComponentType,
  normalizeCmsComponentKey,
  toCmsComponentType,
  normalizeComponentRegionValue,
  normalizeTokenList,
  type ComponentRegion
} from './canonical-types'

// Normalizer utilities
export {
  COMPONENT_CONTENT_NORMALIZERS,
  extractLinkUrl,
  pruneObjectAgainstContract,
  type LocalNormalizationWarning,
  type ComponentContentNormalizer
} from './normalizers'
