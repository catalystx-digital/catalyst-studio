'use client'

import * as React from 'react'
import type { ImportJobViewModel } from '@/lib/studio/import/types/import-job-view-model'
import { getStudioSessionId } from '@/lib/studio/components/site-builder/save-manager'
import type {
  ImportLifecycleState,
  ImportSessionMode,
  ImportTrackerStatus,
} from '@/lib/studio/stores/import-tracker-store'
import { useImportTrackerStore } from '@/lib/studio/stores/import-tracker-store'
import { useSiteBuilderStore } from '@/lib/studio/stores/site-builder-store'

type StreamStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'error'

interface StudioSnapshot {
  websiteId: string
  revision: number
  sequence: number
  imports?: ImportJobViewModel[]
}

interface StudioEvent {
  websiteId: string
  sequence: number
  type: string
  actorSessionId?: string | null
  revision?: number | null
  payload?: unknown
}

interface ImportActivityPayload {
  jobId?: string
  activity?: ImportJobViewModel
  status?: string | null
  phase?: string | null
  progress?: number | null
  message?: string | null
  foundCount?: number | null
  importedCount?: number | null
  processedCount?: number | null
  stagedCount?: number | null
  committedCount?: number | null
  failedCount?: number | null
  skippedCount?: number | null
  pageUrl?: string | null
  draftPageId?: string | null
  draftStructureId?: string | null
  committedPageId?: string | null
}

