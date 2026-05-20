/**
 * Progress Types for Import System
 *
 * Unified type definitions for the import progress tracking system.
 * These types support single-message-per-import updates rather than message spam.
 *
 * @module progress.types
 */

/**
 * High-level stages of the import process.
 * Used for calculating overall progress percentage.
 */
export type ImportStage =
  | 'queued'
  | 'initializing'
  | 'sitemap_discovery'
  | 'page_processing'
  | 'design_extraction'
  | 'component_detection'
  | 'media_ingest'
  | 'template_generation'
  | 'finalizing'
  | 'completed'
  | 'failed'
  | 'unknown';

/**
 * Granular subsystem identifiers for detailed progress tracking.
 * Maps to specific operations within stages.
 */
export type SubsystemId =
  | 'sitemap_fetch'
  | 'sitemap_parse'
  | 'dom_probe'
  | 'dom_analyze'
  | 'llm_detection'
  | 'llm_classification'
  | 'design_system_extract'
  | 'color_analysis'
  | 'typography_analysis'
  | 'media_discovery'
  | 'media_download'
  | 'media_optimize'
  | 'template_create'
  | 'template_save'
  | 'database_write'
  | 'cleanup';

/**
 * Progress state for a single subsystem operation.
 */
export interface SubsystemProgress {
  id: SubsystemId;
  label: string;
  current: number;
  total: number;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

/**
 * Configuration for a single import stage.
 * Used by ProgressCalculator to determine weights and subsystems.
 */
export interface StageConfig {
  id: ImportStage;
  label: string;
  weight: number; // Relative weight for overall progress calculation
  subsystems: SubsystemId[];
}

/**
 * Complete import progress state.
 * This is the single source of truth for an import's progress.
 */
export interface ImportProgressState {
  jobId: string;
  websiteId: string;
  url: string;

  // Overall progress
  stage: ImportStage;
  overallProgress: number; // 0-100

  // Stage-level tracking
  stageProgress: number; // 0-100 within current stage
  stagesCompleted: ImportStage[];

  // Subsystem-level tracking
  activeSubsystems: Map<SubsystemId, SubsystemProgress>;
  completedSubsystems: SubsystemId[];

  // Counts for display
  processedCount: number;
  totalCount: number;
  currentUrl: string | null;

  // Timing
  startedAt: Date;
  updatedAt: Date;
  estimatedTimeRemaining: number | null; // in seconds

  // Status
  status: 'pending' | 'running' | 'completed' | 'failed' | 'partial_success' | 'recoverable_stuck' | 'unknown' | 'cancelled';
  message: string;
  description?: string;

  // Queue info (when waiting to start)
  queuePosition: number | null;
  estimatedStartSeconds: number | null;

  // Error/skip tracking
  errors: Array<{ url: string; error: string; timestamp: Date }>;
  skippedPages: Array<{ url: string; reason: string }>;
}

/**
 * Progress update payload for partial updates.
 * All fields are optional to allow granular updates.
 */
export interface ProgressUpdate {
  stage?: ImportStage;
  stageProgress?: number;
  processedCount?: number;
  totalCount?: number;
  currentUrl?: string | null;
  message?: string;
  description?: string;
  queuePosition?: number | null;
  estimatedStartSeconds?: number | null;

  // Subsystem updates
  subsystemStart?: {
    id: SubsystemId;
    label: string;
    total?: number;
  };
  subsystemProgress?: {
    id: SubsystemId;
    current: number;
    total?: number;
  };
  subsystemComplete?: SubsystemId;
  subsystemError?: {
    id: SubsystemId;
    error: string;
  };

