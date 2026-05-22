/**
 * Re-Import Service
 *
 * Handles selective re-import of pages for existing websites.
 * Enables refreshing content from source without full site re-import.
 *
 * @module reimport-service
 */

import { PrismaClient, WebsitePage, WebsiteStructure, Prisma, Website } from '@/lib/generated/prisma'
import { ImportPipeline } from '../import-pipeline'
import { ImportOrchestrator } from './import-orchestrator'
import { PageBuilderService } from './page-builder-service'
import { StructureService } from './structure-service'
import { ComponentTypeExtractor } from './component-type-extractor'
import { CanonicalSignatureSharedComponentDetector } from './shared-component-detectors/canonical-signature-detector'
import { MediaIngestService } from './media-ingest-service'
import { getCheckpointService, ImportCheckpointService } from './checkpoint-service'
import { ReImportConfig } from '../config'
import type { ImportDetectionResult } from '../web-detection'
import type { CheckpointSession } from '../types/checkpoint.types'
import type {
  ReImportOptions,
  ReImportResult,
  ReImportProgress,
  ReImportSummary,
  PageReImportResult,
  PageReImportStatus,
  PageReImportChanges,
  PageResolutionResult,
  UrlValidationResult,
  ComponentInstance,
  PageMetadataWithReImport,
  ReImportHistoryEntry
} from '../types/reimport.types'

// =============================================================================
// URL Query Parameter Handling Strategy
// =============================================================================
//
// Query parameters are STRIPPED during URL normalization and page matching.
// This means:
// - https://example.com/product?id=123 and https://example.com/product?id=456
//   will match the SAME page at /product
//
// Rationale:
// - Most CMS pages are path-based, not query-based
// - Dynamic pages with query params typically share the same template
// - If query-specific pages are needed, they should have unique paths
// =============================================================================

// =============================================================================
// Extended Options
// =============================================================================

/**
 * Extended re-import options with batch and checkpoint support
 */
export interface ReImportOptionsExtended extends ReImportOptions {
  /** Maximum concurrent page processing (default: 3) */
  concurrency?: number

  /** Enable checkpoint for resumable re-import */
  enableCheckpoint?: boolean

  /** Existing checkpoint session to resume from */
  checkpointSession?: CheckpointSession

  /** Job ID for checkpoint tracking */
  jobId?: string
}

// =============================================================================
// Interface
// =============================================================================

export interface IReImportService {
  /**
   * Re-import one or more pages for an existing website
   */
  reimport(options: ReImportOptionsExtended): Promise<ReImportResult>

  /**
   * Validate URLs for re-import
   */
  validateUrls(websiteId: string, urls: string[]): Promise<UrlValidationResult[]>

  /**
   * Resolve a source URL to an existing page
   */
  resolveExistingPage(websiteId: string, sourceUrl: string): Promise<PageResolutionResult>

  /**
   * Resume a re-import from checkpoint
   */
  resumeFromCheckpoint(jobId: string): Promise<ReImportResult>
}

// =============================================================================
// Configuration
// =============================================================================

export interface ReImportServiceConfig {
  prisma?: PrismaClient
  importPipeline?: ImportPipeline
  mediaIngestService?: MediaIngestService
}

// =============================================================================
// Service Implementation
// =============================================================================

export class ReImportService implements IReImportService {
  private readonly prisma: PrismaClient
  private readonly importPipeline: ImportPipeline
  private readonly mediaIngestService?: MediaIngestService
  private readonly checkpointService: ImportCheckpointService

  private progressCallback?: (progress: ReImportProgress) => void
  private currentCheckpointSession?: CheckpointSession

  constructor(config: ReImportServiceConfig = {}) {
    this.prisma = config.prisma || new PrismaClient()
    this.importPipeline = config.importPipeline || new ImportPipeline()
    this.mediaIngestService = config.mediaIngestService
    this.checkpointService = getCheckpointService()
  }

  // ===========================================================================
  // Main Re-Import Method
  // ===========================================================================

