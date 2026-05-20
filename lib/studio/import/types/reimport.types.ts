/**
 * Re-Import Types
 *
 * Type definitions for the page re-import feature.
 *
 * @module reimport.types
 */

import type { WebsitePage, WebsiteStructure } from '@/lib/generated/prisma'
import type { ImportDetectionResult } from '../web-detection'

// =============================================================================
// Re-Import Options
// =============================================================================

/**
 * Options for re-importing pages
 */
export interface ReImportOptions {
  /** Target website ID (required) */
  websiteId: string

  /** URLs to re-import (required) */
  urls: string[]

  /** Keep local edits where component types match (default: false) */
  preserveCustomizations?: boolean

  /** Skip design system update (default: true) */
  skipDesignSystem?: boolean

  /** Skip shared component re-detection (default: false) */
  skipSharedComponents?: boolean

  /** Create page if not found locally (default: true) */
  createIfNotExists?: boolean

  /** Progress callback */
  onProgress?: (progress: ReImportProgress) => void

  /** Dry run - preview changes without saving */
  dryRun?: boolean
}

// =============================================================================
// Re-Import Progress
// =============================================================================

/**
 * Progress information during re-import
 */
export interface ReImportProgress {
  /** Current stage of re-import */
  stage: ReImportStage

  /** Overall progress percentage (0-100) */
  progress: number

  /** Human-readable message */
  message: string

  /** Current URL being processed */
  currentUrl?: string

  /** Index of current URL (1-based) */
  currentIndex?: number

  /** Total number of URLs */
  totalUrls?: number

  /** Additional details */
  details?: Record<string, unknown>
}

/**
 * Re-import processing stages
 */
export type ReImportStage =
  | 'initializing'
  | 'validating'
  | 'resolving'
  | 'fetching'
  | 'detecting'
  | 'updating'
  | 'media'
  | 'shared-components'
  | 'finalizing'
  | 'complete'

// =============================================================================
// Re-Import Results
// =============================================================================

/**
 * Result of a full re-import operation
 */
export interface ReImportResult {
  /** Whether the overall operation succeeded */
  success: boolean

  /** Per-page results */
  results: PageReImportResult[]

  /** Summary statistics */
  summary: ReImportSummary

  /** Warnings that don't block success */
  warnings: string[]

  /** Total processing time in ms */
  processingTimeMs: number
}

/**
 * Result for a single page re-import
 */
export interface PageReImportResult {
  /** Source URL */
  url: string

  /** Result status */
  status: PageReImportStatus

  /** Page ID (if exists) */
  pageId?: string

  /** Structure ID (if exists) */
  structureId?: string

  /** Error message (if failed) */
  error?: string

  /** HTTP status from source */
  sourceHttpStatus?: number

  /** Redirect URL (if 301/302) */
  redirectedTo?: string

  /** Change details */
  changes?: PageReImportChanges

  /** Processing time for this page in ms */
  processingTimeMs?: number
}

/**
 * Status of a single page re-import
 */
export type PageReImportStatus =
  | 'updated'           // Existing page was updated
  | 'created'           // New page was created
  | 'unchanged'         // No changes detected
  | 'source-not-found'  // Source returned 404
  | 'source-moved'      // Source returned 301/302
  | 'source-error'      // Source returned 5xx
  | 'source-timeout'    // Source request timed out
  | 'skipped'           // Skipped (e.g., domain mismatch)
  | 'failed'            // Processing failed

/**
 * Changes made during page re-import
 */
export interface PageReImportChanges {
  /** Number of components added */
  componentsAdded: number

  /** Number of components removed */
  componentsRemoved: number

  /** Number of components updated */
  componentsUpdated: number

  /** Number of media assets downloaded */
  mediaDownloaded: number

  /** Whether page metadata was updated */
  metadataUpdated: boolean

  /** Whether structure was updated */
  structureUpdated: boolean

  /** Previous component count */
  previousComponentCount?: number

  /** New component count */
  newComponentCount?: number
}

/**
 * Summary of re-import operation
 */
export interface ReImportSummary {
  /** Number of pages successfully updated */
  updated: number

  /** Number of new pages created */
  created: number

  /** Number of pages unchanged */
  unchanged: number

  /** Number of pages where source returned 404 */
  sourceNotFound: number

  /** Number of pages where source moved (redirect) */
  sourceMoved: number

  /** Number of failed pages */
  failed: number

  /** Number of skipped pages */
  skipped: number

  /** Number of shared components updated */
  sharedComponentsUpdated: number

