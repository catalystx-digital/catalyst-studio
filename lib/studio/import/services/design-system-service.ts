/**
 * Design System Service
 *
 * High-level service for managing design systems in the import pipeline
 * Integrates with ImportResultHandler to persist design systems
 * @module design-system-service
 */

import { PrismaClient, WebsiteDesignConcept } from '@/lib/generated/prisma'
import { DesignSystemRepository } from '../repositories/design-system.repository'
import { CapturedDesignSystem, DesignSystem, DiagnosticEntry } from '../types/design-system.types'
import { ImportDetectionResult } from '../detection/types'
import { invalidateImportRelatedCaches } from '../../design-system/ssr-cache-invalidation'
import { DesignSystemTelemetry } from '../../telemetry/design-system-telemetry'
import { DatabaseTelemetryStorage } from '../../telemetry/telemetry-storage'
import {
  DomProbeService,
  type CaptureDesignSystemResult
} from '@/lib/studio/design-system/dom-probe/service'
import type { DomProbeEvaluationResult } from '@/lib/studio/design-system/dom-probe/evaluation'
import type { DomDesignSystemCapture } from '@/lib/studio/design-system/dom-probe/types'
import { computeDomProbeConfidence } from '@/lib/studio/design-system/dom-probe/metrics'
import {
  DomProbeEvidenceExporter,
  type DomProbeEvidenceLinks
} from '@/lib/studio/design-system/dom-probe/evidence-exporter'
import {
  getDomProbeBaselineKey,
  isDomProbeEnabledForWebsite,
  shouldRunDomProbeEvaluation
} from '../utils/dom-probe-flags'
import { DesignConceptRepository } from '@/lib/studio/design-system/design-concept.repository'
import { type ShadcnDesignSystemTokens } from '@/lib/studio/design-system/shadcn-transformer'
import { getDesignSystemVariables, getNormalizedDesignSystem } from '@/lib/studio/design-system/design-system-reader'

export interface DesignSystemServiceOptions {
  repository?: DesignSystemRepository
  conceptRepository?: DesignConceptRepository
  prisma?: PrismaClient
  domProbeService?: DomProbeService
  evidenceExporter?: DomProbeEvidenceExporter
}

export interface ProcessDesignSystemInput {
  websiteId: string
  detectionResults: ImportDetectionResult[]
  sourceJobId?: string
  importUrl?: string
  probeCapture?: CaptureDesignSystemResult
  baselineKey?: string
  /**
   * Use the new simplified shadcn-based storage format.
   * When true, stores { variables: {...}, extraction: {...} } instead of the
   * complex legacy format with palette, typography, spacing objects.
   *
   * Default: true (new imports use new format)
   */
  useNewFormat?: boolean
  /**
   * Design concept ID to store the design system under.
   * If not provided, uses or creates the default concept for the website.
   */
  designConceptId?: string
}

export interface DesignSystemProcessingResult {
  success: boolean
  /** Legacy format design system (when useNewFormat=false) */
  designSystem?: CapturedDesignSystem
  /** New format design system (when useNewFormat=true) */
  shadcnTokens?: ShadcnDesignSystemTokens
  persistedId?: string
  errors: string[]
  warnings: string[]
  strategy: 'dom-probe'
  /** Which storage format was used */
  storageFormat: 'legacy' | 'shadcn'
  probe?: {
    capture: DomDesignSystemCapture
    evaluation?: DomProbeEvaluationResult
    capturePath: string
    manifestPath: string
    runDir: string
    evidence?: DomProbeEvidenceLinks
  }
  metrics: {
    extractionTime: number
    persistenceTime: number
    totalTime: number
    tokensExtracted: number
    confidence: number
  }
}

export class DesignSystemService {
  private repository: DesignSystemRepository
  private prisma: PrismaClient
  private telemetry: DesignSystemTelemetry
  private domProbeService: DomProbeService
  private evidenceExporter: DomProbeEvidenceExporter
  private conceptRepository: DesignConceptRepository

  constructor(options: DesignSystemServiceOptions = {}) {
    this.prisma = options.prisma || new PrismaClient()
    this.repository = options.repository || new DesignSystemRepository(this.prisma)
    this.telemetry = new DesignSystemTelemetry(new DatabaseTelemetryStorage(this.prisma))
    this.domProbeService = options.domProbeService ?? new DomProbeService()
    this.evidenceExporter = options.evidenceExporter ?? new DomProbeEvidenceExporter()
    this.conceptRepository = options.conceptRepository || new DesignConceptRepository(this.prisma)
  }

