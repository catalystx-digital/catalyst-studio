/**
 * Import Pipeline (Web-Based)
 *
 * Orchestrates web-based detection of page components with no screenshots.
 */

import { DetectionFailureError, getDetectionService, DetectionService, ImportDetectionResult } from './web-detection'
import { performanceMonitor } from '@/lib/studio/components/cms/_import/performance'
import { NavigationHierarchy, Template, DesignTokens } from './types'
import { TemplateGenerator, CMSTemplate } from './template-generator'
import { TemplateLibrary } from './template-library'
import { PrismaClient } from '@/lib/generated/prisma'
import { traceMemory } from './utils/memory-trace'
import { getWebFetchTools } from './services/web-tools'
import { CapturedDesignSystem } from './types/design-system.types'
import {
  DomProbeService,
  type CaptureDesignSystemResult
} from '@/lib/studio/design-system/dom-probe/service'
import type { ProgressCallback } from './types/progress.types'
import { computeDomProbeConfidence } from '@/lib/studio/design-system/dom-probe/metrics'
import {
  getDomProbeBaselineKey,
  isDomProbeEnabledForWebsite,
  shouldRunDomProbeEvaluation
} from './utils/dom-probe-flags'
import { importDesignSystemFromUrl } from '@/lib/studio/design-system/import-design-system'
import { adjustDetectedComponents } from './services/detection-post-processor'
import { validateTemplateCanonicalRequirements } from './detection/canonicalization'
import { GlobalSectionArtifactCache } from './detection/global-section-cache'
import { getPageCatalogSummary } from '@/lib/studio/ai/page-catalog'
import {
  ModelConfig,
  ConfidenceConfig,
  ConcurrencyConfig,
  RetryConfig,
  CircuitBreakerConfig,
  TimeoutConfig,
  LoggingConfig,
  CheckpointConfig
} from './config'
import { classifyError as classifyErrorUtil } from './utils/error-classification'
import { sleep } from './utils/retry-utils'
import type { CheckpointSession, PipelineStage } from './types/checkpoint.types'
import { getCheckpointService, ImportCheckpointService } from './services/checkpoint-service'

export interface ImportPipelineProgressPayload {
  message: string
  progress: number
  details?: Record<string, unknown>
}

export interface ImportPipelineOptions {
  urls: string[]
  onProgress?: (payload: ImportPipelineProgressPayload) => void
  /** Unified progress callback for subsystem progress reporting */
  progressCallback?: ProgressCallback
  enablePerformanceMonitoring?: boolean
  model?: string
  apiKey?: string
  generateTemplates?: boolean
  websiteId?: string
  saveToDatabase?: boolean
  /** Skip design token extraction and DOM probe capture */
  skipDesignSystem?: boolean
  /** Checkpoint session for resumable imports */
  checkpointSession?: CheckpointSession
}

interface PerformanceMetrics {
  totalTime: number
  detectionTime: number
  processingTime: number
}

export interface ImportPipelineResult {
  success: boolean
  data?: {
    detectedComponents: ImportDetectionResult[]
    navigation: NavigationHierarchy
    templates: Template[]
    designTokens: DesignTokens
    designSystem?: CapturedDesignSystem
    cmsTemplates?: CMSTemplate[]
    savedTemplateIds?: string[]
  }
  errors: string[]
  performance?: PerformanceMetrics
}

// Use centralized model chain configuration
const DEFAULT_MODEL_CHAIN = ModelConfig.chain

export class ImportPipeline {
  private detectionService: DetectionService
  private templateGenerator: TemplateGenerator
  private templateLibrary: TemplateLibrary | null = null
  private domProbeService: DomProbeService
  private lastDomProbeCapture: CaptureDesignSystemResult | null = null
  private errors: string[] = []

  constructor() {
    this.detectionService = getDetectionService()
    this.templateGenerator = new TemplateGenerator({
      generatePlaceholders: true,
      minConfidence: ConfidenceConfig.templateGeneration,
      templatePrefix: 'imported'
    })
    this.domProbeService = new DomProbeService()
  }

