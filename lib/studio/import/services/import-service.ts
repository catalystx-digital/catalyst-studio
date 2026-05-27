import { ImportJobRepository } from '../repositories/import-job.repository';
import { ImportJobStatus } from '../types/import-job.types';
import type { ImportJob, PrismaClient } from '@/lib/generated/prisma';
import { prisma } from '@/lib/prisma';
import { ImportProgressManager } from './import-progress-manager';
import { SitemapDiscoveryService, type ExpandedImportUrls } from './sitemap-discovery.service';
import { ImportPlannerService } from './import-planner';
import type { ImportPlannerInput, ImportPlan } from '../types/import-planner.types';
import { ConcurrencyConfig, LoggingConfig, type ImportModelMode } from '../config';
import { ImportRunService } from './import-run-service';
import { ImportDraftMaterializer } from './import-draft-materializer';

const importDb = prisma as unknown as PrismaClient;

/**
 * Options for starting an import job.
 * Supports flexible URL input via the import planner.
 */
export interface ImportServiceOptions {
  websiteId: string;
  accountId: string;
  /** Single URL (existing behavior) */
  url?: string;
  /** Multiple specific URLs (new) */
  urls?: string[];
  /** Natural language request (new) */
  request?: string;
  /** Whether to crawl subpages (default: true) */
  followSubpages?: boolean;
  /** Max link depth (default: 3) */
  maxDepth?: number;
  idempotencyKey?: string;
  modelMode?: ImportModelMode;
  modelChain?: string;
}

interface StartImportResult {
  job: ImportJob;
  message: string;
  initialSitemap?: Array<{ url: string; order: number; status: 'pending' | 'processing' | 'ready' | 'failed' | 'skipped'; error?: string }>;
}

function mergeDiscoveredUrls(primary: ExpandedImportUrls, fallback: ExpandedImportUrls): ExpandedImportUrls {
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const url of [...primary.urls, ...fallback.urls]) {
    const key = normalizeUrlForMerge(url);
    if (seen.has(key)) continue;
    seen.add(key);
    urls.push(url);
  }
  const sitemapMetaByUrl = new Map(primary.sitemapMetaByUrl);
  fallback.sitemapMetaByUrl.forEach((value, key) => {
    if (!sitemapMetaByUrl.has(key)) sitemapMetaByUrl.set(key, value);
  });
  return {
    urls,
    sitemapMetaByUrl,
    detectedPlatform: primary.detectedPlatform ?? fallback.detectedPlatform,
    skipped: [...(primary.skipped ?? []), ...(fallback.skipped ?? [])],
    injectedPriorityUrls: [
      ...(primary.injectedPriorityUrls ?? []),
      ...(fallback.injectedPriorityUrls ?? []),
    ],
  };
}

function normalizeUrlForMerge(value: string): string {
  try {
    const url = new URL(value);
    url.hash = '';
    url.hostname = url.hostname.toLowerCase();
    if (url.pathname.length > 1 && url.pathname.endsWith('/')) {
      url.pathname = url.pathname.slice(0, -1);
    }
    return url.toString();
  } catch {
    return value.trim().toLowerCase();
  }
}

function shouldUseCrawlFallback(sourceUrl: string, discoveredUrls: string[]): boolean {
  if (discoveredUrls.length === 0) return true;
  if (discoveredUrls.length > 1) return false;
  try {
    const source = new URL(sourceUrl);
    const discovered = new URL(discoveredUrls[0]);
    const isRoot = (value: URL) => value.pathname === '' || value.pathname === '/';
    return source.host === discovered.host && isRoot(source) && isRoot(discovered);
  } catch {
    return discoveredUrls.length <= 1;
  }
}

export class ImportService {
  private readonly repository: ImportJobRepository;
  private readonly progressManager: ImportProgressManager;
  private readonly sitemapDiscovery: SitemapDiscoveryService;
  private readonly planner: ImportPlannerService;
  private readonly runService: ImportRunService;
  private readonly draftMaterializer: ImportDraftMaterializer;