  /**
   * Process design system extraction and persistence for an import job
   */
  async processDesignSystem(input: ProcessDesignSystemInput): Promise<DesignSystemProcessingResult> {
    const startTime = Date.now()
    const { websiteId, detectionResults, sourceJobId, designConceptId } = input
    const baselineKey = input.baselineKey ?? getDomProbeBaselineKey()

    // Default to new format for new imports
    const useNewFormat = input.useNewFormat !== false

    const result: DesignSystemProcessingResult = {
      success: false,
      errors: [],
      warnings: [],
      strategy: 'dom-probe',
      storageFormat: useNewFormat ? 'shadcn' : 'legacy',
      probe: undefined,
      metrics: {
        extractionTime: 0,
        persistenceTime: 0,
        totalTime: 0,
        tokensExtracted: 0,
        confidence: 0
      }
    }

    await this.telemetry.recordExtractionStart(websiteId, sourceJobId)

    try {
      if (!input.probeCapture && !isDomProbeEnabledForWebsite(websiteId)) {
        const message = 'DOM probe is disabled for this website and no capture override was provided'
        result.errors.push(message)
        throw new Error(message)
      }

      let probeCapture = input.probeCapture ?? (await this.captureWithDomProbe(input, baselineKey))
      if (!probeCapture) {
        const message = 'DOM probe capture did not produce a result'
        result.errors.push(message)
        throw new Error(message)
      }

      if (!probeCapture.evaluation && this.shouldRunEvaluation(baselineKey)) {
        if (baselineKey) {
          probeCapture = {
            ...probeCapture,
            evaluation: await this.domProbeService.evaluateAgainstBaseline(
              probeCapture.capture,
              baselineKey
            )
          }
        }
      }

      const confidenceOverride = computeDomProbeConfidence(probeCapture.evaluation)
      const capturedDesignSystem = this.domProbeService.toCapturedDesignSystem(
        probeCapture.capture,
        confidenceOverride
      )

      result.metrics.extractionTime = probeCapture.capture.metadata.captureDurationMs
      result.metrics.tokensExtracted = this.countTokens(capturedDesignSystem.designSystem)
      result.metrics.confidence = capturedDesignSystem.designSystem.metadata.confidence
      result.probe = {
        capture: probeCapture.capture,
        evaluation: probeCapture.evaluation,
        capturePath: probeCapture.metadata.artifacts.captureJson,
        manifestPath: probeCapture.manifest.artifacts.manifest,
        runDir: probeCapture.runDir
      }

      this.updateDomProbeMetadata(capturedDesignSystem, probeCapture)

      try {
        const evidence = await this.evidenceExporter.exportCapture({
          captureResult: probeCapture,
          websiteId,
          jobId: sourceJobId
        })
        result.probe.evidence = evidence
        this.updateDomProbeMetadata(capturedDesignSystem, probeCapture, evidence)
      } catch (exportError) {
        const exportMessage = exportError instanceof Error ? exportError.message : String(exportError)
        result.warnings.push(`Dom probe evidence export failed: ${exportMessage}`)
      }

      const preDiagnosticsErrors = result.errors.length
      this.applyDesignSystemDiagnostics(capturedDesignSystem, result)
      if (result.errors.length > preDiagnosticsErrors) {
        const diagnosticsMessage = result.errors.slice(preDiagnosticsErrors).join('; ')
        throw new Error(diagnosticsMessage || 'Design system diagnostics reported errors')
      }

      const validation = this.validateDesignSystem(capturedDesignSystem.designSystem)
      if (!validation.valid) {
        result.errors.push(...validation.errors)
        throw new Error(validation.errors.join('; ') || 'Design system validation failed')
      }

      if (result.metrics.tokensExtracted === 0) {
        const message = 'No design system tokens were extracted'
        result.errors.push(message)
        throw new Error(message)
      }

      const persistenceStart = Date.now()
      // Use provided concept ID or fall back to default concept
      const concept = designConceptId
        ? await this.conceptRepository.findById(designConceptId) ?? await this.ensureDefaultConcept(websiteId)
        : await this.ensureDefaultConcept(websiteId)

      if (useNewFormat) {
        // NEW FORMAT: Store as { variables, extraction } directly
        const shadcnTokens = this.domProbeService.toShadcnDesignSystem(probeCapture.capture)
        const persistedDesignSystem = await this.repository.createFromShadcnTokens({
          websiteId,
          designConceptId: concept.id,
          tokens: shadcnTokens,
          sourceJobId,
        })
        result.metrics.persistenceTime = Date.now() - persistenceStart
        result.shadcnTokens = shadcnTokens
        result.persistedId = persistedDesignSystem.id
        result.metrics.confidence = shadcnTokens.extraction.confidence
        result.metrics.tokensExtracted = Object.keys(shadcnTokens.variables).length
      } else {
        // LEGACY FORMAT: Store full design system object
        const persistedDesignSystem = await this.repository.createFromCaptured(
          websiteId,
          capturedDesignSystem,
          sourceJobId,
          concept.id
        )
        result.metrics.persistenceTime = Date.now() - persistenceStart
        result.designSystem = capturedDesignSystem
        result.persistedId = persistedDesignSystem.id
      }

      result.success = true

      invalidateImportRelatedCaches(websiteId, sourceJobId, concept.id)

      result.metrics.totalTime = Date.now() - startTime

      await this.telemetry.recordExtractionComplete(
        websiteId,
        result,
        result.metrics.totalTime,
        sourceJobId
      )

      return result
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      if (!result.errors.includes(message)) {
        result.errors.push(message)
      }
      result.metrics.totalTime = Date.now() - startTime

      await this.telemetry.recordExtractionError(
        websiteId,
        message,
        result.metrics.totalTime,
        sourceJobId
      )

      console.error('Design system processing error:', error)
      throw error instanceof Error ? error : new Error(message)
    }
  }

