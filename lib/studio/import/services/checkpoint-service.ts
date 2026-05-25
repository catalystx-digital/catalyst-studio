/**
 * Import Checkpoint Service
 *
 * Disk-based checkpoint system for resumable imports and per-page debugging.
 * Persists LLM detection results to disk immediately after each page is processed.
 *
 * Directory structure:
 * .import-cache/
 * └── {websiteId}/
 *     └── {jobId}/
 *         ├── manifest.json
 *         ├── sitemap.json
 *         ├── pages/{url-hash}.json
 *         ├── errors/{url-hash}.json
 *         ├── sections/{url-hash}/{section-key}.json
 *         ├── section-errors/{url-hash}/{section-key}.json
 *         ├── page-plans/{url-hash}.json
 *         ├── assembled/{url-hash}.json
 *         └── aggregated/{key}.json
 *
 * @module checkpoint-service
 */

import * as fs from 'fs'
import * as path from 'path'
import { promisify } from 'util'
import type { ImportDetectionResult } from '../web-detection'
import { hashUrl } from '../utils/url-hash'
import { CheckpointConfig, ModelConfig, ConcurrencyConfig } from '../config'
import { classifyError } from '../utils/error-classification'
import type {
  CheckpointSession,
  CheckpointManifest,
  CheckpointSitemap,
  CheckpointPageResult,
  CheckpointPageError,
  CheckpointSectionResult,
  CheckpointSectionError,
  CheckpointStatus,
  LLMDebugInfo,
  ErrorStage,
  SkippedUrlEntry,
  SitemapUrlEntry,
  IImportCheckpointService,
  PipelineStage,
  StageCompletion
} from '../types/checkpoint.types'
import type { DetectedComponent, PageMetadata } from '../detection/types'

// Promisified fs functions
const mkdir = promisify(fs.mkdir)
const writeFile = promisify(fs.writeFile)
const readFile = promisify(fs.readFile)
const readdir = promisify(fs.readdir)
const stat = promisify(fs.stat)
const unlink = promisify(fs.unlink)
const rmdir = promisify(fs.rmdir)
const rename = promisify(fs.rename)

/**
 * Atomic write: write to temp file then rename
 * Prevents corruption on crash during write
 */
async function atomicWriteJson(filePath: string, data: unknown): Promise<void> {
  const tempPath = filePath + '.tmp'
  const json = JSON.stringify(data, null, 2)
  await writeFile(tempPath, json, 'utf-8')
  await rename(tempPath, filePath)
}

/**
 * Safe read JSON with validation
 */
async function safeReadJson<T>(filePath: string): Promise<T | null> {
  try {
    const content = await readFile(filePath, 'utf-8')
    return JSON.parse(content) as T
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null
    }
    console.warn(`[Checkpoint] Failed to read ${filePath}:`, error)
    return null
  }
}

/**
 * Check if a file exists
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath)
    return true
  } catch {
    return false
  }
}

function safeSectionKey(sectionKey: string): string {
  return sectionKey.replace(/[^a-zA-Z0-9._-]/g, '_')
}

/**
 * Recursively delete a directory
 */
async function rmrf(dirPath: string): Promise<void> {
  try {
    const entries = await readdir(dirPath, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name)
      if (entry.isDirectory()) {
        await rmrf(fullPath)
      } else {
        await unlink(fullPath)
      }
    }
    await rmdir(dirPath)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error
    }
  }
}

/**
 * Import Checkpoint Service Implementation
 */
export class ImportCheckpointService implements IImportCheckpointService {
  private readonly baseDir: string

  constructor(baseDir?: string) {
    this.baseDir = baseDir || CheckpointConfig.cacheDir
  }

  /**
   * Get the cache directory for a job
   */
  private getCacheDir(websiteId: string, jobId: string): string {
    return path.join(this.baseDir, websiteId, jobId)
  }

  /**
   * Find a job's cache directory by job ID (searches all website subdirs)
   */
  private async findCacheDir(jobId: string): Promise<string | null> {
    try {
      const exists = await fileExists(this.baseDir)
      if (!exists) {
        return null
      }

      const websiteDirs = await readdir(this.baseDir, { withFileTypes: true })
      for (const entry of websiteDirs) {
        if (!entry.isDirectory()) continue
        const jobDir = path.join(this.baseDir, entry.name, jobId)
        if (await fileExists(path.join(jobDir, 'manifest.json'))) {
          return jobDir
        }
      }
      return null
    } catch {
      return null
    }
  }

