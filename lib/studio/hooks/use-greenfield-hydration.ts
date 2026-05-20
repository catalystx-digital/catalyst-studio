/**
 * Greenfield Hydration Hook
 *
 * Polls the greenfield activity API for progress updates during website generation.
 * Uses the same store infrastructure as import jobs (ImportTrackerStore).
 *
 * Usage:
 *   useGreenfieldHydration({ jobId: 'bootstrap-xxx', pollInterval: 2000 })
 */
import { useEffect, useMemo, useState } from 'react'
import type { ImportJobViewModel } from '@/lib/studio/import/types/import-job-view-model'
import { useImportTrackerStore } from '@/lib/studio/stores/import-tracker-store'

interface UseGreenfieldHydrationOptions {
  /** Poll interval in ms during active generation (default: 2000) */
  pollInterval?: number | null
  /** Poll interval in ms when idle (default: 30000) */
  idlePollInterval?: number | null
  /** Specific greenfield job ID to track (format: bootstrap-{websiteId}-{timestamp}) */
  jobId?: string | null
  /** Website ID to filter jobs */
  websiteId?: string | null
  /** Whether to enable polling (default: true) */
  enabled?: boolean
}

const DEFAULT_ACTIVE_POLL_INTERVAL = 2_000
const DEFAULT_IDLE_POLL_INTERVAL = 30_000

export function useGreenfieldHydration(options?: UseGreenfieldHydrationOptions) {
  const hydrateJobs = useImportTrackerStore((state) => state.hydrateJobs)
  const jobId = options?.jobId ?? null
  const websiteId = options?.websiteId ?? null
  const enabled = options?.enabled ?? true
  const jobs = useImportTrackerStore((state) => state.jobs)
  const [hasRemoteActivity, setHasRemoteActivity] = useState(false)
  const [hasHydratedOnce, setHasHydratedOnce] = useState(false)

  // Determine if the tracked job or any greenfield job is active
  const { hasOngoingJobs, trackedJobState } = useMemo(() => {
    let trackedState: string | null = null
    let ongoing = false

    for (const job of jobs) {
      // Only consider greenfield jobs (bootstrap- prefix)
      if (!job.id.startsWith('bootstrap-')) {
        continue
      }

      if (job.state !== 'completed') {
        ongoing = true
      }
      if (!trackedState && jobId && job.id === jobId) {
        trackedState = job.state
      }
      if (ongoing && trackedState) {
        break
      }
    }

    return {
      hasOngoingJobs: ongoing,
      trackedJobState: trackedState,
    }
  }, [jobs, jobId])

  const activePollInterval = options?.pollInterval ?? DEFAULT_ACTIVE_POLL_INTERVAL
  const idlePollInterval = options?.idlePollInterval ?? DEFAULT_IDLE_POLL_INTERVAL
  const storeSuggestsActive = jobId ? trackedJobState !== 'completed' : hasOngoingJobs
  const shouldUseActiveInterval =
    hasRemoteActivity || (!hasHydratedOnce && storeSuggestsActive) || (jobId && !hasHydratedOnce)
  const pollInterval = shouldUseActiveInterval ? activePollInterval : idlePollInterval

  useEffect(() => {
    // Skip if not enabled or no job to track
    if (!enabled) {
      return
    }

    // If no jobId specified and no websiteId, don't poll
    if (!jobId && !websiteId) {
      return
    }

    let cancelled = false
    let timer: NodeJS.Timeout | null = null

    const load = async () => {
      if (typeof window === 'undefined') {
        return
      }
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return
      }
      try {
        const url = new URL('/api/studio/greenfield/activity', window.location.origin)
        if (jobId) {
          url.searchParams.set('jobId', jobId)
        }
        if (websiteId) {
          url.searchParams.set('websiteId', websiteId)
        }

        const response = await fetch(url.toString(), {
          cache: 'no-store',
        })

        if (!response.ok) {
          throw new Error(`Failed to hydrate greenfield jobs: ${response.status}`)
        }

        const payload = await response.json()
        if (cancelled) return

        const fetchedJobs = Array.isArray(payload?.data) ? (payload.data as ImportJobViewModel[]) : []
        if (process.env.NODE_ENV === 'development') {
          console.log('[useGreenfieldHydration] Fetched jobs:', {
            count: fetchedJobs.length,
            jobs: fetchedJobs.map(j => ({ id: j.id, progress: j.progress, stage: j.stage, message: j.message, state: j.state }))
          })
        }
        if (!cancelled) {
          setHasHydratedOnce(true)
          const hasActiveRemote = fetchedJobs.some((job) => job.state !== 'completed')
          setHasRemoteActivity(hasActiveRemote)
        }

        // Hydrate jobs into the shared import tracker store
        // This allows the existing UI components to display greenfield progress
        hydrateJobs(
          fetchedJobs.map((job) => ({
            id: job.id,
            websiteId: job.websiteId,
            url: job.url,
            status: job.status,
            state: job.state,
            progress: job.progress,
            stage: job.stage,
            message: job.message,
            mode: job.mode,
            queuePosition: job.queuePosition ?? null,
            estimatedStartSeconds: job.estimatedStartSeconds ?? null,
            startedAt: job.startedAt,
            updatedAt: job.updatedAt,
            completedAt: job.completedAt,
            metadata: job.metadata ?? null,
          })),
        )
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('[useGreenfieldHydration] Failed to hydrate jobs', error)
        }
      }
    }

    void load()

    if (pollInterval && pollInterval > 0) {
      timer = setInterval(load, pollInterval)
    }

    return () => {
      cancelled = true
      if (timer) {
        clearInterval(timer)
      }
    }
  }, [hydrateJobs, pollInterval, jobId, websiteId, enabled])

  // Return useful state for consumers
  return {
    hasOngoingJobs,
    trackedJobState,
    hasHydratedOnce,
    isActive: hasRemoteActivity || storeSuggestsActive,
  }
}
