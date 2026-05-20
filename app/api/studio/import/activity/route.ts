import { NextRequest, NextResponse } from 'next/server'
import type { Prisma, ImportJob } from '@/lib/generated/prisma'
import { prisma } from '@/lib/prisma'
import { getAuthContext } from '@/lib/auth/context'
import type { ImportJobMetadata, ImportJobStage, ImportJobViewModel } from '@/lib/studio/import/types/import-job-view-model'
import type { ImportSessionMode } from '@/lib/studio/stores/import-tracker-store'
import type { WebsiteMediaReference } from '@/types/api'

type ImportJobWithWebsite = ImportJob & {
  website?: {
    id: string
    name: string | null
    icon: string | WebsiteMediaReference | null
  } | null
}

type PrismaImportJobWithWebsite = Prisma.ImportJobGetPayload<{
  include: {
    website: {
      select: {
        id: true
        name: true
        icon: true
      }
    }
  }
}>

const ACTIVE_STATUSES = ['pending', 'processing', 'queued'] as const
const RECENT_STATUSES = ['completed', 'failed', 'cancelled'] as const
const RECENT_HISTORY_LIMIT = 5

const DEFAULT_MODE: ImportSessionMode = 'new'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const normalizeWebsiteIcon = (value: unknown): string | WebsiteMediaReference | null => {
  if (value === null || value === undefined) {
    return null
  }
  if (typeof value === 'string') {
    return value
  }
  if (typeof value === 'object') {
    try {
      return JSON.parse(JSON.stringify(value)) as WebsiteMediaReference
    } catch {
      return null
    }
  }
  return null
}

const mapToImportJob = (job: PrismaImportJobWithWebsite): ImportJobWithWebsite => ({
  ...job,
  website: job.website
    ? {
        id: job.website.id,
        name: job.website.name,
        icon: normalizeWebsiteIcon(job.website.icon),
      }
    : null,
})

const clampProgress = (raw: unknown, status: string): number => {
  if (status === 'completed') return 100
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return Math.min(100, Math.max(0, raw))
  }
  if (typeof raw === 'string') {
    const parsed = Number(raw)
    if (!Number.isNaN(parsed)) {
      return Math.min(100, Math.max(0, parsed))
    }
  }
  return 0
}

const mapStage = (status: string, progress: number): ImportJobStage => {
  switch (status) {
    case 'cancelled':
      return 'cancelled'
    case 'failed':
      return 'failed'
    case 'completed':
      return 'completed'
    case 'queued':
      return 'queued'
    default:
      if (progress <= 0) return 'initializing'
      if (progress <= 30) return 'fetching'
      if (progress <= 60) return 'analyzing'
      if (progress <= 90) return 'generating'
      return 'creating'
  }
}

const extractMessage = (detection: Record<string, unknown> | null, status: string, fallback?: string | null) => {
  if (typeof fallback === 'string' && fallback.trim().length > 0) {
    return fallback
  }
  const message = detection?.lastProgressMessage
  return typeof message === 'string' ? message : null
}

const toStringArray = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined
  }
  return value.filter((item): item is string => typeof item === 'string')
}

const toPagesMetadata = (value: unknown): ImportJobMetadata['pages'] => {
  if (!Array.isArray(value)) {
    return undefined
  }
  const pages = value
    .map((item, index) => {
      if (!isRecord(item)) {
        return undefined
      }
      const url = typeof item.url === 'string' ? item.url : undefined
      const status = typeof item.status === 'string' ? item.status : undefined
      if (!url || !status) {
        return undefined
      }
      return {
        url,
        order: typeof item.order === 'number' ? item.order : index,
        status,
        ...(typeof item.error === 'string' ? { error: item.error } : {}),
      }
    })
    .filter((entry): entry is { url: string; order: number; status: string; error?: string } => Boolean(entry))
  return pages.length > 0 ? pages : undefined
}

const toProgressSummary = (value: unknown): ImportJobMetadata['progressSummary'] => {
  if (!isRecord(value)) {
    return undefined
  }
  const processedCount = typeof value.processedCount === 'number' ? value.processedCount : undefined
  const totalCount = typeof value.totalCount === 'number' ? value.totalCount : undefined
  const currentUrl = typeof value.currentUrl === 'string' || value.currentUrl === null ? value.currentUrl ?? null : undefined
  const summary: ImportJobMetadata['progressSummary'] = {}
  if (processedCount !== undefined) summary.processedCount = processedCount
  if (totalCount !== undefined) summary.totalCount = totalCount
  if (currentUrl !== undefined) summary.currentUrl = currentUrl
  return Object.keys(summary).length > 0 ? summary : undefined
}