  /**
   * Create default manifest
   */
  private createManifest(
    jobId: string,
    websiteId: string,
    sourceUrl: string,
    config?: Partial<CheckpointManifest['config']>
  ): CheckpointManifest {
    const now = new Date().toISOString()
    return {
      version: '1.0',
      jobId,
      websiteId,
      sourceUrl,
      createdAt: now,
      updatedAt: now,
      status: 'in_progress',
      currentStage: 'initialized',
      completedStages: [],
      progress: {
        totalUrls: 0,
        completedUrls: 0,
        failedUrls: 0,
        skippedUrls: 0
      },
      timing: {
        startedAt: now,
        lastActivityAt: now
      },
      config: {
        maxPages: config?.maxPages ?? ConcurrencyConfig.maxUrls,
        modelChain: config?.modelChain ?? ModelConfig.chain,
        concurrency: config?.concurrency ?? ConcurrencyConfig.detection
      }
    }
  }

  /**
   * Initialize a new checkpoint session
   */
  async initializeSession(
    jobId: string,
    websiteId: string,
    sourceUrl: string,
    config?: Partial<CheckpointManifest['config']>
  ): Promise<CheckpointSession> {
    const cacheDir = this.getCacheDir(websiteId, jobId)
    const manifestPath = path.join(cacheDir, 'manifest.json')

    // Check if session already exists
    if (await fileExists(manifestPath)) {
      throw new Error(`Checkpoint session already exists for job ${jobId}. Use resumeSession() instead.`)
    }

    // Create directory structure
    await mkdir(path.join(cacheDir, 'pages'), { recursive: true })
    await mkdir(path.join(cacheDir, 'errors'), { recursive: true })
    await mkdir(path.join(cacheDir, 'sections'), { recursive: true })
    await mkdir(path.join(cacheDir, 'section-errors'), { recursive: true })
    await mkdir(path.join(cacheDir, 'page-plans'), { recursive: true })
    await mkdir(path.join(cacheDir, 'assembled'), { recursive: true })
    await mkdir(path.join(cacheDir, 'aggregated'), { recursive: true })

    // Create manifest
    const manifest = this.createManifest(jobId, websiteId, sourceUrl, config)
    await atomicWriteJson(manifestPath, manifest)

    console.log(`[Checkpoint] Initialized session for job ${jobId} at ${cacheDir}`)

    return { jobId, websiteId, cacheDir, manifest }
  }

  /**
   * Resume an existing session
   */
  async resumeSession(jobId: string): Promise<CheckpointSession | null> {
    const cacheDir = await this.findCacheDir(jobId)
    if (!cacheDir) {
      return null
    }

    const manifestPath = path.join(cacheDir, 'manifest.json')
    const manifest = await safeReadJson<CheckpointManifest>(manifestPath)
    if (!manifest) {
      return null
    }

    // Update status to in_progress and refresh timestamp
    manifest.status = 'in_progress'
    manifest.updatedAt = new Date().toISOString()
    manifest.timing.lastActivityAt = new Date().toISOString()
    await atomicWriteJson(manifestPath, manifest)

    // Reconstruct progress from files if manifest seems stale
    const actualCompleted = await this.countCompletedPages(cacheDir)
    const actualFailed = await this.countFailedPages(cacheDir)

    if (manifest.progress.completedUrls !== actualCompleted || manifest.progress.failedUrls !== actualFailed) {
      console.log(`[Checkpoint] Reconstructing progress from files: ${actualCompleted} completed, ${actualFailed} failed`)
      manifest.progress.completedUrls = actualCompleted
      manifest.progress.failedUrls = actualFailed
      await atomicWriteJson(manifestPath, manifest)
    }

    console.log(`[Checkpoint] Resumed session for job ${jobId} at ${cacheDir}`)
    console.log(`[Checkpoint] Progress: ${manifest.progress.completedUrls}/${manifest.progress.totalUrls} completed`)

    return { jobId, websiteId: manifest.websiteId, cacheDir, manifest }
  }

  /**
   * Count completed page files
   */
  private async countCompletedPages(cacheDir: string): Promise<number> {
    try {
      const pagesDir = path.join(cacheDir, 'pages')
      const files = await readdir(pagesDir)
      return files.filter(f => f.endsWith('.json')).length
    } catch {
      return 0
    }
  }

