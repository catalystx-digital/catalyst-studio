/**
 * Types for the DeploymentExecutor
 *
 * These types define the interface for executing CMS exports/deployments
 * in a reusable way that works from both the API route (UI) and CLI scripts.
 */

/**
 * Configuration for deployment execution
 */
export interface DeploymentExecutorConfig {
  /** Website ID to export */
  websiteId: string;

  /** Provider ID: 'optimizely' | 'kontent' | 'contentful' | 'strapi' | 'contentstack' */
  providerId: string;

  /** Provider-specific configuration (credentials, etc.) */
  providerConfig?: Record<string, unknown>;

  /** Export options */
  options?: {
    /** Include components in export (default: true) */
    includeComponents?: boolean;
    /** Include folder hierarchy (default: true) */
    includeFolders?: boolean;
    /** Include content items (default: true) */
    includeContentItems?: boolean;
    /** Publish content after export instead of leaving as draft (default: false) */
    publish?: boolean;
  };
}

/**
 * Progress update during deployment
 */
export interface DeploymentProgress {
  /** Progress percentage 0-100 */
  progress: number;
  /** Human-readable message */
  message: string;
  /** Log level */
  level: 'info' | 'warning' | 'error';
  /** Current step name */
  currentStep?: string;
  /** Total number of steps */
  totalSteps?: number;
  /** Items processed so far */
  itemsProcessed?: number;
  /** Total items to process */
  totalItems?: number;
  /** Timestamp */
  timestamp: Date;
}

/**
 * Callback for progress updates
 */
export type ProgressCallback = (progress: DeploymentProgress) => void | Promise<void>;

/**
 * Callback to check if deployment should be cancelled
 * Returns true if cancelled, false to continue
 */
export type CancellationChecker = () => boolean | Promise<boolean>;

/**
 * Callbacks for deployment execution
 */
export interface DeploymentCallbacks {
  /** Called on progress updates */
  onProgress?: ProgressCallback;
  /** Called to check if deployment is cancelled (optional) */
  checkCancelled?: CancellationChecker;
}

/**
 * Statistics from deployment execution
 */
export interface DeploymentStatistics {
  /** Total items extracted from database */
  extracted: number;
  /** Items transformed for provider */
  transformed: number;
  /** Items created in CMS */
  created: number;
  /** Items updated in CMS */
  updated: number;
  /** Items skipped (unchanged) */
  skipped: number;
  /** Items that failed */
  errors: number;
  /** Content types synced */
  contentTypes: number;
  /** Content items synced */
  contentItems: number;
  /** Components synced */
  components: number;
  /** Folders synced */
  folders: number;
}

/**
 * Result of deployment execution
 */
export interface DeploymentResult {
  /** Whether deployment succeeded */
  success: boolean;
  /** Statistics from the deployment */
  statistics: DeploymentStatistics;
  /** Error message if failed */
  error?: string;
  /** Detailed error information */
  errorDetails?: Array<{
    id: string;
    message: string;
    payload?: unknown;
  }>;
  /** Total execution time in milliseconds */
  durationMs: number;
  /** Provider that was used */
  providerId: string;
  /** Website that was exported */
  websiteId: string;
}
