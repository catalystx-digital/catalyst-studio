import { createHash } from 'node:crypto'

import type { ImportJob, Prisma } from '@/lib/generated/prisma'
import { prisma } from '@/lib/prisma'
import { normalizePath } from '@/lib/studio/import/utils/path-utils'

const importDb = prisma as any

export type ImportRunStatus =
  | 'queued'
  | 'running'
  | 'discovering'
  | 'detecting'
  | 'normalizing'
  | 'staged'
  | 'committing'
  | 'success'
  | 'partial_success'
  | 'completed'
  | 'completed_with_warnings'
  | 'failed'
  | 'cancelled'
  | 'recoverable_stuck'
  | 'unknown'

export type ImportRunPhase =
  | 'queued'
  | 'discover_urls'
  | 'detect_page'
  | 'normalize_page_content'
  | 'commit_page'
  | 'run_finalize'
  | 'enrichment'
  | 'completed'
  | 'failed'
  | 'cancelled'

export interface ImportActivityView {
  id: string
  legacyJobId: string
  runId: string | null
  websiteId: string
  url: string
  status: ImportRunStatus
  phase: string
  progress: number
  message: string | null
  pages: {
    total: number
    staged: number
    committed: number
    failed: number
  }
  recoverableActions: string[]
  updatedAt: Date
  createdAt: Date
  startedAt: Date | null
  completedAt: Date | null
}

export interface ImportRunEventInput {
  level?: 'debug' | 'info' | 'warning' | 'error'
  code?: string
  category?: string
  phase?: string
  scope?: 'run' | 'page' | 'enrichment' | 'commit'
  pageUrl?: string
  message: string
  detail?: Prisma.InputJsonValue
}

const TRACKING_PARAM_PREFIXES = ['utm_']
const TRACKING_PARAMS = new Set(['fbclid', 'gclid', 'msclkid'])
const TERMINAL_RUN_STATUSES = new Set([
  'success',
  'partial_success',
  'completed',
  'completed_with_warnings',
  'failed',
  'cancelled',
  'recoverable_stuck',
  'unknown',
])

export function isTerminalImportRunStatus(status: string | null | undefined): boolean {
  return TERMINAL_RUN_STATUSES.has((status ?? '').toLowerCase())
}

export function normalizeImportUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl)
    parsed.hash = ''
    parsed.hostname = parsed.hostname.toLowerCase()
    parsed.pathname = normalizePath(parsed.pathname)

    for (const key of Array.from(parsed.searchParams.keys())) {
      const lower = key.toLowerCase()
      if (TRACKING_PARAMS.has(lower) || TRACKING_PARAM_PREFIXES.some((prefix) => lower.startsWith(prefix))) {
        parsed.searchParams.delete(key)
      }
    }

    const sorted = Array.from(parsed.searchParams.entries()).sort(([a], [b]) => a.localeCompare(b))
    parsed.search = ''
    for (const [key, value] of sorted) {
      parsed.searchParams.append(key, value)
    }

    let normalized = parsed.toString()
    if (normalized.endsWith('/') && parsed.pathname !== '/') {
      normalized = normalized.slice(0, -1)
    }
    return normalized
  } catch {
    return rawUrl.trim()
  }
}

export function fingerprintImportContent(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value ?? null)).digest('hex')
}

export class ImportRunService {
  async createForJob(input: {
    job: Pick<ImportJob, 'id' | 'websiteId' | 'url' | 'createdAt' | 'startedAt'>
    sourceUrl: string
    urls: string[]
    importPlan?: Prisma.InputJsonValue
    message?: string
  }) {
    const sourceUrl = input.sourceUrl || input.job.url
    const normalizedSourceUrl = normalizeImportUrl(sourceUrl)
    const uniqueUrls = Array.from(new Map(input.urls.map((url) => [normalizeImportUrl(url), url])).values())

    return importDb.$transaction(async (tx: any) => {
      const run = await tx.importRun.upsert({
        where: { importJobId: input.job.id },
        create: {
          importJobId: input.job.id,
          websiteId: input.job.websiteId,
          sourceUrl,
          normalizedSourceUrl,
          status: 'queued',
          phase: 'queued',
          progress: 0,
          message: input.message ?? 'Import queued',
          totalPages: uniqueUrls.length,
          importPlan: input.importPlan,
          startedAt: input.job.startedAt,
        },
        update: {
          sourceUrl,
          normalizedSourceUrl,
          message: input.message ?? 'Import queued',
          totalPages: uniqueUrls.length,
          importPlan: input.importPlan,
        },
      })

      for (const pageUrl of uniqueUrls) {
        await tx.importPageStage.upsert({
          where: {
            runId_normalizedPageUrl: {
              runId: run.id,
              normalizedPageUrl: normalizeImportUrl(pageUrl),
            },
          },
          create: {
            runId: run.id,
            websiteId: input.job.websiteId,
            sourceUrl: pageUrl,
            normalizedPageUrl: normalizeImportUrl(pageUrl),
            normalizedPath: normalizePath(pageUrl),
            status: 'pending',
            phase: 'queued',
          },
          update: {
            sourceUrl: pageUrl,
            normalizedPath: normalizePath(pageUrl),
          },
        })
      }

      await tx.importRunEvent.create({
        data: {
          runId: run.id,
          websiteId: input.job.websiteId,
          level: 'info',
          phase: 'queued',
          message: `Queued ${uniqueUrls.length} import page${uniqueUrls.length === 1 ? '' : 's'}`,
          detail: { sourceUrl, urls: uniqueUrls } as Prisma.InputJsonValue,
        },
      })

      return run
    })
  }

