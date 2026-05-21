'use client'

/**
 * useImportProgressHybrid Hook
 *
 * Hybrid hook that reads import progress from real-time website activity.
 *
 * Decision flow:
 * Regular imports are hydrated by useWebsiteActivityStream into ImportTrackerStore.
 * Greenfield jobs are hydrated separately by useGreenfieldHydration.
 *
 * For greenfield jobs (bootstrap-* prefix):
 * - Reads progress from ImportTrackerStore (hydrated by useGreenfieldHydration)
 * - Does NOT poll AI context (greenfield progress is not stored in chat messages)
 * - This is the fix for BUG-CW-02: Assistant shows no progress without refresh
 *
 * @see PRD: docs/prd-sse-real-time-upgrade.md Task 1.3
 * @module use-import-progress-hybrid
 */

import * as React from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useImportTrackerStore, type ImportJobEntry, type ImportLifecycleState } from '@/lib/studio/stores/import-tracker-store'
import type { ImportStage } from '@/lib/studio/import/types/progress.types'
import type { AIMessage } from '@/types/ai-context'

export function isSSESupported(): boolean {
  return typeof EventSource !== 'undefined'
}

export interface ImportProgressState {
  hasActiveImport: boolean
  jobId: string | null
  stage: ImportStage
  progress: number
  stageProgress: number
  message: string
  description?: string
  processedCount: number
  totalCount: number
  currentUrl: string | null
  startedAt: Date | null
  estimatedTimeRemaining: number | null
  status: 'pending' | 'running' | 'completed' | 'failed' | 'partial_success' | 'cancelled' | 'recoverable_stuck' | 'unknown'
  queuePosition: number | null
  estimatedStartSeconds: number | null
  skippedPages: string[]
  errorCount: number
  rawMessage: AIMessage | null
  isGreenfield?: boolean
}

/**
 * Check if SSE is enabled via feature flag.
 * Set NEXT_PUBLIC_ENABLE_SSE_PROGRESS=false to disable SSE.
 */
/**
 * Check if a jobId is a greenfield/bootstrap job.
 * Greenfield jobs use a different progress system (polling via /api/studio/greenfield/activity)
 * and don't exist in the ImportJob table, so SSE would return 404.
 */
function isGreenfieldJob(jobId: string | null | undefined): boolean {
  return !!jobId && jobId.startsWith('bootstrap-')
}

const TRACKED_TERMINAL_STATUSES = new Set([
  'success',
  'partial_success',
  'completed',
  'completed_with_warnings',
  'failed',
  'cancelled',
  'recoverable_stuck',
  'unknown',
])

/**
 * Map ImportJobEntry status to ImportProgressState status
 */
function mapJobStatus(status: string, state: ImportLifecycleState): ImportProgressState['status'] {
  if (status === 'success' || status === 'completed') return 'completed'
  if (status === 'partial_success' || status === 'completed_with_warnings') return 'partial_success'
  if (status === 'recoverable_stuck') return 'recoverable_stuck'
  if (status === 'unknown') return 'unknown'
  if (status === 'cancelled') return 'cancelled'
  if (status === 'failed') return 'failed'
  if (state === 'completed') return 'completed'
  if (status === 'pending' || status === 'queued') return 'pending'
  return 'running'
}

/**
 * Map ImportJobEntry stage to ImportStage
 */
function mapJobStage(stage: string | undefined): ImportStage {
  const stageMap: Record<string, ImportStage> = {
    'queued': 'queued',
    'initializing': 'initializing',
    'fetching': 'sitemap_discovery',
    'crawling': 'sitemap_discovery',
    'analyzing': 'page_processing',
    'page_processing': 'page_processing',
    'component_detection': 'component_detection',
    'design_extraction': 'design_extraction',
    'media_ingest': 'media_ingest',
    'template_generation': 'template_generation',
    'generating': 'template_generation',
    'creating': 'finalizing',
    'finalizing': 'finalizing',
    'completed': 'completed',
    'failed': 'failed',
  }
  return stageMap[stage ?? ''] ?? 'page_processing'
}

/**
 * Convert ImportJobEntry from store to ImportProgressState
 * @param job - The job entry from the store
 * @param isGreenfieldJob - Whether this is a greenfield (AI-created) job
 */