  async reimport(options: ReImportOptionsExtended): Promise<ReImportResult> {
    const startTime = Date.now()
    this.progressCallback = options.onProgress

    const mergedOptions = {
      preserveCustomizations: options.preserveCustomizations ?? ReImportConfig.defaults.preserveCustomizations,
      skipDesignSystem: options.skipDesignSystem ?? ReImportConfig.defaults.skipDesignSystem,
      skipSharedComponents: options.skipSharedComponents ?? ReImportConfig.defaults.skipSharedComponents,
      createIfNotExists: options.createIfNotExists ?? ReImportConfig.defaults.createIfNotExists,
      dryRun: options.dryRun ?? false,
      concurrency: options.concurrency ?? ReImportConfig.maxConcurrency
    }

    this.reportProgress({
      stage: 'initializing',
      progress: 0,
      message: `Starting re-import of ${options.urls.length} page(s)`,
      totalUrls: options.urls.length
    })

    const results: PageReImportResult[] = []
    const warnings: string[] = []

    // Initialize or resume checkpoint if enabled
    if (options.enableCheckpoint && options.jobId) {
      try {
        if (options.checkpointSession) {
          this.currentCheckpointSession = options.checkpointSession
        } else {
          this.currentCheckpointSession = await this.checkpointService.initializeSession(
            options.jobId,
            options.websiteId,
            options.urls[0],
            { maxPages: options.urls.length }
          )
          await this.checkpointService.saveSitemap(
            this.currentCheckpointSession,
            options.urls,
            []
          )
        }
      } catch (err) {
        console.warn('[ReImportService] Failed to initialize checkpoint:', err)
      }
    }

    try {
      // Step 1: Validate website exists and get source domain
      this.reportProgress({ stage: 'validating', progress: 5, message: 'Validating website and URLs' })
      const website = await this.prisma.website.findUnique({
        where: { id: options.websiteId },
        include: { importJobs: { take: 1, orderBy: { createdAt: 'desc' } } }
      })

      if (!website) {
        throw new Error(`Website not found: ${options.websiteId}`)
      }

      // Get original import domain
      // Priority: 1) website.settings.importSourceDomain, 2) ImportJob URL
      // This ensures domain is preserved even if ImportJob is deleted
      const sourceDomain = this.getImportSourceDomain(website)

      // Create ImportJob record for tracking (if enabled)
      let importJobId: string | undefined
      if (ReImportConfig.tracking.createImportJob && !options.dryRun) {
        try {
          const importJob = await this.prisma.importJob.create({
            data: {
              websiteId: options.websiteId,
              url: options.urls[0], // Primary URL
              status: 'processing',
              startedAt: new Date(),
              // Store reimport metadata in detectionResults since ImportJob schema doesn't have a metadata field
              detectionResults: {
                type: ReImportConfig.tracking.importJobType, // 'reimport' discriminator
                urls: options.urls,
                totalUrls: options.urls.length,
                preserveCustomizations: options.preserveCustomizations,
                skipDesignSystem: options.skipDesignSystem
              } as Prisma.InputJsonValue
            }
          })
          importJobId = importJob.id
        } catch (err) {
          console.warn('[ReImportService] Failed to create ImportJob:', err)
          // Continue without job tracking
        }
      }

      // Step 2: Validate all URLs
      const validationResults = await this.validateUrls(options.websiteId, options.urls)
      const validUrls: string[] = []

      for (let i = 0; i < options.urls.length; i++) {
        const url = options.urls[i]
        const validation = validationResults[i]

        if (!validation.valid) {
          results.push({
            url,
            status: 'skipped',
            error: validation.reason
          })
          warnings.push(`Skipped ${url}: ${validation.reason}`)
        } else if (sourceDomain && validation.domain !== sourceDomain) {
          results.push({
            url,
            status: 'skipped',
            error: `Domain mismatch: expected ${sourceDomain}, got ${validation.domain}`
          })
          warnings.push(`Skipped ${url}: domain mismatch`)
        } else {
          validUrls.push(validation.normalizedUrl || url)
        }
      }

      if (validUrls.length === 0) {
        return this.buildResult(results, warnings, startTime, false)
      }

      // Check for completed URLs from checkpoint
      let urlsToProcess = validUrls
      if (this.currentCheckpointSession) {
        const completedUrls = await this.checkpointService.getCompletedUrls(this.currentCheckpointSession)
        urlsToProcess = validUrls.filter(url => !completedUrls.has(url))

        if (urlsToProcess.length < validUrls.length) {
          const skippedCount = validUrls.length - urlsToProcess.length
          console.log(`[ReImportService] Resuming: ${skippedCount} pages already completed`)
        }
      }

      // Step 3: Process URLs with concurrency
      this.reportProgress({
        stage: 'resolving',
        progress: 10,
        message: `Processing ${urlsToProcess.length} URL(s) with concurrency ${mergedOptions.concurrency}`,
        totalUrls: urlsToProcess.length
      })

      // Process in batches with concurrency
      const batchResults = await this.processUrlsWithConcurrency(
        urlsToProcess,
        options.websiteId,
        mergedOptions,
        validUrls.length
      )
      results.push(...batchResults)

      // Step 4: Run shared component detection (if not skipped)
      if (!mergedOptions.skipSharedComponents) {
        await this.updateSharedComponents(options.websiteId, results)
      }

      // Finalize checkpoint
      if (this.currentCheckpointSession) {
        await this.checkpointService.finalize(this.currentCheckpointSession, true)
      }

      // Update ImportJob status on completion
      if (importJobId) {
        const finalResult = this.buildResult(results, warnings, startTime, true)
        try {
          await this.prisma.importJob.update({
            where: { id: importJobId },
            data: {
              status: finalResult.success ? 'completed' : 'failed',
              completedAt: new Date(),
              detectionResults: {
                type: ReImportConfig.tracking.importJobType, // Preserve type discriminator
                urls: options.urls,
                totalUrls: options.urls.length,
                summary: finalResult.summary,
                processingTimeMs: finalResult.processingTimeMs
              } as Prisma.InputJsonValue
            }
          })
        } catch (err) {
          console.warn('[ReImportService] Failed to update ImportJob:', err)
        }
      }

      this.reportProgress({
        stage: 'complete',
        progress: 100,
        message: 'Re-import completed'
      })

      return this.buildResult(results, warnings, startTime, true)

    } catch (error) {
      console.error('[ReImportService] Re-import failed:', error)

      // Update checkpoint with failure if enabled
      if (this.currentCheckpointSession) {
        await this.checkpointService.updateStatus(
          this.currentCheckpointSession,
          'failed',
          error as Error
        )
      }

      return this.buildResult(
        results,
        [...warnings, `Fatal error: ${(error as Error).message}`],
        startTime,
        false
      )
    }
  }

