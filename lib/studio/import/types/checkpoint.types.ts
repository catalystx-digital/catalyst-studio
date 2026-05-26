/**
 * Import Checkpoint System Types
 *
 * Types for the disk-based checkpoint system that enables resumable imports
 * and per-page debugging.
 *
 * @module checkpoint.types
 */

import type { DetectedComponent, ImportDetectionResult, InvalidDetectedComponent, PageMetadata } from '../detection/types'

// =============================================================================
// Pipeline Stage Types
// =============================================================================

/**
 * Pipeline stages in execution order.
 * Used to track progress and enable stage-based resume.
 */
export type PipelineStage =
  | 'initialized'           // Session created, sitemap saved
  | 'page_detection'        // LLM detection in progress (per-page checkpoints)
  | 'page_detection_done'   // All pages detected, results saved
  | 'navigation_extracted'  // Navigation hierarchy extracted
  | 'templates_identified'  // Page templates identified
  | 'tokens_extracted'      // Design tokens extracted
  | 'dom_probe_done'        // DOM probe capture completed
  | 'templates_generated'   // CMS templates generated
  | 'aggregation_done'      // All aggregation complete, ready for persist
  | 'persist_done'          // Database persist complete

/**
 * Stage completion record
 */
export interface StageCompletion {
  stage: PipelineStage
  completedAt: string
  durationMs: number
}

// =============================================================================
// Manifest Types
// =============================================================================

/**
 * Checkpoint session status
 */
export type CheckpointStatus = 'in_progress' | 'completed' | 'failed' | 'cancelled'

/**
 * Checkpoint manifest stored at manifest.json
 * Contains job metadata and progress tracking
 */
export interface CheckpointManifest {
  /** Schema version for forward compatibility */
  version: '1.0'
  /** Unique job identifier */
  jobId: string
  /** Associated website ID */
  websiteId: string
  /** Original import URL */
  sourceUrl: string
  /** ISO timestamp of session creation */
  createdAt: string
  /** ISO timestamp of last update */
  updatedAt: string
  /** Current session status */
  status: CheckpointStatus

  /** Current pipeline stage */
  currentStage: PipelineStage

  /** Completed stages with timing */
  completedStages: StageCompletion[]

  /** Progress counters */
  progress: {
    /** Total URLs discovered */
    totalUrls: number
    /** Successfully processed URLs */
    completedUrls: number
    /** Failed URLs */
    failedUrls: number
    /** Skipped URLs (budget, circuit breaker, etc.) */
    skippedUrls: number
  }

  /** Timing information */
  timing: {
    /** ISO timestamp when processing started */
    startedAt: string
    /** ISO timestamp of most recent activity */
    lastActivityAt: string
    /** ISO timestamp when session completed (if finished) */
    completedAt?: string
    /** Total processing duration in milliseconds */
    totalDurationMs?: number
  }

  /** Configuration used for this import */
  config: {
    /** Maximum pages to process */
    maxPages: number
    /** Model chain used for detection */
    modelChain: string
    /** Concurrency level */
    concurrency: number
  }

  /** Error information (if failed) */
  error?: {
    /** Stage where error occurred */
    stage: string
    /** Error message */
    message: string
    /** ISO timestamp of error */
    timestamp: string
  }
}

// =============================================================================
// Sitemap Types
// =============================================================================

/**
 * URL processing status
 */
export type UrlStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'skipped'

/**
 * URL entry in the sitemap
 */
export interface SitemapUrlEntry {
  /** Full URL */
  url: string
  /** Hash of URL (for filename mapping) */
  urlHash: string
  /** Current processing status */
  status: UrlStatus
  /** Order in processing queue */
  order: number
  /** ISO timestamp when processing completed */
  processedAt?: string
  /** Error message if failed */
  error?: string
}

/**
 * Skipped URL entry with reason
 */
export interface SkippedUrlEntry {
  /** Full URL */
  url: string
  /** Reason for skipping */
  reason: string
}

/**
 * Checkpoint sitemap stored at sitemap.json
 */
export interface CheckpointSitemap {
  /** ISO timestamp of sitemap discovery */
  discoveredAt: string
  /** All discovered URLs with status */
  urls: SitemapUrlEntry[]
  /** URLs skipped during discovery */
  skipped: SkippedUrlEntry[]
}

// =============================================================================
// Page Result Types
// =============================================================================

/**
 * LLM debug information for a page
 */
