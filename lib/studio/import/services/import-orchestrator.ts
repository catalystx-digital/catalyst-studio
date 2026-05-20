/**
 * ImportOrchestrator Service
 *
 * Coordinates the full import pipeline, including component extraction,
 * page creation, structure building, and shared component detection.
 *
 * This file has been decomposed - stage logic is in orchestrator/ directory.
 */
import { PrismaClient } from '@/lib/generated/prisma'
import {
  IImportOrchestrator,
  ImportResult,
  ImportProgress,
  ImportOptions,
  ImportFailure
} from './interfaces/import-orchestrator.interface'
import { DetectionResult } from './interfaces/component-type-extractor.interface'
import { ComponentTypeExtractor } from './component-type-extractor'
import { PageBuilderService } from './page-builder-service'
import { StructureService } from './structure-service'
import { ISharedComponentDetector } from './interfaces/shared-component-detector.interface'
import { OrchestrationContext } from './orchestrator/context'
import { traceMemory } from '../utils/memory-trace'
import type { ProgressCallback } from '../types/progress.types'

// Import from decomposed modules
import {
  registerSimpleComponentTypes,
  registerFullComponentTypes,
  resolveContentTypeConfiguration
} from './orchestrator/component-type-stage'
import {
  createPages as createPagesStage,
  countTotalComponents
} from './orchestrator/page-creation-stage'
import { persistSharedComponentsAndUpdatePages } from './orchestrator/shared-component-manager'
import {
  validateImportIntegrity,
  rollbackImport,
  generateImportSummary
} from './orchestrator/validation-utils'
import {
  processInChunks,
  checkMemoryUsage,
  forceGarbageCollection,
  handleImportError,
  executeInTransaction,
  type TransactionResult
} from './orchestrator/processing-utils'
import {
  resolveReferencesStage
} from './orchestrator/reference-resolution-stage'

export interface ImportOrchestratorConfig {
  componentTypeExtractor: ComponentTypeExtractor
  pageBuilderService: PageBuilderService
  structureService: StructureService
  sharedComponentDetector: ISharedComponentDetector
  prisma?: PrismaClient
  memoryLimitMB?: number
  /** Skip memory limit checks (useful for workflow mode where Vercel manages resources) */
  skipMemoryCheck?: boolean
  batchSizes?: {
    components?: number
    pages?: number
    structures?: number
    detection?: number
  }
  parallelism?: number
}

export class ImportOrchestrator implements IImportOrchestrator {
  private readonly componentTypeExtractor: ComponentTypeExtractor
  private readonly pageBuilderService: PageBuilderService
  private readonly structureService: StructureService
  private readonly sharedComponentDetector: ISharedComponentDetector
  private readonly prisma: PrismaClient

  private progressCallback?: (progress: ImportProgress) => void
  private currentOptions?: ImportOptions
  private readonly memoryLimitMB: number
  private readonly skipMemoryCheck: boolean
  private readonly batchSizes: {
    components: number
    pages: number
    structures: number
    detection: number
  }
  private readonly chunkConcurrency: number

  constructor(config: ImportOrchestratorConfig) {
    this.componentTypeExtractor = config.componentTypeExtractor
    this.pageBuilderService = config.pageBuilderService
    this.structureService = config.structureService
    this.sharedComponentDetector = config.sharedComponentDetector
    this.prisma = config.prisma || new PrismaClient()

    this.memoryLimitMB = config.memoryLimitMB || 2000
    this.skipMemoryCheck = config.skipMemoryCheck ?? false
    this.batchSizes = {
      components: config.batchSizes?.components || 100,
      pages: config.batchSizes?.pages || 10,
      structures: config.batchSizes?.structures || 50,
      detection: config.batchSizes?.detection || 100
    }
    this.chunkConcurrency = Math.max(1, Math.min(4, config.parallelism || 2))
  }