  /**
   * Count failed page files
   */
  private async countFailedPages(cacheDir: string): Promise<number> {
    try {
      const errorsDir = path.join(cacheDir, 'errors')
      const files = await readdir(errorsDir)
      return files.filter(f => f.endsWith('.json')).length
    } catch {
      return 0
    }
  }

  /**
   * Save sitemap after discovery
   */
  async saveSitemap(
    session: CheckpointSession,
    urls: string[],
    skipped: SkippedUrlEntry[]
  ): Promise<void> {
    const sitemap: CheckpointSitemap = {
      discoveredAt: new Date().toISOString(),
      urls: urls.map((url, order) => ({
        url,
        urlHash: hashUrl(url),
        status: 'pending' as const,
        order
      })),
      skipped
    }

    await atomicWriteJson(path.join(session.cacheDir, 'sitemap.json'), sitemap)

    // Update manifest
    session.manifest.progress.totalUrls = urls.length
    session.manifest.progress.skippedUrls = skipped.length
    session.manifest.updatedAt = new Date().toISOString()
    await this.saveManifest(session)

    console.log(`[Checkpoint] Saved sitemap: ${urls.length} URLs, ${skipped.length} skipped`)
  }

  /**
   * Mark a URL as currently processing
   * Note: We don't update sitemap.json here to avoid race conditions with concurrent workers.
   * The actual status is determined by the presence of page result files.
   */
  async markProcessing(session: CheckpointSession, url: string): Promise<void> {
    // Only update in-memory timestamp, don't write to disk
    // This avoids race conditions when multiple workers call markProcessing simultaneously
    session.manifest.timing.lastActivityAt = new Date().toISOString()
    session.manifest.updatedAt = new Date().toISOString()
  }

  /**
   * Save successful page result immediately after LLM returns
   * Note: We save only the page result file to avoid race conditions.
   * Sitemap and manifest are reconstructed on resume from page files.
   */
  async savePageResult(
    session: CheckpointSession,
    url: string,
    result: ImportDetectionResult,
    debug?: LLMDebugInfo
  ): Promise<void> {
    const urlHash = hashUrl(url)
    const filePath = path.join(session.cacheDir, 'pages', `${urlHash}.json`)

    const pageResult: CheckpointPageResult = {
      url,
      urlHash,
      processedAt: new Date().toISOString(),
      durationMs: result.processingTime || 0,
      detection: result,
      llmDebug: debug
    }

    // Save page result - each URL has its own file, no race condition
    await atomicWriteJson(filePath, pageResult)

    // Update in-memory counters (actual count is reconstructed from files on resume)
    session.manifest.progress.completedUrls++
    session.manifest.timing.lastActivityAt = new Date().toISOString()
    session.manifest.updatedAt = new Date().toISOString()

    // Remove from errors if previously failed (best effort, ignore errors)
    const errorPath = path.join(session.cacheDir, 'errors', `${urlHash}.json`)
    try {
      await unlink(errorPath)
      if (session.manifest.progress.failedUrls > 0) {
        session.manifest.progress.failedUrls--
      }
    } catch {
      // Error file didn't exist, that's fine
    }
  }

  /**
   * Save failed page with error details
   * Note: We save only the error file to avoid race conditions.
   * Sitemap and manifest are reconstructed on resume from error files.
   */
  async savePageError(
    session: CheckpointSession,
    url: string,
    error: Error,
    attemptCount: number,
    stage?: ErrorStage,
    debug?: LLMDebugInfo
  ): Promise<void> {
    const urlHash = hashUrl(url)
    const filePath = path.join(session.cacheDir, 'errors', `${urlHash}.json`)

    // Determine if error is retryable
    const classified = classifyError(error)
    const retryable = classified.class !== 'auth' && classified.class !== 'validation'

    // Determine stage if not provided
    const errorStage: ErrorStage = stage ||
      (classified.class === 'timeout' ? 'llm_call' :
       classified.class === 'connection' ? 'fetch' : 'unknown')

    const pageError: CheckpointPageError = {
      url,
      urlHash,
      attemptedAt: new Date().toISOString(),
      attemptCount,
      error: {
        message: error.message,
        code: (error as any).code,
        stage: errorStage,
        retryable
      },
      ...(debug ? { llmDebug: this.sanitizeLlmDebug(debug) } : {})
    }

    // Save error file - each URL has its own file, no race condition
    await atomicWriteJson(filePath, pageError)

    // Update in-memory counters (actual count is reconstructed from files on resume)
    session.manifest.progress.failedUrls++
    session.manifest.timing.lastActivityAt = new Date().toISOString()
    session.manifest.updatedAt = new Date().toISOString()
  }