export interface LLMDebugInfo {
  /** Number of API requests made */
  requestCount?: number
  /** Number of tool calls */
  toolCallCount?: number
  /** Length of raw response */
  rawResponseLength?: number
  /** LLM model used for this attempt */
  model?: string
  /** Provider/model finish reason */
  finishReason?: string
  /** Token usage returned by provider */
  usage?: unknown
  /** Parser/validation stage that failed */
  stage?: string
  /** First validation path or parser detail, if available */
  validationPath?: string
  /** Raw response (only if IMPORT_CHECKPOINT_RAW_RESPONSE=true) */
  rawResponse?: string
  /** Context window budget used for this detection attempt */
  contextBudget?: number
  /** Minimum completion reserve used for this detection attempt */
  minCompletionBudget?: number
  /** Estimated prompt tokens at failure/request time */
  promptTokensEstimate?: number
  /** Effective completion tokens left at failure/request time */
  effectiveCompletionTokens?: number
  /** Sections omitted because they could not fit within the completion reserve */
  skippedSectionsDueToBudget?: string[]
  /** Section key associated with this model request */
  sectionKey?: string
  /** Section order associated with this model request */
  sectionOrder?: number
  /** Approximate serialized section size */
  sectionApproxBytes?: number
  /** Whether deterministic section source summarization was enabled */
  sectionSummaryEnabled?: boolean
  /** Original serialized section byte estimate before summarization */
  sectionOriginalBytes?: number
  /** Serialized section byte estimate after summarization */
  sectionSummarizedBytes?: number
  /** Fractional source payload reduction from summarization */
  sectionSummaryReductionRatio?: number
  /** Parser-side repair/normalization applied without another LLM call */
  parserRepair?: 'missing_section_key_injected'
  /** Whether the section response omitted the expected section key */
  missingSectionKey?: boolean
  /** Whether the repair prompt included a capped previous response */
  repairPromptCapped?: boolean
  /** Number of characters from the previous response included in repair prompt */
  repairPromptPreviousJsonChars?: number
  /** Components omitted from a section because their content failed strict validation */
  invalidComponents?: InvalidDetectedComponent[]
  /** Count of components omitted from a section because their content failed strict validation */
  invalidComponentCount?: number
  /** Whether a required nonempty section returned no valid components */
  requiredSectionEmpty?: boolean
  /** Section key that already satisfied a required empty global section */
  satisfiedBySectionKey?: string
  /** How this section artifact was obtained */
  extractionMode?: 'fresh' | 'reused' | 'checkpoint'
  /** Source URL for a reused section artifact */
  reusedFromUrl?: string
  /** Source section key for a reused section artifact */
  reusedFromSectionKey?: string
  /** Stable content hash used for global section reuse */
  sectionContentHash?: string
  /** Full reuse cache key */
  reuseKey?: string
  /** Version string for reuse eligibility/invalidation */
  reuseVersion?: string
  /** Whether the section cache was hit */
  cacheHit?: boolean
  /** Reason a section cache lookup missed or was not eligible */
  cacheMissReason?: string
}

/**
 * Checkpoint page result stored at pages/{url-hash}.json
 */
export interface CheckpointPageResult {
  /** Original URL */
  url: string
  /** URL hash (matches filename) */
  urlHash: string
  /** ISO timestamp when processed */
  processedAt: string
  /** Processing duration in milliseconds */
  durationMs: number

  /** Full detection result */
  detection: ImportDetectionResult

  /** Optional LLM debug information */
  llmDebug?: LLMDebugInfo
}

// =============================================================================
// Page Error Types
// =============================================================================

/**
 * Error stage classification
 */
export type ErrorStage = 'fetch' | 'llm_call' | 'budget' | 'parsing' | 'output_limit' | 'unknown'

/**
 * Checkpoint page error stored at errors/{url-hash}.json
 */
export interface CheckpointPageError {
  /** Original URL */
  url: string
  /** URL hash (matches filename) */
  urlHash: string
  /** ISO timestamp of last attempt */
  attemptedAt: string
  /** Number of attempts made */
  attemptCount: number

  /** Error details */
  error: {
    /** Error message */
    message: string
    /** Error code (if available) */
    code?: string
    /** Stage where error occurred */
    stage: ErrorStage
    /** Whether error is retryable */
    retryable: boolean
  }

  /** Partial detection result (if available) */
  partialDetection?: Partial<ImportDetectionResult>

  /** Optional LLM debug information for failed attempts */
  llmDebug?: LLMDebugInfo
}

// =============================================================================
// Section Result Types
// =============================================================================

/**
 * Checkpoint section result stored at sections/{url-hash}/{section-key}.json
 */
export interface CheckpointSectionResult {
  url: string
  urlHash: string
  sectionKey: string
  sectionOrder: number
  processedAt: string
  durationMs: number
  components: DetectedComponent[]
  pageMetadata?: PageMetadata
  llmDebug?: LLMDebugInfo
}

/**
 * Checkpoint section error stored at section-errors/{url-hash}/{section-key}.json
 */
export interface CheckpointSectionError {
  url: string
  urlHash: string
  sectionKey: string
  sectionOrder: number
  attemptedAt: string
  attemptCount: number
  error: {
    message: string
    code?: string
    stage: ErrorStage
    retryable: boolean
  }
  llmDebug?: LLMDebugInfo
}

// =============================================================================
// Session Types
// =============================================================================

/**
 * Active checkpoint session
 */