  async orchestrateImport(
    detectionResults: DetectionResult[],
    websiteId: string,
    options: ImportOptions = {}
  ): Promise<ImportResult> {
    const startTime = Date.now()
    this.currentOptions = options
    this.progressCallback = options.progressCallback

    this.reportProgress({ stage: 'extracting', progress: 0, message: 'Starting import orchestration' })

    try {
      const pageCount = detectionResults.length
      const LARGE_IMPORT_THRESHOLD = 50

      const useTransaction = options.enableTransactions !== false && pageCount <= LARGE_IMPORT_THRESHOLD

      let result: ImportResult

      if (useTransaction) {
        console.log(`[ImportOrchestrator] Using transaction wrapper for ${pageCount} pages`)
        const transactionResult = await executeInTransaction(
          this.prisma,
          // Only run DB operations inside transaction (no network I/O)
          () => this.performCoreOrchestration(detectionResults, websiteId, startTime),
          { timeout: options.timeout }
        )

        if (!transactionResult.success) {
          throw transactionResult.error || new Error('Transaction failed')
        }

        result = transactionResult.data!
      } else {
        console.log(`[ImportOrchestrator] Skipping transaction wrapper for large import (${pageCount} pages)`)
        result = await this.performCoreOrchestration(detectionResults, websiteId, startTime)
      }

      // Run reference resolution OUTSIDE transaction (contains network I/O for image downloads)
      // This is idempotent and can be retried if it fails
      await this.performPostTransactionReferenceResolution(websiteId, startTime)

      return result
    } catch (error) {
      if (options.maxRetries && options.maxRetries > 0) {
        const shouldRetry = await handleImportError(error as Error, 0, options.maxRetries)
        if (shouldRetry) {
          return await this.orchestrateImport(detectionResults, websiteId, {
            ...options,
            maxRetries: options.maxRetries - 1
          })
        }
      }
      throw error
    }
  }

  /**
   * Post-transaction reference resolution (network I/O heavy)
   *
   * This runs AFTER the main transaction commits because it downloads external images
   * which can take a long time and would cause Prisma Accelerate P6005 timeout errors.
   *
   * This operation is idempotent - if it fails, it can be retried without data loss.
   */
  private async performPostTransactionReferenceResolution(
    websiteId: string,
    startTime: number
  ): Promise<void> {
    this.reportProgress({ stage: 'structuring', progress: 55, message: 'Resolving content references (post-transaction)' })

    try {
      const referenceResult = await resolveReferencesStage({
        websiteId,
        onProgress: (msg, prog) => this.reportProgress({
          stage: 'structuring',
          progress: 55 + (prog / 100) * 10, // 55-65% progress
          message: msg
        })
      })
      console.log(
        `[ImportOrchestrator] References resolved: ${referenceResult.mediaReferencesResolved} media, ` +
        `${referenceResult.pageReferencesResolved} pages, ${referenceResult.contentReferencesSynced} synced`
      )
    } catch (error) {
      // Reference resolution is non-fatal - pages are already persisted
      // This can be retried later via a separate endpoint if needed
      console.warn('[ImportOrchestrator] Reference resolution failed (non-fatal, can be retried):', error)
    }
    this.forceGC('after reference resolution')
  }

