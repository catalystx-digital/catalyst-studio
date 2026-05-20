/**
 * Retry configuration options
 */
export interface RetryOptions {
  maxAttempts?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  onRetry?: (error: unknown, attempt: number) => void;
}

/**
 * Default retry configuration
 */
const DEFAULT_RETRY_OPTIONS: Required<Omit<RetryOptions, 'shouldRetry' | 'onRetry'>> = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
};

/**
 * Calculates delay for exponential backoff
 * @param attempt - Current attempt number (1-based)
 * @param options - Retry configuration
 * @returns Delay in milliseconds
 */
export function calculateBackoffDelay(
  attempt: number,
  options: RetryOptions = {}
): number {
  const config = { ...DEFAULT_RETRY_OPTIONS, ...options };
  const delay = config.initialDelay * Math.pow(config.backoffMultiplier, attempt - 1);
  return Math.min(delay, config.maxDelay);
}

/**
 * Executes a function with automatic retry on failure
 * @param fn - Function to execute
 * @param options - Retry configuration
 * @returns Promise resolving to function result
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const config = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: unknown;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if we should retry
      if (options.shouldRetry && !options.shouldRetry(error, attempt)) {
        throw error;
      }

      // Check if we've exhausted attempts
      if (attempt >= config.maxAttempts) {
        throw error;
      }

      // Call retry callback if provided
      if (options.onRetry) {
        options.onRetry(error, attempt);
      }

      // Wait before retrying
      const delay = calculateBackoffDelay(attempt, config);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Checks if an error is retryable
 * @param error - Error to check
 * @returns True if error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    // Network errors
    if (error.message.includes('fetch failed') || 
        error.message.includes('NetworkError') ||
        error.message.includes('ECONNREFUSED')) {
      return true;
    }

    // Timeout errors
    if (error.message.includes('timeout') || 
        error.message.includes('ETIMEDOUT')) {
      return true;
    }

    // Rate limiting errors
    if (error.message.includes('429') || 
        error.message.includes('rate limit')) {
      return true;
    }

    // Server errors (5xx)
    if (error.message.includes('500') || 
        error.message.includes('502') ||
        error.message.includes('503') ||
        error.message.includes('504')) {
      return true;
    }
  }

  return false;
}

/**
 * Creates a retry handler for deployment operations
 * @param onStatusUpdate - Callback for status updates
 * @returns Retry options configured for deployments
 */
export function createDeploymentRetryOptions(
  onStatusUpdate?: (message: string) => void
): RetryOptions {
  return {
    maxAttempts: 3,
    initialDelay: 2000,
    maxDelay: 10000,
    backoffMultiplier: 2,
    shouldRetry: (error) => {
      // Don't retry on client errors (4xx except 429)
      if (error instanceof Error && error.message.includes('4') && 
          !error.message.includes('429')) {
        return false;
      }
      return isRetryableError(error);
    },
    onRetry: (error, attempt) => {
      const message = `Retry attempt ${attempt}: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.log(message);
      if (onStatusUpdate) {
        onStatusUpdate(message);
      }
    },
  };
}