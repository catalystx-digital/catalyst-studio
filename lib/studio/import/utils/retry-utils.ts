/**
 * Retry Utilities
 *
 * Centralized retry logic with exponential backoff.
 * Consolidates duplicate implementations from:
 * - services/orchestrator/shared-component-manager.ts (withRetry)
 * - import-pipeline.ts (inline retry logic)
 * - services/import-orchestrator.ts (inline retry logic)
 *
 * @module retry-utils
 */

import { RetryConfig } from '../config/import-config'
import { classifyError, isRetryable, isFatal, getErrorMessage } from './error-classification'

/**
 * Options for retry operations.
 */
export interface RetryOptions {
  /** Maximum number of retry attempts (default: from config) */
  maxAttempts?: number

  /** Base delay between retries in ms (default: from config) */
  baseDelayMs?: number

  /** Backoff multiplier (default: from config) */
  backoffMultiplier?: number

  /** Jitter factor 0-1 to add randomness (default: from config) */
  jitterFactor?: number

  /** Operation name for logging */
  operationName?: string

  /** Custom retry condition (default: isRetryable) */
  shouldRetry?: (error: unknown, attempt: number) => boolean

  /** Callback on each retry attempt */
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void
}

/**
 * Result of a retry operation.
 */
export interface RetryResult<T> {
  /** Whether the operation succeeded */
  success: boolean

  /** Result value if successful */
  value?: T

  /** Final error if failed */
  error?: Error

  /** Number of attempts made */
  attempts: number

  /** Total time spent including delays */
  totalTimeMs: number
}

/**
 * Executes an async operation with retry logic and exponential backoff.
 *
 * @param operation - Async function to execute
 * @param options - Retry configuration options
 * @returns Promise resolving to the operation result
 * @throws Final error if all retries exhausted
 *
 * @example
 * const result = await withRetry(
 *   () => fetchData(url),
 *   { operationName: 'fetchData', maxAttempts: 3 }
 * )
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = RetryConfig.maxAttempts,
    baseDelayMs = RetryConfig.baseDelayMs,
    backoffMultiplier = RetryConfig.backoffMultiplier,
    jitterFactor = RetryConfig.jitterFactor,
    operationName = 'operation',
    shouldRetry = isRetryable,
    onRetry
  } = options

  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(getErrorMessage(error))

      // Check if we should retry
      const canRetry = shouldRetry(error, attempt)

      if (!canRetry || attempt === maxAttempts) {
        const classification = classifyError(error)
        console.error(`[Retry] ${operationName} failed after ${attempt} attempt(s)`, {
          error: lastError.message,
          errorClass: classification.class,
          retryable: classification.retryable
        })
        throw lastError
      }

      // Calculate delay with exponential backoff and jitter
      const delayMs = calculateBackoffDelay(attempt, baseDelayMs, backoffMultiplier, jitterFactor)

      console.warn(
        `[Retry] ${operationName} failed (attempt ${attempt}/${maxAttempts}), retrying in ${delayMs}ms...`,
        { error: lastError.message }
      )

      // Call retry callback if provided
      if (onRetry) {
        onRetry(error, attempt, delayMs)
      }

      await sleep(delayMs)
    }
  }

  // Should never reach here, but TypeScript needs this
  throw lastError
}

/**
 * Executes an async operation with retry logic, returning a result object
 * instead of throwing on failure.
 *
 * @param operation - Async function to execute
 * @param options - Retry configuration options
 * @returns Result object with success status and value or error
 *
 * @example
 * const result = await withRetryResult(() => fetchData(url))
 * if (result.success) {
 *   console.log(result.value)
 * } else {
 *   console.error(result.error)
 * }
 */
export async function withRetryResult<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<RetryResult<T>> {
  const startTime = Date.now()
  let attempts = 0

  try {
    const value = await withRetry(operation, {
      ...options,
      onRetry: (error, attempt, delayMs) => {
        attempts = attempt
        options.onRetry?.(error, attempt, delayMs)
      }
    })

    return {
      success: true,
      value,
      attempts: attempts + 1,
      totalTimeMs: Date.now() - startTime
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error(getErrorMessage(error)),
      attempts: attempts + 1,
      totalTimeMs: Date.now() - startTime
    }
  }
}