  // Error/skip additions
  addError?: { url: string; error: string };
  addSkipped?: { url: string; reason: string };
}

/**
 * Progress callback type for subsystem operations.
 * Used to report progress from within detection, probe, and ingest services.
 */
export type ProgressCallback = (update: ProgressUpdate) => void;

/**
 * Options for creating a progress tracker instance.
 */
export interface ProgressTrackerOptions {
  jobId: string;
  websiteId: string;
  url: string;
  sessionId: string;
  accountId?: string;
  onProgress?: (state: ImportProgressState) => void;
  debounceMs?: number;
}

/**
 * Serialized progress state for API/database storage.
 * Converts Maps and Dates to JSON-compatible formats.
 */
export interface SerializedProgressState {
  jobId: string;
  websiteId: string;
  url: string;
  stage: ImportStage;
  overallProgress: number;
  stageProgress: number;
  stagesCompleted: ImportStage[];
  activeSubsystems: Array<[SubsystemId, SubsystemProgress]>;
  completedSubsystems: SubsystemId[];
  processedCount: number;
  totalCount: number;
  currentUrl: string | null;
  startedAt: string;
  updatedAt: string;
  estimatedTimeRemaining: number | null;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'partial_success' | 'recoverable_stuck' | 'unknown' | 'cancelled';
  message: string;
  description?: string;
  queuePosition: number | null;
  estimatedStartSeconds: number | null;
  errors: Array<{ url: string; error: string; timestamp: string }>;
  skippedPages: Array<{ url: string; reason: string }>;
}

/**
 * Stage weight configuration.
 * Defines how much each stage contributes to overall progress.
 * Total should sum to 100.
 *
 * Weights are calibrated to match actual pipeline timing:
 * - Page processing takes ~50% of total time (analyzing each page with LLM)
 * - Component detection takes ~20% (post-processing detection results)
 * - Other stages are relatively quick
 */
export const STAGE_WEIGHTS: Record<ImportStage, number> = {
  queued: 0,           // Not shown in progress
  initializing: 5,     // Quick setup phase
  sitemap_discovery: 10, // Finding pages to import (0-10% of pipeline)
  page_processing: 40, // Analyzing pages with LLM (10-60% of pipeline = 50% time)
  component_detection: 15, // Post-processing components (60-80% of pipeline)
  design_extraction: 10, // DOM probe and design tokens (80-88% of pipeline)
  media_ingest: 5,     // Media is processed inline, minimal dedicated time
  template_generation: 10, // Generating templates (88-96% of pipeline)
  finalizing: 5,       // Saving to database (96-100% of pipeline)
  completed: 0,        // Terminal state
  failed: 0,           // Terminal state
  unknown: 0,
};

/**
 * Stage configurations with labels and associated subsystems.
 * Order must match calculateProgressUpToStage stage order.
 */
export const STAGE_CONFIGS: StageConfig[] = [
  {
    id: 'queued',
    label: 'Queued',
    weight: 0,
    subsystems: [],
  },
  {
    id: 'initializing',
    label: 'Initializing',
    weight: 5,
    subsystems: [],
  },
  {
    id: 'sitemap_discovery',
    label: 'Discovering Pages',
    weight: 10,
    subsystems: ['sitemap_fetch', 'sitemap_parse'],
  },
  {
    id: 'page_processing',
    label: 'Processing Pages',
    weight: 40,
    subsystems: ['dom_probe', 'dom_analyze'],
  },
  {
    id: 'component_detection',
    label: 'Detecting Components',
    weight: 15,
    subsystems: ['llm_detection', 'llm_classification'],
  },
  {
    id: 'design_extraction',
    label: 'Extracting Design System',
    weight: 10,
    subsystems: ['design_system_extract', 'color_analysis', 'typography_analysis'],
  },
  {
    id: 'media_ingest',
    label: 'Processing Media',
    weight: 5,
    subsystems: ['media_discovery', 'media_download', 'media_optimize'],
  },
  {
    id: 'template_generation',
    label: 'Generating Templates',
    weight: 10,
    subsystems: ['template_create', 'template_save'],
  },
  {
    id: 'finalizing',
    label: 'Finalizing',
    weight: 5,
    subsystems: ['database_write', 'cleanup'],
  },
  {
    id: 'completed',
    label: 'Completed',
    weight: 0,
    subsystems: [],
  },
  {
    id: 'failed',
    label: 'Failed',
    weight: 0,
    subsystems: [],
  },
  {
    id: 'unknown',
    label: 'Needs attention',
    weight: 0,
    subsystems: [],
  },
];

/**
 * Human-readable labels for subsystems.
 */
export const SUBSYSTEM_LABELS: Record<SubsystemId, string> = {
  sitemap_fetch: 'Fetching sitemap',
  sitemap_parse: 'Parsing sitemap',
  dom_probe: 'Probing DOM',
  dom_analyze: 'Analyzing structure',
  llm_detection: 'AI component detection',
  llm_classification: 'Classifying components',
  design_system_extract: 'Extracting design system',
  color_analysis: 'Analyzing colors',
  typography_analysis: 'Analyzing typography',
  media_discovery: 'Discovering media',
  media_download: 'Downloading media',
  media_optimize: 'Optimizing media',
  template_create: 'Creating templates',
  template_save: 'Saving templates',
  database_write: 'Writing to database',
  cleanup: 'Cleaning up',
};

/**
 * Calculate the cumulative progress up to a given stage.
 *
 * Stage order matches the actual import pipeline flow:
 * 1. queued (waiting to start)
 * 2. initializing (setup)
 * 3. sitemap_discovery (finding pages to import)
 * 4. page_processing (fetching and parsing pages)
 * 5. component_detection (AI detecting components on pages)
 * 6. design_extraction (extracting colors, typography, design tokens)
 * 7. media_ingest (downloading and optimizing images)
 * 8. template_generation (creating reusable templates)
 * 9. finalizing (saving to database)
 * 10. completed
 */
export function calculateProgressUpToStage(
  stage: ImportStage,
  stageProgress: number = 0
): number {
  // CRITICAL: Order must match actual pipeline flow
  const stageOrder: ImportStage[] = [
    'queued',
    'initializing',
    'sitemap_discovery',
    'page_processing',
    'component_detection',   // Component detection happens BEFORE design extraction
    'design_extraction',     // Design extraction (DOM probe) happens after component detection
    'media_ingest',
    'template_generation',
    'finalizing',
    'completed',
  ];

  let cumulativeProgress = 0;

  for (const s of stageOrder) {
    if (s === stage) {
      // Add partial progress for current stage
      cumulativeProgress += (STAGE_WEIGHTS[s] * stageProgress) / 100;
      break;
    }
    cumulativeProgress += STAGE_WEIGHTS[s];
  }

  return Math.min(100, Math.max(0, Math.round(cumulativeProgress)));
}

/**
 * Get the label for a stage.
 */
export function getStageLabel(stage: ImportStage): string {
  const config = STAGE_CONFIGS.find(c => c.id === stage);
  return config?.label ?? stage;
}

/**
 * Serialize progress state for JSON storage.
 */
export function serializeProgressState(state: ImportProgressState): SerializedProgressState {
  return {
    jobId: state.jobId,
    websiteId: state.websiteId,
    url: state.url,
    stage: state.stage,
    overallProgress: state.overallProgress,
    stageProgress: state.stageProgress,
    stagesCompleted: state.stagesCompleted,
    activeSubsystems: Array.from(state.activeSubsystems.entries()),
    completedSubsystems: state.completedSubsystems,
    processedCount: state.processedCount,
    totalCount: state.totalCount,
    currentUrl: state.currentUrl,
    startedAt: state.startedAt.toISOString(),
    updatedAt: state.updatedAt.toISOString(),
    estimatedTimeRemaining: state.estimatedTimeRemaining,
    status: state.status,
    message: state.message,
    description: state.description,
    queuePosition: state.queuePosition,
    estimatedStartSeconds: state.estimatedStartSeconds,
    errors: state.errors.map(e => ({
      url: e.url,
      error: e.error,
      timestamp: e.timestamp.toISOString(),
    })),
    skippedPages: state.skippedPages,
  };
}

/**
 * Deserialize progress state from JSON storage.
 */
export function deserializeProgressState(data: SerializedProgressState): ImportProgressState {
  return {
    jobId: data.jobId,
    websiteId: data.websiteId,
    url: data.url,
    stage: data.stage,
    overallProgress: data.overallProgress,
    stageProgress: data.stageProgress,
    stagesCompleted: data.stagesCompleted,
    activeSubsystems: new Map(data.activeSubsystems),
    completedSubsystems: data.completedSubsystems,
    processedCount: data.processedCount,
    totalCount: data.totalCount,
    currentUrl: data.currentUrl,
    startedAt: new Date(data.startedAt),
    updatedAt: new Date(data.updatedAt),
    estimatedTimeRemaining: data.estimatedTimeRemaining,
    status: data.status,
    message: data.message,
    description: data.description,
    queuePosition: data.queuePosition,
    estimatedStartSeconds: data.estimatedStartSeconds,
    errors: data.errors.map(e => ({
      url: e.url,
      error: e.error,
      timestamp: new Date(e.timestamp),
    })),
    skippedPages: data.skippedPages,
  };
}