  /**
   * Get the latest design system for a website
   */
  async getLatestDesignSystem(
    websiteId: string,
    designConceptId?: string
  ): Promise<DesignSystem | null> {
    const designSystemEntity = await this.repository.findLatestByWebsiteId(websiteId, designConceptId)
    return designSystemEntity ? (designSystemEntity.tokens as unknown as DesignSystem) : null
  }

  /**
   * Get the latest design system entity for a website (includes ID)
   */
  async getLatestDesignSystemEntity(websiteId: string, designConceptId?: string) {
    return this.repository.findLatestByWebsiteId(websiteId, designConceptId)
  }

  /**
   * Update an existing design system
   */
  async updateDesignSystem(
    designSystemId: string,
    tokens: DesignSystem,
    websiteId?: string
  ): Promise<boolean> {
    try {
      await this.repository.update(designSystemId, { tokens })

      // Invalidate cache if websiteId is provided
      if (websiteId) {
        invalidateImportRelatedCaches(websiteId)
      }

      return true
    } catch (error) {
      console.error('Failed to update design system:', error)
      return false
    }
  }

  /**
   * Create design system from provided design system data
   */
  async createFromDesignSystem(
    websiteId: string,
    designSystem: DesignSystem,
    sourceJobId?: string
  ): Promise<string | null> {
    try {
      const concept = await this.ensureDefaultConcept(websiteId)
      const persistedDesignSystem = await this.repository.createFromCaptured(
        websiteId,
        {
          designSystem,
          rawData: { cssVariables: {}, literals: { colors: [], fonts: [] } },
          processingStats: { totalStylesheets: 0, totalInlineStyles: 0, extractionTime: 0, llmCalls: 0, cacheHits: 0 }
        },
        sourceJobId,
        concept.id
      )

      // Invalidate cache after creating new design system
      invalidateImportRelatedCaches(websiteId, sourceJobId, concept.id)

      return persistedDesignSystem.id
    } catch (error) {
      console.error('Failed to create design system from provided data:', error)
      return null
    }
  }

