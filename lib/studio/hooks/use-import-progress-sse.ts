'use client'

/**
 * useImportProgressSSE Hook
 *
 * Server-Sent Events (SSE) based hook for real-time import progress updates.
 * Much more efficient than polling - only receives data when it changes.
 *
 * Features:
 * - Establishes SSE connection for instant progress updates
 * - Implements exponential backoff reconnection (max 100 attempts for long imports)
 * - Cleans up connection on unmount or jobId change
 * - Falls back gracefully when EventSource unavailable
 *
 * @see PRD: docs/prd-sse-real-time-upgrade.md Task 1.2
 * @module use-import-progress-sse
 */

import * as React from 'react'
import type { ImportStage } from '@/lib/studio/import/types/progress.types'
import { sseMetrics } from '@/lib/studio/utils/sse-metrics'

// Re-export the type from the polling hook to ensure type compatibility
export type { ImportProgressState } from './use-import-progress-state'
import type { ImportProgressState } from './use-import-progress-state'

const DEFAULT_STATE: ImportProgressState = {
  hasActiveImport: false,
  jobId: null,
  stage: 'queued',
  progress: 0,
  stageProgress: 0,
  message: '',
  description: undefined,
  processedCount: 0,
  totalCount: 0,
  currentUrl: null,
  startedAt: null,
  estimatedTimeRemaining: null,
  status: 'pending',
  queuePosition: null,
  estimatedStartSeconds: null,
  skippedPages: [],
  errorCount: 0,
  rawMessage: null,
  isGreenfield: false,
}

interface SSEProgressData {
  jobId: string
  status: string
  progress: number
  stage: string
  processedCount: number
  totalCount: number
  currentUrl: string | null
  error: string | null
  timestamp: string
}

/**
 * Hook that uses Server-Sent Events for real-time import progress.
 * Much more efficient than polling - only receives data when it changes.
 *
 * @param jobId - The import job ID to track
 * @param enabled - Whether SSE connection should be active
 */
