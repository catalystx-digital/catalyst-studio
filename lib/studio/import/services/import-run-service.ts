import { createHash, randomUUID } from 'node:crypto'

import type { ImportJob, Prisma } from '@/lib/generated/prisma'
import { prisma } from '@/lib/prisma'
import { normalizePath } from '@/lib/studio/import/utils/path-utils'
import { studioEventBus, type StudioEventRecord } from '@/lib/studio/activity/studio-event-bus'
import { ImportActivityReadService } from './import-activity-read-service'
import { ImportDraftMaterializer } from './import-draft-materializer'

const importDb = prisma as any

export type ImportRunStatus =
  | 'queued'
  | 'discovering'
  | 'importing'
  | 'committing'
  | 'completed'
  | 'completed_with_warnings'
  | 'completed_with_redirects'
  | 'failed_retryable'
  | 'failed_terminal'
  | 'cancelled'
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
  'completed',
  'completed_with_warnings',
  'completed_with_redirects',
  'failed_retryable',
  'failed_terminal',
  'cancelled',
  'unknown',
])

const PROCESSED_STAGE_STATUSES = [
  'detected',
  'staged',
  'committed',
  'failed_retryable',
  'failed_terminal',
  'skipped_existing',
  'redirect',
  'redirect_created',
]

const STAGED_STAGE_STATUSES = [
  'processing',
  'detected',
  'normalized',
  'draft_created',
  'staged',
  'committed',
]

const PROTECTED_STAGE_STATUSES = new Set([
  'committed',
  'failed_terminal',
  'skipped_existing',
  'redirect',
  'redirect_created',
])

const FAILURE_STAGE_STATUSES = new Set(['failed_retryable', 'failed_terminal'])

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

function cryptoRandomToken(): string {
  return randomUUID()
}

export class ImportRunService {
  private readonly activityReadService = new ImportActivityReadService()
  private readonly draftMaterializer = new ImportDraftMaterializer()