  /**
   * Create or update design system with fallback branding data
   * This method extends the existing persistBranding functionality
   */
  async createFromBrandingData(
    websiteId: string,
    brandingData: {
      primaryColors?: string[]
      fonts?: string[]
      visualStyle?: string
    },
    sourceJobId?: string
  ): Promise<string | null> {
    try {
      // Create a minimal design system from branding data
      const fallbackDesignSystem: DesignSystem = {
        palette: {
          primary: (brandingData.primaryColors || ['#2563eb']).map((color, index) => ({
            value: color,
            name: `primary-${index + 1}`,
            confidence: 0.6,
            source: 'llm' as const,
            usageCount: 1,
            hex: color.startsWith('#') ? color : undefined
          })),
          secondary: [],
          accent: [],
          neutral: [],
          surface: [{ value: '#ffffff', name: 'surface-1', confidence: 0.6, source: 'llm' as const, usageCount: 1 }]
        },
        typography: {
          heading: (brandingData.fonts || ['Inter']).slice(0, 2).map((font, index) => ({
            fontFamily: font,
            name: `heading-${index + 1}`,
            confidence: 0.6,
            source: 'llm' as const,
            usageCount: 1
          })),
          body: (brandingData.fonts || ['Inter']).slice(2, 4).map((font, index) => ({
            fontFamily: font,
            name: `body-${index + 1}`,
            confidence: 0.6,
            source: 'llm' as const,
            usageCount: 1
          })),
          ui: (brandingData.fonts || ['Inter']).slice(0, 1).map((font, index) => ({
            fontFamily: font,
            name: `ui-${index + 1}`,
            confidence: 0.6,
            source: 'llm' as const,
            usageCount: 1
          }))
        },
        spacing: {
          name: 'spacing-scale',
          values: [
            { step: 1, value: 4, name: 'xs' },
            { step: 2, value: 8, name: 'sm' },
            { step: 3, value: 16, name: 'md' },
            { step: 4, value: 24, name: 'lg' },
            { step: 5, value: 32, name: 'xl' }
          ],
          unit: 'px',
          base: 4,
          confidence: 0.4,
          source: 'inferred' as const
        },
        radii: {
          name: 'border-radius-scale',
          values: [
            { step: 1, value: 0, name: 'none' },
            { step: 2, value: 4, name: 'sm' },
            { step: 3, value: 8, name: 'md' },
            { step: 4, value: 12, name: 'lg' }
          ],
          unit: 'px',
          confidence: 0.4,
          source: 'inferred' as const
        },
        shadows: [],
        effects: [],
        metadata: {
          sourceUrls: [],
          capturedAt: new Date().toISOString(),
          confidence: 0.6,
          extractionMethod: 'deterministic',
          version: '1.0.0'
        },
        diagnostics: [],
        version: '1.0.0'
      }

      const concept = await this.ensureDefaultConcept(websiteId)
      const persistedDesignSystem = await this.repository.createFromCaptured(
        websiteId,
        { designSystem: fallbackDesignSystem, rawData: { cssVariables: {}, literals: { colors: [], fonts: [] } }, processingStats: { totalStylesheets: 0, totalInlineStyles: 0, extractionTime: 0, llmCalls: 0, cacheHits: 0 } },
        sourceJobId,
        concept.id
      )

      // Invalidate cache after creating new design system
      invalidateImportRelatedCaches(websiteId, sourceJobId, concept.id)

      return persistedDesignSystem.id
    } catch (error) {
      console.error('Failed to create design system from branding data:', error)
      return null
    }
  }

  /**
   * Get design system with processing statistics
   */
  async getDesignSystemWithStats(websiteId: string): Promise<{
    designSystem: DesignSystem | null
    statistics: {
      totalVersions: number
      latestVersion: string
      createdAt: string | null
      processingStats: any
    }
  }> {
    const designSystems = await this.repository.findMany({ websiteId, orderBy: 'createdAt', orderDirection: 'desc' })
    const latest = designSystems[0]

    return {
      designSystem: latest ? (latest.tokens as unknown as DesignSystem) : null,
      statistics: {
        totalVersions: designSystems.length,
        latestVersion: latest?.version || '1.0.0',
        createdAt: latest?.createdAt?.toISOString() || null,
        processingStats: latest ? { /* TODO: Extract from tokens metadata */ } : null
      }
    }
  }

  /**
   * Delete design system by website ID
   */
  async deleteDesignSystem(websiteId: string): Promise<boolean> {
    try {
      await this.repository.deleteByWebsiteId(websiteId)
      return true
    } catch (error) {
      console.error('Failed to delete design system:', error)
      return false
    }
  }

