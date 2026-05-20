/**
 * Export Services - Entry Point
 *
 * This module provides the core export/deployment functionality for Catalyst Studio.
 */

// Main export service
export { BundleExporter } from './bundle-exporter';
export type { ExportOptions } from './bundle-exporter';

// Deployment executor (for both API and CLI usage)
export { DeploymentExecutor } from './deployment-executor';
export type {
  DeploymentExecutorConfig,
  DeploymentProgress,
  DeploymentResult,
  DeploymentStatistics,
  DeploymentCallbacks,
  ProgressCallback,
  CancellationChecker,
} from './deployment-executor.types';

// Shared types
export type {
  ContentTypeExport,
  ContentItemExport,
  ComponentExport,
  ExportMetadata,
  StandardExport,
  CSSAssets,
  UnifiedExportBundle,
  UnifiedBundleSyncResult,
  UnifiedBundleSyncOptions,
  CompiledTypeIndex,
  CompiledTypeSupport,
} from './types';

// Supporting services
export { FolderExporter } from './folder-exporter';
export type { FolderHierarchy } from './folder-exporter';

export { EnhancedExportValidator } from './export-validator';
export { ContentOrchestrator } from './content-orchestrator';
export { ComponentInstanceExtractor } from './component-instance-extractor';
