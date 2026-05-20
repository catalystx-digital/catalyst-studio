import { Prisma } from '@/lib/generated/prisma'
import { ImportJobRepository } from '../repositories/import-job.repository';
import { ImportJobStatus, UpdateImportJobDto } from '../types/import-job.types';
import { updateSystemEvent } from '@/lib/studio/import/utils/update-system-event';
import { UnifiedProgressTracker, createProgressTracker } from './unified-progress-tracker';
import type { ImportStage, ProgressCallback, ProgressUpdate } from '../types/progress.types';

// Minimum interval between database updates (ms)
const THROTTLE_INTERVAL_MS = 500;

// Map ImportJobStatus to ImportStage
const STATUS_TO_STAGE: Record<ImportJobStatus, ImportStage> = {
  [ImportJobStatus.PENDING]: 'queued',
  [ImportJobStatus.QUEUED]: 'queued',
  [ImportJobStatus.PROCESSING]: 'page_processing',
  [ImportJobStatus.COMPLETED]: 'completed',
  [ImportJobStatus.FAILED]: 'failed',
  [ImportJobStatus.CANCELLED]: 'failed',
};

interface PendingUpdate {
  jobId: string;
  status: ImportJobStatus;
  progress: number;
  message?: string;
  details?: Record<string, unknown>;
  timestamp: number;
}

export class ImportProgressManager {
  private pendingUpdates: Map<string, PendingUpdate> = new Map();
  private lastUpdateTime: Map<string, number> = new Map();
  private flushTimers: Map<string, NodeJS.Timeout> = new Map();
  private jobCache: Map<string, { data: any; timestamp: number }> = new Map();
  private readonly JOB_CACHE_TTL_MS = 5000;

  // Unified progress trackers per job (for single-message-per-import updates)
  private progressTrackers: Map<string, UnifiedProgressTracker> = new Map();

  constructor(private readonly repository: ImportJobRepository) {}

  /**
   * Initialize a unified progress tracker for a job.
   * Call this at the start of an import to enable single-message progress updates.
   */
  initializeTracker(
    jobId: string,
    websiteId: string,
    url: string,
    sessionId: string,
    accountId?: string
  ): UnifiedProgressTracker {
    // Clean up existing tracker if any
    const existing = this.progressTrackers.get(jobId);
    if (existing) {
      existing.destroy();
    }

    const tracker = createProgressTracker({
      jobId,
      websiteId,
      url,
      sessionId,
      accountId,
      debounceMs: THROTTLE_INTERVAL_MS,
    });

    this.progressTrackers.set(jobId, tracker);
    return tracker;
  }

  /**
   * Get the progress tracker for a job.
   */
  getTracker(jobId: string): UnifiedProgressTracker | undefined {
    return this.progressTrackers.get(jobId);
  }

  /**
   * Create a progress callback for subsystems to report progress.
   * Returns undefined if no tracker exists for the job.
   */
  createProgressCallback(jobId: string): ProgressCallback | undefined {
    const tracker = this.progressTrackers.get(jobId);
    return tracker ? tracker.createCallback() : undefined;
  }

  /**
   * Update progress via the unified tracker (preferred method).
   * Falls back to legacy behavior if no tracker exists.
   */
  updateTrackedProgress(jobId: string, update: ProgressUpdate): void {
    const tracker = this.progressTrackers.get(jobId);
    if (tracker) {
      tracker.update(update);
    }
  }

  /**
   * Set stage on the unified tracker.
   */
  setStage(jobId: string, stage: ImportStage, message?: string): void {
    const tracker = this.progressTrackers.get(jobId);
    if (tracker) {
      tracker.setStage(stage, message);
    }
  }

