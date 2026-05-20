/**
 * Processing Utilities
 *
 * Chunk processing and memory management utilities for import orchestration.
 *
 * @module processing-utils
 */

import { traceMemory } from '../../utils/memory-trace'
import { isConnectionError } from '../../utils/error-classification'
import type { PrismaClient } from '@/lib/generated/prisma'
import type { ProgressCallback } from '../../types/progress.types'

export interface ChunkProcessorOptions<R> {
  collectResults?: boolean
  concurrency?: number
  onChunk?: (result: R, chunk: any[], chunkIndex: number) => void | Promise<void>
  /** Progress callback for reporting chunk processing progress */
  onProgress?: ProgressCallback
}

/**
 * Processes data in chunks with concurrency control.
 */
export async function processInChunks<T, R>(
  data: T[],
  chunkSize: number,
  processor: (chunk: T[], chunkIndex: number) => Promise<R>,
  operationName: string,
  options: ChunkProcessorOptions<R> = {},
  config: {
    chunkConcurrency: number
    memoryLimitMB: number
    checkMemory: (stage: string) => void
    forceGC: (reason: string) => void
  }
): Promise<R[]> {
  const totalItems = data.length
  if (totalItems === 0) {
    return []
  }

  const collectResults = options.collectResults !== false
  const maxConcurrency = Math.max(1, options.concurrency ?? config.chunkConcurrency)
  const chunksTotal = Math.ceil(totalItems / Math.max(1, chunkSize))
  const results: R[] = []

  let nextIndex = 0
  let fatalError: Error | null = null

  const getNextChunk = (): { chunk: T[]; index: number } | null => {
    if (fatalError) return null
    if (nextIndex >= totalItems) {
      return null
    }
    const start = nextIndex
    const end = Math.min(start + chunkSize, totalItems)
    nextIndex = end
    const index = Math.floor(start / chunkSize)
    const useFullReference = start === 0 && end === totalItems
    const chunk = useFullReference ? data : data.slice(start, end)
    return { chunk, index }
  }

  // Track completed chunks for progress reporting
  let completedChunks = 0

  const worker = async () => {
    while (true) {
      if (fatalError) {
        return
      }

      const next = getNextChunk()
      if (!next) {
        return
      }
      const { chunk, index } = next
      console.log(`Processing ${operationName} chunk ${index + 1}/${chunksTotal} (${chunk.length} items)`)

      // Report progress for this chunk
      options.onProgress?.({
        stageProgress: Math.round((completedChunks / chunksTotal) * 100),
        processedCount: completedChunks * chunkSize,
        totalCount: totalItems,
        message: `Processing ${operationName} chunk ${index + 1}/${chunksTotal}`,
      })

      traceMemory(`${operationName}:chunk:start`, { chunk: index + 1, size: chunk.length })
      config.checkMemory(`before ${operationName} chunk ${index + 1}`)

      try {
        const result = await processor(chunk, index)
        if (collectResults) {
          results.push(result)
        }
        if (options.onChunk) {
          await options.onChunk(result, chunk, index)
        }
      } catch (error) {
        fatalError = error as Error
        console.error(`Error processing ${operationName} chunk ${index + 1}:`, error)
      } finally {
        if (chunk !== data) {
          chunk.length = 0
        }
        config.forceGC(`after ${operationName} chunk ${index + 1}`)
        traceMemory(`${operationName}:chunk:complete`, { chunk: index + 1 })
        completedChunks++
        await new Promise((resolve) => setTimeout(resolve, 5))
      }

      if (fatalError) {
        return
      }
    }
  }

  const workers = Array.from({ length: Math.min(maxConcurrency, chunksTotal) }, () => worker())
  await Promise.all(workers)

  if (fatalError) {
    throw fatalError
  }

  return results
}

/**
 * Checks memory usage and triggers GC if needed.
 */
