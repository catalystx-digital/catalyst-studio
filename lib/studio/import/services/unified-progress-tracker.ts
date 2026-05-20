/**
 * Unified Progress Tracker
 *
 * Central service for tracking import progress. Replaces the scattered hardcoded
 * progress values with a single source of truth that calculates progress based
 * on actual stage completion and subsystem progress.
 *
 * Key features:
 * - Single message per import (updates in place, no spam)
 * - Accurate progress calculation using stage weights
 * - Subsystem-level granularity for smooth progress updates
 * - Debounced updates to prevent excessive API calls
 * - Serializable state for persistence
 *
 * @module unified-progress-tracker
 */

import type {
  ImportProgressState,
  ImportStage,
  SubsystemId,
  ProgressUpdate,
  ProgressTrackerOptions,
  SubsystemProgress,
} from '../types/progress.types';
import {
  calculateProgressUpToStage,
  getStageLabel,
  STAGE_WEIGHTS,
} from '../types/progress.types';
import { updateSystemEvent } from '../utils/update-system-event';

/**
 * Creates a new ImportProgressState with default values.
 */
function createInitialState(options: ProgressTrackerOptions): ImportProgressState {
  const now = new Date();
  return {
    jobId: options.jobId,
    websiteId: options.websiteId,
    url: options.url,
    stage: 'queued',
    overallProgress: 0,
    stageProgress: 0,
    stagesCompleted: [],
    activeSubsystems: new Map(),
    completedSubsystems: [],
    processedCount: 0,
    totalCount: 0,
    currentUrl: null,
    startedAt: now,
    updatedAt: now,
    estimatedTimeRemaining: null,
    status: 'pending',
    message: 'Waiting to start...',
    description: undefined,
    queuePosition: null,
    estimatedStartSeconds: null,
    errors: [],
    skippedPages: [],
  };
}

/**
 * UnifiedProgressTracker class.
 *
 * Manages progress state for a single import job and pushes updates
 * to the AI context system via updateSystemEvent.
 */
export class UnifiedProgressTracker {
  private state: ImportProgressState;
  private sessionId: string;
  private accountId?: string;
  private onProgress?: (state: ImportProgressState) => void;
  private debounceMs: number;
  private debounceTimer: NodeJS.Timeout | null = null;
  private pendingUpdate: boolean = false;
  private lastPushedState: string = '';
  private stageStartTime: Map<ImportStage, number> = new Map();
  private progressHistory: Array<{ time: number; progress: number }> = [];
  private maxProgressSeen: number = 0; // Track max progress for monotonic enforcement

  constructor(options: ProgressTrackerOptions) {
    this.state = createInitialState(options);
    this.sessionId = options.sessionId;
    this.accountId = options.accountId;
    this.onProgress = options.onProgress;
    this.debounceMs = options.debounceMs ?? 500;
  }

  /**
   * Get current progress state (immutable copy).
   */
  getState(): ImportProgressState {
    return {
      ...this.state,
      activeSubsystems: new Map(this.state.activeSubsystems),
      stagesCompleted: [...this.state.stagesCompleted],
      completedSubsystems: [...this.state.completedSubsystems],
      errors: [...this.state.errors],
      skippedPages: [...this.state.skippedPages],
    };
  }

  /**
   * Apply a partial progress update.
   * This is the main method for updating progress from subsystems.
   */
  update(update: ProgressUpdate): void {
    this.applyUpdate(update);
    this.scheduleFlush();
  }

  /**
   * Force immediate flush of progress to AI context.
   * Use sparingly - prefer debounced updates.
   */
  async flush(): Promise<void> {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    await this.pushUpdate();
  }

  /**
   * Transition to a new stage.
   */
  setStage(stage: ImportStage, message?: string): void {
    const now = Date.now();

    // Mark previous stage as completed
    if (this.state.stage !== 'queued' && !this.state.stagesCompleted.includes(this.state.stage)) {
      this.state.stagesCompleted.push(this.state.stage);
    }

    // Record stage transition time for ETA calculation
    this.stageStartTime.set(stage, now);

    // Update state
    this.state.stage = stage;
    this.state.stageProgress = 0;
    this.state.message = message ?? getStageLabel(stage);
    this.state.updatedAt = new Date();

    // Update overall progress
    this.recalculateOverallProgress();

    // Update status
    if (stage === 'completed') {
      this.state.status = 'completed';
      this.state.overallProgress = 100;
      this.state.message = message ?? 'Import completed successfully';
    } else if (stage === 'failed') {
      this.state.status = 'failed';
      this.state.message = message ?? 'Import failed';
    } else if (stage !== 'queued') {
      this.state.status = 'running';
    }

    // Force immediate update for stage transitions
    this.flush();
  }

  /**
   * Update stage progress (0-100 within current stage).
   */
  setStageProgress(progress: number, message?: string): void {
    this.state.stageProgress = Math.min(100, Math.max(0, progress));
    if (message) {
      this.state.message = message;
    }
    this.state.updatedAt = new Date();
    this.recalculateOverallProgress();
    this.scheduleFlush();
  }