  async findByJobId(jobId: string) {
    return importDb.importRun.findUnique({ where: { importJobId: jobId } })
  }

  async updateProgressForJob(
    jobId: string,
    input: {
      status?: ImportRunStatus
      phase?: ImportRunPhase | string
      progress?: number
      message?: string
      totalPages?: number
      stagedPages?: number
      committedPages?: number
      failedPages?: number
      recoverableActions?: string[]
      lastError?: Prisma.InputJsonValue | null
      completedAt?: Date | null
      cancellationRequestedAt?: Date | null
    },
  ) {
    const run = await this.findByJobId(jobId)
    if (!run) return null

    const data: Record<string, unknown> = {
      ...(input.status ? { status: input.status } : {}),
      ...(input.phase ? { phase: input.phase } : {}),
      ...(typeof input.progress === 'number' ? { progress: Math.max(0, Math.min(100, Math.round(input.progress))) } : {}),
      ...(input.message !== undefined ? { message: input.message } : {}),
      ...(typeof input.totalPages === 'number' ? { totalPages: input.totalPages } : {}),
      ...(typeof input.stagedPages === 'number' ? { stagedPages: input.stagedPages } : {}),
      ...(typeof input.committedPages === 'number' ? { committedPages: input.committedPages } : {}),
      ...(typeof input.failedPages === 'number' ? { failedPages: input.failedPages } : {}),
      ...(input.recoverableActions ? { recoverableActions: input.recoverableActions } : {}),
      ...(input.lastError !== undefined ? { lastError: input.lastError } : {}),
      ...(input.completedAt !== undefined ? { completedAt: input.completedAt } : {}),
      ...(input.cancellationRequestedAt !== undefined ? { cancellationRequestedAt: input.cancellationRequestedAt } : {}),
    }

    return importDb.importRun.update({
      where: { id: run.id },
      data,
    })
  }

  async upsertPageStageForJob(
    jobId: string,
    input: {
      pageUrl: string
      canonicalUrl?: string | null
      title?: string | null
      status: string
      phase?: string
      detectionPayload?: Prisma.InputJsonValue
      pageContent?: Prisma.InputJsonValue
      structureCandidate?: Prisma.InputJsonValue
      committedPageId?: string | null
      error?: Prisma.InputJsonValue | null
    },
  ) {
    const run = await this.findByJobId(jobId)
    if (!run) return null

    const normalizedPageUrl = normalizeImportUrl(input.canonicalUrl || input.pageUrl)
    const pageContent = input.pageContent
    const contentFingerprint = pageContent ? fingerprintImportContent(pageContent) : undefined
    const error =
      input.error !== undefined
        ? input.error
        : ['detected', 'normalized', 'committed'].includes(input.status)
          ? null
          : undefined

    const stage = await importDb.importPageStage.upsert({
      where: {
        runId_normalizedPageUrl: {
          runId: run.id,
          normalizedPageUrl,
        },
      },
      create: {
        runId: run.id,
        websiteId: run.websiteId,
        sourceUrl: input.pageUrl,
        canonicalUrl: input.canonicalUrl ?? null,
        normalizedPageUrl,
        normalizedPath: normalizePath(input.canonicalUrl || input.pageUrl),
        title: input.title ?? null,
        status: input.status,
        phase: input.phase ?? 'detect_page',
        detectionPayload: input.detectionPayload,
        pageContent,
        structureCandidate: input.structureCandidate,
        committedPageId: input.committedPageId ?? null,
        contentFingerprint,
        error,
        committedAt: input.status === 'committed' ? new Date() : undefined,
        attempts: 1,
        lastAttemptAt: new Date(),
      },
      update: {
        sourceUrl: input.pageUrl,
        canonicalUrl: input.canonicalUrl ?? null,
        normalizedPath: normalizePath(input.canonicalUrl || input.pageUrl),
        title: input.title ?? undefined,
        status: input.status,
        phase: input.phase ?? 'detect_page',
        detectionPayload: input.detectionPayload,
        pageContent,
        structureCandidate: input.structureCandidate,
        committedPageId: input.committedPageId ?? undefined,
        contentFingerprint,
        ...(error !== undefined ? { error } : {}),
        committedAt: input.status === 'committed' ? new Date() : undefined,
        attempts: { increment: 1 },
        lastAttemptAt: new Date(),
      },
    })

    const [stagedPages, failedPages, committedPages] = await Promise.all([
      importDb.importPageStage.count({ where: { runId: run.id, status: { in: ['detected', 'normalized', 'committed'] } } }),
      importDb.importPageStage.count({ where: { runId: run.id, status: { in: ['failed_retryable', 'failed_terminal', 'skipped'] } } }),
      importDb.importPageStage.count({ where: { runId: run.id, status: 'committed' } }),
    ])

    await importDb.importRun.update({
      where: { id: run.id },
      data: {
        stagedPages,
        failedPages,
        committedPages,
        totalPages: Math.max(run.totalPages, stagedPages + failedPages),
      },
    })

    return stage
  }

