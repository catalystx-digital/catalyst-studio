/**
 * Progress Calculation Utilities
 *
 * Centralized progress reporting for consistent UX.
 * Addresses inconsistent progress ranges across:
 * - import-pipeline.ts (10-96%)
 * - import-orchestrator.ts (10-100%)
 * - import-service.ts (0-100%)
 *
 * @module progress-utils
 */

/**
 * Progress range configuration for a stage.
 */
export interface ProgressRange {
  /** Minimum percentage for this stage */
  min: number

  /** Maximum percentage for this stage */
  max: number

  /** Human-readable stage name */
  name: string
}

/**
 * Standard progress stages for the import pipeline.
 * Stages are designed to provide meaningful feedback without jumping.
 */
export const ImportProgressStages = {
  /** Initial setup and validation */
  initialization: { min: 0, max: 5, name: 'Initializing' },

  /** URL discovery and sitemap parsing */
  discovery: { min: 5, max: 10, name: 'Discovering pages' },

  /** Component detection phase */
  detection: { min: 10, max: 60, name: 'Detecting components' },

  /** Post-detection processing and adjustment */
  processing: { min: 60, max: 70, name: 'Processing components' },

  /** Navigation and hierarchy extraction */
  navigation: { min: 70, max: 75, name: 'Extracting navigation' },

  /** Template identification */
  templates: { min: 75, max: 80, name: 'Identifying templates' },

  /** Design system extraction */
  designSystem: { min: 80, max: 85, name: 'Extracting design system' },

  /** Database persistence */
  persistence: { min: 85, max: 95, name: 'Saving results' },

  /** Final cleanup and summary */
  finalization: { min: 95, max: 100, name: 'Finalizing' }
} as const

/**
 * Orchestrator-specific stages for multi-page imports.
 */
export const OrchestratorProgressStages = {
  /** Component type extraction */
  componentTypes: { min: 10, max: 25, name: 'Extracting component types' },

  /** Page creation */
  pageCreation: { min: 25, max: 50, name: 'Creating pages' },

  /** Site structure building */
  structure: { min: 50, max: 65, name: 'Building site structure' },

  /** Shared component detection */
  sharedDetection: { min: 65, max: 80, name: 'Detecting shared components' },

  /** Shared component persistence */
  sharedPersistence: { min: 80, max: 95, name: 'Saving shared components' },

  /** Finalization */
  finalization: { min: 95, max: 100, name: 'Finalizing import' }
} as const

export type ImportProgressStage = keyof typeof ImportProgressStages
export type OrchestratorProgressStage = keyof typeof OrchestratorProgressStages

/**
 * Progress calculator for managing stage-based progress.
 */
export class ProgressCalculator {
  private currentStage: ProgressRange
  private stageProgress: number = 0

  constructor(initialStage: ProgressRange) {
    this.currentStage = initialStage
  }

  /**
   * Sets the current stage.
   *
   * @param stage - New stage to enter
   */
  setStage(stage: ProgressRange): void {
    this.currentStage = stage
    this.stageProgress = 0
  }

  /**
   * Updates progress within the current stage.
   *
   * @param progress - Progress within stage (0-1)
   */
  setStageProgress(progress: number): void {
    this.stageProgress = Math.max(0, Math.min(1, progress))
  }

  /**
   * Gets the overall progress percentage.
   *
   * @returns Progress percentage (0-100)
   */
  getProgress(): number {
    const { min, max } = this.currentStage
    const range = max - min
    return Math.round(min + range * this.stageProgress)
  }

  /**
   * Gets the current stage name.
   *
   * @returns Stage name
   */
  getStageName(): string {
    return this.currentStage.name
  }

  /**
   * Gets a formatted progress message.
   *
   * @param detail - Optional detail to append
   * @returns Formatted message
   */
  getMessage(detail?: string): string {
    const base = this.currentStage.name
    return detail ? `${base}: ${detail}` : base
  }
}

/**
 * Calculates progress within a stage based on completed items.
 *
 * @param completed - Number of completed items
 * @param total - Total number of items
 * @param stage - Stage range
 * @returns Progress percentage (0-100)
 *
 * @example
 * calculateStageProgress(5, 10, ImportProgressStages.detection) // 35
 */
export function calculateStageProgress(
  completed: number,
  total: number,
  stage: ProgressRange
): number {
  if (total === 0) return stage.min

  const stageProgress = Math.min(1, completed / total)
  const range = stage.max - stage.min

  return Math.round(stage.min + range * stageProgress)
}

/**
 * Interpolates progress between two stages based on elapsed time.
 * Useful for smooth progress animations during async operations.
 *
 * @param startTime - Operation start timestamp
 * @param expectedDurationMs - Expected duration in milliseconds
 * @param stage - Stage range
 * @returns Progress percentage (0-100)
 *
 * @example
 * // After 5 seconds of a 10 second operation
 * interpolateProgress(startTime, 10000, ImportProgressStages.detection)
 */
export function interpolateProgress(
  startTime: number,
  expectedDurationMs: number,
  stage: ProgressRange
): number {
  const elapsed = Date.now() - startTime
  const progress = Math.min(1, elapsed / expectedDurationMs)

  // Use easing function for more natural feel (ease-out)
  const eased = 1 - Math.pow(1 - progress, 3)

  const range = stage.max - stage.min
  return Math.round(stage.min + range * eased)
}

/**
 * Creates a progress reporter function bound to a callback.
 *
 * @param onProgress - Callback to receive progress updates
 * @returns Reporter function
 *
 * @example
 * const report = createProgressReporter(options.onProgress)
 * report(ImportProgressStages.detection, 0.5, 'Processing page 5 of 10')
 */
export function createProgressReporter(
  onProgress?: (payload: { message: string; progress: number; details?: Record<string, unknown> }) => void
): (stage: ProgressRange, stageProgress: number, message?: string, details?: Record<string, unknown>) => void {
  if (!onProgress) {
    return () => { /* no-op */ }
  }

  return (stage, stageProgress, message, details) => {
    const progress = calculateStageProgress(
      Math.round(stageProgress * 100),
      100,
      stage
    )

    onProgress({
      message: message || stage.name,
      progress,
      details
    })
  }
}

/**
 * Creates a stage-aware progress tracker for multi-stage operations.
 *
 * @param onProgress - Callback to receive progress updates
 * @param stages - Stage definitions
 * @returns Progress tracker object
 *
 * @example
 * const tracker = createProgressTracker(onProgress, ImportProgressStages)
 * tracker.enterStage('detection')
 * tracker.update(0.5, 'Detecting page 1')
 */
export function createProgressTracker<T extends Record<string, ProgressRange>>(
  onProgress: ((payload: { message: string; progress: number; details?: Record<string, unknown> }) => void) | undefined,
  stages: T
): {
  enterStage: (stageName: keyof T) => void
  update: (stageProgress: number, message?: string, details?: Record<string, unknown>) => void
  complete: (message?: string) => void
} {
  let currentStage: ProgressRange = stages[Object.keys(stages)[0] as keyof T]

  const report = (progress: number, message: string, details?: Record<string, unknown>) => {
    if (onProgress) {
      onProgress({ message, progress, details })
    }
  }

  return {
    enterStage(stageName: keyof T) {
      currentStage = stages[stageName]
      report(currentStage.min, currentStage.name)
    },

    update(stageProgress: number, message?: string, details?: Record<string, unknown>) {
      const progress = calculateStageProgress(
        Math.round(stageProgress * 100),
        100,
        currentStage
      )
      report(progress, message || currentStage.name, details)
    },

    complete(message?: string) {
      report(100, message || 'Complete')
    }
  }
}