  /**
   * Update processed counts.
   */
  setCounts(processed: number, total: number): void {
    this.state.processedCount = processed;
    this.state.totalCount = total;
    this.state.updatedAt = new Date();
    this.scheduleFlush();
  }

  /**
   * Set current URL being processed.
   */
  setCurrentUrl(url: string | null): void {
    this.state.currentUrl = url;
    this.state.updatedAt = new Date();
    this.scheduleFlush();
  }

  /**
   * Start tracking a subsystem operation.
   */
  startSubsystem(id: SubsystemId, label: string, total?: number): void {
    const subsystem: SubsystemProgress = {
      id,
      label,
      current: 0,
      total: total ?? 0,
      startedAt: new Date(),
    };
    this.state.activeSubsystems.set(id, subsystem);
    this.state.updatedAt = new Date();
    this.scheduleFlush();
  }

  /**
   * Update subsystem progress.
   */
  updateSubsystem(id: SubsystemId, current: number, total?: number): void {
    const subsystem = this.state.activeSubsystems.get(id);
    if (subsystem) {
      subsystem.current = current;
      if (total !== undefined) {
        subsystem.total = total;
      }
      this.state.updatedAt = new Date();
      this.scheduleFlush();
    }
  }

  /**
   * Mark a subsystem as completed.
   */
  completeSubsystem(id: SubsystemId): void {
    const subsystem = this.state.activeSubsystems.get(id);
    if (subsystem) {
      subsystem.completedAt = new Date();
      subsystem.current = subsystem.total;
    }
    this.state.activeSubsystems.delete(id);
    if (!this.state.completedSubsystems.includes(id)) {
      this.state.completedSubsystems.push(id);
    }
    this.state.updatedAt = new Date();
    this.scheduleFlush();
  }

  /**
   * Mark a subsystem as failed.
   */
  failSubsystem(id: SubsystemId, error: string): void {
    const subsystem = this.state.activeSubsystems.get(id);
    if (subsystem) {
      subsystem.error = error;
    }
    this.state.activeSubsystems.delete(id);
    this.state.updatedAt = new Date();
    this.scheduleFlush();
  }

  /**
   * Add an error to the error log.
   */
  addError(url: string, error: string): void {
    this.state.errors.push({
      url,
      error,
      timestamp: new Date(),
    });
    this.state.updatedAt = new Date();
    this.scheduleFlush();
  }

  /**
   * Add a skipped page to the log.
   */
  addSkipped(url: string, reason: string): void {
    this.state.skippedPages.push({ url, reason });
    this.state.updatedAt = new Date();
    this.scheduleFlush();
  }

  /**
   * Set queue position (for jobs waiting to start).
   */
  setQueuePosition(position: number | null, estimatedStartSeconds?: number | null): void {
    this.state.queuePosition = position;
    this.state.estimatedStartSeconds = estimatedStartSeconds ?? null;
    this.state.updatedAt = new Date();
    this.scheduleFlush();
  }

  /**
   * Set descriptive message.
   */
  setMessage(message: string, description?: string): void {
    this.state.message = message;
    if (description !== undefined) {
      this.state.description = description;
    }
    this.state.updatedAt = new Date();
    this.scheduleFlush();
  }

  /**
   * Create a progress callback function for subsystems.
   * This returns a function that can be passed to services like web-detection.
   */
  createCallback(): (update: ProgressUpdate) => void {
    return (update: ProgressUpdate) => {
      this.update(update);
    };
  }

  /**
   * Mark the import as completed.
   */
  complete(message?: string): void {
    this.setStage('completed', message);
  }

  /**
   * Mark the import as failed.
   */
  fail(message: string): void {
    this.state.message = message;
    this.setStage('failed', message);
  }

  // ====== Private Methods ======

  /**
   * Apply a partial update to the state.
   */
  private applyUpdate(update: ProgressUpdate): void {
    if (update.stage !== undefined) {
      this.setStage(update.stage, update.message);
      return; // setStage handles its own flush
    }

    if (update.stageProgress !== undefined) {
      this.state.stageProgress = Math.min(100, Math.max(0, update.stageProgress));
      this.recalculateOverallProgress();
    }

    if (update.processedCount !== undefined) {
      this.state.processedCount = update.processedCount;
    }

    if (update.totalCount !== undefined) {
      this.state.totalCount = update.totalCount;
    }

    if (update.currentUrl !== undefined) {
      this.state.currentUrl = update.currentUrl;
    }

    if (update.message !== undefined) {
      this.state.message = update.message;
    }

    if (update.description !== undefined) {
      this.state.description = update.description;
    }

    if (update.queuePosition !== undefined) {
      this.state.queuePosition = update.queuePosition;
    }

    if (update.estimatedStartSeconds !== undefined) {
      this.state.estimatedStartSeconds = update.estimatedStartSeconds;
    }

    // Subsystem operations
    if (update.subsystemStart) {
      this.startSubsystem(
        update.subsystemStart.id,
        update.subsystemStart.label,
        update.subsystemStart.total
      );
    }

    if (update.subsystemProgress) {
      this.updateSubsystem(
        update.subsystemProgress.id,
        update.subsystemProgress.current,
        update.subsystemProgress.total
      );
    }

    if (update.subsystemComplete) {
      this.completeSubsystem(update.subsystemComplete);
    }

    if (update.subsystemError) {
      this.failSubsystem(update.subsystemError.id, update.subsystemError.error);
    }

    // Error/skip tracking
    if (update.addError) {
      this.addError(update.addError.url, update.addError.error);
    }

    if (update.addSkipped) {
      this.addSkipped(update.addSkipped.url, update.addSkipped.reason);
    }

    this.state.updatedAt = new Date();
  }