  // ===========================================================================
  // Resume from Checkpoint
  // ===========================================================================

  async resumeFromCheckpoint(jobId: string): Promise<ReImportResult> {
    const session = await this.checkpointService.resumeSession(jobId)
    if (!session) {
      throw new Error(`No checkpoint found for job ${jobId}`)
    }

    // Load sitemap to get URLs
    const sitemap = await this.checkpointService.loadSitemap(session)
    if (!sitemap) {
      throw new Error('Checkpoint sitemap not found')
    }

    const urls = sitemap.urls.map(u => u.url)

    return this.reimport({
      websiteId: session.websiteId,
      urls,
      enableCheckpoint: true,
      checkpointSession: session,
      jobId
    })
  }

  // ===========================================================================
  // Batch Processing with Concurrency
  // ===========================================================================

  private async processUrlsWithConcurrency(
    urls: string[],
    websiteId: string,
    options: {
      preserveCustomizations: boolean
      skipDesignSystem: boolean
      createIfNotExists: boolean
      dryRun: boolean
      concurrency: number
    },
    totalUrls: number
  ): Promise<PageReImportResult[]> {
    const results: PageReImportResult[] = []
    const concurrency = Math.min(options.concurrency, urls.length)

    // Process URLs in parallel batches
    for (let i = 0; i < urls.length; i += concurrency) {
      const batch = urls.slice(i, i + concurrency)

      const batchPromises = batch.map((url, batchIndex) =>
        this.processPage(
          url,
          websiteId,
          options,
          i + batchIndex + 1,
          totalUrls
        ).then(async result => {
          // Save to checkpoint if enabled
          if (this.currentCheckpointSession && result.status !== 'failed') {
            try {
              // For successful results, we'd save the detection
              // For now, just mark progress
              await this.checkpointService.completeStage(
                this.currentCheckpointSession,
                'page_detection',
                result.processingTimeMs || 0
              )
            } catch (err) {
              console.warn('[ReImportService] Failed to save checkpoint:', err)
            }
          }
          return result
        })
      )

      const batchResults = await Promise.all(batchPromises)
      results.push(...batchResults)

      // Rate limiting between batches
      if (i + concurrency < urls.length) {
        await this.delay(ReImportConfig.minDelayBetweenPagesMs)
      }
    }

    return results
  }

  // ===========================================================================
  // URL Validation
  // ===========================================================================

  async validateUrls(websiteId: string, urls: string[]): Promise<UrlValidationResult[]> {
    return urls.map(url => this.validateSingleUrl(url))
  }

