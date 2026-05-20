import { WebsitePage, WebsiteStructure, WebsiteComponentType, WebsiteSharedComponent } from '@/lib/generated/prisma'
import { DetectionResult } from './component-type-extractor.interface'
import type { ProgressCallback } from '../../types/progress.types'

export interface ImportFailure {
  pageUrl: string
  error: string
  stage: 'page-creation' | 'structure' | 'shared-component' | 'validation'
  metadata?: Record<string, unknown>
}

export interface ImportDiagnostic {
  code: string
  level: 'info' | 'warn' | 'error'
  message: string
  context?: Record<string, unknown>
  source?: string
}

export interface ImportResult {
  websiteId: string
  pages: WebsitePage[]
  structures: WebsiteStructure[]
  componentTypes: WebsiteComponentType[]
  sharedComponents: WebsiteSharedComponent[]
  failedPages: ImportFailure[]
  diagnostics: ImportDiagnostic[]
  statistics: {
    totalPages: number
    totalComponents: number
    uniqueComponentTypes: number
    sharedComponentsDetected: number
    failedPages: number
    processingTimeMs: number
  }
}

export interface ImportProgress {
  stage: 'extracting' | 'building' | 'structuring' | 'detecting' | 'finalizing'
  progress: number
  message: string
  details?: Record<string, any>
}

export interface TransactionResult<T> {
  success: boolean
  data?: T
  error?: Error
  rollbackPerformed?: boolean
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  statistics: {
    pagesValidated: number
    componentsValidated: number
    structuresValidated: number
  }
}

export interface ImportOptions {
  validateIntegrity?: boolean
  enableTransactions?: boolean
  progressCallback?: (progress: ImportProgress) => void
  /** Unified progress callback for subsystem progress reporting */
  unifiedProgressCallback?: ProgressCallback
  maxRetries?: number
  timeout?: number
  simpleImport?: boolean
}

export interface IImportOrchestrator {
  /**
   * Orchestrate complete import process from detection results
   */
  orchestrateImport(
    detectionResults: DetectionResult[],
    websiteId: string,
    options?: ImportOptions
  ): Promise<ImportResult>

  /**
   * Execute operations within a database transaction
   */
  executeInTransaction<T>(
    operations: () => Promise<T>
  ): Promise<TransactionResult<T>>

  /**
   * Validate import result integrity
   */
  validateImportIntegrity(result: ImportResult): ValidationResult

  /**
   * Report progress to callback or WebSocket
   */
  reportProgress(progress: ImportProgress): void

  /**
   * Rollback import on failure
   */
  rollbackImport(websiteId: string, importResult: Partial<ImportResult>): Promise<void>

  /**
   * Calculate import statistics
   */
  calculateStatistics(result: ImportResult): ImportResult['statistics']

  /**
   * Handle import errors with retry logic
   */
  handleImportError(
    error: Error,
    retryCount: number,
    maxRetries: number
  ): Promise<boolean>

  /**
   * Clean up temporary data after import
   */
  cleanupTemporaryData(websiteId: string): Promise<void>

  /**
   * Verify database consistency after import
   */
  verifyDatabaseConsistency(websiteId: string): Promise<boolean>

  /**
   * Generate import summary report
   */
  generateImportSummary(result: ImportResult): string
}