  /**
   * Recalculate overall progress based on stage and stage progress.
   * Enforces monotonic (always-increasing) progress per PRD §3.2.
   */
  private recalculateOverallProgress(): void {
    const calculatedProgress = calculateProgressUpToStage(
      this.state.stage,
      this.state.stageProgress
    );

    // CRITICAL: Progress must never decrease (Issue #1 fix)
    // Clamp to max progress seen to ensure monotonic increase
    this.maxProgressSeen = Math.max(this.maxProgressSeen, calculatedProgress);
    this.state.overallProgress = this.maxProgressSeen;

    // Update ETA based on progress history
    this.updateEstimatedTimeRemaining();
  }

  /**
   * Update estimated time remaining based on progress history.
   */
  private updateEstimatedTimeRemaining(): void {
    const now = Date.now();
    const progress = this.state.overallProgress;

    // Add to history
    this.progressHistory.push({ time: now, progress });

    // Keep only last 20 data points
    if (this.progressHistory.length > 20) {
      this.progressHistory.shift();
    }

    // Need at least 2 points to calculate rate
    if (this.progressHistory.length < 2 || progress <= 0) {
      this.state.estimatedTimeRemaining = null;
      return;
    }

    // Calculate rate over recent history
    const oldest = this.progressHistory[0];
    const elapsed = (now - oldest.time) / 1000; // seconds
    const progressGain = progress - oldest.progress;

    if (progressGain <= 0 || elapsed <= 0) {
      this.state.estimatedTimeRemaining = null;
      return;
    }

    const rate = progressGain / elapsed; // progress per second
    const remaining = 100 - progress;
    this.state.estimatedTimeRemaining = Math.round(remaining / rate);
  }

  /**
   * Schedule a debounced flush of progress to AI context.
   */
  private scheduleFlush(): void {
    this.pendingUpdate = true;

    if (this.debounceTimer) {
      return; // Already scheduled
    }

    this.debounceTimer = setTimeout(async () => {
      this.debounceTimer = null;
      if (this.pendingUpdate) {
        await this.pushUpdate();
      }
    }, this.debounceMs);
  }

  /**
   * Push the current state to AI context via updateSystemEvent.
   */
  private async pushUpdate(): Promise<void> {
    this.pendingUpdate = false;

    // Create a hash of the significant state to avoid duplicate updates
    const stateHash = JSON.stringify({
      stage: this.state.stage,
      overallProgress: this.state.overallProgress,
      processedCount: this.state.processedCount,
      totalCount: this.state.totalCount,
      message: this.state.message,
      status: this.state.status,
    });

    // Skip if state hasn't meaningfully changed
    if (stateHash === this.lastPushedState) {
      return;
    }
    this.lastPushedState = stateHash;

    // Call onProgress callback if provided
    if (this.onProgress) {
      this.onProgress(this.getState());
    }

    // Push to AI context
    try {
      await updateSystemEvent({
        websiteId: this.state.websiteId,
        sessionId: this.sessionId,
        accountId: this.accountId,
        jobId: this.state.jobId,
        content: this.state.message,
        metadata: {
          type: 'import-progress',
          jobId: this.state.jobId,
          url: this.state.url,
          stage: this.state.stage,
          progress: this.state.overallProgress,
          stageProgress: this.state.stageProgress,
          processedCount: this.state.processedCount,
          totalCount: this.state.totalCount,
          currentUrl: this.state.currentUrl,
          status: this.state.status,
          message: this.state.message,
          description: this.state.description,
          updatedAt: this.state.updatedAt.toISOString(),
          queuePosition: this.state.queuePosition,
          estimatedStartSeconds: this.state.estimatedStartSeconds,
          estimatedTimeRemaining: this.state.estimatedTimeRemaining,
          skippedSummary: this.state.skippedPages.length > 0
            ? this.state.skippedPages.slice(0, 10) // Limit to 10 for UI
            : undefined,
          errorCount: this.state.errors.length,
        },
      });
    } catch (error) {
      console.warn('[UnifiedProgressTracker] Failed to push update', {
        jobId: this.state.jobId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Clean up resources (cancel pending timers).
   */
  destroy(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }
}

/**
 * Factory function to create a new progress tracker.
 */
export function createProgressTracker(options: ProgressTrackerOptions): UnifiedProgressTracker {
  return new UnifiedProgressTracker(options);
}