  private validateSingleUrl(url: string): UrlValidationResult {
    try {
      const parsed = new URL(url)

      // Must be HTTP or HTTPS
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return { valid: false, reason: 'URL must use HTTP or HTTPS protocol' }
      }

      // Reject localhost and private IPs
      const hostname = parsed.hostname.toLowerCase()
      if (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname.startsWith('192.168.') ||
        hostname.startsWith('10.') ||
        hostname.startsWith('172.16.')
      ) {
        return { valid: false, reason: 'Localhost and private IPs are not allowed' }
      }

      // Normalize URL: remove trailing slash, lowercase hostname
      // IMPORTANT: Query parameters are STRIPPED for page matching
      // See URL Query Parameter Handling Strategy comment at top of file
      const normalizedUrl = `${parsed.protocol}//${parsed.hostname}${parsed.pathname.replace(/\/$/, '') || '/'}`

      return {
        valid: true,
        normalizedUrl,
        domain: parsed.hostname,
        // Preserve original URL with query params for reference
        originalUrl: url
      }
    } catch {
      return { valid: false, reason: 'Invalid URL format' }
    }
  }

  // ===========================================================================
  // Page Resolution
  // ===========================================================================

  async resolveExistingPage(websiteId: string, sourceUrl: string): Promise<PageResolutionResult> {
    const canonicalUrl = this.canonicalizeUrl(sourceUrl)

    // 1. Try exact match on importSource metadata
    const byImportSource = await this.prisma.websitePage.findFirst({
      where: {
        websiteId,
        metadata: {
          path: ['importSource'],
          equals: sourceUrl
        }
      },
      include: {
        structures: true
      }
    })

    if (byImportSource) {
      return {
        found: true,
        page: byImportSource,
        structure: byImportSource.structures[0],
        matchedBy: 'importSource',
        canonicalUrl
      }
    }

    // 2. Try match by URL path
    const pathname = new URL(sourceUrl).pathname
    const fullPath = this.canonicalizePath(pathname)

    const structure = await this.prisma.websiteStructure.findFirst({
      where: { websiteId, fullPath },
      include: { websitePage: true }
    })

    if (structure?.websitePage) {
      return {
        found: true,
        page: structure.websitePage,
        structure,
        matchedBy: 'fullPath',
        canonicalUrl
      }
    }

    // 3. Not found
    return {
      found: false,
      matchedBy: 'none',
      canonicalUrl
    }
  }

  // ===========================================================================
  // Single Page Processing
  // ===========================================================================

  private async processPage(
    url: string,
    websiteId: string,
    options: {
      preserveCustomizations: boolean
      skipDesignSystem: boolean
      createIfNotExists: boolean
      dryRun: boolean
    },
    currentIndex: number,
    totalUrls: number
  ): Promise<PageReImportResult> {
    const pageStartTime = Date.now()

    this.reportProgress({
      stage: 'resolving',
      progress: 10 + Math.floor((currentIndex / totalUrls) * 80),
      message: `Processing page ${currentIndex}/${totalUrls}`,
      currentUrl: url,
      currentIndex,
      totalUrls
    })

    try {
      // Step 1: Resolve existing page
      const resolution = await this.resolveExistingPage(websiteId, url)

      // Step 2: Fetch and detect components from source
      this.reportProgress({
        stage: 'fetching',
        progress: 15 + Math.floor((currentIndex / totalUrls) * 80),
        message: `Fetching source: ${url}`,
        currentUrl: url
      })

      const detectionResult = await this.fetchAndDetect(url, options.skipDesignSystem)

      // Handle source errors
      if (!detectionResult.success) {
        return this.handleSourceError(url, detectionResult, resolution)
      }

      // Step 3: Update or create page
      this.reportProgress({
        stage: 'updating',
        progress: 20 + Math.floor((currentIndex / totalUrls) * 80),
        message: resolution.found ? 'Updating existing page' : 'Creating new page',
        currentUrl: url
      })

      if (resolution.found && resolution.page) {
        // Update existing page
        return await this.updateExistingPage(
          resolution.page,
          resolution.structure,
          detectionResult.detection!,
          url,
          options,
          pageStartTime
        )
      } else if (options.createIfNotExists) {
        // Create new page
        return await this.createNewPage(
          websiteId,
          detectionResult.detection!,
          url,
          options,
          pageStartTime
        )
      } else {
        return {
          url,
          status: 'skipped',
          error: 'Page not found and createIfNotExists is false',
          processingTimeMs: Date.now() - pageStartTime
        }
      }

    } catch (error) {
      console.error(`[ReImportService] Failed to process ${url}:`, error)
      return {
        url,
        status: 'failed',
        error: (error as Error).message,
        processingTimeMs: Date.now() - pageStartTime
      }
    }
  }

  // ===========================================================================
  // Source Fetch and Detection
  // ===========================================================================

  private async fetchAndDetect(
    url: string,
    skipDesignSystem: boolean
  ): Promise<{
    success: boolean
    detection?: ImportDetectionResult
    httpStatus?: number
    redirectedTo?: string
    error?: string
  }> {
    try {
      const apiKey = process.env.OPENROUTER_API_KEY
      if (!apiKey) {
        throw new Error('OPENROUTER_API_KEY is required for detection')
      }

      // Use ImportPipeline for single-page detection
      const result = await this.importPipeline.execute({
        urls: [url],
        apiKey,
        enablePerformanceMonitoring: false,
        generateTemplates: false,
        saveToDatabase: false,
        // Skip DOM probe if skipping design system
        skipDomProbe: skipDesignSystem
      })

      const detections = result.data?.detectedComponents
      if (!result.success || !detections || detections.length === 0) {
        return {
          success: false,
          error: result.errors?.[0] || 'Detection failed with no results'
        }
      }

      const detection = detections[0]

      // SAFEGUARD: Validate detection has actual components
      const componentCount = detection.components?.length || 0
      if (componentCount === 0) {
        console.warn(`[ReImportService] Detection succeeded but returned 0 components for ${url}`)
        return {
          success: false,
          error: 'Detection completed but found no components in page'
        }
      }

      // Check for HTTP errors in detection metadata
      const httpStatus = (detection.metadata as any)?.httpStatus || 200

      if (httpStatus === 404) {
        return {
          success: false,
          httpStatus: 404,
          error: 'Source page not found (404)'
        }
      }

      if (httpStatus >= 500) {
        return {
          success: false,
          httpStatus,
          error: `Source server error (${httpStatus})`
        }
      }

      return {
        success: true,
        detection,
        httpStatus
      }

    } catch (error) {
      const message = (error as Error).message

      // Check for timeout
      if (message.includes('timeout') || message.includes('ETIMEDOUT')) {
        return {
          success: false,
          error: 'Source page timed out'
        }
      }

      return {
        success: false,
        error: message
      }
    }
  }

  // ===========================================================================
  // Page Update Logic
  // ===========================================================================

  private async updateExistingPage(
    existingPage: WebsitePage,
    existingStructure: WebsiteStructure | undefined,
    detection: ImportDetectionResult,
    sourceUrl: string,
    options: { preserveCustomizations: boolean; dryRun: boolean },
    startTime: number
  ): Promise<PageReImportResult> {
    const existingContent = existingPage.content as { components?: ComponentInstance[] } | null
    const existingComponents = existingContent?.components || []

    // Build new component tree from detection
    const newComponents = this.buildComponentsFromDetection(detection)

    // SAFEGUARD: Don't wipe existing content with empty detection results
    // If we detected zero components but the page has existing content,
    // abort the update to prevent data loss
    if (newComponents.length === 0 && existingComponents.length > 0) {
      console.warn(`[ReImportService] Detection returned 0 components but page has ${existingComponents.length} existing components. Aborting to prevent data loss.`)
      return {
        url: sourceUrl,
        status: 'failed',
        pageId: existingPage.id,
        structureId: existingStructure?.id,
        error: `Detection returned no components - existing ${existingComponents.length} components preserved`,
        processingTimeMs: Date.now() - startTime
      }
    }

    // Calculate changes
    const changes: PageReImportChanges = {
      componentsAdded: 0,
      componentsRemoved: 0,
      componentsUpdated: 0,
      mediaDownloaded: 0,
      metadataUpdated: true,
      structureUpdated: false,
      previousComponentCount: existingComponents.length,
      newComponentCount: newComponents.length
    }

    let finalComponents: ComponentInstance[]

    if (options.preserveCustomizations) {
      // Merge strategy: preserve local where types match
      const merged = this.mergeComponents(existingComponents, newComponents)
      finalComponents = merged.components
      changes.componentsAdded = merged.added
      changes.componentsRemoved = merged.removed
      changes.componentsUpdated = merged.updated
    } else {
      // Replace strategy: use all new components
      // NOTE: Shared component references (sharedComponentId) are preserved
      // even in replace mode to maintain global component linkages
      finalComponents = this.preserveSharedComponentRefs(existingComponents, newComponents)
      changes.componentsAdded = newComponents.length
      changes.componentsRemoved = existingComponents.length
    }

    // Build page metadata with re-import tracking
    const metadata = this.buildUpdatedMetadata(
      existingPage.metadata as PageMetadataWithReImport,
      detection,
      sourceUrl,
      options.preserveCustomizations
    )

    if (options.dryRun) {
      return {
        url: sourceUrl,
        status: 'updated',
        pageId: existingPage.id,
        structureId: existingStructure?.id,
        changes,
        processingTimeMs: Date.now() - startTime
      }
    }

    // Persist updates atomically using transaction
    // This ensures WebsitePage and related updates succeed or fail together
    await this.prisma.$transaction(async (tx) => {
      await tx.websitePage.update({
        where: { id: existingPage.id },
        data: {
          content: { components: finalComponents },
          metadata: metadata as Prisma.InputJsonValue,
          updatedAt: new Date()
        }
      })

      // Clear any previous source-not-found status
      if ((existingPage.status as string) === 'source-not-found') {
        await tx.websitePage.update({
          where: { id: existingPage.id },
          data: { status: 'draft' }
        })
      }
    })

    return {
      url: sourceUrl,
      status: 'updated',
      pageId: existingPage.id,
      structureId: existingStructure?.id,
      changes,
      processingTimeMs: Date.now() - startTime
    }
  }

  /**
   * Preserve shared component references when replacing content.
   * If existing components have sharedComponentId, try to maintain those refs
   * on matching new components.
   */
  private preserveSharedComponentRefs(
    existing: ComponentInstance[],
    incoming: ComponentInstance[]
  ): ComponentInstance[] {
    // Build map of existing shared component refs by type
    const sharedRefsByType = new Map<string, string>()
    for (const comp of existing) {
      if ((comp.props as any)?.sharedComponentId) {
        sharedRefsByType.set(comp.type, (comp.props as any).sharedComponentId)
      }
    }

    // Apply shared refs to matching incoming components
    return incoming.map(comp => {
      const existingSharedRef = sharedRefsByType.get(comp.type)
      if (existingSharedRef) {
        return {
          ...comp,
          props: {
            ...comp.props,
            sharedComponentId: existingSharedRef
          }
        }
      }
      return comp
    })
  }

  private async createNewPage(
    websiteId: string,
    detection: ImportDetectionResult,
    sourceUrl: string,
    options: { dryRun: boolean },
    startTime: number
  ): Promise<PageReImportResult> {
    // Get default content type for this website
    // Priority: 1) ContentType named "Page", 2) First ContentType
    let contentType = await this.prisma.contentType.findFirst({
      where: { websiteId, name: 'Page' }
    })

    if (!contentType) {
      contentType = await this.prisma.contentType.findFirst({
        where: { websiteId }
      })
    }

    if (!contentType) {
      throw new Error(`Re-import cannot create page for website ${websiteId}: no ContentType is configured`)
    }

    const newComponents = this.buildComponentsFromDetection(detection)
    const pageTitle = this.extractPageTitle(detection, sourceUrl)

    const metadata: PageMetadataWithReImport = {
      importSource: sourceUrl,
      importTimestamp: new Date().toISOString(),
      lastReimportedAt: new Date().toISOString(),
      reimportHistory: [{
        timestamp: new Date().toISOString(),
        changes: { componentsAdded: newComponents.length, componentsRemoved: 0, componentsUpdated: 0 },
        sourceStatus: 200,
        preservedCustomizations: false
      }]
    }

    if (options.dryRun) {
      return {
        url: sourceUrl,
        status: 'created',
        changes: {
          componentsAdded: newComponents.length,
          componentsRemoved: 0,
          componentsUpdated: 0,
          mediaDownloaded: 0,
          metadataUpdated: true,
          structureUpdated: true,
          newComponentCount: newComponents.length
        },
        processingTimeMs: Date.now() - startTime
      }
    }

    const pathname = new URL(sourceUrl).pathname
    const fullPath = this.canonicalizePath(pathname)
    const slug = this.extractSlug(pathname)

    // Create page and structure atomically using transaction
    // This ensures both records are created together or neither is created
    const result = await this.prisma.$transaction(async (tx) => {
      // Create page
      const page = await tx.websitePage.create({
        data: {
          websiteId,
          type: 'page',
          title: pageTitle,
          content: { components: newComponents },
          metadata: metadata as Prisma.InputJsonValue,
          contentTypeId: contentType.id,
          status: 'draft'
        }
      })

      // Create structure
      const structure = await tx.websiteStructure.create({
        data: {
          websiteId,
          slug,
          fullPath,
          websitePageId: page.id,
          pathDepth: fullPath.split('/').filter(Boolean).length
        }
      })

      return { page, structure }
    })

    return {
      url: sourceUrl,
      status: 'created',
      pageId: result.page.id,
      structureId: result.structure.id,
      changes: {
        componentsAdded: newComponents.length,
        componentsRemoved: 0,
        componentsUpdated: 0,
        mediaDownloaded: 0,
        metadataUpdated: true,
        structureUpdated: true,
        newComponentCount: newComponents.length
      },
      processingTimeMs: Date.now() - startTime
    }
  }

  // ===========================================================================
  // Error Handling
  // ===========================================================================

  private handleSourceError(
    url: string,
    result: { httpStatus?: number; redirectedTo?: string; error?: string },
    resolution: PageResolutionResult
  ): PageReImportResult {
    let status: PageReImportStatus = 'failed'

    if (result.httpStatus === 404) {
      status = 'source-not-found'
      // Mark existing page as source-not-found
      if (resolution.found && resolution.page) {
        this.markPageSourceNotFound(resolution.page.id).catch(console.error)
      }
    } else if (result.httpStatus && result.httpStatus >= 300 && result.httpStatus < 400) {
      status = 'source-moved'
    } else if (result.httpStatus && result.httpStatus >= 500) {
      status = 'source-error'
    } else if (result.error?.includes('timeout')) {
      status = 'source-timeout'
    }

    return {
      url,
      status,
      pageId: resolution.page?.id,
      sourceHttpStatus: result.httpStatus,
      redirectedTo: result.redirectedTo,
      error: result.error
    }
  }

  private async markPageSourceNotFound(pageId: string): Promise<void> {
    const page = await this.prisma.websitePage.findUnique({ where: { id: pageId } })
    if (!page) return

    const metadata = (page.metadata || {}) as PageMetadataWithReImport
    metadata.sourceNotFoundAt = new Date().toISOString()

    await this.prisma.websitePage.update({
      where: { id: pageId },
      data: {
        status: 'source-not-found',
        metadata: metadata as Prisma.InputJsonValue
      }
    })
  }

  // ===========================================================================
  // Component Processing
  // ===========================================================================

  private buildComponentsFromDetection(detection: ImportDetectionResult): ComponentInstance[] {
    // Extract components from detection result
    const detectedComponents = detection.components || []

    return detectedComponents.map((comp, index) =>
      this.buildComponentInstanceFromDetection(
        comp,
        `comp-${Date.now()}-${index}`,
        null,
        `components[${index}]`
      )
    )
  }

  private buildComponentInstanceFromDetection(
    component: any,
    id: string,
    parentId: string | null,
    path: string
  ): ComponentInstance {
    const children = Array.isArray(component.children)
      ? component.children.map((child: any, childIndex: number) =>
          this.buildComponentInstanceFromDetection(
            child,
            `${id}-${childIndex}`,
            id,
            `${path}.children[${childIndex}]`
          )
        )
      : undefined

    if (typeof component.type !== 'string' || component.type.trim().length === 0) {
      throw new Error(`Re-import detection ${path}.type must be a non-empty string`)
    }
    if (typeof component.position !== 'number' || !Number.isInteger(component.position) || component.position < 0) {
      throw new Error(`Re-import detection ${path}.position must be a non-negative integer`)
    }

    return {
      id,
      type: component.type,
      parentId,
      position: component.position,
      props: {},
      content: this.readDetectionComponentContent(component, path),
      children
    }
  }

  private readDetectionComponentContent(
    component: { content?: unknown; props?: unknown },
    path: string
  ): Record<string, unknown> {
    if (component.content !== undefined && component.content !== null) {
      if (this.isRecord(component.content)) {
        return component.content
      }

      throw new Error(`Re-import detection ${path}.content must be an object`)
    }

    if (component.props !== undefined && component.props !== null) {
      if (!this.isRecord(component.props) || Object.keys(component.props).length > 0) {
        throw new Error(`Re-import detection ${path} uses legacy props content; use content`)
      }
    }

    return {}
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
  }

  private mergeComponents(
    existing: ComponentInstance[],
    incoming: ComponentInstance[]
  ): { components: ComponentInstance[]; added: number; removed: number; updated: number } {
    // Simple merge strategy: match by type and region
    const merged: ComponentInstance[] = []
    const existingByTypeAndRegion = new Map<string, ComponentInstance>()

    // Index existing components by type + region
    for (const comp of existing) {
      const region = (comp.props?.region as string) || 'main'
      const key = `${comp.type}:${region}`
      existingByTypeAndRegion.set(key, comp)
    }

    let added = 0
    let updated = 0
    const usedKeys = new Set<string>()

    // Process incoming components
    for (const comp of incoming) {
      const region = (comp.props?.region as string) || 'main'
      const key = `${comp.type}:${region}`

      if (existingByTypeAndRegion.has(key) && !usedKeys.has(key)) {
        // Preserve existing component props, take new content
        const existingComp = existingByTypeAndRegion.get(key)!
        merged.push({
          ...comp,
          id: existingComp.id, // Keep existing ID
          props: { ...comp.props, ...existingComp.props } // Merge props (existing takes precedence)
        })
        usedKeys.add(key)
        updated++
      } else {
        // Add new component
        merged.push(comp)
        added++
      }
    }

    const removed = existing.length - usedKeys.size

    return { components: merged, added, removed, updated }
  }

  // ===========================================================================
  // Metadata Handling
  // ===========================================================================

  private buildUpdatedMetadata(
    existing: PageMetadataWithReImport | null,
    detection: ImportDetectionResult,
    sourceUrl: string,
    preservedCustomizations: boolean
  ): PageMetadataWithReImport {
    const now = new Date().toISOString()
    const newComponents = this.buildComponentsFromDetection(detection)

    const historyEntry: ReImportHistoryEntry = {
      timestamp: now,
      changes: {
        componentsAdded: newComponents.length,
        componentsRemoved: 0,
        componentsUpdated: 0
      },
      sourceStatus: 200,
      preservedCustomizations
    }

    return {
      ...existing,
      importSource: sourceUrl,
      lastReimportedAt: now,
      reimportHistory: [...(existing?.reimportHistory || []), historyEntry].slice(-10), // Keep last 10
      // Clear not-found status if source is now available
      sourceNotFoundAt: undefined,
      sourceMovedTo: undefined
    }
  }

  // ===========================================================================
  // Shared Component Detection
  // ===========================================================================
  //
  // STRATEGY (based on PRD review):
  //
  // For single-page re-import (1 page):
  //   - Only update existing shared component references
  //   - Do NOT run full detection (can't find patterns with 1 page)
  //
  // For batch re-import (2-10 pages):
  //   - Run detection ONLY on the affected pages
  //   - May detect patterns within the batch
  //   - Won't affect pages outside the batch
  //
  // For large batch re-import (>10 pages):
  //   - Run full detection across ALL website pages
  //   - More accurate but more expensive
  // ===========================================================================

  private async updateSharedComponents(
    websiteId: string,
    results: PageReImportResult[]
  ): Promise<void> {
    // Get all pages that were updated or created
    const pageIds = results
      .filter(r => r.status === 'updated' || r.status === 'created')
      .map(r => r.pageId)
      .filter((id): id is string => !!id)

    if (pageIds.length === 0) return

    this.reportProgress({
      stage: 'shared-components',
      progress: 90,
      message: `Detecting shared components (${pageIds.length} page(s))`
    })

    try {
      const detector = new CanonicalSignatureSharedComponentDetector(this.prisma)

      if (pageIds.length === 1) {
        // Single page: Only update existing shared component refs
        // Don't run pattern detection (meaningless with 1 page)
        console.log('[ReImportService] Single page - skipping shared component detection')
        await this.updateExistingSharedRefs(websiteId, pageIds[0])
        return
      }

      if (pageIds.length <= 10) {
        // Small batch: Run detection only on affected pages
        console.log(`[ReImportService] Small batch (${pageIds.length} pages) - partial detection`)
        const pages = await this.prisma.websitePage.findMany({
          where: { id: { in: pageIds } }
        })
        await detector.detectShared(pages)
        return
      }

      // Large batch: Run full detection across all website pages
      console.log(`[ReImportService] Large batch (${pageIds.length} pages) - full detection`)
      const allPages = await this.prisma.websitePage.findMany({
        where: { websiteId }
      })
      await detector.detectShared(allPages)

    } catch (error) {
      console.warn('[ReImportService] Shared component detection failed:', error)
    }
  }

  /**
   * Update existing shared component references for a single page.
   * Fetches the latest version of shared components and updates props.
   */
  private async updateExistingSharedRefs(websiteId: string, pageId: string): Promise<void> {
    const page = await this.prisma.websitePage.findUnique({
      where: { id: pageId }
    })

    if (!page) return

    const content = page.content as { components?: ComponentInstance[] } | null
    const components = content?.components || []

    // Find components with sharedComponentId
    const sharedRefs = components
      .filter(c => (c.props as any)?.sharedComponentId)
      .map(c => (c.props as any).sharedComponentId as string)

    if (sharedRefs.length === 0) return

    // Fetch latest shared component data
    const sharedComponents = await this.prisma.websiteSharedComponent.findMany({
      where: { id: { in: sharedRefs } }
    })

    // Build a map of shared component props from config.defaultProps
    // Note: WebsiteSharedComponent has 'config' and 'content' fields, not 'props'
    const sharedPropsMap = new Map<string, Record<string, unknown>>()
    for (const sc of sharedComponents) {
      const config = sc.config as { defaultProps?: Record<string, unknown> } | null
      const props = config?.defaultProps || {}
      sharedPropsMap.set(sc.id, props)
    }

    // Update component props with latest shared data
    const updatedComponents = components.map(c => {
      const sharedId = (c.props as any)?.sharedComponentId
      if (sharedId && sharedPropsMap.has(sharedId)) {
        return {
          ...c,
          props: {
            ...c.props,
            ...sharedPropsMap.get(sharedId),
            sharedComponentId: sharedId // Preserve the ref
          }
        }
      }
      return c
    })

    // Update page with refreshed shared component data
    await this.prisma.websitePage.update({
      where: { id: pageId },
      data: {
        content: { components: updatedComponents }
      }
    })
  }

  // ===========================================================================
  // Domain Validation
  // ===========================================================================

  /**
   * Get the import source domain for a website.
   *
   * Domain validation storage (per PRD review):
   * - Primary: website.settings.importSourceDomain (explicit field)
   * - Fallback: Extract from ImportJob.url
   * - Returns null if website wasn't created via import
   *
   * Note: The importSourceDomain should be set during initial import
   * in the ImportOrchestrator when creating the website.
   */
  private getImportSourceDomain(website: Website & { importJobs?: { url: string }[] }): string | null {
    // Try explicit setting first
    const settings = website.settings as Record<string, unknown> | null
    if (settings?.importSourceDomain && typeof settings.importSourceDomain === 'string') {
      return settings.importSourceDomain
    }

    // Fallback to ImportJob URL
    const importJobUrl = website.importJobs?.[0]?.url
    if (importJobUrl) {
      try {
        return new URL(importJobUrl).hostname
      } catch {
        return null
      }
    }

    // Website wasn't created via import (e.g., created manually)
    // In this case, allow any domain for re-import
    return null
  }

  // ===========================================================================
  // Utility Methods
  // ===========================================================================

  private canonicalizeUrl(url: string): string {
    try {
      const parsed = new URL(url)
      return `${parsed.protocol}//${parsed.hostname}${parsed.pathname.replace(/\/$/, '') || '/'}`
    } catch {
      return url
    }
  }

  private canonicalizePath(pathname: string): string {
    // Remove trailing slash, ensure leading slash
    let path = pathname.replace(/\/+$/, '')
    if (!path.startsWith('/')) path = '/' + path
    if (path === '') path = '/'
    return path
  }

  private extractSlug(pathname: string): string {
    const parts = pathname.split('/').filter(Boolean)
    return parts[parts.length - 1] || 'home'
  }

  private extractPageTitle(detection: ImportDetectionResult, url: string): string {
    // Try to get title from detection metadata
    const metadata = detection.metadata as any
    if (metadata?.pageMetadata?.title) {
      return metadata.pageMetadata.title
    }

    // Extract from URL path
    const pathname = new URL(url).pathname
    const slug = this.extractSlug(pathname)

    return slug
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase())
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  private reportProgress(progress: Partial<ReImportProgress>): void {
    if (this.progressCallback) {
      this.progressCallback({
        stage: 'initializing',
        progress: 0,
        message: '',
        ...progress
      } as ReImportProgress)
    }
  }

  private buildResult(
    results: PageReImportResult[],
    warnings: string[],
    startTime: number,
    success: boolean
  ): ReImportResult {
    const summary: ReImportSummary = {
      updated: 0,
      created: 0,
      unchanged: 0,
      sourceNotFound: 0,
      sourceMoved: 0,
      failed: 0,
      skipped: 0,
      sharedComponentsUpdated: 0,
      mediaDownloaded: 0,
      totalComponentsAdded: 0,
      totalComponentsRemoved: 0
    }

    for (const result of results) {
      switch (result.status) {
        case 'updated':
          summary.updated++
          break
        case 'created':
          summary.created++
          break
        case 'unchanged':
          summary.unchanged++
          break
        case 'source-not-found':
          summary.sourceNotFound++
          break
        case 'source-moved':
          summary.sourceMoved++
          break
        case 'failed':
        case 'source-error':
        case 'source-timeout':
          summary.failed++
          break
        case 'skipped':
          summary.skipped++
          break
      }

      if (result.changes) {
        summary.totalComponentsAdded += result.changes.componentsAdded
        summary.totalComponentsRemoved += result.changes.componentsRemoved
        summary.mediaDownloaded += result.changes.mediaDownloaded
      }
    }

    return {
      success,
      results,
      summary,
      warnings,
      processingTimeMs: Date.now() - startTime
    }
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a new ReImportService instance
 */
export function createReImportService(config?: ReImportServiceConfig): ReImportService {
  return new ReImportService(config)
}
