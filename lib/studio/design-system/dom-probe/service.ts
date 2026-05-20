import path from 'node:path'

import {
  chromium,
  errors,
  type Browser,
  type BrowserContext,
  type BrowserContextOptions,
  type LaunchOptions,
  type Page,
  type Response
} from 'playwright-core'

import { getServerlessLaunchOptions, isServerless } from './serverless-config'

// Playwright's LoadState type for page.waitForLoadState()
type LoadState = 'load' | 'domcontentloaded' | 'networkidle'

import {
  DOM_PROBE_VERSION,
  DomProbeArtifacts,
  buildCaptureMetadata,
  createEmptyDiagnostics,
  createEmptyManifest,
  createRunLogger,
  markCheckpoint,
  persistCapture,
  registerError,
  type DomDesignSystemCapture,
  type DomDesignSystemCaptureMetadata,
  type DomProbeDiagnostics,
  type DomProbeManifest,
  type DomProbeNavigationMetric,
  type DomProbeRunConfig,
  type DomProbeViewport
} from '@/lib/studio/design-system/dom-probe'
import {
  evaluateCaptureAgainstBaseline,
  loadBaseline,
  type DomProbeEvaluationResult
} from '@/lib/studio/design-system/dom-probe/evaluation'
import { extractDesignSystemFromDom } from '@/lib/studio/design-system/dom-probe/peek-adapter'
import {
  DesignSystem,
  type CapturedDesignSystem,
  type DiagnosticEntry,
  type TokenColor,
  type TokenScaleValue,
  type TokenTypography
} from '@/lib/studio/import/types/design-system.types'
import { toShadcnVariables, type ShadcnDesignSystemTokens } from '@/lib/studio/design-system/shadcn-transformer'
import type { ProgressCallback } from '@/lib/studio/import/types/progress.types'

export interface DomProbeServiceOptions {
  viewport?: DomProbeViewport
  baselineRoot?: string
  playwright?: {
    launch?: LaunchOptions
    context?: BrowserContextOptions
  }
  navigation?: DomProbeNavigationOptions
}

export interface CaptureDesignSystemParams {
  websiteId: string
  targetUrl: string
  baselineKey?: string
  jobId?: string
  refresh?: boolean
  evaluation?: boolean
  flags?: Record<string, boolean | number | string | undefined>
  /** Progress callback for reporting DOM probe progress */
  onProgress?: ProgressCallback
}

export interface CaptureDesignSystemResult {
  capture: DomDesignSystemCapture
  manifest: DomProbeManifest
  metadata: DomDesignSystemCaptureMetadata
  runDir: string
  evaluation?: DomProbeEvaluationResult
}

export interface DomProbeNavigationOptions {
  waitUntil?: LoadState
  navigationTimeoutMs?: number
  postNavigationNetworkIdleTimeoutMs?: number
  retryWithLighterWait?: boolean
}

const DEFAULT_TIMEOUT_MS = 60000
const DEFAULT_NAVIGATION_WAIT_UNTIL: LoadState = 'domcontentloaded'
const DEFAULT_NETWORK_IDLE_TIMEOUT_MS = 12000

export class DomProbeService {
  constructor(private readonly options: DomProbeServiceOptions = {}) {}