export interface CheckpointSession {
  /** Job ID */
  jobId: string
  /** Website ID */
  websiteId: string
  /** Cache directory path */
  cacheDir: string
  /** Current manifest state */
  manifest: CheckpointManifest
}

// =============================================================================
// Service Interface
// =============================================================================

/**
 * Import checkpoint service interface
 */
export interface IImportCheckpointService {
  /**
   * Initialize a new checkpoint session
   * @throws if session already exists
   */
  initializeSession(
    jobId: string,
    websiteId: string,
    sourceUrl: string,
    config?: Partial<CheckpointManifest['config']>
  ): Promise<CheckpointSession>

  /**
   * Mark a pipeline stage as complete
   */
  completeStage(
    session: CheckpointSession,
    stage: PipelineStage,
    durationMs: number
  ): Promise<void>

  /**
   * Get the current pipeline stage
   */
  getCurrentStage(session: CheckpointSession): PipelineStage

  /**
   * Check if a stage has been completed
   */
  isStageComplete(session: CheckpointSession, stage: PipelineStage): boolean

  /**
   * Load aggregated data by key (navigation, tokens, templates, etc.)
   */
  loadAggregated<T>(session: CheckpointSession, key: string): Promise<T | null>

  /**
   * Resume an existing session
   * @returns null if session not found
   */
  resumeSession(jobId: string): Promise<CheckpointSession | null>

  /**
   * Save sitemap after discovery
   */
  saveSitemap(
    session: CheckpointSession,
    urls: string[],
    skipped: SkippedUrlEntry[]
  ): Promise<void>

  /**
   * Mark a URL as currently processing
   */
  markProcessing(session: CheckpointSession, url: string): Promise<void>

  /**
   * Save successful page result immediately after LLM returns
   */
  savePageResult(
    session: CheckpointSession,
    url: string,
    result: ImportDetectionResult,
    debug?: LLMDebugInfo
  ): Promise<void>

  /**
   * Save failed page with error details
   */
  savePageError(
    session: CheckpointSession,
    url: string,
    error: Error,
    attemptCount: number,
    stage?: ErrorStage,
    debug?: LLMDebugInfo
  ): Promise<void>

  saveSectionResult(
    session: CheckpointSession,
    url: string,
    sectionKey: string,
    sectionOrder: number,
    components: DetectedComponent[],
    durationMs: number,
    pageMetadata?: PageMetadata,
    debug?: LLMDebugInfo
  ): Promise<void>

  loadSectionResult(
    session: CheckpointSession,
    url: string,
    sectionKey: string
  ): Promise<CheckpointSectionResult | null>

  saveSectionError(
    session: CheckpointSession,
    url: string,
    sectionKey: string,
    sectionOrder: number,
    error: Error,
    attemptCount: number,
    stage?: ErrorStage,
    debug?: LLMDebugInfo
  ): Promise<void>

  loadSectionError(
    session: CheckpointSession,
    url: string,
    sectionKey: string
  ): Promise<CheckpointSectionError | null>

  getCompletedSections(session: CheckpointSession, url: string): Promise<Set<string>>

  streamSectionResults(
    session: CheckpointSession,
    url: string
  ): AsyncIterable<CheckpointSectionResult>

  savePagePlan(session: CheckpointSession, url: string, data: unknown): Promise<void>

  saveAssembledPage(session: CheckpointSession, url: string, data: unknown): Promise<void>

  /**
   * Get URLs that need processing (pending + retryable failed)
   */
  getPendingUrls(session: CheckpointSession): Promise<string[]>

  /**
   * Get completed URLs (for resume skip logic)
   */
  getCompletedUrls(session: CheckpointSession): Promise<Set<string>>

  /**
   * Stream completed page results for aggregation
   */
  streamCompletedResults(session: CheckpointSession): AsyncIterable<CheckpointPageResult>

  /**
   * Save aggregated data (navigation, tokens, templates)
   */
  saveAggregated(session: CheckpointSession, key: string, data: unknown): Promise<void>

  /**
   * Update manifest status
   */
  updateStatus(
    session: CheckpointSession,
    status: CheckpointStatus,
    error?: Error
  ): Promise<void>

  /**
   * Finalize session (update manifest, optional cleanup)
   */
  finalize(session: CheckpointSession, success: boolean): Promise<void>

  /**
   * Delete checkpoint data (after successful persist to DB)
   */
  cleanup(session: CheckpointSession): Promise<void>

  /**
   * Load a specific page result
   */
  loadPageResult(session: CheckpointSession, url: string): Promise<CheckpointPageResult | null>

  /**
   * Load a specific page error
   */
  loadPageError(session: CheckpointSession, url: string): Promise<CheckpointPageError | null>

  /**
   * Load the current manifest
   */
  loadManifest(session: CheckpointSession): Promise<CheckpointManifest>

  /**
   * Load the sitemap
   */
  loadSitemap(session: CheckpointSession): Promise<CheckpointSitemap | null>
}
