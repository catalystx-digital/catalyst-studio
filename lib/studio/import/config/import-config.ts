/**
 * Centralized Import Configuration
 *
 * Single source of truth for all import-related configuration values.
 * This module consolidates scattered constants from across the import system.
 *
 * @module import-config
 */

// =============================================================================
// Environment Variable Helpers
// =============================================================================

function parseEnvInt(key: string, defaultValue: number): number {
  const raw = process.env[key]
  if (!raw) return defaultValue
  const parsed = parseInt(raw, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue
}

function parseEnvFloat(key: string, defaultValue: number): number {
  const raw = process.env[key]
  if (!raw) return defaultValue
  const parsed = parseFloat(raw)
  return Number.isFinite(parsed) ? parsed : defaultValue
}

function parseEnvBool(key: string, defaultValue: boolean): boolean {
  const raw = process.env[key]
  if (!raw) return defaultValue
  return raw === '1' || raw.toLowerCase() === 'true'
}

function parseEnvString(key: string, defaultValue: string): string {
  const raw = process.env[key]
  if (!raw) return defaultValue
  const trimmed = raw.trim()
  return trimmed || defaultValue
}

// =============================================================================
// Model Configuration
// =============================================================================

/**
 * LLM model configuration for import detection.
 *
 * Model selection uses IMPORT_MODEL_CHAIN (pipe-separated list).
 * First model in chain is the primary, others are fallbacks.
 */
const modelChain = parseEnvString(
  'IMPORT_MODEL_CHAIN',
  'google/gemini-3-pro-preview|google/gemini-2.5-flash|anthropic/claude-sonnet-4.5|x-ai/grok-4.1-fast|anthropic/claude-haiku-4.5|openai/gpt-4o-mini'
)

export const ModelConfig = {
  /** Model chain for detection (pipe-separated, first is primary) */
  chain: modelChain,

  /** Primary model (first in chain) */
  primary: modelChain.split('|')[0].trim(),

  /** Model for component type extraction */
  typeExtraction: 'openai/gpt-4o-mini',

  /** Temperature for detection (lower = more deterministic) */
  temperature: {
    detection: 0.0,
    typeExtraction: 0.1
  },

  /** Restrict models to specific provider (e.g., 'anthropic', 'openai') */
  allowedProvider: parseEnvString('IMPORT_MODEL_ALLOWED_PROVIDER', '')
} as const

// =============================================================================
// Token Budget Configuration
// =============================================================================

/**
 * Token limits for LLM requests.
 *
 * The actual max_tokens sent to the API is:
 *   min(maxCompletionTokens, model's max_completion_tokens from OpenRouter)
 *
 * This ensures we respect both user config and model capability.
 */
export const TokenConfig = {
  /**
   * Max completion tokens to request from LLM.
   * Set via IMPORT_DETECT_MAX_TOKENS env var.
   * Will be capped by model's actual max_completion_tokens from OpenRouter.
   */
  maxCompletionTokens: parseEnvInt('IMPORT_DETECT_MAX_TOKENS', 90000),

  /** Context window budget for prompt + completion */
  contextBudget: parseEnvInt('IMPORT_DETECT_CONTEXT_BUDGET', 120000),

  /** Minimum tokens reserved for completion */
  minCompletionBudget: 512,

  /** Max tokens for component type extraction */
  typeExtraction: 1000,

  // Legacy aliases for backward compatibility
  /** @deprecated Use maxCompletionTokens instead */
  get defaultBudget() { return this.maxCompletionTokens },
  /** @deprecated No longer used - model limit comes from OpenRouter */
  get hardCap() { return this.maxCompletionTokens }
} as const

// =============================================================================
// Timeout Configuration
// =============================================================================

/**
 * Timeout values in milliseconds.
 * All timeouts use consistent naming: *Ms suffix for milliseconds.
 */
export const TimeoutConfig = {
  /** Per-request timeout for LLM API calls */
  perRequestMs: parseEnvInt('IMPORT_DETECT_TIMEOUT_MS', 60_000),

  /** Whole-page detection budget */
  perPageMs: parseEnvInt('IMPORT_PER_PAGE_TIMEOUT_MS', 120_000),

  /** Maximum total import job timeout (30 minutes default) */
  totalMaxMs: parseEnvInt('IMPORT_MAX_TIMEOUT_MS', 1_800_000),

  /** Total budget for all detection calls (0 = unlimited) */
  totalBudgetMs: parseEnvInt('IMPORT_TOTAL_BUDGET_MS', 0)
} as const

// =============================================================================
// Confidence Thresholds
// =============================================================================

/**
 * Confidence thresholds for various import stages.
 *
 * Threshold hierarchy (lowest to highest):
 * - detection (0.25): Very low to maximize recall during initial detection
 * - medium (0.60): For seeding/generation tasks
 * - high (0.70): Industry standard for "confident" classification
 * - veryHigh (0.85): For clustering/grouping to avoid false positives
 */
export const ConfidenceConfig = {
  /** Minimum confidence to keep a detected component (maximizes recall) */
  detection: parseEnvFloat('IMPORT_CONFIDENCE_DETECTION', 0.25),

  /** Medium confidence for seeding/generation */
  medium: 0.60,

  /** High confidence threshold (used for auto-approval) */
  highConfidence: 0.70,

  /** Very high confidence (clustering, grouping) */
  veryHigh: 0.85,

  /** Synthetic component confidence by type */
  synthetic: {
    hero: 0.88,
    blog: 0.93,
    commerce: 0.84,
    common: 0.90
  },

  // Legacy aliases for backward compatibility
  /** @deprecated Use highConfidence instead */
  get autoApproval() { return this.highConfidence },
  /** @deprecated Use veryHigh instead */
  get veryHighConfidence() { return this.veryHigh },
  /** @deprecated Use veryHigh instead */
  get patternClustering() { return this.veryHigh },
  /** @deprecated Use medium instead */
  get canonicalSeeding() { return this.medium },
  /** @deprecated Use medium instead */
  get templateGeneration() { return this.medium }
} as const

// =============================================================================
// Retry Configuration
// =============================================================================

/**
 * Retry and backoff settings for resilient operations.
 */
export const RetryConfig = {
  /** Maximum retry attempts */
  maxAttempts: parseEnvInt('IMPORT_RETRIES', 3),

  /** Base delay between retries in ms */
  baseDelayMs: parseEnvInt('IMPORT_BACKOFF_BASE_MS', 500),

  /** Backoff multiplier (exponential: delay * multiplier^attempt) */
  backoffMultiplier: 2,

  /** Jitter percentage to add randomness (0-1) */
  jitterFactor: 0.1
} as const

// =============================================================================
// Circuit Breaker Configuration
// =============================================================================

/**
 * Circuit breaker settings to prevent cascading failures.
 */
export const CircuitBreakerConfig = {
  /** Number of failures before circuit opens */
  threshold: parseEnvInt('IMPORT_CB_THRESHOLD', 3),

  /** Cooldown period before retrying after circuit opens */
  cooldownMs: parseEnvInt('IMPORT_CB_COOLDOWN_MS', 60_000)
} as const

// =============================================================================
// Concurrency Configuration
// =============================================================================

/**
 * Concurrency and batching settings.
 */
export const ConcurrencyConfig = {
  /** Max URLs to process in single import */
  maxUrls: parseEnvInt('IMPORT_MAX_URLS', 4),

  /** Concurrent detection requests */
  detection: parseEnvInt('IMPORT_CONCURRENCY', 2),

  /** Concurrent import jobs per account */
  jobsPerAccount: 3,

  /** Batch sizes for various operations */
  batchSizes: {
    components: 100,
    pages: 10,
    structures: 50,
    detection: 100,
    candidates: 10
  },

  /** Chunk concurrency for parallel processing */
  chunkConcurrency: 2
} as const

// =============================================================================
// Logging Configuration
// =============================================================================

/**
 * Logging and debugging settings.
 */
export const LoggingConfig = {
  /** Log web tool inputs */
  logWebToolInput: parseEnvBool('IMPORT_LOG_WEB_TOOL_INPUT', false),

  /** Log web tool outputs */
  logWebToolOutput: parseEnvBool('IMPORT_LOG_WEB_TOOL_OUTPUT', false),

  /** Max characters to log (0 = unlimited) */
  maxLogLength: parseEnvInt('IMPORT_LOG_WEB_TOOL_MAX_CHARS', 4000),

  /** Enable memory tracing */
  memoryTrace: parseEnvBool('IMPORT_MEMORY_TRACE', false),

  /** Enable telemetry/observability */
  observe: parseEnvBool('IMPORT_OBSERVE', false),

  /** Log LLM output for debugging */
  logOutput: parseEnvBool('IMPORT_LOG_OUTPUT', false),

  /** Log LLM prompts for debugging */
  logPrompt: parseEnvBool('IMPORT_LOG_PROMPT', false),

  /** Max continuation attempts when LLM returns incomplete JSON (default: 5) */
  maxContinuationAttempts: parseEnvInt('IMPORT_MAX_CONTINUATION_ATTEMPTS', 5)
} as const

// =============================================================================
// Sitemap Configuration
// =============================================================================

/**
 * Sitemap discovery settings.
 */
export const SitemapConfig = {
  /** Disable sitemap discovery */
  disabled: parseEnvBool('IMPORT_DISABLE_SITEMAP', false)
} as const

// =============================================================================
// Web Tools Configuration
// =============================================================================

/**
 * Web tools settings for content extraction.
 */
export const WebToolsConfig = {
  /** Maximum bytes per section */
  sectionMaxBytes: parseEnvInt('IMPORT_SECTION_MAX_BYTES', 50000),

  /** Maximum missed DOM sections to force-fetch after tool use */
  maxForceFetchSections: parseEnvInt('IMPORT_MAX_FORCE_FETCH_SECTIONS', 10),

  /** Maximum characters for direct-content retry payloads */
  directPromptMaxChars: parseEnvInt('IMPORT_DIRECT_PROMPT_MAX_CHARS', 150000),

  /** Use simple web tools mode */
  simpleMode: parseEnvBool('IMPORT_WEBTOOLS_SIMPLE', false)
} as const

// =============================================================================
// OpenRouter Configuration
// =============================================================================

/**
 * OpenRouter API settings.
 *
 * TKT-065: Added baseUrl to support direct xAI API calls, bypassing OpenRouter
 * truncation bug with large prompts (~47K tokens).
 */
export const OpenRouterConfig = {
  /** Base URL for API calls (OpenRouter or direct xAI) */
  baseUrl: parseEnvString('OPENROUTER_BASE_URL', 'https://openrouter.ai/api/v1'),

  /** Cache TTL for model metadata in ms (default 1 hour) */
  modelsCacheTtlMs: parseEnvInt('OPENROUTER_MODELS_CACHE_TTL', 3600000)
} as const

// =============================================================================
// Detection Configuration
// =============================================================================

/**
 * Detection-specific settings.
 */
export const DetectionConfig = {
  /** Maximum tool call iterations before forcing completion */
  toolLoopGuard: 6,

  /** Characters per token estimate for budget calculation */
  charsPerToken: 4,

  /** Canonical seeding chunk size */
  canonicalSeedingChunkSize: 50,

  /** Component types to skip during canonical seeding */
  skippedCanonicalTypes: new Set(['page', 'page-container', 'generic'])
} as const

// =============================================================================
// URL Transformation Configuration
// =============================================================================

/**
 * URL transformation settings for converting source site URLs to target format.
 *
 * During import, absolute URLs pointing to the source site are transformed to
 * either relative paths or absolute URLs pointing to the target site.
 */
export const UrlTransformConfig = {
  /**
   * Transformation mode:
   * - 'relative': Convert to relative paths (e.g., '/about')
   * - 'absolute': Convert to target origin (requires targetOrigin)
   * - 'none': No transformation, preserve original URLs
   */
  mode: parseEnvString('IMPORT_URL_TRANSFORM_MODE', 'relative') as 'relative' | 'absolute' | 'none',

  /**
   * Whether URL transformation is enabled.
   * Set to false to skip URL transformation entirely.
   */
  enabled: parseEnvBool('IMPORT_URL_TRANSFORM_ENABLED', true),

  /**
   * Preserve external links (links to domains other than source).
   * When true, only URLs from the source origin are transformed.
   */
  preserveExternal: parseEnvBool('IMPORT_URL_PRESERVE_EXTERNAL', true),

  /**
   * Log URL transformation statistics.
   */
  logStats: parseEnvBool('IMPORT_URL_TRANSFORM_LOG', false)
} as const

// =============================================================================
// Checkpoint Configuration
// =============================================================================

/**
 * Checkpoint system settings for resumable imports.
 */
export const CheckpointConfig = {
  /** Enable/disable checkpointing */
  enabled: parseEnvBool('IMPORT_CHECKPOINT_ENABLED', true),

  /** Base directory for checkpoint files */
  cacheDir: parseEnvString('IMPORT_CHECKPOINT_DIR', '.import-cache'),

  /** Retain checkpoint files after successful import (for debugging) */
  retainOnSuccess: parseEnvBool('IMPORT_CHECKPOINT_RETAIN', false),

  /** Include raw LLM response in checkpoint (large, for deep debugging) */
  includeRawResponse: parseEnvBool('IMPORT_CHECKPOINT_RAW_RESPONSE', false),

  /** Auto-cleanup checkpoints older than N days */
  retentionDays: parseEnvInt('IMPORT_CHECKPOINT_RETENTION_DAYS', 7),

  /** Maximum retries for retryable errors during resume */
  maxRetryAttempts: parseEnvInt('IMPORT_CHECKPOINT_MAX_RETRIES', 3)
} as const

// =============================================================================
// Re-Import Configuration
// =============================================================================

/**
 * Re-import specific settings for selective page refresh.
 */
export const ReImportConfig = {
  /** Max concurrent pages in batch re-import */
  maxConcurrency: parseEnvInt('REIMPORT_MAX_CONCURRENCY', 3),

  /** Maximum URLs allowed per re-import request (API limit) */
  maxUrlsPerRequest: parseEnvInt('REIMPORT_MAX_URLS_PER_REQUEST', 50),

  /** Per-page timeout in ms */
  perPageTimeoutMs: parseEnvInt('REIMPORT_PER_PAGE_TIMEOUT_MS', 60_000),

  /** Total timeout for batch re-import in ms (10 minutes) */
  totalTimeoutMs: parseEnvInt('REIMPORT_TOTAL_TIMEOUT_MS', 10 * 60_000),

  /** Max redirects to follow */
  maxRedirects: parseEnvInt('REIMPORT_MAX_REDIRECTS', 5),

  /** Minimum delay between pages in ms (rate limiting) */
  minDelayBetweenPagesMs: parseEnvInt('REIMPORT_MIN_DELAY_MS', 500),

  /** Default options */
  defaults: {
    /** Don't preserve customizations by default - do full replace */
    preserveCustomizations: false,

    /** Skip design system update (was captured during initial import) */
    skipDesignSystem: true,

    /** Run shared component detection by default */
    skipSharedComponents: false,

    /** Create page if not found locally */
    createIfNotExists: true
  },

  /** Large batch threshold - require async processing above this */
  largeBatchThreshold: parseEnvInt('REIMPORT_LARGE_BATCH_THRESHOLD', 10),

  /** Shared component detection thresholds */
  sharedComponentDetection: {
    /** Single page: skip detection, only update existing refs */
    skipForSinglePage: true,
    /** Pages threshold for full site detection */
    fullSiteDetectionThreshold: parseEnvInt('REIMPORT_FULL_DETECTION_THRESHOLD', 10)
  },

  /** HTTP fetch settings */
  fetch: {
    /** User agent for fetching source pages */
    userAgent: 'CatalystStudio-ReImport/1.0',

    /** Request timeout in ms */
    timeoutMs: parseEnvInt('REIMPORT_FETCH_TIMEOUT_MS', 30_000),

    /** Retry count for transient errors */
    retries: parseEnvInt('REIMPORT_FETCH_RETRIES', 2)
  },

  /**
   * ImportJob tracking for re-imports
   * When enabled, each re-import creates an ImportJob record with type='reimport'
   */
  tracking: {
    /** Create ImportJob record for each re-import */
    createImportJob: true,
    /** ImportJob type discriminator */
    importJobType: 'reimport'
  }
} as const

// =============================================================================
// Import Planner Configuration
// =============================================================================

/**
 * Import Planner Configuration
 *
 * Settings for the LLM-driven import strategy planner.
 * The planner analyzes user requests and determines the best import strategy.
 */
export const PlannerConfig = {
  /** Model to use for planning (defaults to primary model) */
  model: parseEnvString('IMPORT_PLANNER_MODEL', ModelConfig.primary),

  /** Maximum tool iterations before fallback */
  maxIterations: parseEnvInt('IMPORT_PLANNER_MAX_ITERATIONS', 5),

  /** Enable deterministic planning for structured input (skip LLM) */
  enableDeterministic: process.env.IMPORT_PLANNER_DETERMINISTIC !== 'false',

  /** Log planner decisions */
  logDecisions: parseEnvBool('IMPORT_PLANNER_LOG', false),

  /** Temperature for planner LLM calls (0 = deterministic) */
  temperature: 0,

  /** Max tokens for planner LLM response */
  maxTokens: 1000,
} as const

// =============================================================================
// Aggregated Config Export
// =============================================================================

/**
 * Complete import configuration.
 * Use this for full config access, or import individual configs for specific needs.
 */
export const ImportConfig = {
  models: ModelConfig,
  tokens: TokenConfig,
  timeouts: TimeoutConfig,
  confidence: ConfidenceConfig,
  retry: RetryConfig,
  circuitBreaker: CircuitBreakerConfig,
  concurrency: ConcurrencyConfig,
  logging: LoggingConfig,
  detection: DetectionConfig,
  urlTransform: UrlTransformConfig,
  sitemap: SitemapConfig,
  webTools: WebToolsConfig,
  openRouter: OpenRouterConfig,
  checkpoint: CheckpointConfig,
  reimport: ReImportConfig,
  planner: PlannerConfig,
} as const

// =============================================================================
// Config Validation
// =============================================================================

/**
 * Validates configuration at startup.
 * Call this in your main entry point to catch misconfigurations early.
 */
export function validateImportConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  // Validate timeout relationships
  if (TimeoutConfig.perRequestMs > TimeoutConfig.totalMaxMs) {
    errors.push(
      `perRequestMs (${TimeoutConfig.perRequestMs}) should not exceed totalMaxMs (${TimeoutConfig.totalMaxMs})`
    )
  }

  // Validate token budgets
  if (TokenConfig.minCompletionBudget >= TokenConfig.maxCompletionTokens) {
    errors.push(
      `minCompletionBudget (${TokenConfig.minCompletionBudget}) must be less than maxCompletionTokens (${TokenConfig.maxCompletionTokens})`
    )
  }

  // Validate confidence thresholds
  const confidenceValues = [
    ConfidenceConfig.detection,
    ConfidenceConfig.highConfidence,
    ConfidenceConfig.patternClustering,
    ConfidenceConfig.canonicalSeeding
  ]

  for (const value of confidenceValues) {
    if (value < 0 || value > 1) {
      errors.push(`Confidence threshold ${value} must be between 0 and 1`)
    }
  }

  // Validate retry config
  if (RetryConfig.maxAttempts < 1) {
    errors.push(`maxAttempts (${RetryConfig.maxAttempts}) must be at least 1`)
  }

  if (RetryConfig.baseDelayMs < 0) {
    errors.push(`baseDelayMs (${RetryConfig.baseDelayMs}) must be non-negative`)
  }

  // Validate concurrency
  if (ConcurrencyConfig.maxUrls < 1) {
    errors.push(`maxUrls (${ConcurrencyConfig.maxUrls}) must be at least 1`)
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

// =============================================================================
// Type Exports
// =============================================================================

export type ImportConfigType = typeof ImportConfig
export type ModelConfigType = typeof ModelConfig
export type TokenConfigType = typeof TokenConfig
export type TimeoutConfigType = typeof TimeoutConfig
export type ConfidenceConfigType = typeof ConfidenceConfig
export type RetryConfigType = typeof RetryConfig
export type CircuitBreakerConfigType = typeof CircuitBreakerConfig
export type ConcurrencyConfigType = typeof ConcurrencyConfig
export type LoggingConfigType = typeof LoggingConfig
export type DetectionConfigType = typeof DetectionConfig
export type UrlTransformConfigType = typeof UrlTransformConfig
export type SitemapConfigType = typeof SitemapConfig
export type WebToolsConfigType = typeof WebToolsConfig
export type OpenRouterConfigType = typeof OpenRouterConfig
export type CheckpointConfigType = typeof CheckpointConfig
export type PlannerConfigType = typeof PlannerConfig