  /**
   * Check if website has design system
   */
  async hasDesignSystem(websiteId: string): Promise<boolean> {
    return this.repository.existsByWebsiteId(websiteId)
  }

  /**
   * Count total tokens in a design system
   */
  private countTokens(designSystem: DesignSystem): number {
    let count = 0

    // Count color tokens
    Object.values(designSystem.palette).forEach(colors => {
      count += colors.length
    })

    // Count typography tokens
    Object.values(designSystem.typography).forEach(fonts => {
      count += fonts.length
    })

    // Count spacing tokens
    count += designSystem.spacing.values.length

    // Count radii tokens
    count += designSystem.radii.values.length

    // Count shadows and effects
    count += designSystem.shadows.length + designSystem.effects.length

    return count
  }

  private shouldRunEvaluation(baselineKey?: string): boolean {
    if (!baselineKey) {
      return false
    }
    return shouldRunDomProbeEvaluation()
  }

  private updateDomProbeMetadata(
    captured: CapturedDesignSystem,
    probeCapture: CaptureDesignSystemResult,
    evidence?: DomProbeEvidenceLinks
  ): void {
    const metadata = captured.designSystem.metadata
    const domProbe = metadata.domProbe ?? {
      runId: probeCapture.metadata.runId,
      baseline: probeCapture.metadata.baseline,
      targetUrl: probeCapture.capture.metadata.url,
      captureDurationMs: probeCapture.capture.metadata.captureDurationMs
    }

    domProbe.runId = probeCapture.metadata.runId
    domProbe.baseline = probeCapture.metadata.baseline
    domProbe.targetUrl = probeCapture.capture.metadata.url
    domProbe.captureDurationMs = probeCapture.capture.metadata.captureDurationMs

    if (probeCapture.evaluation) {
      const summary = probeCapture.evaluation.summary
      domProbe.evaluation = {
        overall: summary.overall ?? null,
        paletteAgreement: summary.palette?.agreementRatio ?? null,
        typographyMatched: summary.typography?.matched ?? null,
        spacingPassed: summary.spacing?.passed ?? null
      }
    }

    if (evidence) {
      const mapLink = (
        link?: DomProbeEvidenceLinks['captureJson']
      ) => (link ? { key: link.key, url: link.url ?? null, checksum: link.checksum } : undefined)
      domProbe.storageBaseKey = evidence.baseKey
      domProbe.evidence = {
        captureJson: mapLink(evidence.captureJson),
        manifestJson: mapLink(evidence.manifestJson),
        manifestMarkdown: mapLink(evidence.manifestMarkdown),
        runLog: mapLink(evidence.runLog),
        domSnapshot: mapLink(evidence.domSnapshot),
        diffReports: evidence.diffReport ? [mapLink(evidence.diffReport)!] : undefined,
        screenshots: evidence.screenshots
          ?.map(screenshot => mapLink(screenshot))
          .filter((entry): entry is NonNullable<ReturnType<typeof mapLink>> => Boolean(entry))
      }
    }

    metadata.domProbe = domProbe
  }

  private applyDesignSystemDiagnostics(
    captured: CapturedDesignSystem,
    result: DesignSystemProcessingResult
  ): void {
    const diagnostics: DiagnosticEntry[] = [
      ...(captured.designSystem.diagnostics ?? []),
      ...(captured.designSystem.aliases?.diagnostics ?? [])
    ]

    diagnostics.forEach(diagnostic => {
      const entry = `${diagnostic.code}: ${diagnostic.message}`
      if (diagnostic.type === 'error') {
        result.errors.push(entry)
      } else {
        result.warnings.push(entry)
      }
    })
  }

  private async captureWithDomProbe(
    input: ProcessDesignSystemInput,
    baselineKey?: string
  ): Promise<CaptureDesignSystemResult> {
    const targetUrl =
      input.importUrl ??
      input.detectionResults.find(result => result.pageUrl)?.pageUrl ??
      input.detectionResults[0]?.pageUrl

    if (!targetUrl) {
      throw new Error('Unable to determine target URL for DOM probe capture')
    }

    const resolvedBaselineKey = baselineKey ?? input.baselineKey ?? getDomProbeBaselineKey()
    const evaluationEnabled = this.shouldRunEvaluation(resolvedBaselineKey)

    return this.domProbeService.captureDesignSystem({
      websiteId: input.websiteId,
      targetUrl,
      baselineKey: resolvedBaselineKey,
      jobId: input.sourceJobId,
      refresh: true,
      evaluation: evaluationEnabled
    })
  }