  constructor() {
    this.repository = new ImportJobRepository();
    this.progressManager = new ImportProgressManager(this.repository);
    this.sitemapDiscovery = new SitemapDiscoveryService();
    this.planner = new ImportPlannerService();
    this.runService = new ImportRunService();
    this.draftMaterializer = new ImportDraftMaterializer();
  }

  /**
   * Creates an import job and discovers the sitemap.
   * The actual import execution is handled by Vercel Workflow (triggered by caller).
   *
   * Now supports flexible URL input via the import planner:
   * - Single URL (backward compatible)
   * - Multiple specific URLs
   * - Natural language request
   */
  async startImport(options: ImportServiceOptions): Promise<StartImportResult> {
    const { accountId, websiteId, url, urls, request, followSubpages, maxDepth, idempotencyKey, modelMode, modelChain } = options;

    if (!accountId) {
      throw new Error('accountId is required to start an import job');
    }

    // Step 1: Determine import strategy via planner
    const plannerInput: ImportPlannerInput = {
      url,
      urls,
      request,
      followSubpages,
      maxDepth,
    };

    const plan = await this.planner.planImport(plannerInput);

    if (plan.urls.length === 0) {
      throw new Error('No valid URLs to import');
    }

    if (LoggingConfig.observe) {
      console.log(`[ImportService] Plan: ${plan.strategy}, URLs: ${plan.urls.length}, Reasoning: ${plan.reasoning}`);
    }

    // Use first URL for job record (primary URL)
    const primaryUrl = plan.urls[0];
    const message = `Preparing import (strategy: ${plan.strategy})...`;

    // Create the job in PENDING status
    const job = await importDb.$transaction(async (tx) => {
      const createdJob = await this.repository.create(
        {
          websiteId,
          url: primaryUrl,
          status: ImportJobStatus.PENDING,
        },
        tx,
      );

      await tx.importJob.update({
        where: { id: createdJob.id },
        data: {
          detectionResults: {
            progress: 0,
            lastProgressMessage: message,
            lastProgressUpdate: new Date().toISOString(),
            // Store the plan for workflow to use
            importPlan: {
              strategy: plan.strategy,
              urls: plan.urls,
              followLinks: plan.followLinks,
              linkScope: plan.linkScope,
              maxPages: plan.maxPages,
              reasoning: plan.reasoning,
              modelMode,
              modelChain,
            },
          },
        },
      });

      return createdJob;
    });

    // Step 2: Discover URLs based on strategy
    let precomputed: ExpandedImportUrls;
    const maxUrlsCap = ConcurrencyConfig.maxUrls;

    try {
      if (plan.strategy === 'sitemap') {
        // Use existing sitemap discovery for root domains
        precomputed = await this.sitemapDiscovery.expandUrlsForImport(plan.urls[0], maxUrlsCap);
        if (shouldUseCrawlFallback(plan.urls[0], precomputed.urls)) {
          const crawlFallback = await this.sitemapDiscovery.expandUrlsFromCrawl(plan.urls, {
            maxUrls: maxUrlsCap,
            followLinks: true,
            linkScope: 'same_domain',
          });
          precomputed = mergeDiscoveredUrls(precomputed, crawlFallback);
        }
      } else {
        // Use new crawl method for crawl_from_root or specific_urls
        precomputed = await this.sitemapDiscovery.expandUrlsFromCrawl(plan.urls, {
          maxUrls: maxUrlsCap,
          followLinks: plan.followLinks,
          linkScope: plan.linkScope,
        });
      }
    } catch (error) {
      console.warn('[ImportService] URL discovery failed before workflow start; continuing with planned URLs', {
        websiteId,
        strategy: plan.strategy,
        error: error instanceof Error ? error.message : String(error),
      });
      precomputed = {
        urls: plan.urls,
        sitemapMetaByUrl: new Map(),
        detectedPlatform: null,
        skipped: [],
      };
    }

    // Pre-discover sitemap for faster UI feedback
    let initialSitemap: Array<{ url: string; order: number; status: 'pending' | 'processing' | 'ready' | 'failed' | 'skipped'; error?: string }> = [];

    try {
      if (precomputed.urls.length > 0 || (precomputed.skipped && precomputed.skipped.length > 0)) {
        const skippedEntries = precomputed.skipped ?? [];
        const urlsLength = precomputed.urls.length;

        initialSitemap = [
          ...precomputed.urls.map((pageUrl, order) => ({
            url: pageUrl,
            order,
            status: 'pending' as const,
          })),
          ...skippedEntries.map((entry, idx) => ({
            url: entry.url,
            order: urlsLength + idx,
            status: 'skipped' as const,
            error: entry.reason,
          })),
        ];

        const totalCount = precomputed.urls.length + skippedEntries.length;
        await this.progressManager.patchDetectionResults(job.id, {
          sitemap: {
            ordered: precomputed.urls,
            pending: precomputed.urls,
            processing: [],
            completed: [],
            failed: [],
            skipped: skippedEntries.map(entry => entry.url),
            total: totalCount,
          },
          pages: initialSitemap,
          progressSummary: {
            processedCount: 0,
            totalCount,
            currentUrl: null,
          },
          // Preserve the import plan
          importPlan: {
            strategy: plan.strategy,
            urls: plan.urls,
            followLinks: plan.followLinks,
            linkScope: plan.linkScope,
            maxPages: plan.maxPages,
            reasoning: plan.reasoning,
            modelMode,
            modelChain,
          },
        });
      }
    } catch (error) {
      console.warn('[ImportService] Failed to seed initial sitemap for job', job.id, error);
    }

    await this.runService.createForJob({
      job,
      sourceUrl: primaryUrl,
      urls: precomputed.urls,
      idempotencyKey,
      message,
      importPlan: {
        strategy: plan.strategy,
        urls: plan.urls,
        followLinks: plan.followLinks,
        linkScope: plan.linkScope,
        maxPages: plan.maxPages,
        reasoning: plan.reasoning,
        modelMode,
        modelChain,
        discoveredUrls: precomputed.urls,
        skipped: precomputed.skipped ?? [],
      },
    });
    await this.draftMaterializer.materializeForJob(job.id);

    return { job, message, initialSitemap };
  }