  /** Number of media assets downloaded */
  mediaDownloaded: number

  /** Total components added across all pages */
  totalComponentsAdded: number

  /** Total components removed across all pages */
  totalComponentsRemoved: number
}

// =============================================================================
// Page Resolution
// =============================================================================

/**
 * Result of resolving a source URL to an existing page
 */
export interface PageResolutionResult {
  /** Whether a page was found */
  found: boolean

  /** The found page (if any) */
  page?: WebsitePage

  /** The found structure (if any) */
  structure?: WebsiteStructure

  /** How the page was matched */
  matchedBy?: 'importSource' | 'fullPath' | 'none'

  /** Canonical URL (normalized) */
  canonicalUrl: string
}

// =============================================================================
// Source Fetch Result
// =============================================================================

/**
 * Result of fetching a source page
 */
export interface SourceFetchResult {
  /** Whether fetch was successful */
  success: boolean

  /** HTTP status code */
  httpStatus: number

  /** Final URL after redirects */
  finalUrl: string

  /** Whether URL was redirected */
  redirected: boolean

  /** Page content (if success) */
  content?: string

  /** Error message (if failed) */
  error?: string
}

// =============================================================================
// Content Merge
// =============================================================================

/**
 * Result of merging content with preserve customizations
 */
export interface ContentMergeResult {
  /** Merged component tree */
  components: ComponentInstance[]

  /** Merge report */
  report: ContentMergeReport
}

/**
 * Report of content merge operation
 */
export interface ContentMergeReport {
  /** Components preserved from local */
  preservedFromLocal: number

  /** Components taken from source */
  takenFromSource: number

  /** Components removed */
  removed: number

  /** Components with conflicts */
  conflicts: ContentMergeConflict[]
}

/**
 * A conflict during content merge
 */
export interface ContentMergeConflict {
  /** Component ID */
  componentId: string

  /** Component type */
  componentType: string

  /** Conflict reason */
  reason: string

  /** Resolution taken */
  resolution: 'keep-local' | 'use-source'
}

/**
 * Component instance (simplified for merge)
 */
export interface ComponentInstance {
  id: string
  type: string
  parentId: string | null
  position: number
  props: Record<string, unknown>
  children?: ComponentInstance[]
}

// =============================================================================
// Re-Import History
// =============================================================================

/**
 * Re-import history entry stored in page metadata
 */
export interface ReImportHistoryEntry {
  /** When the re-import occurred */
  timestamp: string

  /** Changes made */
  changes: {
    componentsAdded: number
    componentsRemoved: number
    componentsUpdated: number
  }

  /** HTTP status from source */
  sourceStatus: number

  /** Whether customizations were preserved */
  preservedCustomizations: boolean
}

// =============================================================================
// Extended Page Metadata
// =============================================================================

/**
 * Extended page metadata with re-import tracking
 */
export interface PageMetadataWithReImport {
  /** Original import source URL */
  importSource?: string

  /** Original import timestamp */
  importTimestamp?: string

  /** Last re-import timestamp */
  lastReimportedAt?: string

  /** Re-import history */
  reimportHistory?: ReImportHistoryEntry[]

  /** When source returned 404 */
  sourceNotFoundAt?: string

  /** Where source moved to (redirect target) */
  sourceMovedTo?: string

  /** Other metadata fields */
  [key: string]: unknown
}

// =============================================================================
// Validation
// =============================================================================

/**
 * URL validation result
 */
export interface UrlValidationResult {
  /** Whether URL is valid for re-import */
  valid: boolean

  /** Reason if invalid */
  reason?: string

  /** Normalized URL (query params stripped for page matching) */
  normalizedUrl?: string

  /** Original URL including query params */
  originalUrl?: string

  /** Extracted domain */
  domain?: string
}

// =============================================================================
// Authorization
// =============================================================================

/**
 * Authorization context for re-import operations
 */
export interface ReImportAuthContext {
  /** Account ID that must match website owner */
  accountId: string

  /** Optional user ID for audit logging */
  userId?: string
}

// =============================================================================
// Shared Component Detection Strategy
// =============================================================================
//
// For single-page re-import:
//   - Skip shared component detection (skipSharedComponents: true)
//   - OR only update existing shared component references
//
// For batch re-import (>5 pages):
//   - Run full shared component detection across affected pages
//   - May detect new patterns but won't affect non-reimported pages
//
// For site-wide re-import:
//   - Run full shared component detection across all pages
// =============================================================================
