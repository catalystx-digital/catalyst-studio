/**
 * Error Classification Utilities
 *
 * Unified error taxonomy for import operations.
 * Consolidates duplicate implementations from:
 * - import-pipeline.ts (classifyError)
 * - services/import-orchestrator.ts (isConnectionError)
 * - services/orchestrator/shared-component-manager.ts (inline isConnectionError)
 *
 * @module error-classification
 */

/**
 * Error classification categories.
 */
export type ErrorClass = 'timeout' | 'connection' | 'rate_limit' | 'auth' | 'validation' | 'fatal' | 'transient'

/**
 * Detailed error classification result.
 */
export interface ErrorClassification {
  /** Primary error classification */
  class: ErrorClass

  /** Whether the error is retryable */
  retryable: boolean

  /** Human-readable description */
  description: string

  /** Original error message */
  originalMessage: string

  /** Prisma error code if applicable */
  prismaCode?: string
}

/**
 * Error message patterns for classification.
 */
const ERROR_PATTERNS = {
  timeout: [
    'timeout',
    'etimedout',
    'timed out',
    'request timed out',
    'deadline exceeded'
  ],

  connection: [
    'connectionreset',
    'connection reset',
    'econnreset',
    'econnrefused',
    'connection refused',
    'forcibly closed',
    'socket hang up',
    'network error',
    'fetch failed',
    'enotfound',
    'connection closed'
  ],

  rateLimit: [
    'rate limit',
    'rate-limit',
    'ratelimit',
    'too many requests',
    '429',
    'quota exceeded',
    'throttled'
  ],

  auth: [
    'invalid api key',
    'api key is required',
    'unauthorized',
    'authentication failed',
    'invalid credentials',
    '401',
    '403 forbidden'
  ],

  validation: [
    'validation error',
    'invalid input',
    'bad request',
    '400',
    'schema validation'
  ],

  prismaConnection: [
    'p2024', // Timeout acquiring connection from pool
    'p2034'  // Transaction failed due to write conflict
  ]
} as const

/**
 * Classifies an error based on its message and properties.
 *
 * @param error - Error to classify
 * @returns Classification result with retryability info
 *
 * @example
 * const result = classifyError(new Error('Connection timeout'))
 * // { class: 'timeout', retryable: true, ... }
 */
export function classifyError(error: unknown): ErrorClassification {
  const message = getErrorMessage(error).toLowerCase()
  const prismaCode = getPrismaCode(error)

  // Check Prisma-specific errors first
  if (prismaCode) {
    const lowerCode = prismaCode.toLowerCase()
    if (ERROR_PATTERNS.prismaConnection.some(p => lowerCode.includes(p))) {
      return {
        class: 'connection',
        retryable: true,
        description: 'Database connection error (Prisma)',
        originalMessage: getErrorMessage(error),
        prismaCode
      }
    }
  }

  // Check timeout patterns
  if (ERROR_PATTERNS.timeout.some(pattern => message.includes(pattern))) {
    return {
      class: 'timeout',
      retryable: true,
      description: 'Request timed out',
      originalMessage: getErrorMessage(error)
    }
  }

  // Check auth patterns (fatal, not retryable)
  if (ERROR_PATTERNS.auth.some(pattern => message.includes(pattern))) {
    return {
      class: 'auth',
      retryable: false,
      description: 'Authentication failed',
      originalMessage: getErrorMessage(error)
    }
  }

  // Check rate limit patterns
  if (ERROR_PATTERNS.rateLimit.some(pattern => message.includes(pattern))) {
    return {
      class: 'rate_limit',
      retryable: true,
      description: 'Rate limit exceeded',
      originalMessage: getErrorMessage(error)
    }
  }

  // Check connection patterns
  if (ERROR_PATTERNS.connection.some(pattern => message.includes(pattern))) {
    return {
      class: 'connection',
      retryable: true,
      description: 'Connection error',
      originalMessage: getErrorMessage(error)
    }
  }

  // Check validation patterns (not retryable)
  if (ERROR_PATTERNS.validation.some(pattern => message.includes(pattern))) {
    return {
      class: 'validation',
      retryable: false,
      description: 'Validation error',
      originalMessage: getErrorMessage(error)
    }
  }

  // Default to transient (retryable)
  return {
    class: 'transient',
    retryable: true,
    description: 'Transient error',
    originalMessage: getErrorMessage(error)
  }
}

/**
 * Quick check if an error is retryable.
 *
 * @param error - Error to check
 * @returns True if the error is retryable
 *
 * @example
 * if (isRetryable(error)) {
 *   await retry(operation)
 * }
 */
export function isRetryable(error: unknown): boolean {
  return classifyError(error).retryable
}

/**
 * Quick check if an error is a connection error.
 *
 * @param error - Error to check
 * @returns True if the error is connection-related
 *
 * @example
 * if (isConnectionError(error)) {
 *   await waitAndRetry(operation)
 * }
 */
export function isConnectionError(error: unknown): boolean {
  const classification = classifyError(error)
  return classification.class === 'connection' || classification.class === 'timeout'
}

/**
 * Quick check if an error is fatal (not retryable).
 *
 * @param error - Error to check
 * @returns True if the error is fatal
 *
 * @example
 * if (isFatal(error)) {
 *   throw error
 * }
 */
export function isFatal(error: unknown): boolean {
  const classification = classifyError(error)
  return classification.class === 'auth' || classification.class === 'validation'
}

/**
 * Quick check if an error is a timeout.
 *
 * @param error - Error to check
 * @returns True if the error is a timeout
 */
export function isTimeout(error: unknown): boolean {
  return classifyError(error).class === 'timeout'
}

/**
 * Quick check if an error is a rate limit.
 *
 * @param error - Error to check
 * @returns True if the error is a rate limit
 */
export function isRateLimit(error: unknown): boolean {
  return classifyError(error).class === 'rate_limit'
}

/**
 * Extracts error message from any error type.
 *
 * @param error - Error to extract message from
 * @returns Error message string
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === 'string') {
    return error
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message)
  }
  return String(error)
}

/**
 * Extracts Prisma error code if present.
 *
 * @param error - Error to check
 * @returns Prisma error code or undefined
 */
function getPrismaCode(error: unknown): string | undefined {
  if (error && typeof error === 'object' && 'code' in error) {
    return String((error as { code: unknown }).code)
  }
  return undefined
}

/**
 * Creates a detailed error log entry.
 *
 * @param error - Error to log
 * @param context - Additional context
 * @returns Structured log entry
 */
export function createErrorLogEntry(
  error: unknown,
  context?: Record<string, unknown>
): Record<string, unknown> {
  const classification = classifyError(error)

  return {
    errorClass: classification.class,
    retryable: classification.retryable,
    message: classification.originalMessage,
    description: classification.description,
    prismaCode: classification.prismaCode,
    stack: error instanceof Error ? error.stack : undefined,
    ...context
  }
}
