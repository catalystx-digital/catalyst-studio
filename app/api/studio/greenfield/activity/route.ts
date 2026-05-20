/**
 * Greenfield Activity API
 *
 * Returns progress for greenfield website generation jobs.
 * Queries AIContext for bootstrap progress messages.
 *
 * This API returns data in the same ImportJobViewModel format as the import activity API,
 * allowing the existing UI infrastructure to display greenfield progress.
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthContext } from '@/lib/auth/context'
import type { ImportJobViewModel } from '@/lib/studio/import/types/import-job-view-model'
import type { ImportSessionMode } from '@/lib/studio/stores/import-tracker-store'
import type { WebsiteMediaReference } from '@/types/api'
import type { ImportProgressMetadata } from '@/lib/studio/import/utils/update-system-event'
import type { AIMessage } from '@/types/ai-context'

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
    case 'in_progress':
      return 'processing'
    default:
      return 'pending'
  }
}

const mapStage = (status: string, progress: number): ImportJobViewModel['stage'] => {
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
      // For greenfield, use generating stage more prominently
      if (progress <= 0) return 'initializing'
      if (progress <= 30) return 'fetching'
      if (progress <= 80) return 'generating'
      return 'creating'
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

/**
 * Convert a greenfield progress message from AIContext to ImportJobViewModel.
 */
const greenfieldProgressToViewModel = (
  message: AIMessage,
  websiteId: string,
  website: { id: string; name: string | null; icon: string | WebsiteMediaReference | null } | null
): ImportJobViewModel | null => {
  const meta = message.metadata as ImportProgressMetadata | undefined
  if (!meta || meta.type !== 'import-progress') {
    return null
  }

  // Only handle bootstrap jobs (greenfield)
  if (!meta.jobId?.startsWith('bootstrap-')) {
    return null
  }

  const progress = typeof meta.progress === 'number' ? Math.min(100, Math.max(0, meta.progress)) : 0
  const status = normalizeStatus(meta.status)
  const stage = mapStage(status, progress)
  const state = deriveState(status)

  const updatedAt = typeof meta.updatedAt === 'string' ? meta.updatedAt : new Date().toISOString()

  return {
    id: meta.jobId,
    websiteId,
    url: '', // Greenfield jobs don't have a source URL
    status,
    progress,
    stage,
    message: meta.message || null,
    state,
    mode: 'new' as ImportSessionMode,
    startedAt: updatedAt,
    updatedAt,
    completedAt: status === 'completed' || status === 'failed' ? updatedAt : null,
    createdAt: updatedAt,
    queuePosition: null,
    estimatedStartSeconds: null,
    metadata: {
      progressSummary: {
        processedCount: meta.processedCount ?? 0,
        totalCount: meta.totalCount ?? 0,
        currentUrl: null,
      },
    },
    website,
  }
}

// Type for context with website included
type AIContextWithWebsite = {
  id: string
  websiteId: string | null
  sessionId: string
  context: unknown
  metadata: unknown
  createdAt: Date
  updatedAt: Date
  accountId: string | null
  website: {
    id: string
    name: string | null
    icon: unknown
  } | null
}

export async function GET(request: NextRequest) {
  try {
    const { accountId } = await getAuthContext(request)
    const searchParams = request.nextUrl.searchParams
    const requestedJobId = searchParams.get('jobId')
    const websiteIdFilter = searchParams.get('websiteId')

    // For active jobs, look at recently updated contexts
    // For specific job requests, search more broadly
    const timeWindow = requestedJobId ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000
    const updatedAtGte = new Date(Date.now() - timeWindow)

    // Query AIContext records for websites owned by this account
    const contexts = await prisma.aIContext.findMany({
      where: {
        website: { accountId },
        ...(websiteIdFilter ? { websiteId: websiteIdFilter } : {}),
        updatedAt: { gte: updatedAtGte },
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
      orderBy: { updatedAt: 'desc' },
      take: 50,
    }) as AIContextWithWebsite[]

    const greenfieldViewModels: ImportJobViewModel[] = []
    const seenJobIds = new Set<string>()

    for (const ctx of contexts) {
      const contextData = ctx.context as { messages?: AIMessage[] } | null
      const messages = Array.isArray(contextData?.messages) ? contextData.messages : []

      // Find bootstrap progress messages (reverse to get most recent first)
      for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i]
        const meta = msg.metadata as ImportProgressMetadata | undefined
        if (!meta || meta.type !== 'import-progress' || !meta.jobId?.startsWith('bootstrap-')) {
          continue
        }

        // Skip if we already processed this job
        if (seenJobIds.has(meta.jobId)) {
          continue
        }

        // Skip completed/failed jobs unless specifically requested
        const status = normalizeStatus(meta.status)
        const isTerminal = status === 'completed' || status === 'failed' || status === 'cancelled'
        if (isTerminal && meta.jobId !== requestedJobId) {
          continue
        }

        seenJobIds.add(meta.jobId)

        const website = ctx.website
          ? {
              id: ctx.website.id,
              name: ctx.website.name,
              icon: normalizeWebsiteIcon(ctx.website.icon),
            }
          : null

        // Skip if websiteId is null
        if (!ctx.websiteId) {
          continue
        }

        const viewModel = greenfieldProgressToViewModel(msg, ctx.websiteId, website)
        if (viewModel) {
          greenfieldViewModels.push(viewModel)
        }
      }
    }

    // If a specific job was requested and not found, search all contexts
    if (requestedJobId && requestedJobId.startsWith('bootstrap-') && !seenJobIds.has(requestedJobId)) {
      const allContexts = await prisma.aIContext.findMany({
        where: {
          website: { accountId },
          ...(websiteIdFilter ? { websiteId: websiteIdFilter } : {}),
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
        orderBy: { updatedAt: 'desc' },
        take: 100,
      }) as AIContextWithWebsite[]

      for (const ctx of allContexts) {
        // Skip if websiteId is null
        if (!ctx.websiteId) {
          continue
        }

        const contextData = ctx.context as { messages?: AIMessage[] } | null
        const messages = Array.isArray(contextData?.messages) ? contextData.messages : []

        for (let i = messages.length - 1; i >= 0; i--) {
          const msg = messages[i]
          const meta = msg.metadata as ImportProgressMetadata | undefined
          if (meta?.jobId === requestedJobId) {
            seenJobIds.add(meta.jobId)

            const website = ctx.website
              ? {
                  id: ctx.website.id,
                  name: ctx.website.name,
                  icon: normalizeWebsiteIcon(ctx.website.icon),
                }
              : null

            const viewModel = greenfieldProgressToViewModel(msg, ctx.websiteId, website)
            if (viewModel) {
              greenfieldViewModels.push(viewModel)
            }
            break
          }
        }

        if (seenJobIds.has(requestedJobId)) {
          break
        }
      }
    }

    // Sort by updatedAt descending
    greenfieldViewModels.sort((a, b) => {
      const aDate = a.updatedAt ? new Date(a.updatedAt).getTime() : 0
      const bDate = b.updatedAt ? new Date(b.updatedAt).getTime() : 0
      return bDate - aDate
    })

    return NextResponse.json({ data: greenfieldViewModels })
  } catch (error) {
    console.error('[greenfield/activity] Failed to load greenfield activity', error)
    return NextResponse.json(
      { error: { message: 'Failed to load greenfield activity' } },
      { status: 500 },
    )
  }
}