function jobEntryToProgressState(job: ImportJobEntry | null, isGreenfieldJob: boolean = false): ImportProgressState {
  if (!job) {
    return {
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
      isGreenfield: isGreenfieldJob,
    }
  }

  const mappedStatus = mapJobStatus(job.status, job.state)
  const isActive = job.state === 'active' || job.state === 'queued'
  const progressSummary = job.metadata?.progressSummary as
    | {
        processedCount?: number
        totalCount?: number
        currentUrl?: string | null
      }
    | undefined

  return {
    hasActiveImport: isActive,
    jobId: job.id,
    stage: mapJobStage(job.stage),
    progress: job.progress,
    stageProgress: job.progress,
    message: job.message ?? '',
    description: job.stage ?? undefined,
    processedCount: progressSummary?.processedCount ?? 0,
    totalCount: progressSummary?.totalCount ?? 0,
    currentUrl: progressSummary?.currentUrl ?? null,
    startedAt: job.startedAt ? new Date(job.startedAt) : null,
    estimatedTimeRemaining: null,
    status: mappedStatus,
    queuePosition: job.queuePosition ?? null,
    estimatedStartSeconds: job.estimatedStartSeconds ?? null,
    skippedPages: [],
    errorCount: job.error ? 1 : 0,
    rawMessage: null,
    isGreenfield: isGreenfieldJob,
  }
}

function importRealtimeUnavailableState(jobId: string | null | undefined, reason: string): ImportProgressState {
  return {
    hasActiveImport: Boolean(jobId),
    jobId: jobId ?? null,
    stage: 'queued',
    progress: 0,
    stageProgress: 0,
    message: reason,
    description: reason,
    processedCount: 0,
    totalCount: 0,
    currentUrl: null,
    startedAt: null,
    estimatedTimeRemaining: null,
    status: 'unknown',
    queuePosition: null,
    estimatedStartSeconds: null,
    skippedPages: [],
    errorCount: 1,
    rawMessage: null,
    isGreenfield: false,
  }
}

/**
 * Hook that reads greenfield progress from ImportTrackerStore.
 * This is used for bootstrap-* jobs that are hydrated by useGreenfieldHydration.
 *
 * FIX for BUG-CW-03: Uses useShallow with a selector that extracts the specific job's
 * key values. This ensures Zustand detects changes properly using shallow equality
 * comparison instead of Object.is reference comparison. The previous approach selected
 * the entire jobs array, which with Immer could sometimes not trigger re-renders when
 * individual jobs were updated.
 *
 * @see https://github.com/pmndrs/zustand/issues/449 - Immer .push not triggering re-render
 * @see https://zustand.docs.pmnd.rs/guides/prevent-rerenders-with-use-shallow
 */
function useGreenfieldProgress(
  jobId: string | null | undefined,
  enabled: boolean = true
): ImportProgressState {
  // Use useShallow to compare object properties shallowly instead of by reference.
  // This ensures that when Immer updates a job in the store, we detect the change
  // even if the object reference changes (which it does with Immer).
  const jobData = useImportTrackerStore(
    useShallow((state) => {
      if (!enabled || !jobId) return null
      const job = state.jobs.find((j) => j.id === jobId)
      if (!job) return null
      // Extract key values - useShallow will compare these shallowly
      return {
        id: job.id,
        progress: job.progress,
        stage: job.stage,
        message: job.message,
        state: job.state,
        status: job.status,
        websiteId: job.websiteId,
        url: job.url,
        mode: job.mode,
        startedAt: job.startedAt,
        updatedAt: job.updatedAt,
        completedAt: job.completedAt,
        error: job.error,
        queuePosition: job.queuePosition,
        estimatedStartSeconds: job.estimatedStartSeconds,
        metadata: job.metadata,
      }
    })
  )

  // Convert to ImportProgressState - this now reacts to jobData changes
  const progressState = React.useMemo(() => {
    if (!enabled || !jobId) {
      return jobEntryToProgressState(null, true) // true = isGreenfield
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('[useGreenfieldProgress] Job data:', {
        jobId,
        found: !!jobData,
        jobData: jobData ? { id: jobData.id, progress: jobData.progress, stage: jobData.stage, message: jobData.message, state: jobData.state } : null
      })
    }

    if (!jobData) {
      return jobEntryToProgressState(null, true)
    }

    // Reconstruct ImportJobEntry from the extracted data
    const job: ImportJobEntry = {
      id: jobData.id,
      websiteId: jobData.websiteId,
      url: jobData.url,
      mode: jobData.mode,
      status: jobData.status,
      state: jobData.state,
      progress: jobData.progress,
      stage: jobData.stage,
      message: jobData.message,
      startedAt: jobData.startedAt,
      updatedAt: jobData.updatedAt ?? null,
      completedAt: jobData.completedAt ?? null,
      error: jobData.error,
      queuePosition: jobData.queuePosition,
      estimatedStartSeconds: jobData.estimatedStartSeconds,
      metadata: jobData.metadata,
    }

    return jobEntryToProgressState(job, true) // true = isGreenfield
  }, [enabled, jobId, jobData])

  return progressState
}

/**
 * Hybrid hook that reads progress from stores hydrated by real-time streams.
 *
 * NOTE: Greenfield jobs (bootstrap-* prefix) read from ImportTrackerStore instead of polling.
 * The store is hydrated by useGreenfieldHydration which polls /api/studio/greenfield/activity.
 * This is the fix for BUG-CW-02: Assistant shows no progress without refresh.
 *
 * @param jobId - The import job ID to track
 */
