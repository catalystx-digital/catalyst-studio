import { prisma } from '@/lib/prisma'
import type { ImportJobMetadata, ImportJobStage, ImportJobViewModel } from '@/lib/studio/import/types/import-job-view-model'
import type { ImportSessionMode, ImportTrackerStatus } from '@/lib/studio/stores/import-tracker-store'
import type { WebsiteMediaReference } from '@/types/api'

const importDb = prisma as any

const DEFAULT_MODE: ImportSessionMode = 'new'
const ACTIVE_LEGACY_STATUSES = ['pending', 'processing', 'queued'] as const
const TERMINAL_LEGACY_STATUSES = ['completed', 'completed_with_warnings', 'failed', 'cancelled'] as const

type ProductStatus = NonNullable<ImportJobViewModel['productStatus']>

type ActivityRun = {
  id: string
  importJobId: string
  websiteId: string
  sourceUrl: string
  status: string
  phase: string
  progress: number
  message: string | null
  totalPages: number
  stagedPages: number
  committedPages: number
  failedPages: number
  recoverableActions: string[]
  lastError: unknown
  startedAt: Date | null
  completedAt: Date | null
  createdAt: Date
  updatedAt: Date
  pageStages?: Array<{
    sourceUrl: string
    canonicalUrl: string | null
    normalizedPageUrl: string
    title: string | null
    status: string
    phase: string
    error: unknown
    draftPageId: string | null
    draftStructureId: string | null
    committedPageId: string | null
  }>
  importJob: {
    id: string
    websiteId: string
    url: string
    status: string
    errorMessage: string | null
    startedAt: Date | null
    completedAt: Date | null
    createdAt: Date
    updatedAt: Date
  }
  website?: {
    id: string
    name: string | null
    icon: unknown
  } | null
}

type ActivityJob = {
  id: string
  websiteId: string
  url: string
  status: string
  detectionResults: unknown
  errorMessage: string | null
  startedAt: Date | null
  completedAt: Date | null
  createdAt: Date
  updatedAt: Date
  website?: {
    id: string
    name: string | null
    icon: unknown
  } | null
}

type ImportActivityListOptions = {
  requestedJobId?: string | null
  websiteId?: string | null
  limit?: number
  includePageStages?: boolean
}