  async execute(options: ImportPipelineOptions): Promise<ImportPipelineResult> {
    this.errors = []
    this.lastDomProbeCapture = null
    const startTime = Date.now()
    const performanceMetrics: PerformanceMetrics = {
      totalTime: 0,
      detectionTime: 0,
      processingTime: 0
    }

    // Get checkpoint service for stage management
    const checkpointService = CheckpointConfig.enabled ? getCheckpointService() : null
    const session = options.checkpointSession

    try {
      this.reportProgress(options.onProgress, { message: 'Starting web-based import pipeline...', progress: 0 })

      // Helper to check if stage should be skipped (already completed)
      const shouldSkipStage = (stage: PipelineStage): boolean => {
        return session ? checkpointService?.isStageComplete(session, stage) ?? false : false
      }

      // Helper to mark stage complete and save aggregated data
      const completeStage = async (stage: PipelineStage, durationMs: number, key?: string, data?: unknown): Promise<void> => {
        if (session && checkpointService) {
          if (key && data) {
            await checkpointService.saveAggregated(session, key, data)
          }
          await checkpointService.completeStage(session, stage, durationMs)
        }
      }

      // =========================================================================
      // STAGE 1: Page Detection (LLM calls)
      // =========================================================================
      let detectionResults: ImportDetectionResult[]
      const detectionStart = Date.now()
      let completedDetectionThisRun = false

      if (shouldSkipStage('page_detection_done')) {
        // Load detection results from checkpoint
        this.reportProgress(options.onProgress, { message: 'Loading page detection from checkpoint...', progress: 10 })
        detectionResults = []
        if (session && checkpointService) {
          for await (const result of checkpointService.streamCompletedResults(session)) {
            detectionResults.push(result.detection)
          }
        }
        console.log(`[Checkpoint] Loaded ${detectionResults.length} detection results from checkpoint`)
      } else {
        // Run page detection
        traceMemory('pipeline:detection:start', { urls: options.urls.length })

        // Mark page_detection stage as started
        if (session && checkpointService) {
          session.manifest.currentStage = 'page_detection'
          await checkpointService.saveAggregated(session, '_stage', { current: 'page_detection' })
        }

        detectionResults = await this.detectComponents(
          options.urls,
          {
            model: options.model,
            apiKey: options.apiKey,
            progressCallback: options.progressCallback,
            checkpointSession: options.checkpointSession
          },
          options.onProgress
        )
        completedDetectionThisRun = true
      }

      const pageSummary = await getPageCatalogSummary()

      // Post-process and validate both fresh and checkpoint-resumed detections.
      detectionResults = detectionResults.map(result => {
        if (result.postProcessed) {
          return result
        }
        return {
          ...result,
          postProcessed: true,
          components: adjustDetectedComponents(result.components, {
            pageUrl: result.pageUrl,
            resourcesSummary: result.resourcesSummary,
            pageMetadata: result.pageMetadata
          })
        }
      })
      detectionResults = detectionResults.map(result => {
        if (result.isRedirectPage || result.detectionError) {
          return result
        }
        if (!result.pageTemplate) {
          return {
            ...result,
            detectionError: {
              stage: 'detection' as const,
              message: 'Detection completed without a pageTemplate'
            }
          }
        }
        try {
          validateTemplateCanonicalRequirements({
            components: result.components,
            template: result.pageTemplate,
            pageSummary,
            pageUrl: result.pageUrl
          })
          return result
        } catch (error) {
          return {
            ...result,
            detectionError: {
              stage: 'detection' as const,
              message: error instanceof Error ? error.message : String(error)
            }
          }
        }
      })
      detectionResults = detectionResults.map(result => {
        if (result.isRedirectPage || result.detectionError || result.components.length > 0) {
          return result
        }
        return {
          ...result,
          detectionError: {
            stage: 'detection' as const,
            message: 'Detection completed but found no components in page'
          }
        }
      })

      traceMemory('pipeline:detection:complete', { urls: options.urls.length, detected: detectionResults.length })
      if (LoggingConfig.memoryTrace) {
        console.log('[ImportMemory] pipeline:web-tools-cache:post-detection', {
          ...getWebFetchTools().getCacheStats(),
          stage: 'post-detection'
        })
      }

      const detectionFailures = detectionResults.filter(result => this.isFailedDetectionResult(result))
      if (completedDetectionThisRun && session && checkpointService) {
        for (const result of detectionResults) {
          if (this.isFailedDetectionResult(result)) {
            continue
          }
          await checkpointService.savePageResult(session, result.pageUrl, result)
          if (LoggingConfig.observe) {
            console.log(JSON.stringify({ event: 'checkpoint.saved.validated', url: result.pageUrl }))
          }
        }
      }

      if (detectionFailures.length > 0) {
        throw new Error(
          `Detection failed for ${detectionFailures.length}/${detectionResults.length} page(s): ` +
          detectionFailures.map(result => `${result.pageUrl}: ${result.detectionError?.message ?? 'No components detected'}`).join('; ')
        )
      }

      if (completedDetectionThisRun) {
        // Mark page_detection_done
        await completeStage('page_detection_done', Date.now() - detectionStart)
      }

      performanceMetrics.detectionTime = Date.now() - detectionStart
      this.reportProgress(options.onProgress, { message: 'Detected components on ' + detectionResults.length + ' pages', progress: 60 })

      // =========================================================================
      // STAGE 2: Navigation Extraction
      // =========================================================================
      const processingStart = Date.now()
      let navigation: NavigationHierarchy

      if (shouldSkipStage('navigation_extracted')) {
        this.reportProgress(options.onProgress, { message: 'Loading navigation from checkpoint...', progress: 65 })
        navigation = await checkpointService!.loadAggregated<NavigationHierarchy>(session!, 'navigation')
          ?? this.extractNavigationFromDetection(detectionResults)
      } else {
        const navStart = Date.now()
        navigation = this.extractNavigationFromDetection(detectionResults)
        await completeStage('navigation_extracted', Date.now() - navStart, 'navigation', navigation)
      }
      this.reportProgress(options.onProgress, { message: 'Extracted navigation hierarchy', progress: 70 })

      // =========================================================================
      // STAGE 3: Template Identification
      // =========================================================================
      let templates: Template[]

      if (shouldSkipStage('templates_identified')) {
        this.reportProgress(options.onProgress, { message: 'Loading templates from checkpoint...', progress: 75 })
        templates = await checkpointService!.loadAggregated<Template[]>(session!, 'templates')
          ?? this.identifyTemplatesFromDetection(detectionResults)
      } else {
        const templatesStart = Date.now()
        templates = this.identifyTemplatesFromDetection(detectionResults)
        await completeStage('templates_identified', Date.now() - templatesStart, 'templates', templates)
      }
      this.reportProgress(options.onProgress, { message: 'Identified ' + templates.length + ' page templates', progress: 80 })

      // =========================================================================
      // STAGE 4: Design Token Extraction
      // =========================================================================
      let designTokens: DesignTokens = {
        images: [],
        textPatterns: [],
        contentOrganization: [],
        componentUsage: []
      }

      if (options.skipDesignSystem) {
        this.reportProgress(options.onProgress, { message: 'Skipped design system extraction', progress: 85 })
      } else if (shouldSkipStage('tokens_extracted')) {
        this.reportProgress(options.onProgress, { message: 'Loading design tokens from checkpoint...', progress: 83 })
        designTokens = await checkpointService!.loadAggregated<DesignTokens>(session!, 'designTokens')
          ?? this.extractDesignTokensFromDetection(detectionResults)
      } else {
        const tokensStart = Date.now()
        designTokens = this.extractDesignTokensFromDetection(detectionResults)
        await completeStage('tokens_extracted', Date.now() - tokensStart, 'designTokens', designTokens)
      }
      this.reportProgress(options.onProgress, { message: 'Extracted design system tokens', progress: 85 })

      // =========================================================================
      // STAGE 5: DOM Probe Capture
      // =========================================================================
      let designSystem: CapturedDesignSystem | undefined
      const domProbeEnabled = isDomProbeEnabledForWebsite(options.websiteId)
      const baselineKey = getDomProbeBaselineKey()

      if (options.skipDesignSystem) {
        this.reportProgress(options.onProgress, { message: 'Skipped DOM probe design system capture', progress: 88 })
      } else if (!domProbeEnabled) {
        throw new Error(
          `DOM probe import is disabled for website ${options.websiteId ?? 'unknown'}`
        )
      } else {
        if (shouldSkipStage('dom_probe_done')) {
          this.reportProgress(options.onProgress, { message: 'Loading DOM probe results from checkpoint...', progress: 87 })
          designSystem = await checkpointService!.loadAggregated<CapturedDesignSystem>(session!, 'designSystem') ?? undefined

          // Also load the dom probe capture if available
          const cachedCapture = await checkpointService!.loadAggregated<CaptureDesignSystemResult>(session!, 'domProbeCapture')
          if (cachedCapture) {
            this.lastDomProbeCapture = cachedCapture
          }
        } else {
          this.reportProgress(options.onProgress, { message: 'Running DOM probe capture...', progress: 87 })
          const domProbeStart = Date.now()

          const targetUrl = this.resolveDomProbeTargetUrl(detectionResults, options.urls)
          if (!targetUrl) {
            throw new Error('Unable to determine target URL for DOM probe capture')
          }

          const captureWebsiteId = this.resolveDomProbeWebsiteId(options.websiteId, targetUrl)
          const evaluationRequested = baselineKey ? shouldRunDomProbeEvaluation() : false

          // Step 1: Capture DOM probe
          const captureResult = await this.domProbeService.captureDesignSystem({
            websiteId: captureWebsiteId,
            targetUrl,
            baselineKey,
            refresh: true,
            evaluation: evaluationRequested,
            onProgress: options.progressCallback
          })

          this.lastDomProbeCapture = captureResult

          // Step 2: Process design system using shared function (skips DOM probe since we pass capture)
          const dsResult = await importDesignSystemFromUrl({
            url: targetUrl,
            websiteId: captureWebsiteId,
            existingProbeCapture: captureResult,
            onProgress: options.progressCallback,
            jobId: session?.manifest.jobId,
            useNewFormat: true
          })

          // Extract design system for pipeline output (use legacy format if available)
          if (dsResult.designSystem) {
            designSystem = dsResult.designSystem
          } else {
            // Fallback: convert from capture if processing didn't return legacy format
            const confidenceOverride = computeDomProbeConfidence(captureResult.evaluation)
            designSystem = this.domProbeService.toCapturedDesignSystem(
              captureResult.capture,
              confidenceOverride
            )
          }

          // Save DOM probe results to checkpoint
          await completeStage('dom_probe_done', Date.now() - domProbeStart, 'designSystem', designSystem)
          if (session && checkpointService) {
            await checkpointService.saveAggregated(session, 'domProbeCapture', captureResult)
          }
        }
      }

      if (!options.skipDesignSystem) {
        this.reportProgress(options.onProgress, {
          message: designSystem
            ? `Captured DOM probe design system (${this.formatConfidence(designSystem.designSystem.metadata.confidence)})`
            : 'DOM probe design system loaded from checkpoint',
          progress: 88,
          details: this.lastDomProbeCapture ? {
            strategy: 'dom-probe',
            domProbe: {
              runId: this.lastDomProbeCapture.metadata.runId,
              runDir: this.lastDomProbeCapture.runDir,
              evaluation: this.lastDomProbeCapture.evaluation?.summary ?? null
            }
          } : undefined
        })
      }

      if (!options.skipDesignSystem && !designSystem) {
        throw new Error('DOM probe capture returned an empty design system payload')
      }

      // =========================================================================
      // STAGE 6: CMS Template Generation
      // =========================================================================
      let cmsTemplates: CMSTemplate[] | undefined
      let savedTemplateIds: string[] | undefined

      if (options.generateTemplates) {
        if (shouldSkipStage('templates_generated')) {
          this.reportProgress(options.onProgress, { message: 'Loading CMS templates from checkpoint...', progress: 90 })
          cmsTemplates = await checkpointService!.loadAggregated<CMSTemplate[]>(session!, 'cmsTemplates') ?? undefined
        } else {
          this.reportProgress(options.onProgress, { message: 'Generating CMS templates from patterns...', progress: 88 })
          const cmsStart = Date.now()

          try {
            const pipelineResult: ImportPipelineResult = {
              success: true,
              data: { detectedComponents: detectionResults, navigation, templates, designTokens, designSystem },
              errors: []
            }
            cmsTemplates = await performanceMonitor.measure('templateGeneration', async () =>
              this.templateGenerator.generateFromPatterns(pipelineResult)
            )

            await completeStage('templates_generated', Date.now() - cmsStart, 'cmsTemplates', cmsTemplates)
            this.reportProgress(options.onProgress, { message: 'Generated ' + cmsTemplates.length + ' CMS templates', progress: 92 })
          } catch (error) {
            const message = `Template generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            this.errors.push(message)
            console.error(message)
          }
        }

        // Save templates to database if requested (not checkpointed - idempotent)
        if (cmsTemplates && options.saveToDatabase && options.websiteId) {
          this.reportProgress(options.onProgress, { message: 'Saving templates to database...', progress: 94 })
          if (!this.templateLibrary) {
            const prisma = new PrismaClient()
            this.templateLibrary = new TemplateLibrary(prisma)
          }
          savedTemplateIds = []
          for (const template of cmsTemplates) {
            try {
              const id = await this.templateLibrary.storeTemplate(template, options.websiteId)
              savedTemplateIds.push(id)
            } catch (error) {
              const message = `Failed to save template ${template.name}: ${error instanceof Error ? error.message : 'Unknown error'}`
              this.errors.push(message)
              console.error(message)
            }
          }
          this.reportProgress(options.onProgress, { message: 'Saved ' + savedTemplateIds.length + ' templates to database', progress: 96 })
        }
      }

      // Mark aggregation complete
      if (session && checkpointService) {
        await checkpointService.completeStage(session, 'aggregation_done', Date.now() - processingStart)
      }

      performanceMetrics.processingTime = Date.now() - processingStart
      performanceMetrics.totalTime = Date.now() - startTime

      if (options.enablePerformanceMonitoring) {
        this.logPerformanceMetrics(performanceMetrics, detectionResults)
      }

      const failedDetections = detectionResults.filter(result => this.isFailedDetectionResult(result))
      if (failedDetections.length > 0) {
        this.errors.push(
          `Detection failed for ${failedDetections.length}/${detectionResults.length} page(s): ` +
          failedDetections.map(result => `${result.pageUrl}: ${result.detectionError?.message ?? 'No components detected'}`).join('; ')
        )
      }

      const hasPersistableResults = detectionResults.some(result =>
        result.isRedirectPage || (result.pageTemplate && result.components && result.components.length > 0)
      )
      const success = detectionResults.length > 0
        && failedDetections.length === 0
        && hasPersistableResults
        && detectionResults.every(result =>
          result.isRedirectPage || (result.pageTemplate && result.components && result.components.length > 0)
        )

      this.reportProgress(options.onProgress, { message: (success ? 'Import pipeline completed successfully' : 'Import pipeline completed with errors'), progress: 100 })

      return {
        success,
        data: { detectedComponents: detectionResults, navigation, templates, designTokens, designSystem, cmsTemplates, savedTemplateIds },
        errors: this.errors,
        performance: performanceMetrics
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      this.errors.push(errorMessage)
      console.error('Import pipeline error:', error)
      return { success: false, errors: this.errors, performance: performanceMetrics }
    }
  }

  private async detectComponents(
    urls: string[],
    options: { model?: string; apiKey?: string; progressCallback?: ProgressCallback; checkpointSession?: CheckpointSession },
    onProgress?: (payload: ImportPipelineProgressPayload) => void
  ): Promise<ImportDetectionResult[]> {
    traceMemory('pipeline:detectComponents:start', { urls: urls.length })
    const results: ImportDetectionResult[] = new Array(urls.length)
    const checkpointService = CheckpointConfig.enabled ? getCheckpointService() : null
    const session = options.checkpointSession

    // Load completed URLs from checkpoint if resuming
    let completedUrls = new Set<string>()
    if (session && checkpointService) {
      completedUrls = await checkpointService.getCompletedUrls(session)
      if (completedUrls.size > 0) {
        console.log(`[Checkpoint] Resuming: ${completedUrls.size} pages already completed, skipping...`)
      }
    }
    const total = urls.length
    type PageImportState = 'pending' | 'processing' | 'ready' | 'error' | 'skipped'
    const pageStates = new Map<string, { status: PageImportState; error?: string }>()
    urls.forEach((pageUrl) => pageStates.set(pageUrl, { status: 'pending' }))

    const buildDetails = (currentUrl?: string, extra?: Record<string, unknown>): Record<string, unknown> => {
      const orderedPages = urls.map((pageUrl, order) => {
        const state = pageStates.get(pageUrl) ?? { status: 'pending' as PageImportState }
        return {
          url: pageUrl,
          order,
          status: state.status,
          ...(state.error ? { error: state.error } : {}),
        }
      })
      const statusUrls = (status: PageImportState) =>
        orderedPages.filter((entry) => entry.status === status).map((entry) => entry.url)
      const processedCount = orderedPages.filter((entry) => entry.status === 'ready' || entry.status === 'skipped').length
      const details: Record<string, unknown> = {
        sitemap: {
          ordered: urls,
          pending: statusUrls('pending'),
          processing: statusUrls('processing'),
          completed: statusUrls('ready'),
          failed: statusUrls('error'),
          skipped: statusUrls('skipped'),
          total,
        },
        pages: orderedPages,
        progressSummary: {
          processedCount,
          totalCount: total,
          currentUrl: currentUrl ?? null,
        },
      }
      if (extra) {
        for (const [key, value] of Object.entries(extra)) {
          details[key] = value
        }
      }
      return details
    }

    const setPageState = (pageUrl: string, status: PageImportState, error?: string) => {
      pageStates.set(pageUrl, error ? { status, error } : { status })
    }

    // Use centralized configuration
    const maxConcurrency = ConcurrencyConfig.detection
    const totalBudgetMs = TimeoutConfig.totalBudgetMs
    const budgetMs = totalBudgetMs > 0 ? totalBudgetMs : undefined
    const startTime = Date.now()
    let budgetExceeded = false

    // Use centralized circuit breaker & retry settings
    const cbThreshold = CircuitBreakerConfig.threshold
    const cbCooldownMs = CircuitBreakerConfig.cooldownMs
    const maxRetries = RetryConfig.maxAttempts
    const baseBackoffMs = RetryConfig.baseDelayMs

    const failCountsByHost = new Map<string, number>()
    const breakerOpenUntil = new Map<string, number>()

    // Use centralized error classification
    const classifyError = (err: unknown): 'timeout' | 'transient' | 'fatal' => {
      if (err instanceof DetectionFailureError && err.debug.stage === 'validation') {
        return 'fatal'
      }
      const classification = classifyErrorUtil(err)
      if (classification.class === 'timeout') return 'timeout'
      if (classification.class === 'auth' || classification.class === 'validation') return 'fatal'
      return 'transient'
    }

    // sleep is now imported from utils/retry-utils

    const modelChain = options.model || ModelConfig.chain
    const modelCandidates = modelChain.split('|').map(value => value.trim()).filter(Boolean)
    const detectionModels = modelCandidates.length > 0 ? modelCandidates : DEFAULT_MODEL_CHAIN.split('|')
    const primaryModel = detectionModels[0]
    const globalSectionCache = new GlobalSectionArtifactCache()

    let index = 0
    let completed = 0
    const next = async (): Promise<void> => {
      const current = index++
      if (current >= urls.length) return
      const url = urls[current]
      const host = (() => {
        try {
          return new URL(url).host
        } catch {
          return 'unknown'
        }
      })()

      if (budgetExceeded) {
        if (!results[current]) {
          results[current] = this.buildFailedDetectionResult(
            url,
            primaryModel,
            'Detection skipped after import budget exhausted'
          )
        }
        setPageState(url, 'skipped', 'Detection skipped after import budget exhausted')
        completed++
        this.reportProgress(onProgress, {
          message: 'Detection skipped for ' + url + ' due to exhausted budget',
          progress: 10 + Math.floor((current / total) * 50),
          details: buildDetails(url),
        })
        if (LoggingConfig.observe) {
          console.log(JSON.stringify({ event: 'detect.skipped_budget', url, index: current + 1, total, elapsedMs: Date.now() - startTime }))
        }
        await next()
        return
      }

      // Circuit breaker check
      const openUntil = breakerOpenUntil.get(host) || 0
      if (Date.now() < openUntil) {
        setPageState(url, 'skipped', 'Detection skipped due to open circuit breaker')
        results[current] = this.buildFailedDetectionResult(
          url,
          primaryModel,
          'Detection skipped due to open circuit breaker'
        )
        completed++
        this.reportProgress(onProgress, {
          message: 'Circuit breaker active for host ' + host + '; skipping ' + url,
          progress: 10 + Math.floor((current / total) * 50),
          details: buildDetails(url),
        })
        if (LoggingConfig.observe) {
          console.log(JSON.stringify({ event: 'cb.skip', host, url, openUntil }))
        }
        await next()
        return
      }

      // Budget guard
      if (budgetMs && (Date.now() - startTime) > budgetMs) {
        console.warn('[ImportPipeline] Budget exhausted (' + budgetMs + 'ms). Skipping remaining URLs starting at index ' + current + '.')
        results[current] = this.buildFailedDetectionResult(
          url,
          primaryModel,
          'Detection skipped after import budget exhausted'
        )
        setPageState(url, 'skipped', 'Detection skipped after import budget exhausted')
        budgetExceeded = true
        completed++
        this.reportProgress(onProgress, {
          message: 'Detection skipped for ' + url + ' after exceeding budget',
          progress: 10 + Math.floor((current / total) * 50),
          details: buildDetails(url),
        })
        if (LoggingConfig.observe) {
          console.log(JSON.stringify({ event: 'detect.budget_exhausted', url, index: current + 1, total, elapsedMs: Date.now() - startTime }))
        }
        await next()
        return
      }

      // Checkpoint: Skip already completed URLs (for resume)
      if (completedUrls.has(url)) {
        // Load the result from checkpoint
        if (session && checkpointService) {
          const cached = await checkpointService.loadPageResult(session, url)
          if (cached) {
            results[current] = cached.detection
            setPageState(url, 'ready')
            completed++
            this.reportProgress(onProgress, {
              message: 'Loaded from checkpoint: ' + url,
              progress: 10 + Math.floor((current / total) * 50),
              details: buildDetails(url),
            })
            if (LoggingConfig.observe) {
              console.log(JSON.stringify({ event: 'checkpoint.loaded', url, index: current + 1, total }))
            }
            await next()
            return
          }
        }
      }

      // Mark URL as processing in checkpoint
      if (session && checkpointService) {
        await checkpointService.markProcessing(session, url)
      }

      const progressValue = 10 + Math.floor((current / total) * 50)
      setPageState(url, 'processing')
      this.reportProgress(onProgress, {
        message: 'Detecting components ' + (current + 1) + '/' + total + ': ' + url,
        progress: progressValue,
        details: buildDetails(url),
      })

      const runDetectionWithModel = async (model: string): Promise<ImportDetectionResult> => {
        return performanceMonitor.measure('web.detect', async () =>
          this.detectionService.detectComponentsFromUrl(url, {
            model,
            apiKey: options.apiKey,
            includeContent: true,
            onProgress: options.progressCallback,
            checkpointSession: session ?? undefined,
            checkpointService: checkpointService ?? undefined,
            globalSectionCache,
          })
        )
      }

      const attempt = async (): Promise<ImportDetectionResult> => {
        let lastError: unknown
        for (let idx = 0; idx < detectionModels.length; idx++) {
          const candidateModel = detectionModels[idx]
          try {
            if (idx > 0) {
              console.warn(`[ImportPipeline] Switching to detection model ${candidateModel} for ${url}`)
            }
            return await runDetectionWithModel(candidateModel)
          } catch (err) {
            lastError = err
            const nextModel = detectionModels[idx + 1]
            const message = err instanceof Error ? err.message : String(err ?? 'Unknown error')
            if (nextModel) {
              console.warn(`[ImportPipeline] Detection model ${candidateModel} failed for ${url}: ${message}. Trying ${nextModel}.`)
              continue
            }
            throw err instanceof Error ? err : new Error(message)
          }
        }
        throw lastError instanceof Error ? lastError : new Error(String(lastError ?? 'Unknown detection error'))
      }
      try {
        let attemptNum = 0
        while (true) {
          try {
            const result = await attempt()
            results[current] = result
            failCountsByHost.set(host, 0)
            setPageState(url, 'ready')

            this.reportProgress(onProgress, {
              message: 'Completed detection for ' + url,
              progress: progressValue,
              details: buildDetails(url),
            })
            break
          } catch (err) {
            const kind = classifyError(err)
            if (kind === 'fatal') {
              throw err
            }
            if (attemptNum >= maxRetries) {
              throw err
            }
            const delay = baseBackoffMs * Math.pow(2, attemptNum) + Math.floor(Math.random() * baseBackoffMs)
            if (LoggingConfig.observe) {
              console.log(JSON.stringify({ event: 'detect.retry', url, host, attempt: attemptNum + 1, kind, delay }))
            }
            await sleep(delay)
            attemptNum++
          }
        }
      } catch (error) {
        console.error('Web-based detection failed for ' + url + ':', error)
        const failureReason = error instanceof Error ? error.message : 'Unknown error'
        results[current] = this.buildFailedDetectionResult(
          url,
          primaryModel,
          'Web detection failed: ' + failureReason
        )
        setPageState(url, 'error', failureReason)

        // Checkpoint: Save error for potential retry
        if (session && checkpointService) {
          const attemptCount = (failCountsByHost.get(host) || 0) + 1
          await checkpointService.savePageError(
            session,
            url,
            error instanceof Error ? error : new Error(failureReason),
            attemptCount,
            error instanceof DetectionFailureError
              ? (error.debug.stage === 'llm_call' ? 'llm_call' : error.debug.stage === 'budget' ? 'budget' : error.debug.stage === 'output_limit' ? 'output_limit' : 'parsing')
              : undefined,
            error instanceof DetectionFailureError ? {
              model: error.debug.model,
              stage: error.debug.stage,
              rawResponseLength: error.debug.rawResponseLength ?? error.debug.rawResponse?.length ?? 0,
              rawResponse: error.debug.rawResponse,
              finishReason: error.debug.finishReason,
              usage: error.debug.usage,
              validationPath: error.debug.validationPath,
              requestCount: error.debug.requestCount,
              toolCallCount: error.debug.toolCallCount,
              contextBudget: error.debug.contextBudget,
              minCompletionBudget: error.debug.minCompletionBudget,
              promptTokensEstimate: error.debug.promptTokensEstimate,
              effectiveCompletionTokens: error.debug.effectiveCompletionTokens,
              skippedSectionsDueToBudget: error.debug.skippedSectionsDueToBudget
            } : undefined
          )
          if (LoggingConfig.observe) {
            console.log(JSON.stringify({ event: 'checkpoint.error', url, index: current + 1, total, attemptCount }))
          }
        }

        this.reportProgress(onProgress, {
          message: 'Detection failed for ' + url + ': ' + failureReason,
          progress: progressValue,
          details: buildDetails(url),
        })
        const count = (failCountsByHost.get(host) || 0) + 1
        failCountsByHost.set(host, count)
        if (count >= cbThreshold) {
          const until = Date.now() + cbCooldownMs
          breakerOpenUntil.set(host, until)
          if (LoggingConfig.observe) {
            console.log(JSON.stringify({ event: 'cb.open', host, count, until }))
          }
        }
      } finally {
        completed++
        if (LoggingConfig.observe) {
          console.log(JSON.stringify({ event: 'detect.completed', url, index: current + 1, total, elapsedMs: Date.now() - startTime }))
        }
      }
      await next()
    }

    const workers = Array.from({ length: Math.min(maxConcurrency, urls.length) }, () => next())
    await Promise.all(workers)
    traceMemory('pipeline:detectComponents:complete', { urls: urls.length })
    if (LoggingConfig.memoryTrace) {
      console.log('[ImportMemory] pipeline:web-tools-cache:detectComponents', {
        ...getWebFetchTools().getCacheStats(),
        stage: 'detectComponents.complete'
      })
    }
    return results
  }

  private extractNavigationFromDetection(results: ImportDetectionResult[]): NavigationHierarchy {
    const pages = results.filter(result => !this.isFailedDetectionResult(result)).map(r => ({
      title: this.derivePageTitle(r),
      url: new URL(r.pageUrl).pathname,
      children: [] as any[]
    }))
    return { pages, sections: [] }
  }

  private buildFailedDetectionResult(
    url: string,
    modelUsed: string,
    reason: string
  ): ImportDetectionResult {
    return {
      components: [],
      pageMetadata: undefined,
      processingTime: 0,
      modelUsed,
      tokenUsage: 0,
      cost: 0,
      pageUrl: url,
      accuracy: 0,
      detectionError: {
        stage: 'detection',
        message: reason.trim() || 'Detection failed'
      }
    }
  }

  private isFailedDetectionResult(result: ImportDetectionResult): boolean {
    return Boolean(result.detectionError)
  }

  private derivePageTitle(result: ImportDetectionResult): string {
    // Prefer LLM-provided metadata title when available
    if (result.pageMetadata?.title && String(result.pageMetadata.title).trim().length > 0) {
      return String(result.pageMetadata.title).trim()
    }
    try {
      const pathname = new URL(result.pageUrl).pathname
      if (pathname === '/' || pathname === '') return 'Home'
    } catch { /* ignore */ }
    const nav = result.components.find(c => c.type.toLowerCase().includes('nav'))
    const hero = result.components.find(c => c.type.toLowerCase().includes('hero'))
    if (nav?.content?.links?.[0]?.label) return String(nav.content.links[0].label)
    if (hero?.content?.heading) return String(hero.content.heading)
    try { return new URL(result.pageUrl).pathname.replace(/\//g, ' ').trim() || 'Home' } catch { return 'Page' }
  }

  private identifyTemplatesFromDetection(results: ImportDetectionResult[]): Template[] {
    const templateMap = new Map<string, Template>()
    for (const result of results) {
      const regions = { header: [] as string[], hero: [] as string[], main: [] as string[], footer: [] as string[] }
      for (const c of result.components) {
        const loc = c.location || 'main'
        regions[loc] = regions[loc] || []
        regions[loc].push(c.type)
      }
      const key = JSON.stringify(regions)
      if (!templateMap.has(key)) {
        templateMap.set(key, { id: `tpl-${templateMap.size + 1}`, name: `Template ${templateMap.size + 1}`, regions, pages: [], similarity: 1 })
      }
      templateMap.get(key)!.pages.push(result.pageUrl)
    }
    return Array.from(templateMap.values())
  }

  private extractDesignTokensFromDetection(results: ImportDetectionResult[]): DesignTokens {
    const tokens: DesignTokens = { images: [], textPatterns: [], contentOrganization: [], componentUsage: [] }
    const imageSet = new Set<string>()
    const textPatternSet = new Set<string>()
    const componentUsageMap = new Map<string, number>()
    for (const r of results) {
      for (const c of r.components) {
        if (c.content?.image) imageSet.add(c.content.image)
        if (Array.isArray(c.content?.images)) c.content.images.forEach((i: string) => imageSet.add(i))
        if (c.content?.backgroundImage) imageSet.add(c.content.backgroundImage)
        if (c.content?.heading) textPatternSet.add('heading')
        if (c.content?.subheading) textPatternSet.add('subheading')
        if (c.content?.body) textPatternSet.add('body')
        componentUsageMap.set(c.type, (componentUsageMap.get(c.type) || 0) + 1)
      }
    }
    tokens.images = Array.from(imageSet)
    tokens.textPatterns = Array.from(textPatternSet)
    tokens.componentUsage = Array.from(componentUsageMap.entries()).map(([type, count]) => ({ type, frequency: count / results.length, instances: count }))
    tokens.componentUsage.sort((a, b) => b.frequency - a.frequency)
    return tokens
  }

  private resolveDomProbeTargetUrl(
    detectionResults: ImportDetectionResult[],
    candidateUrls: string[]
  ): string | undefined {
    const detectionUrl = detectionResults.find(result => result.pageUrl)?.pageUrl
    if (detectionUrl) {
      return detectionUrl
    }
    return candidateUrls.length > 0 ? candidateUrls[0] : undefined
  }

  private resolveDomProbeWebsiteId(websiteId: string | undefined, targetUrl: string): string {
    if (websiteId && websiteId.trim().length > 0) {
      return websiteId
    }
    try {
      const url = new URL(targetUrl)
      return url.hostname || 'dom-probe'
    } catch {
      return 'dom-probe'
    }
  }

  private formatConfidence(confidence: number | undefined): string {
    if (typeof confidence !== 'number' || Number.isNaN(confidence)) {
      return 'N/A'
    }
    const value = confidence > 1 ? confidence : confidence * 100
    return `${Math.round(value)}%`
  }

  private reportProgress(cb: ImportPipelineOptions['onProgress'], payload: ImportPipelineProgressPayload): void {
    if (cb) cb(payload)
    console.log('[' + payload.progress + '%] ' + payload.message)
  }

  private logPerformanceMetrics(metrics: PerformanceMetrics, results: ImportDetectionResult[]): void {
    console.log('=== Import Pipeline Performance Metrics ===')
    console.log(`Total Time: ${metrics.totalTime}ms`)
    console.log(`Detection Time: ${metrics.detectionTime}ms`)
    console.log(`Processing Time: ${metrics.processingTime}ms`)
    const totalComponents = results.reduce((sum, r) => sum + r.components.length, 0)
    const avgDetectionTime = metrics.detectionTime / Math.max(results.length, 1)
    const avgComponentTime = metrics.detectionTime / Math.max(totalComponents, 1)
    console.log(`Pages Processed: ${results.length}`)
    console.log(`Components Detected: ${totalComponents}`)
    console.log(`Avg Detection per Page: ${avgDetectionTime.toFixed(2)}ms`)
    console.log(`Avg Detection per Component: ${avgComponentTime.toFixed(2)}ms`)
    const avgAccuracy = results.reduce((sum, r) => sum + (r.accuracy || 0), 0) / Math.max(results.length, 1)
    console.log(`Average Accuracy: ${(avgAccuracy * 100).toFixed(1)}%`)
  }

  getLastDomProbeCapture(): CaptureDesignSystemResult | null {
    return this.lastDomProbeCapture
  }
}

// Export singleton instance
export const importPipeline = new ImportPipeline()