export function useImportProgressHybrid(
  jobId: string | null | undefined,
  _websiteId: string | null | undefined,
  _sessionId: string | null | undefined
): ImportProgressState {
  const trackedJobData = useImportTrackerStore(
    useShallow((state) => {
      if (!jobId) return null
      const job = state.jobs.find((candidate) => candidate.id === jobId)
      if (!job) return null
      return {
        id: job.id,
        progress: job.progress,
        stage: job.stage,
        message: job.message,
        state: job.state,
        status: job.status,
        websiteId: job.websiteId,
        url: job.url,
        mode: job.mode,
        startedAt: job.startedAt,
        updatedAt: job.updatedAt,
        completedAt: job.completedAt,
        error: job.error,
        queuePosition: job.queuePosition,
        estimatedStartSeconds: job.estimatedStartSeconds,
        metadata: job.metadata,
      }
    })
  )

  const trackedJob = React.useMemo<ImportJobEntry | null>(() => {
    if (!trackedJobData) return null
    return {
      id: trackedJobData.id,
      websiteId: trackedJobData.websiteId,
      url: trackedJobData.url,
      mode: trackedJobData.mode,
      status: trackedJobData.status,
      state: trackedJobData.state,
      progress: trackedJobData.progress,
      stage: trackedJobData.stage,
      message: trackedJobData.message,
      startedAt: trackedJobData.startedAt,
      updatedAt: trackedJobData.updatedAt ?? null,
      completedAt: trackedJobData.completedAt ?? null,
      error: trackedJobData.error,
      queuePosition: trackedJobData.queuePosition,
      estimatedStartSeconds: trackedJobData.estimatedStartSeconds,
      metadata: trackedJobData.metadata,
    }
  }, [trackedJobData])

  // Check if this is a greenfield job (needs to react to jobId changes)
  const isGreenfield = isGreenfieldJob(jobId)
  const trackedTerminal =
    trackedJob?.state === 'completed' || (trackedJob ? TRACKED_TERMINAL_STATUSES.has(trackedJob.status) : false)

  // Greenfield progress from store (for bootstrap-* jobs)
  // This reads from ImportTrackerStore which is hydrated by useGreenfieldHydration
  const greenfieldProgress = useGreenfieldProgress(
    jobId,
    isGreenfield
  )

  // Log which method is being used (development only)
  React.useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      if (isGreenfield) {
        console.log(`[ImportProgress] Using store for greenfield job (${jobId})`)
      } else {
        console.log('[ImportProgress] Using website activity stream for updates')
      }
    }
  }, [isGreenfield, jobId])

  // Debug: Log when greenfield progress changes
  React.useEffect(() => {
    if (process.env.NODE_ENV === 'development' && isGreenfield) {
      console.log('[ImportProgress] Greenfield progress updated:', {
        jobId,
        hasActiveImport: greenfieldProgress.hasActiveImport,
        progress: greenfieldProgress.progress,
        stage: greenfieldProgress.stage,
        status: greenfieldProgress.status,
        message: greenfieldProgress.message,
      })
    }
  }, [isGreenfield, jobId, greenfieldProgress])

  if (isGreenfield) {
    return greenfieldProgress
  }
  if (trackedTerminal) {
    return jobEntryToProgressState(trackedJob, false)
  }
  if (trackedJob) {
    return jobEntryToProgressState(trackedJob, false)
  }
  if (jobId) {
    return importRealtimeUnavailableState(jobId, 'Waiting for website real-time updates')
  }
  return jobEntryToProgressState(null, false)
}

/**
 * Hook that combines SSE progress with local message state.
 * Use this as the real-time import progress adapter.
 *
 * @param messages - Local AI messages array
 * @param jobId - The import job ID (for SSE)
 * @param websiteId - Website ID (for polling fallback)
 * @param sessionId - Session ID (for polling fallback)
 */
export function useImportProgressWithSSE(
  messages: Array<{ id?: string; metadata?: Record<string, unknown> }>,
  jobId: string | null | undefined,
  websiteId: string | null | undefined,
  sessionId: string | null | undefined
): {
  progressState: ImportProgressState
  filteredMessages: typeof messages
} {
  // Use hybrid hook for progress
  const progressState = useImportProgressHybrid(jobId, websiteId, sessionId)

  // Filter out progress messages from display
  const filteredMessages = React.useMemo(() => {
    return messages.filter((msg) => {
      const metadata = msg.metadata
      // Filter out progress event messages - they'll be shown in the status card
      return metadata?.type !== 'import-progress' || !metadata?.isProgressEvent
    })
  }, [messages])

  return { progressState, filteredMessages }
}
