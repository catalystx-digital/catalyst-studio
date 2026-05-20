'use client'

/**
 * useImportProgressState Hook
 *
 * Extracts and manages import progress state from AI context messages.
 * Provides a clean interface for the ImportStatusCard component.
 *
 * Features:
 * - Finds the latest import-progress message in context
 * - Parses metadata into typed progress state
 * - Provides reactive updates when context changes
 * - Handles multiple concurrent imports by jobId
 *
 * @deprecated The polling-based hooks in this module are deprecated.
 * Use the SSE-based hooks from `@/lib/studio/hooks/sse-hooks` instead:
 * - `useImportProgressSSE` - Direct SSE connection
 * - `useImportProgressHybrid` - SSE with polling fallback
 * - `useImportProgressWithSSE` - Drop-in replacement for useImportProgressWithPolling
 *
 * The polling hooks are kept for fallback support in browsers without EventSource.
 *
 * @see PRD: docs/prd-sse-real-time-upgrade.md
 * @module use-import-progress-state
 */

import * as React from 'react'
import type { AIMessage } from '@/types/ai-context'
import type { ImportStage } from '@/lib/studio/import/types/progress.types'

export interface ImportProgressState {
  /** Whether there's an active import */
  hasActiveImport: boolean

  /** The job ID of the active import */
  jobId: string | null

  /** Current stage */
  stage: ImportStage

  /** Overall progress (0-100) */
  progress: number

  /** Progress within current stage (0-100) */
  stageProgress: number

  /** Human-readable message */
  message: string

  /** Additional description */
  description?: string

  /** Pages processed */
  processedCount: number

  /** Total pages to process */
  totalCount: number

  /** Current URL being processed */
  currentUrl: string | null

  /** When the import started */
  startedAt: Date | null

  /** Estimated seconds remaining */
  estimatedTimeRemaining: number | null

  /** Current status */
  status: 'pending' | 'running' | 'completed' | 'failed'

  /** Queue position (if waiting) */
  queuePosition: number | null

  /** Estimated seconds until start (if queued) */
  estimatedStartSeconds: number | null

  /** Skipped pages with reasons */
  skippedPages: Array<{ url: string; reason: string }>

  /** Number of errors */
  errorCount: number

  /** The raw message for reference */
  rawMessage: AIMessage | null

  /** Whether this is a greenfield (AI-created) job vs import job */
  isGreenfield?: boolean
}

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

/**
 * Find the latest import progress message from a list of AI messages.
 * CRITICAL: Must find the message with stable ID pattern `import-progress-{jobId}`
 * to ensure the same message is tracked throughout import lifecycle (Issue #2 fix).
 */
function findProgressMessage(messages: AIMessage[]): AIMessage | null {
  // Search from the end to find the most recent progress message
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]
    const metadata = msg.metadata as Record<string, unknown> | undefined

    // Check for import-progress type and that it's a progress event message
    // The message ID should match pattern: import-progress-{jobId}
    if (
      metadata?.type === 'import-progress' &&
      (metadata?.isProgressEvent === true || (msg.id && msg.id.startsWith('import-progress-')))
    ) {
      return msg
    }
  }
  return null
}

/**
 * Parse an AI message into ImportProgressState.
 */
function parseProgressMessage(message: AIMessage): ImportProgressState {
  const metadata = message.metadata as Record<string, unknown>

  // Determine if the import is still active
  const status = (metadata.status as string) ?? 'running'
  const isActive = status === 'pending' || status === 'running'

  return {
    hasActiveImport: isActive,
    jobId: (metadata.jobId as string) ?? null,
    stage: (metadata.stage as ImportStage) ?? 'page_processing',
    progress: typeof metadata.progress === 'number' ? metadata.progress : 0,
    stageProgress: typeof metadata.stageProgress === 'number' ? metadata.stageProgress : 0,
    message: (metadata.message as string) ?? message.content,
    description: metadata.description as string | undefined,
    processedCount: typeof metadata.processedCount === 'number' ? metadata.processedCount : 0,
    totalCount: typeof metadata.totalCount === 'number' ? metadata.totalCount : 0,
    currentUrl: (metadata.currentUrl as string | null) ?? null,
    startedAt: metadata.startedAt ? new Date(metadata.startedAt as string) : null,
    estimatedTimeRemaining:
      typeof metadata.estimatedTimeRemaining === 'number'
        ? metadata.estimatedTimeRemaining
        : null,
    status: status as ImportProgressState['status'],
    queuePosition:
      typeof metadata.queuePosition === 'number' ? metadata.queuePosition : null,
    estimatedStartSeconds:
      typeof metadata.estimatedStartSeconds === 'number'
        ? metadata.estimatedStartSeconds
        : null,
    skippedPages: Array.isArray(metadata.skippedSummary)
      ? (metadata.skippedSummary as Array<{ url: string; reason: string }>)
      : [],
    errorCount: typeof metadata.errorCount === 'number' ? metadata.errorCount : 0,
    rawMessage: message,
  }
}