  /**
   * Validate design system structure
   */
  private validateDesignSystem(designSystem: DesignSystem): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    if (!designSystem.palette) {
      errors.push('Palette is required')
    } else {
      if (!designSystem.palette.primary || designSystem.palette.primary.length === 0) {
        errors.push('Primary palette must have at least one color')
      }
    }

    if (!designSystem.typography) {
      errors.push('Typography is required')
    } else {
      if (!designSystem.typography.heading || designSystem.typography.heading.length === 0) {
        errors.push('Typography must have at least one heading font')
      }
    }

    if (!designSystem.metadata) {
      errors.push('Metadata is required')
    }

    if (!designSystem.version) {
      errors.push('Version is required')
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  /**
   * Get repository for advanced operations
   */
  getRepository(): DesignSystemRepository {
    return this.repository
  }

  async persistConceptDesignSystem(
    websiteId: string,
    conceptId: string,
    tokens: DesignSystem
  ): Promise<string> {
    const concept = await this.conceptRepository.findById(conceptId)
    if (!concept || concept.websiteId !== websiteId) {
      throw new Error('Design concept not found for website')
    }

    const persisted = await this.repository.create({
      websiteId,
      designConceptId: conceptId,
      tokens,
      markPreviousInactive: true
    })

    invalidateImportRelatedCaches(websiteId, undefined, conceptId)
    return persisted.id
  }

  private async ensureDefaultConcept(websiteId: string): Promise<WebsiteDesignConcept> {
    const existing = await this.conceptRepository.findDefault(websiteId)
    if (existing) {
      return existing
    }

    return this.conceptRepository.create({
      websiteId,
      name: 'Design Concept 1',
      slug: 'design-concept-1',
      isDefault: true,
      position: 0
    })
  }

  /**
   * Get CSS variables from a website's design system (handles both old and new formats)
   *
   * This is the primary method for retrieving design system CSS variables for export.
   * It works with both the legacy DesignSystem format and the new ShadcnDesignSystemTokens format.
   */
  async getCssVariables(
    websiteId: string,
    designConceptId?: string
  ): Promise<Record<string, string>> {
    const entity = await this.repository.findLatestByWebsiteId(websiteId, designConceptId)
    if (!entity) {
      // Return defaults if no design system exists
      const { SHADCN_DEFAULTS } = await import('@/lib/studio/design-system/shadcn-defaults')
      return { ...SHADCN_DEFAULTS }
    }
    return getDesignSystemVariables(entity.tokens)
  }

  /**
   * Get normalized design system tokens (converts any format to new ShadcnDesignSystemTokens)
   */
  async getNormalizedTokens(
    websiteId: string,
    designConceptId?: string
  ): Promise<ShadcnDesignSystemTokens> {
    const entity = await this.repository.findLatestByWebsiteId(websiteId, designConceptId)
    if (!entity) {
      const { SHADCN_DEFAULTS } = await import('@/lib/studio/design-system/shadcn-defaults')
      return {
        variables: { ...SHADCN_DEFAULTS },
        extraction: {
          timestamp: new Date().toISOString(),
          confidence: 0,
          source: 'default',
          detectedCount: 0,
          defaultCount: Object.keys(SHADCN_DEFAULTS).length,
        },
      }
    }
    return getNormalizedDesignSystem(entity.tokens)
  }

  /**
   * Create design system using new simplified format
   *
   * This stores design systems in the new ShadcnDesignSystemTokens format
   * which contains CSS variables directly, without the complex intermediate structure.
   */
  async createFromShadcnTokens(
    websiteId: string,
    tokens: ShadcnDesignSystemTokens,
    sourceJobId?: string
  ): Promise<string | null> {
    try {
      const concept = await this.ensureDefaultConcept(websiteId)
      const persisted = await this.repository.createFromShadcnTokens({
        websiteId,
        designConceptId: concept.id,
        tokens,
        sourceJobId,
      })

      invalidateImportRelatedCaches(websiteId, sourceJobId, concept.id)
      return persisted.id
    } catch (error) {
      console.error('Failed to create design system from shadcn tokens:', error)
      return null
    }
  }
}