  async createForJob(input: {
    job: Pick<ImportJob, 'id' | 'websiteId' | 'url' | 'createdAt' | 'startedAt'>
    sourceUrl: string
    urls: string[]
    idempotencyKey?: string | null
    importPlan?: Prisma.InputJsonValue
    message?: string
  }) {
    const sourceUrl = input.sourceUrl || input.job.url
    const normalizedSourceUrl = normalizeImportUrl(sourceUrl)
    const uniqueUrls = Array.from(new Map(input.urls.map((url) => [normalizePath(normalizeImportUrl(url)), url])).values())
    let eventToPublish: StudioEventRecord | null = null

    const run = await importDb.$transaction(async (tx: any) => {
      const run = await tx.importRun.upsert({
        where: { importJobId: input.job.id },
        create: {
          importJobId: input.job.id,
          websiteId: input.job.websiteId,
          sourceUrl,
          normalizedSourceUrl,
          idempotencyKey: input.idempotencyKey ?? null,
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
          idempotencyKey: input.idempotencyKey ?? null,
          message: input.message ?? 'Import queued',
          totalPages: uniqueUrls.length,
          importPlan: input.importPlan,
        },
      })

      for (const pageUrl of uniqueUrls) {
        const attemptToken = cryptoRandomToken()
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
            status: 'discovered',
            phase: 'queued',
            attemptToken,
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

      eventToPublish = await studioEventBus.publishInTransaction(tx, {
        websiteId: input.job.websiteId,
        type: 'import.run.updated',
        source: 'import',
        resourceType: 'importRun',
        resourceId: run.id,
        payload: {
          jobId: input.job.id,
          status: run.status,
          phase: run.phase,
          progress: run.progress,
          message: run.message,
          foundCount: uniqueUrls.length,
          discoveredCount: uniqueUrls.length,
          processedCount: 0,
          committedCount: 0,
          importedCount: 0,
          failedCount: 0,
          skippedCount: 0,
        },
      })

      return run
    })

    if (eventToPublish) {
      await studioEventBus.publishAfterCommit(eventToPublish)
    }
    await this.publishActivityProjection(input.job.websiteId, input.job.id, run.id, 'import.run.updated')

    return run
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

    const updated = await importDb.importRun.update({
      where: { id: run.id },
      data,
    })

    const eventType = isTerminalImportRunStatus(input.status) ? 'import.run.completed' : 'import.run.updated'
    await studioEventBus.publish({
      websiteId: run.websiteId,
      type: eventType,
      source: 'import',
      resourceType: 'importRun',
      resourceId: run.id,
      payload: {
        jobId,
        status: updated.status,
        phase: updated.phase,
        progress: updated.progress,
        message: updated.message,
        foundCount: updated.totalPages,
        importedCount: updated.committedPages,
        failedCount: updated.failedPages,
      },
    })
    await this.publishActivityProjection(run.websiteId, jobId, run.id, eventType)

    return updated
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
      attemptToken?: string | null
    },
  ) {
    const run = await this.findByJobId(jobId)
    if (!run) return null

    const normalizedPageUrl = normalizeImportUrl(input.canonicalUrl || input.pageUrl)
    const requestedStatus = normalizePageStageStatus(input.status)
    const emptyCommittedContentError =
      requestedStatus === 'committed' && !hasImportPageComponents(input.pageContent)
        ? ({
            code: 'EMPTY_IMPORT_PAGE_CONTENT',
            message: 'Import page content has no components and cannot be committed',
            pageUrl: input.pageUrl,
          } satisfies Prisma.InputJsonValue)
        : null
    const canonicalStatus = emptyCommittedContentError ? 'failed_terminal' : requestedStatus
    const pageContent = input.pageContent
    const contentFingerprint = pageContent ? fingerprintImportContent(pageContent) : undefined
    const nextAttemptToken = input.attemptToken || cryptoRandomToken()
    const error =
      emptyCommittedContentError
        ? emptyCommittedContentError
        : input.error !== undefined
        ? input.error
        : ['processing', 'detected', 'normalized', 'draft_created', 'committed', 'redirect_created'].includes(canonicalStatus)
          ? null
          : undefined

    const existingStage = await importDb.importPageStage.findUnique({
      where: {
        runId_normalizedPageUrl: { runId: run.id, normalizedPageUrl },
      },
      select: { id: true, status: true, attemptToken: true },
    })

    let stage: any
    if (!existingStage) {
      stage = await importDb.importPageStage.create({
        data: {
          runId: run.id,
          websiteId: run.websiteId,
          sourceUrl: input.pageUrl,
          canonicalUrl: input.canonicalUrl ?? null,
          normalizedPageUrl,
          normalizedPath: normalizePath(input.canonicalUrl || input.pageUrl),
          title: input.title ?? null,
          status: canonicalStatus,
          phase: input.phase ?? 'detect_page',
          detectionPayload: input.detectionPayload,
          pageContent,
          structureCandidate: input.structureCandidate,
          committedPageId: canonicalStatus === 'committed' ? input.committedPageId ?? null : null,
          contentFingerprint,
          error,
          committedAt: canonicalStatus === 'committed' ? new Date() : undefined,
          attempts: 1,
          attemptToken: nextAttemptToken,
          lastAttemptAt: new Date(),
        },
      })
    } else {
      const existingStatus = normalizePageStageStatus(existingStage.status)
      const isProtected = PROTECTED_STAGE_STATUSES.has(existingStatus)
      if (isProtected) {
        return importDb.importPageStage.findUnique({ where: { id: existingStage.id } })
      }

      const tokenMatches = !input.attemptToken || !existingStage.attemptToken || existingStage.attemptToken === input.attemptToken
      if (!tokenMatches) {
        return importDb.importPageStage.findUnique({ where: { id: existingStage.id } })
      }

      const updateResult = await importDb.importPageStage.updateMany({
        where: {
          id: existingStage.id,
          ...(input.attemptToken ? { attemptToken: input.attemptToken } : {}),
        },
        data: {
          sourceUrl: input.pageUrl,
          canonicalUrl: input.canonicalUrl ?? null,
          normalizedPath: normalizePath(input.canonicalUrl || input.pageUrl),
          title: input.title ?? undefined,
          status: canonicalStatus,
          phase: input.phase ?? 'detect_page',
          detectionPayload: input.detectionPayload,
          pageContent,
          structureCandidate: input.structureCandidate,
          committedPageId: canonicalStatus === 'committed' ? input.committedPageId ?? undefined : null,
          contentFingerprint,
          ...(error !== undefined ? { error } : {}),
          committedAt: canonicalStatus === 'committed' ? new Date() : undefined,
          ...(input.attemptToken ? {} : { attemptToken: existingStage.attemptToken ?? nextAttemptToken }),
          ...(FAILURE_STAGE_STATUSES.has(canonicalStatus) ? { attempts: { increment: 1 } } : {}),
          lastAttemptAt: new Date(),
        },
      })

      if (updateResult.count === 0) {
        return importDb.importPageStage.findUnique({ where: { id: existingStage.id } })
      }
      stage = await importDb.importPageStage.findUnique({ where: { id: existingStage.id } })
    }

    const [stagedPages, failedPages, committedPages, processedPages, skippedPages, discoveredPages] = await Promise.all([
      importDb.importPageStage.count({ where: { runId: run.id, status: { in: STAGED_STAGE_STATUSES } } }),
      importDb.importPageStage.count({ where: { runId: run.id, status: { in: ['failed_retryable', 'failed_terminal', 'skipped_existing'] } } }),
      importDb.importPageStage.count({ where: { runId: run.id, status: 'committed' } }),
      importDb.importPageStage.count({ where: { runId: run.id, status: { in: PROCESSED_STAGE_STATUSES } } }),
      importDb.importPageStage.count({ where: { runId: run.id, status: { in: ['skipped_existing'] } } }),
      importDb.importPageStage.count({ where: { runId: run.id } }),
    ])

    await importDb.importRun.update({
      where: { id: run.id },
      data: {
        stagedPages,
        failedPages,
        committedPages,
        totalPages: Math.max(run.totalPages, discoveredPages),
      },
    })

    await studioEventBus.publish({
      websiteId: run.websiteId,
      type: 'import.page.updated',
      source: 'import',
      resourceType: 'importPageStage',
      resourceId: stage.id,
      payload: {
        jobId,
        pageUrl: stage.sourceUrl,
        normalizedPageUrl: stage.normalizedPageUrl,
        status: stage.status,
        phase: stage.phase,
        title: stage.title,
        draftPageId: stage.draftPageId,
        draftStructureId: stage.draftStructureId,
        committedPageId: stage.committedPageId,
        foundCount: Math.max(run.totalPages, discoveredPages),
        discoveredCount: Math.max(run.totalPages, discoveredPages),
        importedCount: committedPages,
        failedCount: failedPages,
        skippedCount: skippedPages,
        processedCount: processedPages,
        stagedCount: stagedPages,
        committedCount: committedPages,
      },
    })
    await this.draftMaterializer.updateDraftForStage(jobId, stage.id, mapStageToDraftStatus(stage.status))
    await this.publishActivityProjection(run.websiteId, jobId, run.id, 'import.page.updated')

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
    const run = await this.findByJobId(jobId)
    await this.updateProgressForJob(jobId, {
      status: 'cancelled',
      phase: 'cancelled',
      message,
      recoverableActions: [],
      cancellationRequestedAt: new Date(),
      completedAt: new Date(),
    })
    if (!run) return
    const stages = await importDb.importPageStage.findMany({
      where: { runId: run.id, committedPageId: null },
      select: { id: true },
    })
    await Promise.all(stages.map((stage: { id: string }) => this.draftMaterializer.updateDraftForStage(jobId, stage.id, 'cancelled')))
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

    const [committedPages, failedPages, skippedPages, redirectPages, totalPages] = await Promise.all([
      importDb.importPageStage.count({ where: { runId: run.id, status: 'committed' } }),
      importDb.importPageStage.count({ where: { runId: run.id, status: { in: ['failed_retryable', 'failed_terminal'] } } }),
      importDb.importPageStage.count({ where: { runId: run.id, status: { in: ['skipped_existing'] } } }),
      importDb.importPageStage.count({ where: { runId: run.id, status: 'redirect_created' } }),
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
        status: 'completed_with_warnings',
        message: `Import completed with ${failedPages + skippedPages} page warning${failedPages + skippedPages === 1 ? '' : 's'}`,
        totalPages,
        committedPages,
        failedPages: failedPages + skippedPages,
      }
    }

    if (committedPages > 0) {
      return {
        status: redirectPages > 0 ? 'completed_with_redirects' : 'completed',
        message: 'Import completed',
        totalPages,
        committedPages,
        failedPages: 0,
      }
    }

    if (redirectPages > 0 && failedPages + skippedPages === 0) {
      return {
        status: 'completed_with_redirects',
        message: 'Import completed with redirects only',
        totalPages,
        committedPages: 0,
        failedPages: 0,
      }
    }

    return {
      status: failedPages > 0 ? 'failed_retryable' : 'failed_terminal',
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
        status === 'completed' || status === 'completed_with_warnings' || status === 'completed_with_redirects'
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

  private async publishActivityProjection(
    websiteId: string,
    jobId: string,
    runId: string,
    type: 'import.run.updated' | 'import.page.updated' | 'import.run.completed',
  ): Promise<void> {
    const activity = await this.activityReadService.getForJobByWebsite(websiteId, jobId)
    if (!activity) return
    await studioEventBus.publish({
      websiteId,
      type,
      source: 'import',
      resourceType: 'importRun',
      resourceId: runId,
      payload: {
        jobId,
        activity,
      },
    })
  }
}

function mapStageToDraftStatus(status: string): Parameters<ImportDraftMaterializer['updateDraftForStage']>[2] {
  switch (status) {
    case 'committed':
      return 'committed'
    case 'redirect_created':
      return 'committed'
    case 'processing':
    case 'draft_created':
      return 'staged'
    case 'detected':
      return 'detected'
    case 'normalized':
    case 'staged':
      return 'staged'
    case 'failed_retryable':
    case 'failed_terminal':
      return 'failed'
    case 'skipped_existing':
      return 'skipped_existing'
    default:
      return 'detecting'
  }
}

export function normalizeRunStatus(status: string | null | undefined): ImportRunStatus {
  const value = (status ?? 'queued').toLowerCase()
  switch (value) {
    case 'queued':
    case 'discovering':
    case 'importing':
    case 'committing':
    case 'completed':
    case 'completed_with_warnings':
    case 'completed_with_redirects':
    case 'failed_retryable':
    case 'failed_terminal':
    case 'cancelled':
    case 'unknown':
      return value
    case 'pending':
      return 'queued'
    case 'running':
    case 'processing':
    case 'detecting':
    case 'normalizing':
    case 'staged':
      return 'importing'
    case 'success':
    case 'partial_success':
      return 'completed_with_warnings'
    case 'failed':
    case 'recoverable_stuck':
      return 'failed_retryable'
    default:
      return 'unknown'
  }
}

export function normalizePageStageStatus(status: string | null | undefined): string {
  const value = (status ?? 'discovered').toLowerCase()
  switch (value) {
    case 'pending':
      return 'discovered'
    case 'detecting':
      return 'processing'
    case 'detected':
      return 'detected'
    case 'normalizing':
    case 'normalized':
      return 'normalized'
    case 'staged':
      return 'staged'
    case 'skipped':
      return 'skipped_existing'
    case 'ready':
    case 'completed':
    case 'success':
      return 'committed'
    case 'redirect':
      return 'redirect_created'
    default:
      return value
  }
}

function hasImportPageComponents(pageContent: Prisma.InputJsonValue | undefined): boolean {
  if (!pageContent || typeof pageContent !== 'object' || Array.isArray(pageContent)) {
    return false
  }
  const components = (pageContent as Record<string, unknown>).components
  return Array.isArray(components) && components.length > 0
}
