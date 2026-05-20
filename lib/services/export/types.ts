/**
 * Shared types for export services
 * Extracted to avoid circular dependencies
 */

import { FolderHierarchy } from './folder-exporter';
import type { UniversalMediaAsset } from '@/lib/cms-export/universal/types';
import type { UnifiedContent } from './content-orchestrator';
import type { ValueObjectDefinition } from './helpers/value-object-order';

// Re-export deployment executor types for convenience
export type {
  DeploymentExecutorConfig,
  DeploymentProgress,
  DeploymentResult,
  DeploymentStatistics,
  DeploymentCallbacks,
  ProgressCallback,
  CancellationChecker,
} from './deployment-executor.types';

export interface ContentTypeExport {
  id: string
  key: string
  name: string
  pluralName: string
  category: string
  fields: any
  mayContainTypes?: string[]
  metadata?: Record<string, unknown>
}

export interface ContentItemExport {
  id: string
  contentTypeId: string
  title: string
  slug: string
  content: any
  metadata?: any
  mediaAssets?: UniversalMediaAsset[]
}

export interface ComponentExport {
  id: string
  type: string
  category: string
  props?: any
  content?: any
  name?: string
  metadata?: any
  aiMetadata?: any
}

export interface ExportMetadata {
  exportDate: string | Date
  websiteId: string
  websiteName?: string
  version: string
  statistics?: {
    contentTypes: number
    contentItems: number
    components: number
    folders: number
    totalExportTime: number
  }
  itemCounts?: {
    contentTypes: number
    contentItems: number
    components: number
    folders?: number
  }
  validation?: {
    performed: boolean
    valid: boolean
    errorCount: number
    warningCount: number
    timestamp?: string
  }
  componentRelationships?: any[]
  externalReferences?: any[]
  itemCount?: number // For backward compatibility
  typeCount?: number // For backward compatibility
}

export interface StandardExport {
  websiteId?: string // Optional for backward compatibility
  contentTypes: ContentTypeExport[]
  contentItems: ContentItemExport[]
  websitePages?: any[] // For new model support
  components?: ComponentExport[] // Optional for backward compatibility
  folders?: FolderHierarchy
  metadata: ExportMetadata
  /** CSS assets for exported site styling */
  cssAssets?: CSSAssets
}

/**
 * CSS assets generated for exported websites
 * Ensures proper styling without requiring Tailwind build pipeline
 */
export interface CSSAssets {
  /** Complete CSS with all design system variables and utilities */
  full: string
  /** Critical CSS for initial render (variables only) */
  critical: string
  /** HTML snippet to inject into <head> for theme support */
  themeScript: string
  /** Theme mode used for export */
  theme: 'light' | 'dark' | 'auto'
}

export interface UnifiedExportBundle {
  website: {
    id: string
    name?: string | null
  }
  contentTypes: ContentTypeExport[]
  unifiedContent: UnifiedContent[]
  componentUsage: string[]
  components: ComponentExport[]
  valueObjects: ValueObjectDefinition[]
  folders: FolderHierarchy
  metadata: ExportMetadata
  /** CSS assets for exported site styling */
  cssAssets?: CSSAssets
}

export interface UnifiedBundleSyncResult {
  successCount: number
  failureCount: number
  details: Array<{
    scope: 'contentType' | 'content' | 'component' | 'folder' | 'relationship' | 'other'
    id: string
    action: 'created' | 'updated' | 'skipped' | 'deleted' | 'error'
    message?: string
    providerId?: string
    payload?: unknown
  }>
}

export interface UnifiedBundleSyncOptions {
  // Reserved for future options
}

// Provider-agnostic compiled schema interfaces (minimal for planning/sync)
export interface CompiledTypeIndex {
  byKey: Record<string, unknown>
  all: Array<{ key: string; baseType?: string; fields?: Array<{ name: string; valueType?: string }> }>
}

export interface CompiledTypeSupport {
  // Compile a provider-ready type index from export content types
  compile(contentTypes: ContentTypeExport[]): CompiledTypeIndex
  // Optional configuration step to let provider cache or precompute
  configure?(compiled: CompiledTypeIndex): void | Promise<void>
  // Optional ensure step to create/update types remotely
  ensure?(compiled: CompiledTypeIndex): Promise<void>
  // Optional helper to register local id→key mapping and base type
  registerContentTypeMapping?(dbId: string, safeKey: string, baseType: '_page' | '_component'): void
}