  private isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private deepMergeObjects(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = { ...target };
    for (const [key, value] of Object.entries(source)) {
      if (value === undefined) {
        continue;
      }
      const existing = result[key];
      if (this.isPlainObject(value)) {
        result[key] = this.deepMergeObjects(this.isPlainObject(existing) ? (existing as Record<string, unknown>) : {}, value);
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  private toStringArray(value: unknown): string[] | undefined {
    if (!Array.isArray(value)) {
      return undefined;
    }
    const result = value.filter((item): item is string => typeof item === 'string');
    return result.length > 0 ? result : undefined;
  }

  private async getCachedJob(jobId: string): Promise<any> {
    const cached = this.jobCache.get(jobId);
    const now = Date.now();
    if (cached && now - cached.timestamp < this.JOB_CACHE_TTL_MS) {
      return cached.data;
    }
    const job = await this.repository.findById(jobId);
    if (job) {
      this.jobCache.set(jobId, { data: job, timestamp: now });
    }
    return job;
  }

  private invalidateJobCache(jobId: string): void {
    this.jobCache.delete(jobId);
  }

  async patchDetectionResults(
    jobId: string,
    patch: Record<string, unknown>,
    update?: Partial<Omit<UpdateImportJobDto, 'detectionResults'>>
  ): Promise<Record<string, unknown>> {
    // Use fresh fetch for write operation to ensure consistency
    const job = await this.repository.findById(jobId);
    if (!job) {
      throw new Error('Import job ' + jobId + ' not found');
    }
    const existing = this.isPlainObject(job.detectionResults) ? (job.detectionResults as Record<string, unknown>) : {};
    const merged = this.deepMergeObjects(existing, patch);
    await this.repository.update(jobId, {
      detectionResults: merged as Prisma.JsonValue,
      ...(update ?? {}),
    });
    // Invalidate cache after write
    this.invalidateJobCache(jobId);
    return merged;
  }

  async updateProgress(
    jobId: string,
    status: ImportJobStatus,
    progress: number,
    message?: string,
    details?: Record<string, unknown>
  ): Promise<void> {
    const now = Date.now();
    const lastUpdate = this.lastUpdateTime.get(jobId) || 0;
    const timeSinceLastUpdate = now - lastUpdate;

    // Important status changes bypass throttling
    const isImportantStatus = status === ImportJobStatus.COMPLETED ||
                               status === ImportJobStatus.FAILED ||
                               status === ImportJobStatus.CANCELLED;

    // If within throttle interval and not an important status, queue the update
    if (timeSinceLastUpdate < THROTTLE_INTERVAL_MS && !isImportantStatus) {
      this.pendingUpdates.set(jobId, {
        jobId,
        status,
        progress,
        message,
        details,
        timestamp: now,
      });

      // Set up flush timer if not already set
      if (!this.flushTimers.has(jobId)) {
        const timer = setTimeout(() => {
          this.flushPendingUpdate(jobId);
        }, THROTTLE_INTERVAL_MS - timeSinceLastUpdate);
        this.flushTimers.set(jobId, timer);
      }
      return;
    }

    // Clear any pending timer for this job
    const existingTimer = this.flushTimers.get(jobId);
    if (existingTimer) {
      clearTimeout(existingTimer);
      this.flushTimers.delete(jobId);
    }
    this.pendingUpdates.delete(jobId);

    await this.executeProgressUpdate(jobId, status, progress, message, details);
    this.lastUpdateTime.set(jobId, Date.now());
  }

  private async flushPendingUpdate(jobId: string): Promise<void> {
    this.flushTimers.delete(jobId);
    const pending = this.pendingUpdates.get(jobId);
    if (!pending) {
      return;
    }
    this.pendingUpdates.delete(jobId);

    try {
      await this.executeProgressUpdate(
        pending.jobId,
        pending.status,
        pending.progress,
        pending.message,
        pending.details
      );
      this.lastUpdateTime.set(jobId, Date.now());
    } catch (error) {
      // Log but don't throw - this is a background flush
      console.warn('[ImportProgressManager] Failed to flush pending update:', error);
    }
  }

  private async executeProgressUpdate(
    jobId: string,
    status: ImportJobStatus,
    progress: number,
    message?: string,
    details?: Record<string, unknown>
  ): Promise<void> {
    const patch: Record<string, unknown> = {
      progress,
      lastProgressUpdate: new Date().toISOString(),
    };
    if (message !== undefined) {
      patch.lastProgressMessage = message;
    }
    const mergedPatch = details ? this.deepMergeObjects(patch, details) : patch;
    await this.patchDetectionResults(jobId, mergedPatch, { status });

    // Fire and forget system event logging to avoid blocking
    this.logSystemEvent(jobId, status, progress, message, details).catch((error) => {
      console.warn('[ImportProgressManager] Failed to log system event:', error);
    });
  }

  private async logSystemEvent(
    jobId: string,
    status: ImportJobStatus,
    progress: number,
    message?: string,
    details?: Record<string, unknown>
  ): Promise<void> {
    // If we have a unified tracker, it handles system events
    const tracker = this.progressTrackers.get(jobId);
    if (tracker) {
      // Tracker handles its own event updates
      return;
    }

    // Legacy path: use updateSystemEvent for jobs without a tracker
    try {
      // Use cached job data to avoid extra DB call
      const job = await this.getCachedJob(jobId);
      if (!job?.website || !job.website.accountId) {
        return;
      }

      const progressSnapshot = this.extractProgressSnapshot(details);
      const stage = STATUS_TO_STAGE[status] ?? 'page_processing';

      await updateSystemEvent({
        websiteId: job.websiteId,
        sessionId: `import-${job.websiteId}`, // Default session for legacy jobs
        accountId: job.website.accountId,
        jobId,
        content: message ?? `Import ${status.toLowerCase()}`,
        metadata: {
          type: 'import-progress',
          jobId,
          url: job.url,
          stage,
          progress,
          processedCount: typeof progressSnapshot.processedCount === 'number' ? progressSnapshot.processedCount : 0,
          totalCount: typeof progressSnapshot.totalCount === 'number' ? progressSnapshot.totalCount : 0,
          currentUrl: typeof progressSnapshot.currentUrl === 'string' ? progressSnapshot.currentUrl : null,
          status: status.toLowerCase(),
          message: message ?? `Import ${status.toLowerCase()}`,
          description: undefined,
          updatedAt: new Date().toISOString(),
          queuePosition: typeof progressSnapshot.queuePosition === 'number' ? progressSnapshot.queuePosition : null,
          estimatedStartSeconds: typeof progressSnapshot.estimatedStartSeconds === 'number' ? progressSnapshot.estimatedStartSeconds : null,
          skippedSummary: Array.isArray(details?.skippedSummary) ? details.skippedSummary as Array<{ url: string; reason: string }> : undefined,
        },
      });
    } catch (error) {
      if (process.env.NODE_ENV !== 'test') {
        console.warn('[ImportProgressManager] Failed to update system event', error);
      }
    }
  }

  private extractProgressSnapshot(details?: Record<string, unknown>): Record<string, unknown> {
    if (!details || typeof details !== 'object') {
      return {};
    }

    const snapshot: Record<string, unknown> = {};
    const summary = this.isPlainObject(details.progressSummary)
      ? (details.progressSummary as Record<string, unknown>)
      : undefined;

    if (summary) {
      if (typeof summary.processedCount === 'number') {
        snapshot.processedCount = summary.processedCount;
      }
      if (typeof summary.totalCount === 'number') {
        snapshot.totalCount = summary.totalCount;
      }
      if (
        typeof summary.currentUrl === 'string' ||
        summary.currentUrl === null
      ) {
        snapshot.currentUrl = summary.currentUrl;
      }
    }

    if (typeof details.currentUrl === 'string') {
      snapshot.currentUrl = details.currentUrl;
    }

    if (Array.isArray((details as any).skippedSummary)) {
      snapshot.skippedCount = (details as any).skippedSummary.length;
    }

    if (typeof details.queuePosition === 'number') {
      snapshot.queuePosition = details.queuePosition;
    }

    if (typeof details.estimatedStartSeconds === 'number') {
      snapshot.estimatedStartSeconds = details.estimatedStartSeconds;
    }

    return snapshot;
  }

  normalizeJobMetadata(input: unknown): Record<string, unknown> | undefined {
    if (!this.isPlainObject(input)) {
      return undefined;
    }
    const detection = input as Record<string, unknown>;
    const metadata: Record<string, unknown> = {};

    const sitemap = this.isPlainObject(detection['sitemap']) ? (detection['sitemap'] as Record<string, unknown>) : undefined;
    if (sitemap) {
      metadata.sitemap = {
        ordered: this.toStringArray(sitemap['ordered']),
        pending: this.toStringArray(sitemap['pending']),
        processing: this.toStringArray(sitemap['processing']),
        completed: this.toStringArray(sitemap['completed']),
        failed: this.toStringArray(sitemap['failed']),
        skipped: this.toStringArray(sitemap['skipped']),
        total: typeof sitemap['total'] === 'number' ? sitemap['total'] : undefined,
      };
    }

    if (Array.isArray(detection['pages'])) {
      const pages = detection['pages']
        .map((value, index) => {
          if (!this.isPlainObject(value)) {
            return undefined;
          }
          const url = typeof value['url'] === 'string' ? value['url'] : undefined;
          const status = typeof value['status'] === 'string' ? value['status'] : undefined;
          if (!url || !status) {
            return undefined;
          }
          return {
            url,
            order: typeof value['order'] === 'number' ? value['order'] : index,
            status,
            ...(typeof value['error'] === 'string' ? { error: value['error'] } : {}),
          };
        })
        .filter((entry): entry is { url: string; order: number; status: string; error?: string } => Boolean(entry));
      if (pages.length > 0) {
        metadata.pages = pages;
      }
    }

    const progressSummary = this.isPlainObject(detection['progressSummary'])
      ? (detection['progressSummary'] as Record<string, unknown>)
      : undefined;
    if (progressSummary) {
      const summary: Record<string, unknown> = {};
      if (typeof progressSummary['processedCount'] === 'number') {
        summary.processedCount = progressSummary['processedCount'];
      }
      if (typeof progressSummary['totalCount'] === 'number') {
        summary.totalCount = progressSummary['totalCount'];
      }
      if (typeof progressSummary['currentUrl'] === 'string' || progressSummary['currentUrl'] === null) {
        summary.currentUrl = progressSummary['currentUrl'] ?? null;
      }
      if (Object.keys(summary).length > 0) {
        metadata.progressSummary = summary;
      }
    }

    const skippedSummary = Array.isArray(detection['skippedSummary'])
      ? detection['skippedSummary'].filter(
          (entry): entry is { url: string; reason?: string } =>
            entry && typeof entry === 'object' && typeof (entry as any).url === 'string'
        )
      : undefined;

    if (skippedSummary && skippedSummary.length > 0) {
      metadata.skippedSummary = skippedSummary.map(entry => ({
        url: entry.url,
        ...(typeof (entry as any).reason === 'string' ? { reason: (entry as any).reason } : {}),
      }));
    }

    return Object.keys(metadata).length > 0 ? metadata : undefined;
  }

  /**
   * Clean up internal state for a completed job.
   * Should be called when a job finishes (completed, failed, or cancelled).
   */
  cleanup(jobId: string): void {
    const timer = this.flushTimers.get(jobId);
    if (timer) {
      clearTimeout(timer);
      this.flushTimers.delete(jobId);
    }
    this.pendingUpdates.delete(jobId);
    this.lastUpdateTime.delete(jobId);
    this.jobCache.delete(jobId);

    // Clean up unified progress tracker
    const tracker = this.progressTrackers.get(jobId);
    if (tracker) {
      tracker.destroy();
      this.progressTrackers.delete(jobId);
    }
  }

  /**
   * Complete a job using the unified tracker.
   */
  completeJob(jobId: string, message?: string): void {
    const tracker = this.progressTrackers.get(jobId);
    if (tracker) {
      tracker.complete(message);
    }
  }

  /**
   * Fail a job using the unified tracker.
   */
  failJob(jobId: string, message: string): void {
    const tracker = this.progressTrackers.get(jobId);
    if (tracker) {
      tracker.fail(message);
    }
  }
}