/**
 * Hook to extract import progress state from AI context messages.
 *
 * @param messages - Array of AI context messages
 * @returns Import progress state
 */
export function useImportProgressState(messages: AIMessage[]): ImportProgressState {
  return React.useMemo(() => {
    const progressMessage = findProgressMessage(messages)

    if (!progressMessage) {
      return DEFAULT_STATE
    }

    return parseProgressMessage(progressMessage)
  }, [messages])
}

/**
 * Hook to filter out progress messages from display.
 * Returns messages without import-progress events (for cleaner UI).
 */
export function useFilteredMessages(messages: AIMessage[]): AIMessage[] {
  return React.useMemo(() => {
    return messages.filter((msg) => {
      const metadata = msg.metadata as Record<string, unknown> | undefined
      // Filter out progress event messages - they'll be shown in the status card
      return metadata?.type !== 'import-progress' || !metadata?.isProgressEvent
    })
  }, [messages])
}

/**
 * Hook to get both progress state and filtered messages.
 * Convenience wrapper around the two hooks above.
 */
export function useImportProgress(messages: AIMessage[]): {
  progressState: ImportProgressState
  filteredMessages: AIMessage[]
} {
  const progressState = useImportProgressState(messages)
  const filteredMessages = useFilteredMessages(messages)

  return { progressState, filteredMessages }
}

// Polling intervals optimized to reduce Prisma Accelerate query usage
// See PRD prd-prisma-query-optimization.md for context
const ACTIVE_IMPORT_POLL_MS = 5_000     // 5 seconds when import is running
const IDLE_CHECK_POLL_MS = 120_000      // 2 minutes when no active import
const STOP_POLLING_AFTER_MS = 300_000   // Stop polling after 5 minutes of no activity

/**
 * Hook that polls the AI context API for import progress updates.
 * Use this when you need real-time progress updates during an import.
 *
 * OPTIMIZED: Uses adaptive polling intervals to reduce database queries:
 * - 5 seconds when import is active (was 1.5s)
 * - 2 minutes when idle (was 1.5s)
 * - Stops entirely after 5 minutes of inactivity
 *
 * @deprecated Use `useImportProgressSSE` or `useImportProgressHybrid` instead.
 * SSE provides instant updates with 90% fewer database queries.
 * This polling-based hook is kept for fallback support only.
 *
 * @see PRD: docs/prd-sse-real-time-upgrade.md
 *
 * @param websiteId - The website ID to poll progress for
 * @param sessionId - The session ID (from getBuilderAssistantSessionId)
 * @param enabled - Whether polling is enabled (default: true)
 */