  async updateProgress(
    jobId: string,
    status: ImportJobStatus,
    progress: number,
    message?: string,
    details?: Record<string, unknown>,
  ): Promise<void> {
    await this.progressManager.updateProgress(jobId, status, progress, message, details);
  }

  async getJobProgress(jobId: string): Promise<{
    status: string;
    progress: number;
    message?: string;
    stage?: string;
    websiteId?: string;
    metadata?: Record<string, unknown>;
  }> {
    const job = await this.repository.findById(jobId);
    if (!job) {
      throw new Error('Import job not found');
    }

    const detectionResults = job.detectionResults as Record<string, unknown> | null;
    const isCompleted =
      job.status === ImportJobStatus.COMPLETED ||
      job.status === ImportJobStatus.COMPLETED_WITH_WARNINGS;
    const progress = isCompleted ? 100 : (detectionResults?.progress as number) || 0;
    const message = detectionResults?.lastProgressMessage as string | undefined;
    const metadata = this.progressManager.normalizeJobMetadata(detectionResults);

    let stage = 'initializing';
    if (job.status === ImportJobStatus.CANCELLED) {
      stage = 'cancelled';
    } else if (job.status === ImportJobStatus.FAILED) {
      stage = 'failed';
    } else if (isCompleted) {
      stage = 'completed';
    } else if (progress > 0 && progress <= 30) {
      stage = 'fetching';
    } else if (progress > 30 && progress <= 60) {
      stage = 'analyzing';
    } else if (progress > 60 && progress <= 90) {
      stage = 'generating';
    } else if (progress > 90) {
      stage = 'creating';
    }

    return {
      status: job.status,
      progress,
      message,
      stage,
      websiteId: job.websiteId,
      metadata,
    };
  }

  async cancelImport(jobId: string): Promise<void> {
    const job = await this.repository.findById(jobId);
    if (!job) {
      throw new Error('Import job not found');
    }

    await this.repository.update(jobId, {
      status: ImportJobStatus.CANCELLED,
      errorMessage: 'Import cancelled by user',
      completedAt: new Date(),
    });
  }
}
