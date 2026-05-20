/**
 * Constants for Optimizely provider configuration
 */

// Retry configuration
export const RETRY_CONFIG = {
  MAX_RETRIES: 3,
  INITIAL_DELAY_MS: 1000,
  MAX_DELAY_MS: 10000,
  BACKOFF_MULTIPLIER: 2
} as const;

// API configuration
export const API_CONFIG = {
  DEFAULT_PAGE_SIZE: 100,
  MAX_PAGE_SIZE: 250,
  DEFAULT_API_VERSION: 'preview3',
  DEFAULT_BASE_URL: 'https://api.cms.optimizely.com',
  BATCH_SIZE: 50,
  BATCH_DELAY_MS: 2000  // Reduced to 2 seconds for better performance
} as const;

// Adaptive rate limiting configuration
export const RATE_LIMIT_CONFIG = {
  MIN_DELAY_MS: 500,      // Minimum delay between requests
  MAX_DELAY_MS: 4000,     // Maximum delay when rate limited
  INITIAL_DELAY_MS: 1000, // Start with 1 second delay
  BACKOFF_FACTOR: 1.5,    // Multiply delay by this on rate limit
  SPEEDUP_FACTOR: 0.9,    // Multiply delay by this on success
  PARALLEL_REQUESTS: 3    // Number of parallel requests allowed
} as const;

// Timeout configuration  
export const TIMEOUT_CONFIG = {
  DEFAULT_TIMEOUT_MS: 30000,
  AUTH_TIMEOUT_MS: 10000,
  LONG_RUNNING_TIMEOUT_MS: 60000
} as const;

// Cache configuration
export const CACHE_CONFIG = {
  TYPE_CACHE_TTL_MS: 300000, // 5 minutes
  ITEM_CACHE_TTL_MS: 60000,  // 1 minute
  MAX_CACHE_SIZE: 1000
} as const;