/**
 * Calculates exponential backoff delay with optional jitter.
 *
 * @param attempt - Current attempt number (1-based)
 * @param baseDelayMs - Base delay in milliseconds
 * @param multiplier - Backoff multiplier
 * @param jitterFactor - Jitter factor (0-1)
 * @returns Calculated delay in milliseconds
 *
 * @example
 * calculateBackoffDelay(1, 500, 2, 0.1) // ~500ms
 * calculateBackoffDelay(2, 500, 2, 0.1) // ~1000ms
 * calculateBackoffDelay(3, 500, 2, 0.1) // ~2000ms
 */
export function calculateBackoffDelay(
  attempt: number,
  baseDelayMs: number,
  multiplier: number,
  jitterFactor: number
): number {
  // Exponential backoff: baseDelay * multiplier^(attempt-1)
  const exponentialDelay = baseDelayMs * Math.pow(multiplier, attempt - 1)

  // Add jitter: random value between -jitter and +jitter
  const jitter = exponentialDelay * jitterFactor * (Math.random() * 2 - 1)

  return Math.max(0, Math.round(exponentialDelay + jitter))
}

/**
 * Calculates linear backoff delay.
 *
 * @param attempt - Current attempt number (1-based)
 * @param baseDelayMs - Base delay in milliseconds
 * @returns Calculated delay in milliseconds
 *
 * @example
 * calculateLinearDelay(1, 500) // 500ms
 * calculateLinearDelay(2, 500) // 1000ms
 * calculateLinearDelay(3, 500) // 1500ms
 */
export function calculateLinearDelay(attempt: number, baseDelayMs: number): number {
  return baseDelayMs * attempt
}

/**
 * Processes items in batches with delays between batches.
 * Useful for preventing connection pool exhaustion.
 *
 * @param items - Items to process
 * @param batchSize - Number of items per batch
 * @param processor - Function to process each item
 * @param options - Batch processing options
 * @returns Array of results
 *
 * @example
 * const results = await processInBatches(
 *   urls,
 *   10,
 *   async (url) => fetch(url),
 *   { operationName: 'fetch URLs', delayBetweenBatchesMs: 100 }
 * )
 */
export async function processInBatches<T, R>(
  items: T[],
  batchSize: number,
  processor: (item: T, index: number) => Promise<R>,
  options: {
    operationName?: string
    delayBetweenBatchesMs?: number
    concurrentInBatch?: boolean
  } = {}
): Promise<R[]> {
  const {
    operationName = 'batch processing',
    delayBetweenBatchesMs = 100,
    concurrentInBatch = false
  } = options

  const results: R[] = []

  for (let i = 0; i < items.length; i += batchSize) {
    const batchEnd = Math.min(i + batchSize, items.length)
    const batchNum = Math.floor(i / batchSize) + 1
    const totalBatches = Math.ceil(items.length / batchSize)

    console.log(`[Batch] Processing ${operationName} batch ${batchNum}/${totalBatches}`)

    const batchItems = items.slice(i, batchEnd)

    if (concurrentInBatch) {
      // Process batch items concurrently
      const batchResults = await Promise.all(
        batchItems.map((item, idx) => processor(item, i + idx))
      )
      results.push(...batchResults)
    } else {
      // Process batch items sequentially (safer for connection pools)
      for (let j = 0; j < batchItems.length; j++) {
        const result = await processor(batchItems[j], i + j)
        results.push(result)
      }
    }

    // Delay between batches to allow connection pool recovery
    if (batchEnd < items.length && delayBetweenBatchesMs > 0) {
      await sleep(delayBetweenBatchesMs)
    }
  }

  return results
}

/**
 * Wraps an operation with a timeout.
 *
 * @param operation - Async operation to execute
 * @param timeoutMs - Timeout in milliseconds
 * @param operationName - Name for error messages
 * @returns Promise that rejects if timeout is exceeded
 *
 * @example
 * const result = await withTimeout(fetchData(), 5000, 'fetch')
 */
export async function withTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  operationName: string = 'operation'
): Promise<T> {
  let timeoutId: NodeJS.Timeout | undefined

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${operationName} timed out after ${timeoutMs}ms`))
    }, timeoutMs)
  })

  try {
    const result = await Promise.race([operation, timeoutPromise])
    return result
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
  }
}

/**
 * Creates a promise that resolves after a delay.
 *
 * @param ms - Delay in milliseconds
 * @returns Promise that resolves after delay
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