export function usePolledImportProgress(
  websiteId: string | null | undefined,
  sessionId: string | null | undefined,
  enabled: boolean = true
): ImportProgressState {
  const [state, setState] = React.useState<ImportProgressState>(DEFAULT_STATE)
  const isFetchingRef = React.useRef(false)
  // CRITICAL: Track max progress seen per jobId to enforce monotonic progress (no decreases)
  const maxProgressByJobRef = React.useRef<Map<string, number>>(new Map())

  // Track activity for adaptive polling
  const lastActivityRef = React.useRef<number>(Date.now())
  const [isPollingActive, setIsPollingActive] = React.useState(true)

  // Resume polling on user activity
  React.useEffect(() => {
    const updateActivity = () => {
      lastActivityRef.current = Date.now()
      if (!isPollingActive) {
        setIsPollingActive(true)
        console.log('[usePolledImportProgress] Resuming polling due to user activity')
      }
    }

    window.addEventListener('focus', updateActivity)
    window.addEventListener('mousemove', updateActivity)
    window.addEventListener('keydown', updateActivity)

    return () => {
      window.removeEventListener('focus', updateActivity)
      window.removeEventListener('mousemove', updateActivity)
      window.removeEventListener('keydown', updateActivity)
    }
  }, [isPollingActive])

  React.useEffect(() => {
    if (!websiteId || !sessionId || !enabled || !isPollingActive) {
      return
    }

    let isMounted = true
    let timeoutId: NodeJS.Timeout | null = null

    const fetchProgress = async () => {
      // Prevent concurrent fetches
      if (isFetchingRef.current || !isMounted) {
        return
      }
      isFetchingRef.current = true

      let hasActiveImport = false

      try {
        const response = await fetch(
          `/api/ai-context/${encodeURIComponent(sessionId)}?websiteId=${encodeURIComponent(websiteId)}`
        )

        if (!response.ok) {
          // Context might not exist yet, that's okay
          if (response.status === 404) {
            // Schedule next poll at idle interval
            scheduleNext(false)
            return
          }
          console.warn('[usePolledImportProgress] Failed to fetch context:', response.status)
          scheduleNext(false)
          return
        }

        const json = await response.json()
        const messages: AIMessage[] = json.data?.messages ?? []

        if (!isMounted) return

        const progressMessage = findProgressMessage(messages)
        if (progressMessage) {
          const newState = parseProgressMessage(progressMessage)
          hasActiveImport = newState.hasActiveImport

          // MONOTONIC PROGRESS ENFORCEMENT: Progress must never decrease for the same job
          // This prevents jarring UX where progress jumps backwards (e.g., 80% → 40%)
          const jobId = newState.jobId ?? 'default'
          const currentMax = maxProgressByJobRef.current.get(jobId) ?? 0

          // Only update max if we're still on an active import
          if (newState.hasActiveImport) {
            const enforcedProgress = Math.max(currentMax, newState.progress)
            maxProgressByJobRef.current.set(jobId, enforcedProgress)

            // Apply monotonic enforcement to the state
            setState({
              ...newState,
              progress: enforcedProgress,
            })
          } else {
            // Import completed/failed - reset max progress for this job
            maxProgressByJobRef.current.delete(jobId)
            setState(newState)
          }
        } else {
          // No progress message found, reset to default
          setState(DEFAULT_STATE)
        }
      } catch (error) {
        console.warn('[usePolledImportProgress] Error fetching progress:', error)
      } finally {
        isFetchingRef.current = false
        // Schedule next poll with adaptive interval
        if (isMounted) {
          scheduleNext(hasActiveImport)
        }
      }
    }

    const scheduleNext = (hasActiveImport: boolean) => {
      if (!isMounted) return

      // Check if user has been inactive too long
      const idleTime = Date.now() - lastActivityRef.current
      if (idleTime > STOP_POLLING_AFTER_MS && !hasActiveImport) {
        console.log('[usePolledImportProgress] Stopping polling due to inactivity')
        setIsPollingActive(false)
        return
      }

      // Use fast polling when import is active, slow when idle
      const interval = hasActiveImport ? ACTIVE_IMPORT_POLL_MS : IDLE_CHECK_POLL_MS
      timeoutId = setTimeout(fetchProgress, interval)
    }

    // Fetch immediately on mount
    fetchProgress()

    return () => {
      isMounted = false
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }, [websiteId, sessionId, enabled, isPollingActive])

  return state
}

/**
 * Combined hook that uses both local messages and polled server state.
 * The polled state is the primary source of truth for import progress.
 *
 * OPTIMIZED: Uses adaptive polling intervals (5s active, 2min idle, stops after 5min)
 * to reduce Prisma Accelerate query usage from ~115K/day to ~1K/day.
 *
 * @deprecated Use `useImportProgressWithSSE` from `@/lib/studio/hooks/use-import-progress-hybrid` instead.
 * The SSE-based hook provides instant updates with even fewer database queries.
 * This polling-based hook is kept for fallback support only.
 *
 * @see PRD: docs/prd-sse-real-time-upgrade.md
 */
export function useImportProgressWithPolling(
  messages: AIMessage[],
  websiteId: string | null | undefined,
  sessionId: string | null | undefined
): {
  progressState: ImportProgressState
  filteredMessages: AIMessage[]
} {
  // Poll the server for the latest progress state with adaptive intervals
  const polledState = usePolledImportProgress(
    websiteId,
    sessionId,
    true // Enable polling (uses adaptive intervals internally)
  )

  // The polled state is the authoritative source since it comes from the server
  // where the import service pushes updates
  const filteredMessages = useFilteredMessages(messages)

  return { progressState: polledState, filteredMessages }
}

export default useImportProgressState