  private getSectionDir(session: CheckpointSession, kind: 'sections' | 'section-errors', url: string): string {
    return path.join(session.cacheDir, kind, hashUrl(url))
  }

  private getSectionPath(session: CheckpointSession, kind: 'sections' | 'section-errors', url: string, sectionKey: string): string {
    return path.join(this.getSectionDir(session, kind, url), `${safeSectionKey(sectionKey)}.json`)
  }

  async saveSectionResult(
    session: CheckpointSession,
    url: string,
    sectionKey: string,
    sectionOrder: number,
    components: DetectedComponent[],
    durationMs: number,
    pageMetadata?: PageMetadata,
    debug?: LLMDebugInfo
  ): Promise<void> {
    const urlHash = hashUrl(url)
    const dir = this.getSectionDir(session, 'sections', url)
    await mkdir(dir, { recursive: true })

    const sectionResult: CheckpointSectionResult = {
      url,
      urlHash,
      sectionKey,
      sectionOrder,
      processedAt: new Date().toISOString(),
      durationMs,
      components,
      ...(pageMetadata ? { pageMetadata } : {}),
      ...(debug ? { llmDebug: this.sanitizeLlmDebug(debug) } : {})
    }

    await atomicWriteJson(this.getSectionPath(session, 'sections', url, sectionKey), sectionResult)
    try {
      await unlink(this.getSectionPath(session, 'section-errors', url, sectionKey))
    } catch {
      // No stale section error existed.
    }
    session.manifest.timing.lastActivityAt = new Date().toISOString()
    session.manifest.updatedAt = new Date().toISOString()
  }

  async loadSectionResult(
    session: CheckpointSession,
    url: string,
    sectionKey: string
  ): Promise<CheckpointSectionResult | null> {
    return safeReadJson<CheckpointSectionResult>(this.getSectionPath(session, 'sections', url, sectionKey))
  }

  async saveSectionError(
    session: CheckpointSession,
    url: string,
    sectionKey: string,
    sectionOrder: number,
    error: Error,
    attemptCount: number,
    stage?: ErrorStage,
    debug?: LLMDebugInfo
  ): Promise<void> {
    const urlHash = hashUrl(url)
    const dir = this.getSectionDir(session, 'section-errors', url)
    await mkdir(dir, { recursive: true })

    const classified = classifyError(error)
    const retryable = classified.class !== 'auth' && classified.class !== 'validation'
    const errorStage: ErrorStage = stage ||
      (classified.class === 'timeout' ? 'llm_call' :
       classified.class === 'connection' ? 'fetch' : 'unknown')

    const sectionError: CheckpointSectionError = {
      url,
      urlHash,
      sectionKey,
      sectionOrder,
      attemptedAt: new Date().toISOString(),
      attemptCount,
      error: {
        message: error.message,
        code: (error as any).code,
        stage: errorStage,
        retryable
      },
      ...(debug ? { llmDebug: this.sanitizeLlmDebug(debug) } : {})
    }

    await atomicWriteJson(this.getSectionPath(session, 'section-errors', url, sectionKey), sectionError)
    session.manifest.timing.lastActivityAt = new Date().toISOString()
    session.manifest.updatedAt = new Date().toISOString()
  }

  async loadSectionError(
    session: CheckpointSession,
    url: string,
    sectionKey: string
  ): Promise<CheckpointSectionError | null> {
    return safeReadJson<CheckpointSectionError>(this.getSectionPath(session, 'section-errors', url, sectionKey))
  }

  async getCompletedSections(session: CheckpointSession, url: string): Promise<Set<string>> {
    const completed = new Set<string>()
    const dir = this.getSectionDir(session, 'sections', url)
    try {
      const files = await readdir(dir)
      for (const file of files) {
        if (!file.endsWith('.json')) continue
        const section = await safeReadJson<CheckpointSectionResult>(path.join(dir, file))
        if (section?.sectionKey) completed.add(section.sectionKey)
      }
    } catch {
      // No section directory yet.
    }
    return completed
  }

