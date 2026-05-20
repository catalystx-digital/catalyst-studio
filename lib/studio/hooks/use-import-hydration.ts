import { useEffect, useMemo, useState } from 'react'
import type { ImportJobViewModel } from '@/lib/studio/import/types/import-job-view-model'
import { useImportTrackerStore } from '@/lib/studio/stores/import-tracker-store'

interface UseImportHydrationOptions {
  pollInterval?: number | null
  idlePollInterval?: number | null
  jobId?: string | null
  websiteId?: string | null
  /** When false, disables all API calls and polling. Defaults to true. */
  enabled?: boolean
}

const DEFAULT_ACTIVE_POLL_INTERVAL = 8_000
const DEFAULT_IDLE_POLL_INTERVAL = 120_000

export function useImportHydration(options?: UseImportHydrationOptions) {
  const hydrateJobs = useImportTrackerStore((state) => state.hydrateJobs)
  const jobId = options?.jobId ?? null
  const websiteId = options?.websiteId ?? null
  const enabled = options?.enabled ?? true
  const jobs = useImportTrackerStore((state) => state.jobs)
  const [hasRemoteActivity, setHasRemoteActivity] = useState(false)
  const [hasHydratedOnce, setHasHydratedOnce] = useState(false)

  const { hasOngoingJobs, trackedJobState } = useMemo(() => {
    let trackedState: string | null = null
    let ongoing = false

    for (const job of jobs) {
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
    hasRemoteActivity || (!hasHydratedOnce && storeSuggestsActive)
  const pollInterval = shouldUseActiveInterval ? activePollInterval : idlePollInterval

  useEffect(() => {
    // Skip all API calls and polling when disabled
    if (!enabled) {
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
        const url = new URL('/api/studio/import/activity', window.location.origin)
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
          throw new Error(`Failed to hydrate import jobs: ${response.status}`)
        }

        const payload = await response.json()
        if (cancelled) return

        const jobs = Array.isArray(payload?.data) ? (payload.data as ImportJobViewModel[]) : []
        if (!cancelled) {
          setHasHydratedOnce(true)
          const hasActiveRemote = jobs.some((job) => job.state !== 'completed')
          setHasRemoteActivity(hasActiveRemote)
        }
        hydrateJobs(
          jobs.map((job) => ({
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
          console.error('Failed to hydrate import jobs', error)
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
}