  async captureDesignSystem(params: CaptureDesignSystemParams): Promise<CaptureDesignSystemResult> {
    const { targetUrl, baselineKey, refresh = true, evaluation = true, flags, onProgress } = params
    const viewport = this.options.viewport

    // Report DOM probe start
    onProgress?.({
      subsystemStart: {
        id: 'dom_probe',
        label: 'Probing DOM',
        total: 5, // launch, navigate, capture, analyze, persist
      },
      message: `Starting DOM probe for ${targetUrl}`,
    })

    const config: DomProbeRunConfig = {
      baseline: baselineKey ?? params.websiteId,
      targetUrl,
      refresh,
      evaluation,
      viewport: viewport ?? { width: 1280, height: 720, deviceScaleFactor: 1 },
      runnerVersion: DOM_PROBE_VERSION,
      flags: flags ?? {}
    }

    const artifacts = new DomProbeArtifacts(config)
    await artifacts.initialize()
    const logger = createRunLogger(artifacts)
    const manifest = createEmptyManifest(config, artifacts.runId)

    let browser: Browser | null = null
    let context: BrowserContext | null = null
    let page: Page | null = null
    let metadata: DomDesignSystemCaptureMetadata | null = null
    const consoleErrors: Array<{ type: string; text: string; location?: { url?: string; lineNumber?: number; columnNumber?: number } }> = []
    const navigationWarnings: string[] = []

    const runStartedAt = new Date()
    const navigationOptions = this.getNavigationOptions()

    try {
      await logger.info('Starting DOM probe run', {
        baseline: config.baseline,
        url: targetUrl,
        flags: config.flags
      })

      // Get serverless-optimized launch options if in serverless environment
      const serverlessOptions = await getServerlessLaunchOptions()

      browser = await chromium.launch({
        headless: true,
        timeout: DEFAULT_TIMEOUT_MS,
        ...serverlessOptions,
        ...(this.options.playwright?.launch ?? {})
      })

      // Progress: browser launched (step 1 of 5)
      onProgress?.({
        subsystemProgress: { id: 'dom_probe', current: 1, total: 5 },
        message: 'Browser launched, creating context...',
      })

      context = await browser.newContext({
        viewport: config.viewport,
        deviceScaleFactor: config.viewport.deviceScaleFactor,
        userAgent:
          this.options.playwright?.context?.userAgent ??
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) SiteShot-DOMProbe/1.0 Chrome/124.0 Safari/537.36',
        locale: this.options.playwright?.context?.locale ?? 'en-US',
        timezoneId: this.options.playwright?.context?.timezoneId ?? 'Australia/Sydney',
        ...this.options.playwright?.context
      })

      page = await context.newPage()
      const onConsole = async (message: any) => {
        const entry = {
          type: message.type(),
          text: message.text(),
          location: message.location()
        }
        if (entry.type === 'error') {
          consoleErrors.push(entry)
        }
        await logger.debug('page.console', entry)
      }
      page.on('console', onConsole)

      const navigationResult = await this.navigateWithFallback(page, targetUrl, logger, navigationOptions)
      navigationWarnings.push(...navigationResult.warnings)

      if (!navigationResult.response) {
        const warning = `Navigation to ${targetUrl} did not return a response; continuing with current page state`
        navigationWarnings.push(warning)
        await logger.warn(warning)
      } else if (navigationResult.response.status() >= 400) {
        const warning = `Navigation returned status ${navigationResult.response.status()} for ${targetUrl}`
        navigationWarnings.push(warning)
        await logger.warn(warning)
      }

      const readinessWarnings = await this.waitForPageReadiness(page, navigationOptions, logger)
      navigationWarnings.push(...readinessWarnings)
      await logger.info('Page ready for capture', {
        warnings: navigationWarnings.length ? navigationWarnings : undefined
      })

      // Progress: navigation complete (step 2 of 5)
      onProgress?.({
        subsystemProgress: { id: 'dom_probe', current: 2, total: 5 },
        message: 'Page loaded, capturing design system...',
      })

      const screenshotPath = path.join(artifacts.screenshotsDir, 'full-page.png')
      await page.screenshot({ path: screenshotPath, fullPage: true, type: 'png' })
      manifest.artifacts.screenshots.push(path.relative(process.cwd(), screenshotPath))
      markCheckpoint(manifest, 'CP1', path.relative(process.cwd(), screenshotPath))

      const domSnapshot = await page.content()
      await artifacts.writeDomSnapshot(domSnapshot)
      manifest.artifacts.domSnapshot = path.relative(process.cwd(), artifacts.domSnapshotPath)
      await logger.info('DOM snapshot saved', { path: manifest.artifacts.domSnapshot })

      // Progress: DOM snapshot captured (step 3 of 5)
      onProgress?.({
        subsystemProgress: { id: 'dom_probe', current: 3, total: 5 },
        message: 'DOM captured, extracting design tokens...',
      })

      const navigationTimings = await this.collectNavigationTimings(page)
      const analysis = await extractDesignSystemFromDom(page)

      // Progress: design system analyzed (step 4 of 5)
      onProgress?.({
        subsystemProgress: { id: 'dom_probe', current: 4, total: 5 },
        message: 'Design tokens extracted, persisting...',
      })
      const userAgent = await page.evaluate(() => navigator.userAgent)
      const browserVersion = await browser.version()
      const runCompletedAt = new Date()

      metadata = buildCaptureMetadata({
        config,
        artifacts,
        runId: artifacts.runId,
        runStartedAt,
        runCompletedAt,
        browser: {
          name: 'chromium',
          version: browserVersion,
          userAgent
        },
        viewport: config.viewport,
        timings: navigationTimings,
        cached: false
      })
      metadata.artifacts.screenshots = manifest.artifacts.screenshots
      metadata.artifacts.domSnapshot = manifest.artifacts.domSnapshot

      const diagnostics = analysis.diagnostics ?? createEmptyDiagnostics()
      diagnostics.consoleErrors = consoleErrors
      if (navigationWarnings.length > 0) {
        const uniqueWarnings = Array.from(new Set(navigationWarnings))
        diagnostics.warnings = [...diagnostics.warnings, ...uniqueWarnings]
      }

      const capture: DomDesignSystemCapture = {
        metadata,
        typography: analysis.typography,
        palette: analysis.palette,
        spacing: analysis.spacing,
        components: analysis.components ?? [],
        diagnostics,
        rawDomSnapshotPath: artifacts.domSnapshotPath
      }

      await persistCapture(artifacts, capture)
      const relativeCapture = path.relative(process.cwd(), artifacts.capturePath)
      manifest.artifacts.captureJson = relativeCapture
      manifest.artifacts.runLog = path.relative(process.cwd(), artifacts.logPath)
      markCheckpoint(manifest, 'CP2', relativeCapture)

      await logger.info('DOM probe capture persisted', {
        capturePath: artifacts.capturePath,
        manifestPath: artifacts.manifestJsonPath
      })

      const evaluationResult = evaluation && baselineKey
        ? await this.runEvaluation(capture, manifest, baselineKey, artifacts)
        : undefined

      await artifacts.finalizeManifest(manifest)

      // Progress: DOM probe complete (step 5 of 5)
      onProgress?.({
        subsystemComplete: 'dom_probe',
        message: `Design system captured with ${capture.palette.colors.length} colors, ${capture.typography.length} typography styles`,
      })

      return {
        capture,
        manifest,
        metadata,
        runDir: artifacts.runDir,
        evaluation: evaluationResult
      }
    } catch (error) {
      // Report DOM probe error
      onProgress?.({
        subsystemError: { id: 'dom_probe', error: error instanceof Error ? error.message : 'Unknown error' },
      })
      const message = error instanceof Error ? error.message : String(error)
      registerError(manifest, message)
      await logger.error('DOM probe run failed', { error: message })
      await artifacts.finalizeManifest(manifest).catch(() => {})
      throw error
    } finally {
      if (page) {
        await page.close().catch(() => {})
      }
      if (context) {
        await context.close().catch(() => {})
      }
      if (browser) {
        await browser.close().catch(() => {})
      }
    }
  }

  async evaluateAgainstBaseline(
    capture: DomDesignSystemCapture,
    baselineKey: string
  ): Promise<DomProbeEvaluationResult> {
    const previousRoot = process.env.DOM_PROBE_BASELINE_ROOT
    if (this.options.baselineRoot) {
      process.env.DOM_PROBE_BASELINE_ROOT = this.options.baselineRoot
    }
    try {
      const baseline = await loadBaseline(baselineKey)
      const evaluation = evaluateCaptureAgainstBaseline(capture, baseline)
      return evaluation
    } finally {
      if (this.options.baselineRoot) {
        if (previousRoot === undefined) {
          delete process.env.DOM_PROBE_BASELINE_ROOT
        } else {
          process.env.DOM_PROBE_BASELINE_ROOT = previousRoot
        }
      }
    }
  }

  toDesignSystem(capture: DomDesignSystemCapture, confidenceOverride?: number): DesignSystem {
    const palette = this.mapPalette(capture.palette)
    const typography = this.mapTypography(capture.typography)
    const spacing = this.mapSpacing(capture.spacing)
    const diagnostics = this.mapDiagnostics(capture.diagnostics)

    const designSystem: DesignSystem = {
      palette,
      typography,
      spacing,
      radii: this.buildFallbackRadii(),
      shadows: [],
      effects: [],
      metadata: {
        sourceUrls: [capture.metadata.url].filter(Boolean),
        capturedAt: capture.metadata.timestamp,
        confidence: typeof confidenceOverride === 'number' ? confidenceOverride : this.estimateConfidence(capture),
        extractionMethod: 'deterministic',
        version: DOM_PROBE_VERSION,
        domProbe: {
          runId: capture.metadata.runId,
          baseline: capture.metadata.baseline,
          targetUrl: capture.metadata.url,
          captureDurationMs: capture.metadata.captureDurationMs,
          evidence: {}
        }
      },
      diagnostics,
      version: DOM_PROBE_VERSION,
      aliases: undefined
    }

    // Use new simplified shadcn transformer - extracts directly from capture
    const shadcnTokens = toShadcnVariables(capture)
    designSystem.aliases = {
      cssVariables: shadcnTokens.variables,
      computedAt: new Date().toISOString(),
      diagnostics: [],
      fallbackSummary: {}
    }

    return designSystem
  }

  toCapturedDesignSystem(
    capture: DomDesignSystemCapture,
    confidenceOverride?: number
  ): CapturedDesignSystem {
    const designSystem = this.toDesignSystem(capture, confidenceOverride)
    return {
      designSystem,
      rawData: {
        cssVariables: {},
        stylesheets: [],
        literals: {
          colors: capture.palette.colors.map(color => ({
            value: color.hex,
            usage: color.occurrences
          })),
          fonts: capture.typography.map(sample => ({
            value: sample.fontFamily,
            usage: sample.usageCount
          }))
        },
        inlineStyles: {}
      },
      processingStats: {
        totalStylesheets: 0,
        totalInlineStyles: 0,
        extractionTime: capture.metadata.captureDurationMs,
        llmCalls: 0,
        cacheHits: 0
      }
    }
  }

  /**
   * Convert DOM probe capture directly to shadcn CSS variables
   *
   * This is the NEW simplified format that stores CSS variables directly.
   * No intermediate DesignSystem object, no mapping layer.
   */
  toShadcnDesignSystem(capture: DomDesignSystemCapture): ShadcnDesignSystemTokens {
    return toShadcnVariables(capture)
  }

  private async runEvaluation(
    capture: DomDesignSystemCapture,
    manifest: DomProbeManifest,
    baselineKey: string,
    artifacts: DomProbeArtifacts
  ): Promise<DomProbeEvaluationResult | undefined> {
    try {
      const evaluation = await this.evaluateAgainstBaseline(capture, baselineKey)
      const diffPath = await this.writeDiffReport(artifacts, evaluation)
      manifest.artifacts.diffs = [diffPath]
      markCheckpoint(manifest, 'CP3', diffPath)
      if (!evaluation.summary.overall) {
        manifest.status = 'failed'
        manifest.errors.push('Evaluation failed – see diff report for details')
      }
      manifest.notes = Array.from(new Set([...(manifest.notes ?? []), ...evaluation.notes]))
      return evaluation
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      manifest.notes = Array.from(new Set([...(manifest.notes ?? []), `Evaluation failed: ${message}`]))
      return undefined
    }
  }

  private async writeDiffReport(
    artifacts: DomProbeArtifacts,
    evaluation: DomProbeEvaluationResult
  ): Promise<string> {
    const payload = {
      summary: evaluation.summary,
      typography: evaluation.typography,
      palette: evaluation.palette,
      spacing: evaluation.spacing,
      notes: evaluation.notes
    }
    const relativePath = path.join('diffs', 'diff.json')
    const absolutePath = await artifacts.writeJson(relativePath, payload)
    return path.relative(process.cwd(), absolutePath)
  }

  private async waitForFonts(page: Page): Promise<void> {
    await page.evaluate(async () => {
      if ('fonts' in document && document.fonts && typeof document.fonts.ready === 'object') {
        try {
          await document.fonts.ready
        } catch (error) {
          console.warn('document.fonts.ready rejected', error)
        }
      }
    })
  }

  private async collectNavigationTimings(page: Page): Promise<DomProbeNavigationMetric[]> {
    const metrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
      if (navigation) {
        return {
          domContentLoaded: navigation.domContentLoadedEventEnd - navigation.startTime,
          loadEvent: navigation.loadEventEnd - navigation.startTime,
          responseEnd: navigation.responseEnd - navigation.startTime,
          requestStart: navigation.requestStart - navigation.startTime,
          connectEnd: navigation.connectEnd - navigation.startTime
        }
      }
      const timing = performance.timing
      if (!timing) return null
      return {
        domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
        loadEvent: timing.loadEventEnd - timing.navigationStart,
        responseEnd: timing.responseEnd - timing.navigationStart,
        requestStart: timing.requestStart - timing.navigationStart,
        connectEnd: timing.connectEnd - timing.navigationStart
      }
    })
    if (!metrics) return []
    return Object.entries(metrics)
      .filter(([, value]) => typeof value === 'number' && Number.isFinite(value))
      .map(([name, value]) => ({
        name,
        valueMs: Math.max(0, Number(value))
      }))
  }

  private mapPalette(capturePalette: DomDesignSystemCapture['palette']): DesignSystem['palette'] {
    type CaptureSwatch = DomDesignSystemCapture['palette']['colors'][number]
    type PaletteEntry = { swatch: CaptureSwatch; forcedRole?: CaptureSwatch['role'] }

    const convert = (swatch: CaptureSwatch, index: number): TokenColor => {
      const rgba = this.hexToRgba(swatch.hex)
      return {
        value: swatch.hex,
        name: swatch.role ? `${swatch.role}-${index + 1}` : `color-${index + 1}`,
        confidence: swatch.role ? 0.95 : 0.8,
        source: 'css-var',
        usageCount: swatch.occurrences,
        hex: swatch.hex,
        rgba,
        hsl: undefined
      }
    }

    const toTokens = (entries: PaletteEntry[]): TokenColor[] =>
      entries.map((entry, index) => {
        const target =
          entry.forcedRole && entry.swatch.role !== entry.forcedRole
            ? { ...entry.swatch, role: entry.forcedRole }
            : entry.swatch
        return convert(target, index)
      })

    const normalizeHex = (hex: string) => hex.toLowerCase()
    const LOW_CHROMA_THRESHOLD = 0.045

    const colors = capturePalette.colors ?? []

    const isChromatic = (swatch: CaptureSwatch): boolean => {
      const chroma = swatch.oklch?.c
      if (typeof chroma === 'number') {
        return chroma >= LOW_CHROMA_THRESHOLD
      }
      if (swatch.role === 'background' || swatch.role === 'text' || swatch.role === 'neutral') {
        return false
      }
      const hex = normalizeHex(swatch.hex)
      return hex !== '#ffffff' && hex !== '#fff' && hex !== '#000000'
    }

    const chromaticCandidates = colors.filter(isChromatic)
    const neutralCandidates = colors.filter(swatch => !isChromatic(swatch))
    const usedChromatic = new Set<string>()

    const createEntry = (swatch: CaptureSwatch, fallbackRole?: CaptureSwatch['role']): PaletteEntry => ({
      swatch,
      forcedRole: swatch.role ? undefined : fallbackRole
    })

    const addChromatic = (
      collection: PaletteEntry[],
      swatch: CaptureSwatch | null | undefined,
      fallbackRole: CaptureSwatch['role']
    ) => {
      if (!swatch) return
      const key = normalizeHex(swatch.hex)
      if (usedChromatic.has(key)) return
      collection.push(createEntry(swatch, fallbackRole))
      usedChromatic.add(key)
    }

    const primaryEntries: PaletteEntry[] = []
    addChromatic(primaryEntries, capturePalette.primary ?? undefined, 'primary')
    if (primaryEntries.length === 0) {
      const fallback = chromaticCandidates.find(swatch => !usedChromatic.has(normalizeHex(swatch.hex)))
      if (fallback) {
        addChromatic(primaryEntries, fallback, 'primary')
      }
    }

    const secondaryEntries: PaletteEntry[] = []
    addChromatic(secondaryEntries, capturePalette.secondary ?? undefined, 'secondary')
    if (secondaryEntries.length === 0) {
      const fallback = chromaticCandidates.find(swatch => !usedChromatic.has(normalizeHex(swatch.hex)))
      if (fallback) {
        addChromatic(secondaryEntries, fallback, 'secondary')
      }
    }

    const accentEntries: PaletteEntry[] = []
    const accentSource =
      capturePalette.accent && capturePalette.accent.length > 0
        ? capturePalette.accent
        : colors.filter(swatch => swatch.role === 'accent')
    accentSource.forEach(swatch => addChromatic(accentEntries, swatch, 'accent'))
    if (accentEntries.length === 0) {
      chromaticCandidates.forEach(swatch => {
        if (!usedChromatic.has(normalizeHex(swatch.hex))) {
          addChromatic(accentEntries, swatch, 'accent')
        }
      })
    }

    const neutralEntries: PaletteEntry[] = []
    const neutralSource =
      capturePalette.neutrals && capturePalette.neutrals.length > 0
        ? capturePalette.neutrals
        : neutralCandidates
    neutralSource.forEach(swatch => {
      neutralEntries.push(createEntry(swatch, 'neutral'))
    })

    const mapToEntries = (swatches: CaptureSwatch[], role: CaptureSwatch['role']): PaletteEntry[] =>
      swatches.map(swatch => createEntry(swatch, role))

    const surfaceFromCapture = capturePalette.surface && capturePalette.surface.length > 0
      ? capturePalette.surface
      : []
    let surfaceEntries: PaletteEntry[] = mapToEntries(surfaceFromCapture, 'background')

    if (surfaceEntries.length === 0) {
      const backgroundSwatches = colors.filter(swatch => swatch.role === 'background')
      surfaceEntries = mapToEntries(backgroundSwatches, 'background')
    }

    if (surfaceEntries.length === 0 && neutralSource.length > 0) {
      surfaceEntries = mapToEntries(neutralSource.slice(0, 2), 'background')
    }

    const primaryTokens = toTokens(primaryEntries)
    const secondaryTokens = toTokens(secondaryEntries)
    const accentTokens = toTokens(accentEntries)
    const neutralTokens = toTokens(neutralEntries)
    let surfaceTokens = toTokens(surfaceEntries)

    if (surfaceTokens.length === 0) {
      surfaceTokens = [
        {
          value: '#ffffff',
          name: 'surface-1',
          confidence: 0.6,
          source: 'css-var',
          usageCount: 1,
          hex: '#ffffff',
          rgba: 'rgba(255, 255, 255, 1)',
          hsl: undefined
        }
      ]
    }

    return {
      primary: primaryTokens,
      secondary: secondaryTokens,
      accent: accentTokens,
      neutral: neutralTokens,
      surface: surfaceTokens
    }
  }

  private mapTypography(samples: DomDesignSystemCapture['typography']): DesignSystem['typography'] {
    const toToken = (sample: DomDesignSystemCapture['typography'][number]): TokenTypography => {
      const fontSize = Number.isFinite(sample.fontSizePx) ? `${sample.fontSizePx}px` : undefined
      const lineHeight = typeof sample.lineHeightPx === 'number' ? `${sample.lineHeightPx}px` : undefined
      const letterSpacing = typeof sample.letterSpacingPx === 'number' ? `${sample.letterSpacingPx}px` : undefined
      const [family, ...fallbacks] = sample.fontStack.split(',').map(part => part.trim().replace(/^['"]|['"]$/g, ''))
      const weightNumeric = Number.parseInt(sample.fontWeight, 10)
      const fontWeight = Number.isFinite(weightNumeric) ? weightNumeric : sample.fontWeight

      return {
        fontFamily: family || sample.fontFamily,
        fontSize,
        fontWeight,
        lineHeight,
        letterSpacing,
        name: sample.role ? `${sample.role}-${sample.id}` : sample.id,
        confidence: sample.role ? 0.95 : 0.85,
        source: 'css',
        usageCount: sample.usageCount,
        fallbacks: fallbacks.filter(Boolean)
      }
    }

    const heading: TokenTypography[] = []
    const body: TokenTypography[] = []
    const ui: TokenTypography[] = []

    samples.forEach(sample => {
      const token = toToken(sample)
      switch (sample.role) {
        case 'heading':
          heading.push(token)
          break
        case 'body':
          body.push(token)
          break
        case 'label':
        case 'cta':
          ui.push(token)
          break
        default:
          if (heading.length === 0) {
            heading.push(token)
          } else if (body.length === 0) {
            body.push(token)
          } else {
            ui.push(token)
          }
          break
      }
    })

    const ensureFallback = (collection: TokenTypography[], defaults: () => TokenTypography[]) => {
      if (collection.length === 0) {
        collection.push(...defaults())
      }
    }

    ensureFallback(heading, () => [
      {
        fontFamily: 'Inter',
        fontSize: '32px',
        fontWeight: 600,
        lineHeight: '40px',
        letterSpacing: undefined,
        name: 'heading-default',
        confidence: 0.5,
        source: 'css',
        usageCount: 0,
        fallbacks: ['sans-serif']
      }
    ])

    ensureFallback(body, () => [
      {
        fontFamily: 'Inter',
        fontSize: '16px',
        fontWeight: 400,
        lineHeight: '24px',
        letterSpacing: undefined,
        name: 'body-default',
        confidence: 0.5,
        source: 'css',
        usageCount: 0,
        fallbacks: ['sans-serif']
      }
    ])

    ensureFallback(ui, () => [
      {
        fontFamily: 'Inter',
        fontSize: '14px',
        fontWeight: 500,
        lineHeight: '20px',
        letterSpacing: undefined,
        name: 'ui-default',
        confidence: 0.5,
        source: 'css',
        usageCount: 0,
        fallbacks: ['sans-serif']
      }
    ])

    return {
      heading,
      body,
      ui
    }
  }

  private mapSpacing(captureSpacing: DomDesignSystemCapture['spacing']): DesignSystem['spacing'] {
    const sortedScale = [...captureSpacing.scale].sort((a, b) => a.valuePx - b.valuePx)
    const values: TokenScaleValue[] = sortedScale.map((token, index) => ({
      step: index + 1,
      value: token.valuePx,
      name: `spacing-${index + 1}`
    }))

    if (values.length === 0) {
      values.push(
        { step: 1, value: captureSpacing.baseUnitPx ?? 4, name: 'spacing-1' },
        { step: 2, value: ((captureSpacing.baseUnitPx ?? 4) * 2), name: 'spacing-2' },
        { step: 3, value: ((captureSpacing.baseUnitPx ?? 4) * 4), name: 'spacing-3' }
      )
    }

    return {
      name: 'spacing-scale',
      values,
      unit: 'px',
      base: captureSpacing.baseUnitPx ?? values[0]?.value ?? 4,
      confidence: 0.85,
      source: 'inferred'
    }
  }

  private mapDiagnostics(diagnostics: DomProbeDiagnostics): DiagnosticEntry[] {
    const entries: DiagnosticEntry[] = []
    diagnostics.errors.forEach((message, index) =>
      entries.push({
        type: 'error',
        code: `DOM_PROBE_ERROR_${index + 1}`,
        message,
        source: 'DomProbeService',
        severity: 'high'
      })
    )
    diagnostics.warnings.forEach((message, index) =>
      entries.push({
        type: 'warning',
        code: `DOM_PROBE_WARNING_${index + 1}`,
        message,
        source: 'DomProbeService',
        severity: 'medium'
      })
    )
    diagnostics.infos.forEach((message, index) =>
      entries.push({
        type: 'info',
        code: `DOM_PROBE_INFO_${index + 1}`,
        message,
        source: 'DomProbeService',
        severity: 'low'
      })
    )
    diagnostics.missingFonts.forEach((font, index) =>
      entries.push({
        type: 'warning',
        code: `DOM_PROBE_MISSING_FONT_${index + 1}`,
        message: `Font "${font}" reported missing during capture`,
        source: 'DomProbeService',
        severity: 'medium'
      })
    )
    diagnostics.consoleErrors.forEach((entry, index) =>
      entries.push({
        type: 'warning',
        code: `DOM_PROBE_CONSOLE_ERROR_${index + 1}`,
        message: `Console error: ${entry.text}`,
        source: 'DomProbeService',
        severity: 'medium'
      })
    )
    if (diagnostics.notes) {
      diagnostics.notes.forEach((note, index) =>
        entries.push({
          type: 'info',
          code: `DOM_PROBE_NOTE_${index + 1}`,
          message: note,
          source: 'DomProbeService',
          severity: 'low'
        })
      )
    }
    return entries
  }

  private estimateConfidence(capture: DomDesignSystemCapture): number {
    const typographyScore = Math.min(1, capture.typography.length / 3)
    const paletteScore = Math.min(1, capture.palette.colors.length / 4)
    const spacingScore = capture.spacing.baseUnitPx ? 1 : 0.7
    return Number(((typographyScore + paletteScore + spacingScore) / 3).toFixed(2))
  }

  private buildFallbackRadii(): DesignSystem['radii'] {
    return {
      name: 'border-radius-scale',
      values: [
        { step: 1, value: 0, name: 'none' },
        { step: 2, value: 4, name: 'sm' },
        { step: 3, value: 8, name: 'md' },
        { step: 4, value: 16, name: 'lg' }
      ],
      unit: 'px',
      confidence: 0.5,
      source: 'inferred'
    }
  }

  private hexToRgba(hex: string): string {
    const normalized = hex.replace('#', '')
    if (normalized.length !== 6) {
      return 'rgba(0, 0, 0, 1)'
    }
    const r = parseInt(normalized.slice(0, 2), 16)
    const g = parseInt(normalized.slice(2, 4), 16)
    const b = parseInt(normalized.slice(4, 6), 16)
    return `rgba(${r}, ${g}, ${b}, 1)`
  }

  private getNavigationOptions(): Required<DomProbeNavigationOptions> {
    const { navigation } = this.options
    return {
      waitUntil: navigation?.waitUntil ?? DEFAULT_NAVIGATION_WAIT_UNTIL,
      navigationTimeoutMs: navigation?.navigationTimeoutMs ?? DEFAULT_TIMEOUT_MS,
      postNavigationNetworkIdleTimeoutMs:
        navigation?.postNavigationNetworkIdleTimeoutMs ?? DEFAULT_NETWORK_IDLE_TIMEOUT_MS,
      retryWithLighterWait: navigation?.retryWithLighterWait ?? true
    }
  }

  private isTimeoutError(error: unknown): boolean {
    return error instanceof errors.TimeoutError || (error instanceof Error && /Timeout .*exceeded/i.test(error.message))
  }

  private async navigateWithFallback(
    page: Page,
    targetUrl: string,
    logger: ReturnType<typeof createRunLogger>,
    options: Required<DomProbeNavigationOptions>
  ): Promise<{ response: Response | null; waitUntil: LoadState; warnings: string[] }> {
    const warnings: string[] = []
    const attempts = Array.from(
      new Set<LoadState>([
        options.waitUntil,
        ...(options.retryWithLighterWait && options.waitUntil === 'networkidle' ? ['domcontentloaded' as const] : []),
        ...(options.retryWithLighterWait && options.waitUntil !== 'load' ? ['load' as const] : [])
      ])
    )

    let lastError: unknown

    for (const waitUntil of attempts) {
      try {
        const response = await page.goto(targetUrl, { waitUntil, timeout: options.navigationTimeoutMs })
        return { response, waitUntil, warnings }
      } catch (error) {
        lastError = error
        const isTimeout = this.isTimeoutError(error)
        const shouldRetry = isTimeout && waitUntil !== attempts[attempts.length - 1] && options.retryWithLighterWait
        const message = `Navigation with waitUntil="${waitUntil}" ${
          isTimeout ? `timed out after ${options.navigationTimeoutMs}ms` : 'failed'
        }${shouldRetry ? '; retrying with a lighter wait condition' : ''}`
        warnings.push(message)
        await logger.warn(message)

        if (!shouldRetry) {
          const errorMessage = error instanceof Error ? error.message : String(error)
          throw new Error(`Navigation to ${targetUrl} failed: ${errorMessage}`)
        }
      }
    }

    const errorMessage = lastError instanceof Error ? lastError.message : 'Unknown navigation error'
    throw new Error(`Navigation to ${targetUrl} failed: ${errorMessage}`)
  }

  private async waitForPageReadiness(
    page: Page,
    options: Required<DomProbeNavigationOptions>,
    logger: ReturnType<typeof createRunLogger>
  ): Promise<string[]> {
    const warnings: string[] = []

    try {
      await page.waitForLoadState('load', { timeout: options.navigationTimeoutMs })
    } catch (error) {
      if (this.isTimeoutError(error)) {
        const warning = `Page load event did not fire within ${options.navigationTimeoutMs}ms; continuing with available DOM`
        warnings.push(warning)
        await logger.warn(warning)
      } else {
        throw error
      }
    }

    try {
      await page.waitForFunction(() => document.readyState === 'complete', null, {
        timeout: options.navigationTimeoutMs
      })
    } catch (error) {
      if (this.isTimeoutError(error)) {
        const warning = `document.readyState did not reach "complete" within ${options.navigationTimeoutMs}ms; continuing`
        warnings.push(warning)
        await logger.warn(warning)
      } else {
        throw error
      }
    }

    if (options.postNavigationNetworkIdleTimeoutMs > 0) {
      const start = Date.now()
      try {
        await page.waitForLoadState('networkidle', { timeout: options.postNavigationNetworkIdleTimeoutMs })
      } catch (error) {
        if (this.isTimeoutError(error)) {
          const elapsed = Date.now() - start
          const warning = `Network did not go idle within ${options.postNavigationNetworkIdleTimeoutMs}ms (elapsed ${elapsed}ms); proceeding without idle guarantee`
          warnings.push(warning)
          await logger.warn(warning)
        } else {
          throw error
        }
      }
    }

    try {
      await this.waitForFonts(page)
    } catch (error) {
      const warning = `Failed to confirm web fonts readiness: ${error instanceof Error ? error.message : String(error)}`
      warnings.push(warning)
      await logger.warn(warning)
    }

    return warnings
  }
}