  async *streamSectionResults(
    session: CheckpointSession,
    url: string
  ): AsyncIterable<CheckpointSectionResult> {
    const dir = this.getSectionDir(session, 'sections', url)
    try {
      const files = await readdir(dir)
      const results: CheckpointSectionResult[] = []
      for (const file of files) {
        if (!file.endsWith('.json')) continue
        const result = await safeReadJson<CheckpointSectionResult>(path.join(dir, file))
        if (result) results.push(result)
      }
      results.sort((a, b) => a.sectionOrder - b.sectionOrder)
      for (const result of results) {
        yield result
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error
      }
    }
  }

  async savePagePlan(session: CheckpointSession, url: string, data: unknown): Promise<void> {
    await mkdir(path.join(session.cacheDir, 'page-plans'), { recursive: true })
    await atomicWriteJson(path.join(session.cacheDir, 'page-plans', `${hashUrl(url)}.json`), data)
  }

  async saveAssembledPage(session: CheckpointSession, url: string, data: unknown): Promise<void> {
    await mkdir(path.join(session.cacheDir, 'assembled'), { recursive: true })
    await atomicWriteJson(path.join(session.cacheDir, 'assembled', `${hashUrl(url)}.json`), data)
  }

  private sanitizeLlmDebug(debug: LLMDebugInfo): LLMDebugInfo {
    const { rawResponse, ...rest } = debug
    return {
      ...rest,
      rawResponseLength: debug.rawResponseLength ?? rawResponse?.length ?? 0,
      ...(CheckpointConfig.includeRawResponse && rawResponse ? { rawResponse } : {})
    }
  }

  /**
   * Get URLs that need processing (pending + retryable failed)
   * Determines status from actual files rather than sitemap status field.
   */
  async getPendingUrls(session: CheckpointSession): Promise<string[]> {
    const sitemap = await this.loadSitemap(session)
    if (!sitemap) return []

    // Get completed URLs from page result files
    const completedUrls = await this.getCompletedUrls(session)

    const pending: string[] = []
    const maxRetries = CheckpointConfig?.maxRetryAttempts ?? 3

    for (const entry of sitemap.urls) {
      // Skip if already completed
      if (completedUrls.has(entry.url)) {
        continue
      }

      // Check if there's an error file
      const error = await this.loadPageError(session, entry.url)
      if (error) {
        // Only retry if retryable and under max attempts
        if (error.error.retryable && error.attemptCount < maxRetries) {
          pending.push(entry.url)
        }
        // Otherwise skip (non-retryable or max attempts reached)
      } else {
        // No result file and no error file = pending
        pending.push(entry.url)
      }
    }

    return pending
  }

  /**
   * Get completed URLs (for resume skip logic)
   */
  async getCompletedUrls(session: CheckpointSession): Promise<Set<string>> {
    const completed = new Set<string>()

    try {
      const pagesDir = path.join(session.cacheDir, 'pages')
      const files = await readdir(pagesDir)

      for (const file of files) {
        if (!file.endsWith('.json')) continue
        const filePath = path.join(pagesDir, file)
        const pageResult = await safeReadJson<CheckpointPageResult>(filePath)
        if (pageResult?.url) {
          completed.add(pageResult.url)
        }
      }
    } catch {
      // Pages directory might not exist yet
    }

    return completed
  }

  /**
   * Stream completed page results for aggregation
   * Uses async generator to avoid loading all results into memory
   */
  async *streamCompletedResults(session: CheckpointSession): AsyncIterable<CheckpointPageResult> {
    const pagesDir = path.join(session.cacheDir, 'pages')

    try {
      const files = await readdir(pagesDir)

      for (const file of files) {
        if (!file.endsWith('.json')) continue
        const filePath = path.join(pagesDir, file)
        const pageResult = await safeReadJson<CheckpointPageResult>(filePath)
        if (pageResult) {
          yield pageResult
        } else {
          console.warn(`[Checkpoint] Skipping corrupted file: ${file}`)
        }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error
      }
      // No pages directory means no results
    }
  }

  /**
   * Save aggregated data (navigation, tokens, templates)
   */
  async saveAggregated(session: CheckpointSession, key: string, data: unknown): Promise<void> {
    const filePath = path.join(session.cacheDir, 'aggregated', `${key}.json`)
    await atomicWriteJson(filePath, data)
  }