  /**
   * Core orchestration - DB operations only (fast, runs inside transaction)
   *
   * Reference resolution is intentionally excluded here because it contains
   * network I/O (downloading external images) which would cause Prisma Accelerate
   * P6005 timeout errors. Reference resolution runs after the transaction commits.
   */
  private async performCoreOrchestration(
    detectionResults: DetectionResult[],
    websiteId: string,
    startTime: number
  ): Promise<ImportResult> {
    const simpleImport = this.currentOptions?.simpleImport === true
    const context = new OrchestrationContext(websiteId, startTime)
    const failedPages: ImportFailure[] = []

    traceMemory('orchestrator:start', { websiteId, detectionCount: detectionResults.length })
    this.checkMemory('orchestration start')

    try {
      // Stage 1: Register component types
      const componentTypes = await this.registerComponentTypes({ detectionResults, websiteId, simpleImport })
      context.setComponentTypes(componentTypes)
      console.log(`[ImportOrchestrator] Component types extracted: ${componentTypes.length}`)
      this.forceGC('after component type extraction')

      this.reportProgress({ stage: 'building', progress: 30, message: 'Creating pages with component instances' })

      // Stage 2: Resolve content types and create pages
      const { defaultContentTypeId, templateContentTypes } = await resolveContentTypeConfiguration(
        this.prisma,
        websiteId
      )
      this.pageBuilderService.configureContentTypes({ defaultContentTypeId, templateContentTypes })

      const pages = await createPagesStage({
        detectionResults,
        componentTypes: context.getComponentTypes(),
        websiteId,
        contentTypeId: defaultContentTypeId,
        failedPages,
        pageBuilderService: this.pageBuilderService,
        batchSize: this.batchSizes.pages,
        processInChunks: (data, chunkSize, processor, operationName, options) =>
          this.processInChunksWrapper(data, chunkSize, processor, operationName, options),
        onProgress: (msg, prog, details) => this.reportProgress({ stage: 'building', progress: prog, message: msg, details })
      })
      context.setPages(pages)
      context.setFailedPages(failedPages)
      console.log(`[ImportOrchestrator] Pages created: ${pages.length}`)
      this.forceGC('after page creation')

      this.reportProgress({ stage: 'structuring', progress: 45, message: 'Building URL structure hierarchy' })

      // Stage 3: Create structures (needed for page reference resolution later)
      this.structureService.clearDiagnostics()
      const structures = await this.createStructures(context.getPages(), websiteId)
      context.setStructures(structures)
      console.log(`[ImportOrchestrator] Structures created: ${structures.length}`)

      const structureDiagnostics = this.structureService.getDiagnostics().map(d => ({ ...d, source: 'structure' }))
      if (structureDiagnostics.length > 0) {
        context.addDiagnostics(structureDiagnostics)
        this.structureService.clearDiagnostics()
      }
      this.forceGC('after structure creation')

      // NOTE: Stage 3.5 (resolveReferencesStage) is intentionally NOT here
      // It runs AFTER the transaction commits via performPostTransactionReferenceResolution()
      // because it contains network I/O (image downloads) that would timeout Prisma Accelerate

      this.reportProgress({ stage: 'detecting', progress: 70, message: 'Detecting shared components' })

      // Stage 4: Detect and persist shared components
      const sharedCandidates = await this.detectSharedComponentCandidates(context.getPages(), websiteId)
      context.setSharedComponents(sharedCandidates)

      const sharedPersisted = await persistSharedComponentsAndUpdatePages({
        prisma: this.prisma,
        websiteId,
        sharedComponentDetector: this.sharedComponentDetector,
        pages: context.getPages(),
        candidates: sharedCandidates,
        componentTypes: context.getComponentTypes()
      })

      context.setSharedComponents(sharedPersisted.sharedComponents)
      context.setPages(sharedPersisted.updatedPages)
      context.setComponentTypes(sharedPersisted.refreshedComponentTypes)
      console.log(`[ImportOrchestrator] Shared components persisted: ${sharedPersisted.sharedComponents.length}`)

      this.reportProgress({ stage: 'finalizing', progress: 90, message: 'Persisting shared components and updating page references' })

      // Finalize
      context.setTotalComponents(countTotalComponents(context.getPages()))
      const processingTimeMs = Date.now() - startTime
      const result = context.finalize(processingTimeMs)

      if (this.currentOptions?.validateIntegrity !== false) {
        const validationResult = validateImportIntegrity(result)
        if (!validationResult.valid) {
          throw new Error(`Import validation failed: ${validationResult.errors.join(', ')}`)
        }
      }

      this.reportProgress({ stage: 'finalizing', progress: 100, message: `Core import completed in ${processingTimeMs}ms (reference resolution pending)` })
      this.checkMemory('orchestration completion')

      return result
    } catch (error) {
      try {
        await rollbackImport(this.prisma, websiteId, context.getPartialResult())
      } catch (rollbackError) {
        console.error('Import rollback failed', rollbackError)
      }
      throw error
    }
  }

  private async registerComponentTypes(params: {
    detectionResults: DetectionResult[]
    websiteId: string
    simpleImport: boolean
  }): Promise<any[]> {
    const input = {
      ...params,
      prisma: this.prisma,
      componentTypeExtractor: this.componentTypeExtractor,
      onProgress: (msg: string, prog: number) => this.reportProgress({ stage: 'extracting', progress: prog, message: msg })
    }

    return params.simpleImport
      ? registerSimpleComponentTypes(input)
      : registerFullComponentTypes(input)
  }