export function checkMemoryUsage(
  stage: string,
  memoryLimitMB: number,
  forceGC: (reason: string) => void
): void {
  const snapshot = traceMemory(`memory:${stage}`)
  if (!snapshot) {
    return
  }

  if (snapshot.heapUsedMB > memoryLimitMB) {
    console.warn(`Memory usage (${snapshot.heapUsedMB}MB) exceeds limit (${memoryLimitMB}MB) at ${stage}`)

    forceGC(`high memory usage at ${stage}`)

    const postGC = traceMemory(`memory:${stage}:post-gc`)
    const postHeap = postGC?.heapUsedMB ?? snapshot.heapUsedMB
    if (postHeap > memoryLimitMB) {
      throw new Error(`Memory usage (${postHeap}MB) still exceeds limit (${memoryLimitMB}MB) after garbage collection at ${stage}`)
    }
  }
}

/**
 * Forces garbage collection if available.
 */
export function forceGarbageCollection(reason: string): void {
  if (typeof global !== 'undefined' && (global as any).gc) {
    console.log(`Forcing garbage collection: ${reason}`)
    ;(global as any).gc()
  } else {
    console.log(`Garbage collection hint: ${reason} (gc not exposed)`)
    if (typeof process !== 'undefined' && typeof process.nextTick === 'function') {
      process.nextTick(() => {})
    }
  }
}

/**
 * Handles import errors and determines if retry is possible.
 */
export async function handleImportError(
  error: Error,
  retryCount: number,
  maxRetries: number
): Promise<boolean> {
  const recoverableErrors = ['NetworkError', 'TimeoutError', 'RateLimitError']
  const isRecoverable = recoverableErrors.some(type =>
    error.name === type || error.message.includes(type) || error.message.toLowerCase().includes(type.toLowerCase())
  )

  if (!isRecoverable || retryCount >= maxRetries) {
    return false
  }

  const delay = Math.pow(2, retryCount) * 1000
  await new Promise(resolve => setTimeout(resolve, delay))

  return true
}

export interface TransactionResult<T> {
  success: boolean
  data?: T
  error?: Error
  rollbackPerformed?: boolean
}

/**
 * Executes operations in a database transaction with retry logic.
 *
 * IMPORTANT: Prisma Accelerate has a HARD 15-second (15000ms) limit on interactive
 * transactions. The timeout parameter MUST NOT exceed 15000ms or Accelerate will
 * reject the parameter value with P6005 error BEFORE execution even starts.
 *
 * @see https://www.prisma.io/docs/accelerate/limitations#interactive-transactions
 */
export async function executeInTransaction<T>(
  prisma: PrismaClient,
  operations: () => Promise<T>,
  options: {
    timeout?: number
    maxRetries?: number
  } = {}
): Promise<TransactionResult<T>> {
  const MAX_RETRIES = options.maxRetries ?? 2
  // Prisma Accelerate hard limit: 15000ms max for interactive transactions
  // Any value > 15000ms is REJECTED as an invalid parameter (P6005)
  const PRISMA_ACCELERATE_MAX_TIMEOUT = 15000
  const requestedTimeout = options.timeout || 15000
  const BASE_TIMEOUT = Math.min(requestedTimeout, PRISMA_ACCELERATE_MAX_TIMEOUT)
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`[Transaction] Starting transaction (attempt ${attempt}/${MAX_RETRIES})`)

      const result = await prisma.$transaction(
        async () => {
          return await operations()
        },
        {
          timeout: BASE_TIMEOUT,
          maxWait: 30000, // 30 seconds to acquire connection
          isolationLevel: 'ReadCommitted'
        }
      )

      console.log(`[Transaction] Transaction completed successfully`)
      return {
        success: true,
        data: result
      }
    } catch (error) {
      lastError = error as Error
      const connectionError = isConnectionError(error)

      console.error(`[Transaction] Transaction failed (attempt ${attempt}/${MAX_RETRIES})`, {
        error: lastError.message,
        isConnectionError: connectionError,
        code: (error as any)?.code
      })

      if (!connectionError || attempt === MAX_RETRIES) {
        break
      }

      const delayMs = 2000 * attempt // 2s, 4s
      console.warn(`[Transaction] Retrying transaction in ${delayMs}ms...`)
      await new Promise(resolve => setTimeout(resolve, delayMs))
    }
  }

  return {
    success: false,
    error: lastError as Error,
    rollbackPerformed: true
  }
}