const extractMetadata = (detection: Record<string, unknown> | null): ImportJobMetadata | undefined => {
  if (!detection) {
    return undefined
  }
  const metadata: ImportJobMetadata = {}
  if (isRecord(detection['sitemap'])) {
    metadata.sitemap = {
      ordered: toStringArray(detection['sitemap'].ordered),
      pending: toStringArray(detection['sitemap'].pending),
      processing: toStringArray(detection['sitemap'].processing),
      completed: toStringArray(detection['sitemap'].completed),
      failed: toStringArray(detection['sitemap'].failed),
      skipped: toStringArray(detection['sitemap'].skipped),
      total: typeof detection['sitemap'].total === 'number' ? detection['sitemap'].total : undefined,
    }
  }
  const pages = toPagesMetadata(detection['pages'])
  if (pages) {
    metadata.pages = pages
  }
  const progressSummary = toProgressSummary(detection['progressSummary'])
  if (progressSummary) {
    metadata.progressSummary = progressSummary
  }
  if (isRecord(detection['mediaDiagnostics'])) {
    const diagnostics = detection['mediaDiagnostics']
    const mediaMetadata: Required<ImportJobMetadata>['media'] = {}
    if (typeof diagnostics.assetsDetected === 'number') {
      mediaMetadata.assetsDetected = diagnostics.assetsDetected
    }
    if (typeof diagnostics.ingestWarningCount === 'number') {
      mediaMetadata.ingestWarningCount = diagnostics.ingestWarningCount
    }
    if (typeof diagnostics.missingSrcCount === 'number') {
      mediaMetadata.missingSrcCount = diagnostics.missingSrcCount
    }
    if (Array.isArray(diagnostics.missingSrcByPage)) {
      const normalized = diagnostics.missingSrcByPage
        .map((entry) => {
          if (!isRecord(entry)) {
            return undefined
          }
          const pageUrl = typeof entry.pageUrl === 'string' ? entry.pageUrl : undefined
          const count = typeof entry.count === 'number' ? entry.count : undefined
          if (!pageUrl || count === undefined) {
            return undefined
          }
          return { pageUrl, count }
        })
        .filter((entry): entry is { pageUrl: string; count: number } => Boolean(entry))
      if (normalized.length > 0) {
        mediaMetadata.missingSrcByPage = normalized
      }
    }
    if (Array.isArray(diagnostics.missingSrcEntries)) {
      const normalizedEntries = diagnostics.missingSrcEntries
        .map((entry) => {
          if (!isRecord(entry)) {
            return undefined
          }
          const parentType = typeof entry.parentType === 'string' ? entry.parentType : undefined
          const message = typeof entry.message === 'string' ? entry.message : undefined
          if (!parentType || !message) {
            return undefined
          }
          const normalizedEntry: { parentType: string; message: string; pageUrl?: string; field?: string; childType?: string; mediaId?: string } = {
            parentType,
            message
          }
          if (typeof entry.pageUrl === 'string') {
            normalizedEntry.pageUrl = entry.pageUrl
          }
          if (typeof entry.field === 'string') {
            normalizedEntry.field = entry.field
          }
          if (typeof entry.childType === 'string') {
            normalizedEntry.childType = entry.childType
          }
          if (typeof entry.mediaId === 'string') {
            normalizedEntry.mediaId = entry.mediaId
          }
          return normalizedEntry
        })
        .filter(
          (entry): entry is { parentType: string; message: string; pageUrl?: string; field?: string; childType?: string; mediaId?: string } => Boolean(entry)
        )
      if (normalizedEntries.length > 0) {
        mediaMetadata.missingSrcEntries = normalizedEntries
      }
    }
    if (Object.keys(mediaMetadata).length > 0) {
      metadata.media = mediaMetadata
    }
  }
  return Object.keys(metadata).length > 0 ? metadata : undefined
}