  private async createStructures(pages: any[], websiteId: string): Promise<any[]> {
    const structureRecords: any[] = []
    await this.processInChunksWrapper(
      pages,
      this.batchSizes.structures,
      async (chunk) => this.structureService.createStructures(chunk, websiteId),
      'structure creation',
      {
        collectResults: false,
        onChunk: (result) => {
          if (Array.isArray(result) && result.length > 0) {
            structureRecords.push(...result)
          }
        }
      }
    )

    this.reportProgress({ stage: 'structuring', progress: 60, message: `Created ${structureRecords.length} structure entries` })
    return structureRecords
  }

  private async detectSharedComponentCandidates(pages: any[], websiteId: string): Promise<any[]> {
    const sharedComponentRecords: any[] = []
    await this.processInChunksWrapper(
      pages,
      this.batchSizes.detection,
      async (chunk) => this.sharedComponentDetector.detectShared(chunk),
      'shared component detection',
      {
        collectResults: false,
        onChunk: (result) => {
          if (Array.isArray(result) && result.length > 0) {
            sharedComponentRecords.push(...result)
          }
        }
      }
    )

    this.reportProgress({ stage: 'detecting', progress: 80, message: `Detected ${sharedComponentRecords.length} shared components` })
    return sharedComponentRecords
  }

  private async processInChunksWrapper<T, R>(
    data: T[],
    chunkSize: number,
    processor: (chunk: T[], chunkIndex: number) => Promise<R>,
    operationName: string,
    options: { collectResults?: boolean; concurrency?: number; onChunk?: (result: R, chunk: T[], chunkIndex: number) => void | Promise<void>; onProgress?: ProgressCallback } = {}
  ): Promise<R[]> {
    return processInChunks(
      data,
      chunkSize,
      processor,
      operationName,
      {
        ...options,
        // Pass unified progress callback if available
        onProgress: options.onProgress ?? this.currentOptions?.unifiedProgressCallback
      },
      {
        chunkConcurrency: this.chunkConcurrency,
        memoryLimitMB: this.memoryLimitMB,
        checkMemory: (stage) => this.checkMemory(stage),
        forceGC: (reason) => this.forceGC(reason)
      }
    )
  }

  private checkMemory(stage: string): void {
    if (this.skipMemoryCheck) {
      // In workflow mode, Vercel manages resources - skip memory checks
      return
    }
    checkMemoryUsage(stage, this.memoryLimitMB, (reason) => this.forceGC(reason))
  }

  private forceGC(reason: string): void {
    forceGarbageCollection(reason)
  }

  reportProgress(progress: ImportProgress): void {
    if (this.progressCallback) {
      this.progressCallback(progress)
    }
  }

  // Public interface methods delegating to utilities
  async executeInTransaction<T>(operations: () => Promise<T>): Promise<TransactionResult<T>> {
    return executeInTransaction(this.prisma, operations, { timeout: this.currentOptions?.timeout })
  }

  validateImportIntegrity(result: ImportResult) {
    return validateImportIntegrity(result)
  }

  async rollbackImport(websiteId: string, importResult: Partial<ImportResult>): Promise<void> {
    return rollbackImport(this.prisma, websiteId, importResult)
  }

  calculateStatistics(result: ImportResult) {
    return {
      totalPages: result.pages.length,
      totalComponents: countTotalComponents(result.pages),
      uniqueComponentTypes: result.componentTypes.length,
      sharedComponentsDetected: result.sharedComponents.length,
      failedPages: result.failedPages.length,
      processingTimeMs: result.statistics.processingTimeMs
    }
  }

  async handleImportError(error: Error, retryCount: number, maxRetries: number): Promise<boolean> {
    return handleImportError(error, retryCount, maxRetries)
  }

  async cleanupTemporaryData(websiteId: string): Promise<void> {
    console.log(`Cleaning up temporary data for website ${websiteId}`)
  }

  async verifyDatabaseConsistency(websiteId: string): Promise<boolean> {
    try {
      await this.prisma.websitePage.findMany({ where: { websiteId } })
      await this.prisma.websiteStructure.findMany({ where: { websiteId }, include: { websitePage: true } })
      return true
    } catch (error) {
      console.error('Database consistency check failed:', error)
      return false
    }
  }

  generateImportSummary(result: ImportResult): string {
    return generateImportSummary(result)
  }
}
