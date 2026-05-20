/**
 * Import Utilities Module
 *
 * Re-exports all utility functions from the import system.
 *
 * @module utils
 */

// Path utilities
export {
  normalizePath,
  normalizePathname,
  isHomePath,
  getHostname,
  getOrigin,
  joinPath,
  getPathSlug,
  slugToTitle,
  deriveTitleFromUrl,
  matchPath
} from './path-utils'

// Error classification utilities
export {
  classifyError,
  isRetryable,
  isConnectionError,
  isFatal,
  isTimeout,
  isRateLimit,
  getErrorMessage,
  createErrorLogEntry,
  type ErrorClass,
  type ErrorClassification
} from './error-classification'

// Retry utilities
export {
  withRetry,
  withRetryResult,
  calculateBackoffDelay,
  calculateLinearDelay,
  processInBatches,
  withTimeout,
  sleep,
  type RetryOptions,
  type RetryResult
} from './retry-utils'

// JSON parsing utilities
export {
  sanitizeForJson,
  extractJsonArray,
  extractJsonObject,
  extractArrayAfterKey,
  safeJsonParse,
  tryParseJson,
  extractAllJsonObjects,
  extractTupleItems,
  safeStringify,
  deepClone,
  isValidJson,
  type JsonExtractionResult
} from './json-parsing'

// Progress utilities
export {
  ImportProgressStages,
  OrchestratorProgressStages,
  ProgressCalculator,
  calculateStageProgress,
  interpolateProgress,
  createProgressReporter,
  createProgressTracker,
  type ProgressRange,
  type ImportProgressStage,
  type OrchestratorProgressStage
} from './progress-utils'

// Memory tracing (existing)
export { traceMemory } from './memory-trace'

// Pattern analysis (existing)
export {
  calculatePatternSimilarity,
  normalizeStructure
} from './pattern-analysis'

// Validation (existing)
export {
  MAX_JSON_SIZE,
  MAX_JSON_DEPTH,
  getJSONSizeInBytes,
  validateJSONSize,
  validateJSONDepth,
  validateJSON,
  validateImportJSON,
  formatBytes
} from './validation'

// DOM probe flags (existing)
export {
  getDomProbeBaselineKey,
  isDomProbeEnabledForWebsite,
  shouldRunDomProbeEvaluation
} from './dom-probe-flags'

// URL transformation utilities
export {
  transformUrl,
  transformHtmlUrls,
  transformObjectUrls,
  transformComponentUrls,
  extractOrigin,
  isAnchorLink,
  isSpecialProtocol,
  isProtocolRelative,
  isRelativePath,
  isSameOrigin,
  isProcessableUrl,
  type UrlTransformMode,
  type UrlTransformContext,
  type UrlTransformResult
} from './url-transformer'