export function useImportProgressSSE(
  jobId: string | null | undefined,
  enabled: boolean = true
): ImportProgressState {
  const [state, setState] = React.useState<ImportProgressState>(DEFAULT_STATE)
  const eventSourceRef = React.useRef<EventSource | null>(null)
  const reconnectTimeoutRef = React.useRef<NodeJS.Timeout | null>(null)
  const reconnectAttemptsRef = React.useRef(0)
  const maxProgressRef = React.useRef(0)

  React.useEffect(() => {
    if (!jobId || !enabled) {
      setState(DEFAULT_STATE)
      maxProgressRef.current = 0
      return
    }

    // Check if EventSource is supported (99%+ browsers)
    if (!isSSESupported()) {
      console.warn('[useImportProgressSSE] EventSource not supported, falling back to polling')
      return
    }

    const connect = () => {
      // Close existing connection
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }

      const url = `/api/studio/import/jobs/${encodeURIComponent(jobId)}/stream`
      const eventSource = new EventSource(url)
      eventSourceRef.current = eventSource

      eventSource.onopen = () => {
        if (process.env.NODE_ENV === 'development') {
          console.log('[SSE] Connected to import progress stream')
        }
        reconnectAttemptsRef.current = 0
        sseMetrics.recordConnection()
      }

      eventSource.onmessage = (event) => {
        try {
          const data: SSEProgressData = JSON.parse(event.data)
          sseMetrics.recordMessage()

          // Normalize status to uppercase for comparison (database stores lowercase)
          const normalizedStatus = data.status?.toUpperCase() ?? ''
          const isActive = normalizedStatus === 'PENDING' ||
                          normalizedStatus === 'QUEUED' ||
                          normalizedStatus === 'PROCESSING'

          // MONOTONIC PROGRESS ENFORCEMENT: Progress must never decrease
          const enforcedProgress = isActive
            ? Math.max(maxProgressRef.current, data.progress)
            : data.progress

          if (isActive) {
            maxProgressRef.current = enforcedProgress
          } else {
            // Reset when job completes
            maxProgressRef.current = 0
          }

          setState({
            hasActiveImport: isActive,
            jobId: data.jobId,
            stage: mapStage(data.stage),
            progress: enforcedProgress,
            stageProgress: enforcedProgress, // Can be refined per-stage
            message: getProgressMessage(data),
            description: data.currentUrl ?? undefined,
            processedCount: data.processedCount,
            totalCount: data.totalCount,
            currentUrl: data.currentUrl,
            startedAt: data.timestamp ? new Date(data.timestamp) : null,
            estimatedTimeRemaining: null, // Can calculate based on rate
            status: mapStatus(data.status),
            queuePosition: null,
            estimatedStartSeconds: null,
            skippedPages: [],
            errorCount: data.error ? 1 : 0,
            rawMessage: null,
          })
        } catch (error) {
          console.error('[SSE] Error parsing message:', error)
          sseMetrics.recordError()
        }
      }

      eventSource.onerror = () => {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[SSE] Connection error, attempting reconnection')
        }
        sseMetrics.recordError()
        eventSource.close()
        eventSourceRef.current = null

        // Exponential backoff for reconnection
        // High maxAttempts to support long imports (10+ minutes)
        // After ~5 attempts, delay caps at 30s, so 100 attempts covers ~50 minutes
        const maxAttempts = 100
        if (reconnectAttemptsRef.current < maxAttempts) {
          // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s (cap), 30s, ...
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000)
          reconnectAttemptsRef.current++
          sseMetrics.recordReconnection()
          if (process.env.NODE_ENV === 'development') {
            console.log(`[SSE] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current})`)
          }
          reconnectTimeoutRef.current = setTimeout(connect, delay)
        } else {
          console.error('[SSE] Max reconnection attempts reached')
        }
      }
    }

    connect()

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
      }
    }
  }, [jobId, enabled])

  return state
}

function mapStage(stage: string): ImportStage {
  const stageMap: Record<string, ImportStage> = {
    'queued': 'queued',
    'initializing': 'initializing',
    'sitemap_discovery': 'sitemap_discovery',
    'crawling': 'sitemap_discovery',
    'analyzing': 'page_processing',
    'page_processing': 'page_processing',
    'component_detection': 'component_detection',
    'design_extraction': 'design_extraction',
    'media_ingest': 'media_ingest',
    'template_generation': 'template_generation',
    'generating': 'template_generation',
    'finalizing': 'finalizing',
    'completed': 'completed',
    'failed': 'failed',
  }
  return stageMap[stage] ?? 'page_processing'
}

function mapStatus(status: string): ImportProgressState['status'] {
  // Normalize to uppercase for comparison (database stores lowercase)
  const normalized = status?.toUpperCase() ?? ''
  const statusMap: Record<string, ImportProgressState['status']> = {
    'PENDING': 'pending',
    'QUEUED': 'pending',
    'PROCESSING': 'running',
    'COMPLETED': 'completed',
    'FAILED': 'failed',
    'CANCELLED': 'failed',
  }
  return statusMap[normalized] ?? 'running'
}

function getProgressMessage(data: SSEProgressData): string {
  // Normalize status to uppercase for comparison
  const normalizedStatus = data.status?.toUpperCase() ?? ''
  if (data.error) return `Error: ${data.error}`
  if (normalizedStatus === 'COMPLETED') return 'Import completed successfully'
  if (normalizedStatus === 'FAILED') return 'Import failed'
  if (data.totalCount > 0) {
    return `Processing page ${data.processedCount} of ${data.totalCount}`
  }
  return `${data.stage}...`
}

/**
 * Feature detection for SSE support.
 * Returns true if browser supports EventSource.
 */
export function isSSESupported(): boolean {
  return typeof EventSource !== 'undefined'
}
