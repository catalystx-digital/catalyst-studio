/**
 * Progress Heartbeat Pattern
 *
 * Emits progress updates at regular intervals during long-running AI generation
 * operations to prevent user perception of "stalled" progress.
 *
 * Key features:
 * - Emits heartbeat every 15 seconds (configurable)
 * - Includes elapsed time in message
 * - Supports "X of Y" page count display when provided
 * - Uses existing updateSystemEvent infrastructure
 * - Safe cleanup via stop() (idempotent, handles edge cases)
 *
 * @module progress-heartbeat
 */

import { updateSystemEvent, type ImportProgressMetadata } from '@/lib/studio/import/utils/update-system-event';

/**
 * Configuration for the heartbeat timer.
 */
export interface HeartbeatConfig {
  /** Website ID for context */
  websiteId: string;
  /** Session ID for AI context */
  sessionId: string;
  /** Account ID (optional) */
  accountId?: string;
  /** Job ID for progress tracking */
  jobId: string;
  /** Interval between heartbeats in milliseconds (default: 15000ms / 15s) */
  intervalMs?: number;
}

/**
 * Page counts for "X of Y" display in heartbeat messages.
 */
export interface HeartbeatCounts {
  /** Number of items processed so far */
  processed: number;
  /** Total number of items to process */
  total: number;
}

/**
 * Default heartbeat interval: 15 seconds.
 * Chosen to be frequent enough to reassure users but not so frequent as to spam.
 */
const DEFAULT_INTERVAL_MS = 15_000;

/**
 * ProgressHeartbeat class.
 *
 * Manages a timer that emits progress updates at regular intervals during
 * long-running operations like AI page generation.
 *
 * @example
 * ```typescript
 * const heartbeat = new ProgressHeartbeat({
 *   websiteId,
 *   sessionId,
 *   accountId,
 *   jobId
 * });
 *
 * try {
 *   heartbeat.start({ processed: 0, total: 4 });
 *
 *   for (let i = 0; i < pages.length; i++) {
 *     await createPage(pages[i]);
 *     heartbeat.updateCounts(i + 1, pages.length);
 *   }
 * } finally {
 *   heartbeat.stop();  // ALWAYS called, even on error
 * }
 * ```
 */
export class ProgressHeartbeat {
  private intervalId: NodeJS.Timeout | null = null;
  private startTime: number = 0;
  private counts: HeartbeatCounts | null = null;
  private readonly config: HeartbeatConfig;
  private readonly intervalMs: number;

  constructor(config: HeartbeatConfig) {
    this.config = config;
    this.intervalMs = config.intervalMs ?? DEFAULT_INTERVAL_MS;
  }

  /**
   * Start the heartbeat timer.
   *
   * Call this at the beginning of a long-running operation.
   * The first heartbeat will be emitted after the interval elapses.
   *
   * @param initialCounts Optional initial counts for "X of Y" display
   */
  start(initialCounts?: HeartbeatCounts): void {
    // Prevent multiple starts - stop existing timer first
    if (this.intervalId !== null) {
      this.stop();
    }

    this.startTime = Date.now();
    this.counts = initialCounts ?? null;

    // Start the heartbeat timer
    this.intervalId = setInterval(() => {
      void this.emitHeartbeat();
    }, this.intervalMs);
  }

  /**
   * Update the counts for subsequent heartbeats.
   *
   * Call this as items are processed to update "X of Y" in the heartbeat message.
   *
   * @param processed Number of items processed so far
   * @param total Total number of items to process
   */
  updateCounts(processed: number, total: number): void {
    this.counts = { processed, total };
  }

  /**
   * Stop the heartbeat timer.
   *
   * MUST be called in finally block to ensure cleanup.
   * Safe to call multiple times (idempotent).
   * Safe to call before start() was called.
   */
  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    // Reset state
    this.startTime = 0;
    this.counts = null;
  }

  /**
   * Check if the heartbeat is currently running.
   */
  isRunning(): boolean {
    return this.intervalId !== null;
  }

  /**
   * Emit a single heartbeat progress update.
   */
  private async emitHeartbeat(): Promise<void> {
    const elapsedMs = Date.now() - this.startTime;
    const elapsedSeconds = Math.floor(elapsedMs / 1000);
    const message = this.formatMessage(elapsedSeconds);

    try {
      await updateSystemEvent({
        websiteId: this.config.websiteId,
        sessionId: this.config.sessionId,
        accountId: this.config.accountId,
        jobId: this.config.jobId,
        content: message,
        metadata: this.createMetadata(message, elapsedSeconds),
      });
    } catch (error) {
      // Log but don't throw - heartbeats are non-critical
      console.warn('[ProgressHeartbeat] Failed to emit heartbeat', {
        jobId: this.config.jobId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Format the heartbeat message.
   *
   * Without counts: "AI generating pages... (45s)"
   * With counts: "AI generating page 2 of 4... (45s)"
   */
  private formatMessage(elapsedSeconds: number): string {
    const timeStr = `(${elapsedSeconds}s)`;

    if (this.counts && this.counts.total > 0) {
      return `AI generating page ${this.counts.processed} of ${this.counts.total}... ${timeStr}`;
    }

    return `AI generating pages... ${timeStr}`;
  }

  /**
   * Create metadata for the progress update.
   */
  private createMetadata(message: string, _elapsedSeconds: number): ImportProgressMetadata {
    return {
      type: 'import-progress',
      jobId: this.config.jobId,
      url: '',
      stage: 'creating',
      progress: this.calculateProgress(),
      processedCount: this.counts?.processed ?? 0,
      totalCount: this.counts?.total ?? 0,
      currentUrl: null,
      status: 'running',
      message,
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Calculate approximate progress percentage based on counts.
   */
  private calculateProgress(): number {
    if (!this.counts || this.counts.total === 0) {
      // No counts available, return a generic "in progress" value
      return 50;
    }

    // Calculate progress as percentage of items completed
    // Cap at 95% since we're not fully done until stop() is called
    const progress = Math.floor((this.counts.processed / this.counts.total) * 100);
    return Math.min(progress, 95);
  }
}

/**
 * Factory function to create a new ProgressHeartbeat instance.
 */
export function createProgressHeartbeat(config: HeartbeatConfig): ProgressHeartbeat {
  return new ProgressHeartbeat(config);
}