const normalizeStatus = (status: string | null | undefined): ImportJobViewModel['status'] => {
  const value = (status ?? 'pending').toLowerCase()
  switch (value) {
    case 'pending':
    case 'processing':
    case 'completed':
    case 'failed':
    case 'cancelled':
    case 'queued':
      return value
    default:
      return 'pending'
  }
}

const deriveState = (status: string): ImportJobViewModel['state'] => {
  switch (status) {
    case 'queued':
      return 'queued'
    case 'completed':
      return 'completed'
    case 'failed':
    case 'cancelled':
      return 'completed'
    default:
      return 'active'
  }
}

const deriveMode = (job: ImportJobWithWebsite): ImportSessionMode => {
  // TODO: once mode is persisted server-side, hydrate with actual value
  return DEFAULT_MODE
}

const toViewModel = (job: ImportJobWithWebsite): ImportJobViewModel => {
  const detection = isRecord(job.detectionResults) ? job.detectionResults : null
  const progress = clampProgress(detection?.progress, job.status)
  const stage = mapStage(job.status, progress)
  const message = extractMessage(detection, job.status, job.errorMessage ?? undefined)
  const metadata = extractMetadata(detection)

  return {
    id: job.id,
    websiteId: job.websiteId,
    url: job.url,
    status: normalizeStatus(job.status),
    progress,
    stage,
    message,
    state: deriveState(job.status),
    mode: deriveMode(job),
    startedAt: job.startedAt ? job.startedAt.toISOString() : null,
    updatedAt: job.updatedAt.toISOString(),
    completedAt: job.completedAt ? job.completedAt.toISOString() : null,
    createdAt: job.createdAt.toISOString(),
    queuePosition: detection && typeof detection.queuePosition === 'number' ? detection.queuePosition : null,
    estimatedStartSeconds:
      detection && typeof detection.estimatedStartSeconds === 'number'
        ? detection.estimatedStartSeconds
        : null,
    metadata,
    website: job.website
      ? {
          id: job.website.id,
          name: job.website.name,
          icon: job.website.icon,
        }
      : null,
  }
}

export async function GET(request: NextRequest) {
  try {
    const { accountId } = await getAuthContext(request)

    const searchParams = request.nextUrl.searchParams
    const requestedJobId = searchParams.get('jobId')

    const [activeJobResults, recentJobResults] = await Promise.all([
      prisma.importJob.findMany({
        where: {
          website: { accountId },
          status: { in: [...ACTIVE_STATUSES] },
        },
        include: {
          website: {
            select: {
              id: true,
              name: true,
              icon: true,
            },
          },
        },
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
        take: 20,
      }),
      prisma.importJob.findMany({
        where: {
          website: { accountId },
          status: { in: [...RECENT_STATUSES] },
        },
        include: {
          website: {
            select: {
              id: true,
              name: true,
              icon: true,
            },
          },
        },
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
        take: RECENT_HISTORY_LIMIT,
      }),
    ])

    const activeJobs = activeJobResults.map(mapToImportJob)
    const recentJobs = recentJobResults.map(mapToImportJob)

    const orderedJobs: ImportJobWithWebsite[] = []
    const seenJobIds = new Set<string>()

    for (const job of activeJobs) {
      if (seenJobIds.has(job.id)) continue
      seenJobIds.add(job.id)
      orderedJobs.push(job)
    }

    for (const job of recentJobs) {
      if (seenJobIds.has(job.id)) continue
      seenJobIds.add(job.id)
      orderedJobs.push(job)
    }

    if (requestedJobId) {
      const requestedJob = await prisma.importJob.findFirst({
        where: {
          id: requestedJobId,
          website: { accountId },
        },
        include: {
          website: {
            select: { id: true, name: true, icon: true },
          },
        },
      })

      if (requestedJob) {
        const normalizedRequested = mapToImportJob(requestedJob)
        const existingIndex = orderedJobs.findIndex((job) => job.id === normalizedRequested.id)
        if (existingIndex >= 0) {
          orderedJobs[existingIndex] = normalizedRequested
        } else {
          orderedJobs.unshift(normalizedRequested)
        }
        seenJobIds.add(normalizedRequested.id)
      }
    }

    const payload: ImportJobViewModel[] = orderedJobs.map(toViewModel)

    return NextResponse.json({ data: payload })
  } catch (error) {
    console.error('Failed to load studio import activity', error)
    return NextResponse.json(
      { error: { message: 'Failed to load import activity' } },
      { status: 500 },
    )
  }
}