  async recordEventForJob(jobId: string, input: ImportRunEventInput) {
    const run = await this.findByJobId(jobId)
    if (!run) return null

    return importDb.importRunEvent.create({
      data: {
        runId: run.id,
        websiteId: run.websiteId,
        level: input.level ?? 'info',
        code: input.code,
        category: input.category,
        phase: input.phase,
        scope: input.scope ?? 'run',
        pageUrl: input.pageUrl,
        message: input.message,
        detail: input.detail,
      },
    })
  }

  async assertRunNotCancelled(jobId: string): Promise<void> {
    const run = await this.findByJobId(jobId)
    if (run && String(run.status).toLowerCase() === 'cancelled') {
      throw new Error('Import run has been cancelled')
    }
  }

  async markCancelledForJob(jobId: string, message = 'Import cancelled'): Promise<void> {
    await this.updateProgressForJob(jobId, {
      status: 'cancelled',
      phase: 'cancelled',
      message,
      recoverableActions: [],
      cancellationRequestedAt: new Date(),
      completedAt: new Date(),
    })
  }

  async deriveFinalStatusForJob(jobId: string): Promise<{
    status: ImportRunStatus
    message: string
    totalPages: number
    committedPages: number
    failedPages: number
  } | null> {
    const run = await this.findByJobId(jobId)
    if (!run) return null

    const [committedPages, failedPages, skippedPages, totalPages] = await Promise.all([
      importDb.importPageStage.count({ where: { runId: run.id, status: 'committed' } }),
      importDb.importPageStage.count({ where: { runId: run.id, status: { in: ['failed_retryable', 'failed_terminal'] } } }),
      importDb.importPageStage.count({ where: { runId: run.id, status: 'skipped' } }),
      importDb.importPageStage.count({ where: { runId: run.id } }),
    ])

    if (String(run.status).toLowerCase() === 'cancelled') {
      return {
        status: 'cancelled',
        message: committedPages > 0 ? 'Import cancelled; committed pages were preserved' : 'Import cancelled',
        totalPages,
        committedPages,
        failedPages: failedPages + skippedPages,
      }
    }

    if (committedPages > 0 && failedPages + skippedPages > 0) {
      return {
        status: 'partial_success',
        message: `Import completed with ${failedPages + skippedPages} page warning${failedPages + skippedPages === 1 ? '' : 's'}`,
        totalPages,
        committedPages,
        failedPages: failedPages + skippedPages,
      }
    }

    if (committedPages > 0) {
      return {
        status: 'success',
        message: 'Import completed',
        totalPages,
        committedPages,
        failedPages: 0,
      }
    }

    return {
      status: 'failed',
      message: 'Import failed before any pages were committed',
      totalPages,
      committedPages: 0,
      failedPages: failedPages + skippedPages,
    }
  }

  toActivityView(run: Awaited<ReturnType<ImportRunService['findByJobId']>> & { importJob?: ImportJob | null }): ImportActivityView {
    const importJob = run.importJob
    const status = normalizeRunStatus(run.status)
    return {
      id: importJob?.id ?? run.importJobId,
      legacyJobId: run.importJobId,
      runId: run.id,
      websiteId: run.websiteId,
      url: run.sourceUrl,
      status,
      phase: run.phase,
      progress:
        status === 'completed' || status === 'completed_with_warnings' || status === 'success' || status === 'partial_success'
          ? 100
          : Math.max(0, Math.min(100, run.progress)),
      message: run.message,
      pages: {
        total: run.totalPages,
        staged: run.stagedPages,
        committed: run.committedPages,
        failed: run.failedPages,
      },
      recoverableActions: run.recoverableActions,
      updatedAt: run.updatedAt,
      createdAt: run.createdAt,
      startedAt: run.startedAt,
      completedAt: run.completedAt,
    }
  }
}

export function normalizeRunStatus(status: string | null | undefined): ImportRunStatus {
  const value = (status ?? 'queued').toLowerCase()
  switch (value) {
    case 'queued':
    case 'running':
    case 'discovering':
    case 'detecting':
    case 'normalizing':
    case 'staged':
    case 'committing':
    case 'success':
    case 'partial_success':
    case 'completed':
    case 'completed_with_warnings':
    case 'failed':
    case 'cancelled':
    case 'recoverable_stuck':
    case 'unknown':
      return value
    case 'pending':
      return 'queued'
    case 'processing':
      return 'detecting'
    default:
      return 'unknown'
  }
}