export interface ImportProgressSnapshot {
  jobId: string
  status: ImportTrackerStatus
  productStatus: ProductStatus
  progress: number
  stage: ImportJobStage
  processedCount: number
  totalCount: number
  currentUrl: string | null
  error: string | null
  timestamp: string
  rawStatus: string | null
  recoverableActions: string[]
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const clampProgress = (raw: unknown, status: string): number => {
  if (status === 'success' || status === 'partial_success' || status === 'completed' || status === 'completed_with_warnings' || status === 'completed_with_redirects') {
    return 100
  }
  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.min(100, Math.max(0, Math.round(raw)))
  if (typeof raw === 'string') {
    const parsed = Number(raw)
    if (!Number.isNaN(parsed)) return Math.min(100, Math.max(0, Math.round(parsed)))
  }
  return 0
}

const normalizeWebsiteIcon = (value: unknown): string | WebsiteMediaReference | null => {
  if (value === null || value === undefined) return null
  if (typeof value === 'string') return value
  if (typeof value === 'object') {
    try {
      return JSON.parse(JSON.stringify(value)) as WebsiteMediaReference
    } catch {
      return null
    }
  }
  return null
}

function normalizeRunProductStatus(status: string | null | undefined, run?: Pick<ActivityRun, 'committedPages' | 'failedPages' | 'totalPages'>): ProductStatus {
  const value = (status ?? '').toLowerCase()
  switch (value) {
    case 'success':
    case 'completed':
      return 'success'
    case 'partial_success':
    case 'completed_with_warnings':
    case 'completed_with_redirects':
      return 'partial_success'
    case 'failed':
    case 'failed_terminal':
      return run && run.committedPages > 0 ? 'partial_success' : 'failed'
    case 'failed_retryable':
      return run && run.committedPages > 0 ? 'partial_success' : 'recoverable_stuck'
    case 'cancelled':
      return 'cancelled'
    case 'recoverable_stuck':
      return 'recoverable_stuck'
    case 'queued':
    case 'running':
    case 'discovering':
    case 'importing':
    case 'detecting':
    case 'normalizing':
    case 'staged':
    case 'committing':
      return 'active'
    default:
      return 'unknown'
  }
}

function toTrackerStatus(productStatus: ProductStatus, rawStatus: string | null | undefined): ImportTrackerStatus {
  if (productStatus === 'success') return 'success'
  if (productStatus === 'partial_success') return 'partial_success'
  if (productStatus === 'recoverable_stuck') return 'recoverable_stuck'
  if (productStatus === 'unknown') return 'unknown'
  if (productStatus === 'active') {
    const value = (rawStatus ?? '').toLowerCase()
    if (value === 'queued') return 'queued'
    if (value === 'pending') return 'pending'
    return 'running'
  }
  return productStatus
}

function toLifecycleState(status: ImportTrackerStatus): ImportJobViewModel['state'] {
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

function mapRunStage(phase: string | null | undefined, productStatus: ProductStatus): ImportJobStage {
  if (productStatus === 'success' || productStatus === 'partial_success') return 'completed'
  if (productStatus === 'cancelled') return 'cancelled'
  if (productStatus === 'failed') return 'failed'
  if (productStatus === 'recoverable_stuck' || productStatus === 'unknown') return 'unknown'
  switch (phase) {
    case 'queued':
      return 'queued'
    case 'discover_urls':
      return 'fetching'
    case 'detect_page':
    case 'normalize_page_content':
      return 'analyzing'
    case 'commit_page':
      return 'creating'
    case 'run_finalize':
      return 'finalizing'
    case 'enrichment':
      return 'generating'
    default:
      return 'initializing'
  }
}

function mapLegacyProductStatus(status: string | null | undefined): ProductStatus {
  const value = (status ?? '').toLowerCase()
  switch (value) {
    case 'completed':
      return 'success'
    case 'completed_with_warnings':
      return 'partial_success'
    case 'failed':
      return 'failed'
    case 'cancelled':
      return 'cancelled'
    case 'pending':
    case 'queued':
    case 'processing':
      return 'active'
    default:
      return 'unknown'
  }
}

function mapLegacyStage(status: string, progress: number, productStatus: ProductStatus): ImportJobStage {
  if (productStatus === 'success' || productStatus === 'partial_success') return 'completed'
  if (productStatus === 'cancelled') return 'cancelled'
  if (productStatus === 'failed') return 'failed'
  if (productStatus === 'unknown' || productStatus === 'recoverable_stuck') return 'unknown'
  if (status === 'queued') return 'queued'
  if (progress <= 0) return 'initializing'
  if (progress <= 30) return 'fetching'
  if (progress <= 60) return 'analyzing'
  if (progress <= 90) return 'generating'
  return 'creating'
}

function mapPageStageStatus(status: string | null | undefined, phase?: string | null): string {
  const value = (status ?? '').trim().toLowerCase()
  switch (value) {
    case 'pending':
    case 'queued':
    case 'discovered':
      return 'pending'
    case 'detecting':
    case 'detected':
    case 'processing':
    case 'analyzing':
    case 'normalizing':
    case 'normalized':
    case 'staged':
    case 'draft_created':
      return 'processing'
    case 'committing':
      return 'processing'
    case 'committed':
    case 'ready':
    case 'completed':
    case 'success':
      return 'ready'
    case 'failed_retryable':
    case 'failed_terminal':
    case 'failed':
      return 'failed'
    case 'recoverable_stuck':
    case 'unknown':
      return 'invalid'
    case 'skipped':
    case 'skipped_existing':
      return 'skipped'
    case 'redirect_created':
      return 'ready'
    default:
      return phase === 'commit_page' ? 'processing' : 'pending'
  }
}

function extractMessage(detection: Record<string, unknown> | null, fallback?: string | null): string | null {
  if (fallback && fallback.trim()) return fallback
  const message = detection?.lastProgressMessage
  return typeof message === 'string' ? message : null
}

function toStringArray(value: unknown): string[] | undefined {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : undefined
}

function extractLegacyPages(value: unknown): ImportJobMetadata['pages'] | undefined {
  if (!Array.isArray(value)) return undefined
  const pages: NonNullable<ImportJobMetadata['pages']> = []
  value.filter(isRecord).forEach((page, index) => {
    const url =
      typeof page.url === 'string'
        ? page.url
        : typeof page.pageUrl === 'string'
          ? page.pageUrl
          : typeof page.sourceUrl === 'string'
            ? page.sourceUrl
            : ''
    if (!url) return
    const rawStatus = typeof page.rawStatus === 'string'
      ? page.rawStatus
      : typeof page.status === 'string'
        ? page.status
        : 'ready'
    const normalizedStatus = rawStatus.startsWith('import-') ? rawStatus.slice('import-'.length) : rawStatus
    pages.push({
      url,
      order: typeof page.order === 'number' ? page.order : index,
      status: mapPageStageStatus(normalizedStatus),
      ...(typeof page.normalizedPageUrl === 'string' ? { normalizedPageUrl: page.normalizedPageUrl } : {}),
      rawStatus,
      ...(typeof page.phase === 'string' ? { phase: page.phase } : {}),
      title: typeof page.title === 'string' ? page.title : null,
      committedPageId:
        typeof page.committedPageId === 'string'
          ? page.committedPageId
          : typeof page.pageId === 'string'
            ? page.pageId
            : null,
      ...(typeof page.error === 'string' ? { error: page.error } : {}),
    })
  })
  return pages.length > 0 ? pages : undefined
}

function extractLegacyMetadata(detection: Record<string, unknown> | null): ImportJobMetadata | undefined {
  if (!detection) return undefined
  const metadata: ImportJobMetadata = {}
  if (isRecord(detection.sitemap)) {
    metadata.sitemap = {
      ordered: toStringArray(detection.sitemap.ordered),
      pending: toStringArray(detection.sitemap.pending),
      processing: toStringArray(detection.sitemap.processing),
      completed: toStringArray(detection.sitemap.completed),
      failed: toStringArray(detection.sitemap.failed),
      skipped: toStringArray(detection.sitemap.skipped),
      total: typeof detection.sitemap.total === 'number' ? detection.sitemap.total : undefined,
    }
  }
  if (isRecord(detection.progressSummary)) {
    metadata.progressSummary = {
      processedCount: typeof detection.progressSummary.processedCount === 'number' ? detection.progressSummary.processedCount : undefined,
      totalCount: typeof detection.progressSummary.totalCount === 'number' ? detection.progressSummary.totalCount : undefined,
      currentUrl:
        typeof detection.progressSummary.currentUrl === 'string' || detection.progressSummary.currentUrl === null
          ? detection.progressSummary.currentUrl ?? null
          : undefined,
    }
  }
  const pages = extractLegacyPages(detection.pages)
  if (pages) {
    metadata.pages = pages
  }
  if (isRecord(detection.mediaDiagnostics)) {
    const diagnostics = detection.mediaDiagnostics
    const media: Required<ImportJobMetadata>['media'] = {}
    if (typeof diagnostics.assetsDetected === 'number') media.assetsDetected = diagnostics.assetsDetected
    if (typeof diagnostics.ingestWarningCount === 'number') media.ingestWarningCount = diagnostics.ingestWarningCount
    if (typeof diagnostics.missingSrcCount === 'number') media.missingSrcCount = diagnostics.missingSrcCount
    if (Array.isArray(diagnostics.missingSrcByPage)) {
      media.missingSrcByPage = diagnostics.missingSrcByPage
        .filter(isRecord)
        .map((entry) => ({
          pageUrl: typeof entry.pageUrl === 'string' ? entry.pageUrl : '',
          count: typeof entry.count === 'number' ? entry.count : 0,
        }))
        .filter((entry) => entry.pageUrl)
    }
    if (Array.isArray(diagnostics.missingSrcEntries)) {
      media.missingSrcEntries = diagnostics.missingSrcEntries
        .filter(isRecord)
        .map((entry) => ({
          ...(typeof entry.pageUrl === 'string' ? { pageUrl: entry.pageUrl } : {}),
          parentType: typeof entry.parentType === 'string' ? entry.parentType : '',
          ...(typeof entry.field === 'string' ? { field: entry.field } : {}),
          ...(typeof entry.childType === 'string' ? { childType: entry.childType } : {}),
          ...(typeof entry.mediaId === 'string' ? { mediaId: entry.mediaId } : {}),
          message: typeof entry.message === 'string' ? entry.message : '',
        }))
        .filter((entry) => entry.parentType && entry.message)
    }
    if (Object.keys(media).length > 0) metadata.media = media
  }
  return Object.keys(metadata).length > 0 ? metadata : undefined
}

function pageStageMetadata(run: ActivityRun): ImportJobMetadata {
  const stages = run.pageStages ?? []
  const pages = stages.map((stage, index) => ({
    url: stage.sourceUrl,
    normalizedPageUrl: stage.normalizedPageUrl,
    order: index,
    status: mapPageStageStatus(stage.status, stage.phase),
    rawStatus: stage.status,
    phase: stage.phase,
    title: stage.title,
    committedPageId: stage.committedPageId,
    draftPageId: stage.draftPageId,
    draftStructureId: stage.draftStructureId,
    ...(stage.error ? { error: typeof stage.error === 'string' ? stage.error : JSON.stringify(stage.error) } : {}),
  }))
  const current = stages.find((stage) => {
    const uiStatus = mapPageStageStatus(stage.status, stage.phase)
    return uiStatus === 'processing'
  })
  const processedPages = stages.filter(stage =>
    ['detected', 'staged', 'committed', 'failed_retryable', 'failed_terminal', 'skipped', 'skipped_existing', 'redirect', 'redirect_created'].includes(stage.status)
  ).length
  const detectedPages = stages.filter(stage => stage.status === 'detected').length
  const processingPages = stages.filter(stage => ['processing', 'normalizing', 'normalized', 'draft_created'].includes(stage.status)).length
  const skippedPages = stages.filter(stage => ['skipped', 'skipped_existing'].includes(stage.status)).length
  return {
    importRun: {
      runId: run.id,
      phase: run.phase,
      recoverableActions: run.recoverableActions,
      productStatus: normalizeRunProductStatus(run.status, run),
      pages: {
        total: run.totalPages,
        staged: run.stagedPages,
        committed: run.committedPages,
        failed: run.failedPages,
        skipped: skippedPages,
        discovered: stages.length,
        processed: processedPages,
        detected: detectedPages,
        processing: processingPages,
      },
    },
    pages,
    progressSummary: {
      processedCount: processedPages,
      totalCount: run.totalPages,
      currentUrl: current?.sourceUrl ?? null,
      discoveredCount: stages.length,
      processingCount: processingPages,
      detectedCount: detectedPages,
      stagedCount: run.stagedPages,
      committedCount: run.committedPages,
      failedCount: run.failedPages,
      skippedCount: skippedPages,
    },
    ...(run.lastError ? { lastError: run.lastError } : {}),
  }
}

export class ImportActivityReadService {
  async listForAccount(accountId: string, options: ImportActivityListOptions = {}): Promise<ImportJobViewModel[]> {
    const limit = options.limit ?? 20
    const includePageStages = options.includePageStages ?? Boolean(options.requestedJobId)
    const [runs, legacyJobs] = await Promise.all([
      importDb.importRun.findMany({
        where: {
          website: { accountId },
          ...(options.requestedJobId ? { importJobId: options.requestedJobId } : {}),
          ...(options.websiteId ? { websiteId: options.websiteId } : {}),
        },
        include: this.runInclude(includePageStages),
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
        take: limit,
      }),
      importDb.importJob.findMany({
        where: {
          website: { accountId },
          ...(options.websiteId ? { websiteId: options.websiteId } : {}),
          importRuns: { none: {} },
          OR: [
            { status: { in: [...ACTIVE_LEGACY_STATUSES, ...TERMINAL_LEGACY_STATUSES] } },
            ...(options.requestedJobId ? [{ id: options.requestedJobId }] : []),
          ],
        },
        include: this.jobInclude(),
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
        take: limit,
      }),
    ])

    return [...runs.map((run: ActivityRun) => this.toRunViewModel(run)), ...legacyJobs.map((job: ActivityJob) => this.toLegacyViewModel(job))]
      .filter((item, index, items) => items.findIndex((candidate) => candidate.id === item.id) === index)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, limit)
  }

  async getForJob(accountId: string, jobId: string): Promise<ImportJobViewModel | null> {
    const run = await importDb.importRun.findFirst({
      where: { importJobId: jobId, website: { accountId } },
      include: this.runInclude(true),
    })
    if (run) return this.toRunViewModel(run)

    const job = await importDb.importJob.findFirst({
      where: { id: jobId, website: { accountId } },
      include: this.jobInclude(),
    })
    return job ? this.toLegacyViewModel(job) : null
  }

  async getForJobByWebsite(websiteId: string, jobId: string): Promise<ImportJobViewModel | null> {
    if (typeof importDb.importRun?.findFirst !== 'function') {
      return null
    }
    const run = await importDb.importRun.findFirst({
      where: { importJobId: jobId, websiteId },
      include: this.runInclude(true),
    })
    if (run) return this.toRunViewModel(run)

    const job = await importDb.importJob.findFirst({
      where: { id: jobId, websiteId },
      include: this.jobInclude(),
    })
    return job ? this.toLegacyViewModel(job) : null
  }

  async getProgressSnapshot(accountId: string, jobId: string): Promise<ImportProgressSnapshot | null> {
    const view = await this.getForJob(accountId, jobId)
    if (!view) return null
    const summary = isRecord(view.metadata?.progressSummary) ? view.metadata?.progressSummary : {}
    const importRun = isRecord(view.metadata?.importRun) ? view.metadata?.importRun : {}
    const runPages = isRecord(importRun.pages) ? importRun.pages : {}
    return {
      jobId: view.id,
      status: view.status,
      productStatus: view.productStatus ?? 'unknown',
      progress: view.progress,
      stage: view.stage,
      processedCount:
        typeof summary.processedCount === 'number'
          ? summary.processedCount
          : typeof runPages.committed === 'number'
            ? runPages.committed
            : 0,
      totalCount:
        typeof summary.totalCount === 'number'
          ? summary.totalCount
          : typeof runPages.total === 'number'
            ? runPages.total
            : 0,
      currentUrl: typeof summary.currentUrl === 'string' || summary.currentUrl === null ? summary.currentUrl ?? null : null,
      error: view.status === 'failed' || view.status === 'unknown' || view.status === 'recoverable_stuck' ? view.message : null,
      timestamp: view.updatedAt,
      rawStatus: view.rawStatus ?? null,
      recoverableActions: Array.isArray(importRun.recoverableActions)
        ? importRun.recoverableActions.filter((action): action is string => typeof action === 'string')
        : [],
    }
  }

  private runInclude(includePageStages = true) {
    const include: Record<string, unknown> = {
      importJob: true,
      website: { select: { id: true, name: true, icon: true } },
    }
    if (includePageStages) {
      include.pageStages = {
        orderBy: { firstSeenAt: 'asc' },
        select: {
          sourceUrl: true,
          canonicalUrl: true,
          normalizedPageUrl: true,
          title: true,
          status: true,
          phase: true,
          error: true,
          draftPageId: true,
          draftStructureId: true,
          committedPageId: true,
        },
      }
    }
    return include
  }

  private jobInclude() {
    return { website: { select: { id: true, name: true, icon: true } } }
  }

  private toRunViewModel(run: ActivityRun): ImportJobViewModel {
    const productStatus = normalizeRunProductStatus(run.status, run)
    const status = toTrackerStatus(productStatus, run.status)
    const progress = clampProgress(run.progress, status)
    const metadata = pageStageMetadata(run)

    return {
      id: run.importJobId,
      websiteId: run.websiteId,
      url: run.sourceUrl,
      status,
      rawStatus: run.status,
      productStatus,
      progress,
      stage: mapRunStage(run.phase, productStatus),
      message: run.message ?? run.importJob.errorMessage ?? null,
      state: toLifecycleState(status),
      mode: DEFAULT_MODE,
      startedAt: run.startedAt ? run.startedAt.toISOString() : run.importJob.startedAt ? run.importJob.startedAt.toISOString() : null,
      updatedAt: run.updatedAt.toISOString(),
      completedAt: run.completedAt ? run.completedAt.toISOString() : run.importJob.completedAt ? run.importJob.completedAt.toISOString() : null,
      createdAt: run.createdAt.toISOString(),
      queuePosition: null,
      estimatedStartSeconds: null,
      metadata,
      website: run.website
        ? { id: run.website.id, name: run.website.name, icon: normalizeWebsiteIcon(run.website.icon) }
        : null,
    }
  }

  private toLegacyViewModel(job: ActivityJob): ImportJobViewModel {
    const detection = isRecord(job.detectionResults) ? job.detectionResults : null
    const productStatus = mapLegacyProductStatus(job.status)
    const status = toTrackerStatus(productStatus, job.status)
    const progress = clampProgress(detection?.progress, status)
    return {
      id: job.id,
      websiteId: job.websiteId,
      url: job.url,
      status,
      rawStatus: job.status,
      productStatus,
      progress,
      stage: mapLegacyStage(job.status, progress, productStatus),
      message: extractMessage(detection, job.errorMessage),
      state: toLifecycleState(status),
      mode: DEFAULT_MODE,
      startedAt: job.startedAt ? job.startedAt.toISOString() : null,
      updatedAt: job.updatedAt.toISOString(),
      completedAt: job.completedAt ? job.completedAt.toISOString() : null,
      createdAt: job.createdAt.toISOString(),
      queuePosition: detection && typeof detection.queuePosition === 'number' ? detection.queuePosition : null,
      estimatedStartSeconds: detection && typeof detection.estimatedStartSeconds === 'number' ? detection.estimatedStartSeconds : null,
      metadata: extractLegacyMetadata(detection),
      website: job.website ? { id: job.website.id, name: job.website.name, icon: normalizeWebsiteIcon(job.website.icon) } : null,
    }
  }
}