  /**
   * Load aggregated data by key
   */
  async loadAggregated<T>(session: CheckpointSession, key: string): Promise<T | null> {
    const filePath = path.join(session.cacheDir, 'aggregated', `${key}.json`)
    return safeReadJson<T>(filePath)
  }

  /**
   * Mark a pipeline stage as complete
   */
  async completeStage(
    session: CheckpointSession,
    stage: PipelineStage,
    durationMs: number
  ): Promise<void> {
    const completion: StageCompletion = {
      stage,
      completedAt: new Date().toISOString(),
      durationMs
    }

    session.manifest.completedStages.push(completion)
    session.manifest.currentStage = stage
    session.manifest.updatedAt = new Date().toISOString()
    session.manifest.timing.lastActivityAt = new Date().toISOString()

    await this.saveManifest(session)
    console.log(`[Checkpoint] Stage '${stage}' completed in ${durationMs}ms`)
  }

  /**
   * Get the current pipeline stage
   */
  getCurrentStage(session: CheckpointSession): PipelineStage {
    return session.manifest.currentStage
  }

  /**
   * Check if a stage has been completed
   */
  isStageComplete(session: CheckpointSession, stage: PipelineStage): boolean {
    return session.manifest.completedStages.some(s => s.stage === stage)
  }

  /**
   * Get stages that need to run (not yet completed)
   */
  getPendingStages(session: CheckpointSession): PipelineStage[] {
    const allStages: PipelineStage[] = [
      'initialized',
      'page_detection',
      'page_detection_done',
      'navigation_extracted',
      'templates_identified',
      'tokens_extracted',
      'dom_probe_done',
      'templates_generated',
      'aggregation_done',
      'persist_done'
    ]

    const completedSet = new Set(session.manifest.completedStages.map(s => s.stage))
    return allStages.filter(s => !completedSet.has(s))
  }

  /**
   * Update manifest status
   */
  async updateStatus(
    session: CheckpointSession,
    status: CheckpointStatus,
    error?: Error
  ): Promise<void> {
    session.manifest.status = status
    session.manifest.updatedAt = new Date().toISOString()
    session.manifest.timing.lastActivityAt = new Date().toISOString()

    if (status === 'completed' || status === 'failed' || status === 'cancelled') {
      session.manifest.timing.completedAt = new Date().toISOString()
      session.manifest.timing.totalDurationMs = Date.now() -
        new Date(session.manifest.timing.startedAt).getTime()
    }

    if (error && status === 'failed') {
      session.manifest.error = {
        stage: session.manifest.currentStage,
        message: error.message,
        timestamp: new Date().toISOString()
      }
    }

    await this.saveManifest(session)
  }

  /**
   * Finalize session (update manifest, optional cleanup)
   */
  async finalize(session: CheckpointSession, success: boolean): Promise<void> {
    await this.updateStatus(session, success ? 'completed' : 'failed')

    // Default to cleanup on success unless explicitly retained
    const retainOnSuccess = CheckpointConfig?.retainOnSuccess ?? false
    if (success && !retainOnSuccess) {
      console.log(`[Checkpoint] Import successful, cleaning up checkpoint files`)
      await this.cleanup(session)
    } else {
      console.log(`[Checkpoint] Retaining checkpoint files at ${session.cacheDir}`)
    }
  }

  /**
   * Delete checkpoint data (after successful persist to DB)
   */
  async cleanup(session: CheckpointSession): Promise<void> {
    try {
      await rmrf(session.cacheDir)

      // Try to remove parent directory if empty
      const parentDir = path.dirname(session.cacheDir)
      const siblings = await readdir(parentDir)
      if (siblings.length === 0) {
        await rmdir(parentDir)
      }

      console.log(`[Checkpoint] Cleaned up checkpoint at ${session.cacheDir}`)
    } catch (error) {
      console.warn(`[Checkpoint] Failed to cleanup ${session.cacheDir}:`, error)
    }
  }

  /**
   * Load a specific page result
   */
  async loadPageResult(session: CheckpointSession, url: string): Promise<CheckpointPageResult | null> {
    const urlHash = hashUrl(url)
    const filePath = path.join(session.cacheDir, 'pages', `${urlHash}.json`)
    return safeReadJson<CheckpointPageResult>(filePath)
  }