export function useWebsiteActivityStream(options: {
  websiteId: string | null | undefined
  enabled?: boolean
}) {
  const { websiteId, enabled = true } = options
  const [status, setStatus] = React.useState<StreamStatus>('idle')
  const [hydrated, setHydrated] = React.useState(false)
  const lastSequenceRef = React.useRef(0)
  const reconnectRef = React.useRef<NodeJS.Timeout | null>(null)
  const refreshRef = React.useRef<NodeJS.Timeout | null>(null)
  const eventSourceRef = React.useRef<EventSource | null>(null)

  React.useEffect(() => {
    if (!enabled || !websiteId || typeof EventSource === 'undefined') {
      setStatus('idle')
      setHydrated(false)
      lastSequenceRef.current = 0
      return
    }

    let cancelled = false
    const localSessionId = getStudioSessionId()
    setHydrated(false)

    const scheduleStructureRefresh = () => {
      if (refreshRef.current) {
        clearTimeout(refreshRef.current)
      }
      refreshRef.current = setTimeout(() => {
        refreshRef.current = null
        if (!cancelled) {
          void useSiteBuilderStore.getState().loadStructure(websiteId)
        }
      }, 750)
    }

    const connect = () => {
      if (cancelled) return
      setStatus((current) => (current === 'idle' ? 'connecting' : 'reconnecting'))

      const url = `/api/studio/websites/${encodeURIComponent(websiteId)}/events?after=${lastSequenceRef.current}`
      const source = new EventSource(url)
      eventSourceRef.current = source

      source.onopen = () => {
        if (!cancelled) setStatus('connected')
      }

      source.addEventListener('studio.snapshot', (event) => {
        applySnapshot(event as MessageEvent<string>)
      })

      ;[
        'website.graph.changed',
        'website.page.changed',
        'website.layout.changed',
        'import.run.updated',
        'import.page.updated',
        'import.run.completed',
      ].forEach((eventName) => {
        source.addEventListener(eventName, (event) => {
          applyEvent(event as MessageEvent<string>)
        })
      })

      source.onmessage = (event) => {
        applyEvent(event as MessageEvent<string>)
      }

      source.onerror = () => {
        source.close()
        if (eventSourceRef.current === source) {
          eventSourceRef.current = null
        }
        if (cancelled) return
        setStatus('reconnecting')
        reconnectRef.current = setTimeout(connect, 3000)
      }
    }

    const applySnapshot = (event: MessageEvent<string>) => {
      try {
        const snapshot = JSON.parse(event.data) as StudioSnapshot
        if (snapshot.websiteId !== websiteId) return
        lastSequenceRef.current = Math.max(lastSequenceRef.current, snapshot.sequence ?? 0)
        if (typeof snapshot.revision === 'number') {
          useSiteBuilderStore.getState().setWebsiteRevision(snapshot.revision)
        }
        if (Array.isArray(snapshot.imports)) {
          useImportTrackerStore.getState().hydrateJobs(
            snapshot.imports.map((job) => ({
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
              metadata: attachActivitySequence(job.metadata, snapshot.sequence ?? 0),
            })),
          )
        }
        setHydrated(true)
      } catch (error) {
        console.warn('[WebsiteActivity] Failed to apply snapshot', error)
      }
    }

    const applyEvent = (event: MessageEvent<string>) => {
      try {
        const activity = JSON.parse(event.data) as StudioEvent
        if (activity.websiteId !== websiteId) return
        if (activity.sequence <= lastSequenceRef.current) return
        if (activity.sequence > lastSequenceRef.current + 1 && lastSequenceRef.current > 0) {
          // Gap recovery is handled by reconnecting with the last applied sequence.
          eventSourceRef.current?.close()
          eventSourceRef.current = null
          setStatus('reconnecting')
          reconnectRef.current = setTimeout(connect, 0)
          return
        }
        lastSequenceRef.current = activity.sequence
        if (
          (activity.type === 'website.graph.changed' ||
            activity.type === 'website.page.changed' ||
            activity.type === 'website.layout.changed') &&
          typeof activity.revision === 'number'
        ) {
          useSiteBuilderStore.getState().setWebsiteRevision(activity.revision)
          if (activity.actorSessionId !== localSessionId) {
            scheduleStructureRefresh()
          }
        }
        if (
          activity.type === 'import.run.updated' ||
          activity.type === 'import.page.updated' ||
          activity.type === 'import.run.completed'
        ) {
          applyImportEvent(websiteId, activity.payload, activity.sequence)
          if (shouldRefreshStructureForImport(activity.type, activity.payload)) {
            scheduleStructureRefresh()
          }
        }
      } catch (error) {
        console.warn('[WebsiteActivity] Failed to apply event', error)
      }
    }

    connect()

    return () => {
      cancelled = true
      if (reconnectRef.current) {
        clearTimeout(reconnectRef.current)
        reconnectRef.current = null
      }
      if (refreshRef.current) {
        clearTimeout(refreshRef.current)
        refreshRef.current = null
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
    }
  }, [enabled, websiteId])

  return {
    status,
    connected: status === 'connected',
    hydrated,
  }
}

function applyImportEvent(websiteId: string, rawPayload: unknown, sequence: number) {
  if (!rawPayload || typeof rawPayload !== 'object') return
  const payload = rawPayload as ImportActivityPayload
  if (!payload.jobId) return
  if (payload.activity && payload.activity.id) {
    upsertImportActivity(payload.activity, sequence)
    return
  }

  const existing = useImportTrackerStore.getState().jobs.find((job) => job.id === payload.jobId)
  if (isStaleImportUpdate(existing?.metadata, sequence)) return
  const status = normalizeImportStatus(payload.status) ?? existing?.status ?? 'processing'
  const state = deriveImportState(status)
  const existingMetadata =
    existing?.metadata && typeof existing.metadata === 'object' && !Array.isArray(existing.metadata)
      ? existing.metadata
      : {}
  const existingSummary =
    existingMetadata.progressSummary && typeof existingMetadata.progressSummary === 'object'
      ? (existingMetadata.progressSummary as Record<string, unknown>)
      : {}
  const processedCount =
    typeof payload.processedCount === 'number'
      ? payload.processedCount
      : typeof payload.importedCount === 'number' || typeof payload.failedCount === 'number'
      ? (payload.importedCount ?? 0) + (payload.failedCount ?? 0)
      : undefined
  const metadata = {
    ...existingMetadata,
    _activitySequence: sequence,
    progressSummary: {
      ...existingSummary,
      ...(typeof processedCount === 'number' ? { processedCount } : {}),
      ...(typeof payload.foundCount === 'number' ? { totalCount: payload.foundCount } : {}),
      ...(payload.pageUrl !== undefined ? { currentUrl: payload.pageUrl } : {}),
      ...(typeof payload.stagedCount === 'number' ? { stagedCount: payload.stagedCount } : {}),
      ...(typeof payload.committedCount === 'number'
        ? { committedCount: payload.committedCount }
        : typeof payload.importedCount === 'number'
        ? { committedCount: payload.importedCount }
        : {}),
      ...(typeof payload.failedCount === 'number' ? { failedCount: payload.failedCount } : {}),
      ...(typeof payload.skippedCount === 'number' ? { skippedCount: payload.skippedCount } : {}),
    },
  }

  const tracker = useImportTrackerStore.getState()
  if (!existing) {
    tracker.registerJob({
      id: payload.jobId,
      websiteId,
      url: payload.pageUrl ?? '',
      mode: 'new' satisfies ImportSessionMode,
      status,
      state,
      progress: typeof payload.progress === 'number' ? payload.progress : 0,
      stage: payload.phase ?? undefined,
      message: payload.message ?? undefined,
      metadata,
    })
    return
  }

  tracker.updateJob(payload.jobId, {
    status,
    state,
    progress: typeof payload.progress === 'number' ? payload.progress : existing.progress,
    stage: payload.phase ?? undefined,
    message: payload.message ?? undefined,
    metadata,
  })
}

function upsertImportActivity(job: ImportJobViewModel, sequence: number) {
  const existing = useImportTrackerStore.getState().jobs.find((entry) => entry.id === job.id)
  if (isStaleImportUpdate(existing?.metadata, sequence)) return
  useImportTrackerStore.getState().hydrateJobs([{
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
    metadata: attachActivitySequence(job.metadata, sequence),
  }])
}

function attachActivitySequence(metadata: ImportJobViewModel['metadata'] | null | undefined, sequence: number) {
  return {
    ...(metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : {}),
    _activitySequence: sequence,
  }
}

function isStaleImportUpdate(metadata: unknown, sequence: number): boolean {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return false
  const current = (metadata as Record<string, unknown>)._activitySequence
  return typeof current === 'number' && sequence < current
}

function deriveImportState(status: ImportTrackerStatus): ImportLifecycleState {
  if (status === 'queued') return 'queued'
  if (
    status === 'success' ||
    status === 'partial_success' ||
    status === 'completed' ||
    status === 'completed_with_warnings' ||
    status === 'failed' ||
    status === 'cancelled' ||
    status === 'recoverable_stuck' ||
    status === 'unknown'
  ) {
    return 'completed'
  }
  return 'active'
}

function normalizeImportStatus(status: string | null | undefined): ImportTrackerStatus | null {
  if (!status) return null
  switch (status.toLowerCase()) {
    case 'pending':
    case 'processing':
    case 'queued':
    case 'running':
    case 'success':
    case 'partial_success':
    case 'completed':
    case 'completed_with_warnings':
    case 'failed':
    case 'cancelled':
    case 'recoverable_stuck':
    case 'unknown':
      return status.toLowerCase() as ImportTrackerStatus
    case 'committed':
    case 'detected':
    case 'normalized':
      return 'processing'
    case 'failed_retryable':
    case 'failed_terminal':
      return 'failed'
    case 'skipped':
      return 'partial_success'
    default:
      return null
  }
}

function shouldRefreshStructureForImport(type: string, rawPayload: unknown): boolean {
  if (type === 'import.run.completed') return true
  if (type !== 'import.page.updated' || !rawPayload || typeof rawPayload !== 'object') return false
  const payload = rawPayload as ImportActivityPayload
  return Boolean(payload.committedPageId || payload.draftPageId || payload.draftStructureId || payload.activity)
}