  /**
   * Load a specific page error
   */
  async loadPageError(session: CheckpointSession, url: string): Promise<CheckpointPageError | null> {
    const urlHash = hashUrl(url)
    const filePath = path.join(session.cacheDir, 'errors', `${urlHash}.json`)
    return safeReadJson<CheckpointPageError>(filePath)
  }

  /**
   * Load the current manifest
   */
  async loadManifest(session: CheckpointSession): Promise<CheckpointManifest> {
    const filePath = path.join(session.cacheDir, 'manifest.json')
    const manifest = await safeReadJson<CheckpointManifest>(filePath)
    if (!manifest) {
      throw new Error(`Manifest not found at ${filePath}`)
    }
    return manifest
  }

  /**
   * Load the sitemap
   */
  async loadSitemap(session: CheckpointSession): Promise<CheckpointSitemap | null> {
    const filePath = path.join(session.cacheDir, 'sitemap.json')
    return safeReadJson<CheckpointSitemap>(filePath)
  }

  /**
   * Save manifest to disk
   */
  private async saveManifest(session: CheckpointSession): Promise<void> {
    const filePath = path.join(session.cacheDir, 'manifest.json')
    await atomicWriteJson(filePath, session.manifest)
  }

  /**
   * List all checkpoint sessions for a website
   */
  async listSessions(websiteId: string): Promise<Array<{ jobId: string; manifest: CheckpointManifest }>> {
    const websiteDir = path.join(this.baseDir, websiteId)
    const sessions: Array<{ jobId: string; manifest: CheckpointManifest }> = []

    try {
      const jobDirs = await readdir(websiteDir, { withFileTypes: true })
      for (const entry of jobDirs) {
        if (!entry.isDirectory()) continue
        const manifestPath = path.join(websiteDir, entry.name, 'manifest.json')
        const manifest = await safeReadJson<CheckpointManifest>(manifestPath)
        if (manifest) {
          sessions.push({ jobId: entry.name, manifest })
        }
      }
    } catch {
      // Website directory doesn't exist
    }

    return sessions
  }

  /**
   * Clean up old checkpoints based on retention policy
   */
  async cleanupOldCheckpoints(): Promise<number> {
    const retentionDays = CheckpointConfig?.retentionDays ?? 7
    const retentionMs = retentionDays * 24 * 60 * 60 * 1000
    const cutoffTime = Date.now() - retentionMs
    let cleanedCount = 0

    try {
      const exists = await fileExists(this.baseDir)
      if (!exists) return 0

      const websiteDirs = await readdir(this.baseDir, { withFileTypes: true })
      for (const websiteEntry of websiteDirs) {
        if (!websiteEntry.isDirectory()) continue
        const websiteDir = path.join(this.baseDir, websiteEntry.name)

        const jobDirs = await readdir(websiteDir, { withFileTypes: true })
        for (const jobEntry of jobDirs) {
          if (!jobEntry.isDirectory()) continue
          const jobDir = path.join(websiteDir, jobEntry.name)
          const manifestPath = path.join(jobDir, 'manifest.json')

          const manifest = await safeReadJson<CheckpointManifest>(manifestPath)
          if (!manifest) continue

          const createdAt = new Date(manifest.createdAt).getTime()
          if (createdAt < cutoffTime) {
            await rmrf(jobDir)
            cleanedCount++
            console.log(`[Checkpoint] Cleaned up old checkpoint: ${jobEntry.name}`)
          }
        }

        // Remove empty website directory
        const remaining = await readdir(websiteDir)
        if (remaining.length === 0) {
          await rmdir(websiteDir)
        }
      }
    } catch (error) {
      console.warn('[Checkpoint] Error during cleanup:', error)
    }

    return cleanedCount
  }
}

// Singleton instance
let checkpointServiceInstance: ImportCheckpointService | null = null

/**
 * Get the checkpoint service singleton
 */
export function getCheckpointService(): ImportCheckpointService {
  if (!checkpointServiceInstance) {
    checkpointServiceInstance = new ImportCheckpointService()
  }
  return checkpointServiceInstance
}

/**
 * Create a new checkpoint service with custom base directory (for testing)
 */
export function createCheckpointService(baseDir: string): ImportCheckpointService {
  return new ImportCheckpointService(baseDir)
}
