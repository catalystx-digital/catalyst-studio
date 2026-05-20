/**
 * Design System Telemetry
 *
 * Collects metrics and analytics for design system operations.
 * Tracks extraction performance, usage patterns, and system health.
 *
 * @module design-system-telemetry
 */

import type { DesignSystem, CapturedDesignSystem } from '@/lib/studio/import/types/design-system.types'
import type { DesignSystemProcessingResult } from '@/lib/studio/import/services/design-system-service'

export interface DesignSystemMetrics {
  extraction: {
    totalExtractions: number
    successfulExtractions: number
    failedExtractions: number
    averageExtractionTime: number
    averageTokensExtracted: number
    averageConfidence: number
    extractionRateByHour: Record<string, number>
  }
  overrides: {
    totalOverrides: number
    overridesByCategory: Record<string, number>
    overridesReset: number
    backupCreations: number
    backupRestorations: number
  }
  performance: {
    cacheHitRate: number
    averageResponseTime: number
    errorRate: number
    slowQueries: number
  }
  usage: {
    websiteCount: number
    activeDesignSystems: number
    tokensInUse: number
    popularTokens: Array<{
      category: string
      tokenName: string
      usageCount: number
    }>
  }
}

export interface TelemetryEvent {
  type:
    | 'extraction_start'
    | 'extraction_complete'
    | 'extraction_error'
    | 'override_applied'
    | 'override_reset'
    | 'backup_created'
    | 'backup_restored'
    | 'cache_hit'
    | 'cache_miss'
    | 'slow_query'
    | 'concept_created'
    | 'concept_deleted'
    | 'concept_shuffle'
  websiteId: string
  timestamp: Date
  data?: any
  userId?: string
  sessionId?: string
  duration?: number
  error?: string
}

export interface TelemetryStorage {
  recordEvent(event: TelemetryEvent): Promise<void>
  getMetrics(timeRange?: { start: Date; end: Date }): Promise<DesignSystemMetrics>
  getEvents(filters?: {
    websiteId?: string
    type?: string
    timeRange?: { start: Date; end: Date }
  }): Promise<TelemetryEvent[]>
  clearOldEvents(olderThan: Date): Promise<number>
}

export class DesignSystemTelemetry {
  private storage: TelemetryStorage

  constructor(storage: TelemetryStorage) {
    this.storage = storage
  }

  private serializeEvidenceLink(
    link?: {
      key: string
      url?: string | null
      checksum?: string
      size?: number
      contentType?: string
      etag?: string
    } | null
  ) {
    if (!link) return null
    return {
      key: link.key,
      url: link.url ?? null,
      checksum: link.checksum ?? null,
      size: link.size ?? null,
      contentType: link.contentType ?? null,
      etag: link.etag ?? null
    }
  }

  /**
   * Record extraction start
   */
  async recordExtractionStart(
    websiteId: string,
    userId?: string,
    sessionId?: string
  ): Promise<void> {
    await this.storage.recordEvent({
      type: 'extraction_start',
      websiteId,
      timestamp: new Date(),
      userId,
      sessionId
    })
  }

  /**
   * Record extraction completion
   */
  async recordExtractionComplete(
    websiteId: string,
    result: DesignSystemProcessingResult,
    duration: number,
    userId?: string,
    sessionId?: string
  ): Promise<void> {
    await this.storage.recordEvent({
      type: 'extraction_complete',
      websiteId,
      timestamp: new Date(),
      data: {
        success: result.success,
        tokensExtracted: result.metrics.tokensExtracted,
        confidence: result.metrics.confidence,
        warnings: result.warnings.length,
        errors: result.errors.length,
        aliasFallbacks: result.designSystem?.designSystem.aliases?.fallbackSummary ?? null,
        strategy: result.strategy,
        probe: result.probe
          ? {
              evaluationOverall: result.probe.evaluation?.summary.overall ?? null,
              paletteAgreement: result.probe.evaluation?.summary.palette.agreementRatio ?? null,
              typographyMatched: result.probe.evaluation?.summary.typography.matched ?? null,
              spacingPassed: result.probe.evaluation?.summary.spacing.passed ?? null,
              capturePath: result.probe.capturePath,
              manifestPath: result.probe.manifestPath,
              runDir: result.probe.runDir,
              evidence: result.probe.evidence
                ? {
                    baseKey: result.probe.evidence.baseKey,
                    capture: this.serializeEvidenceLink(result.probe.evidence.captureJson),
                    manifest: this.serializeEvidenceLink(result.probe.evidence.manifestJson),
                    manifestMarkdown: this.serializeEvidenceLink(result.probe.evidence.manifestMarkdown),
                    diff: this.serializeEvidenceLink(result.probe.evidence.diffReport),
                    runLog: this.serializeEvidenceLink(result.probe.evidence.runLog),
                    domSnapshot: this.serializeEvidenceLink(result.probe.evidence.domSnapshot),
                    screenshots: result.probe.evidence.screenshots.map(item => this.serializeEvidenceLink(item))
                  }
                : null,
              domProbeMetadata: result.designSystem?.designSystem.metadata.domProbe ?? null
            }
          : null
      },
      userId,
      sessionId,
      duration
    })
  }

  /**
   * Record extraction error
   */
  async recordExtractionError(
    websiteId: string,
    error: string,
    duration: number,
    userId?: string,
    sessionId?: string
  ): Promise<void> {
    await this.storage.recordEvent({
      type: 'extraction_error',
      websiteId,
      timestamp: new Date(),
      error,
      userId,
      sessionId,
      duration
    })
  }

  /**
   * Record token override application
   */
  async recordOverrideApplied(
    websiteId: string,
    category: string,
    tokenName: string,
    userId?: string,
    sessionId?: string
  ): Promise<void> {
    await this.storage.recordEvent({
      type: 'override_applied',
      websiteId,
      timestamp: new Date(),
      data: {
        category,
        tokenName
      },
      userId,
      sessionId
    })
  }

  /**
   * Record token override reset
   */
  async recordOverrideReset(
    websiteId: string,
    category: string,
    tokenName: string,
    userId?: string,
    sessionId?: string
  ): Promise<void> {
    await this.storage.recordEvent({
      type: 'override_reset',
      websiteId,
      timestamp: new Date(),
      data: {
        category,
        tokenName
      },
      userId,
      sessionId
    })
  }

  async recordConceptCreated(
    websiteId: string,
    conceptId: string,
    metadata: { duplicatePalette: boolean; generatorSeed?: string; totalConcepts: number }
  ): Promise<void> {
    await this.storage.recordEvent({
      type: 'concept_created',
      websiteId,
      timestamp: new Date(),
      data: {
        conceptId,
        ...metadata
      }
    })
  }

  async recordConceptDeleted(
    websiteId: string,
    conceptId: string,
    metadata: { remainingConcepts: number }
  ): Promise<void> {
    await this.storage.recordEvent({
      type: 'concept_deleted',
      websiteId,
      timestamp: new Date(),
      data: {
        conceptId,
        ...metadata
      }
    })
  }

  async recordConceptShuffle(
    websiteId: string,
    conceptId: string,
    metadata: { generatorSeed: string; deltaMetrics?: Record<string, number> }
  ): Promise<void> {
    await this.storage.recordEvent({
      type: 'concept_shuffle',
      websiteId,
      timestamp: new Date(),
      data: {
        conceptId,
        ...metadata
      }
    })
  }

  /**
   * Record backup creation
   */
  async recordBackupCreated(
    websiteId: string,
    reason?: string,
    userId?: string,
    sessionId?: string
  ): Promise<void> {
    await this.storage.recordEvent({
      type: 'backup_created',
      websiteId,
      timestamp: new Date(),
      data: {
        reason
      },
      userId,
      sessionId
    })
  }

  /**
   * Record backup restoration
   */
  async recordBackupRestored(
    websiteId: string,
    backupId: string,
    itemsRestored: number,
    userId?: string,
    sessionId?: string
  ): Promise<void> {
    await this.storage.recordEvent({
      type: 'backup_restored',
      websiteId,
      timestamp: new Date(),
      data: {
        backupId,
        itemsRestored
      },
      userId,
      sessionId
    })
  }

  /**
   * Record cache hit
   */
  async recordCacheHit(
    websiteId: string,
    cacheKey: string,
    duration: number
  ): Promise<void> {
    await this.storage.recordEvent({
      type: 'cache_hit',
      websiteId,
      timestamp: new Date(),
      data: {
        cacheKey
      },
      duration
    })
  }

  /**
   * Record cache miss
   */
  async recordCacheMiss(
    websiteId: string,
    cacheKey: string,
    duration: number
  ): Promise<void> {
    await this.storage.recordEvent({
      type: 'cache_miss',
      websiteId,
      timestamp: new Date(),
      data: {
        cacheKey
      },
      duration
    })
  }

  /**
   * Record slow query
   */
  async recordSlowQuery(
    websiteId: string,
    operation: string,
    duration: number,
    userId?: string,
    sessionId?: string
  ): Promise<void> {
    await this.storage.recordEvent({
      type: 'slow_query',
      websiteId,
      timestamp: new Date(),
      data: {
        operation,
        duration
      },
      userId,
      sessionId,
      duration
    })
  }

  /**
   * Get comprehensive metrics
   */
  async getMetrics(timeRange?: { start: Date; end: Date }): Promise<DesignSystemMetrics> {
    const events = await this.storage.getEvents(timeRange ? { timeRange } : undefined)

    return {
      extraction: this.calculateExtractionMetrics(events),
      overrides: this.calculateOverrideMetrics(events),
      performance: this.calculatePerformanceMetrics(events),
      usage: await this.calculateUsageMetrics(events)
    }
  }

  /**
   * Get extraction success rate
   */
  async getExtractionSuccessRate(timeRange?: { start: Date; end: Date }): Promise<number> {
    const events = await this.storage.getEvents({
      type: 'extraction_complete',
      timeRange
    })

    const extractionEvents = await this.storage.getEvents({
      type: 'extraction_error',
      timeRange
    })

    const totalExtractions = events.length + extractionEvents.length
    if (totalExtractions === 0) return 0

    return (events.length / totalExtractions) * 100
  }

  /**
   * Get most popular tokens
   */
  async getPopularTokens(limit: number = 10): Promise<Array<{
    category: string
    tokenName: string
    usageCount: number
  }>> {
    const overrideEvents = await this.storage.getEvents({
      type: 'override_applied'
    })

    const tokenUsage = new Map<string, { category: string; tokenName: string; count: number }>()

    for (const event of overrideEvents) {
      const { category, tokenName } = event.data || {}
      if (category && tokenName) {
        const key = `${category}.${tokenName}`
        const existing = tokenUsage.get(key) || { category, tokenName, count: 0 }
        existing.count++
        tokenUsage.set(key, existing)
      }
    }

    return Array.from(tokenUsage.values())
      .map(({ category, tokenName, count }) => ({ category, tokenName, usageCount: count }))
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, limit)
  }

  /**
   * Get hourly extraction activity
   */
  async getHourlyActivity(timeRange?: { start: Date; end: Date }): Promise<Record<string, number>> {
    const events = await this.storage.getEvents({
      type: 'extraction_complete',
      timeRange
    })

    const hourlyActivity: Record<string, number> = {}

    for (const event of events) {
      const hour = event.timestamp.getHours().toString().padStart(2, '0')
      hourlyActivity[hour] = (hourlyActivity[hour] || 0) + 1
    }

    return hourlyActivity
  }

  /**
   * Calculate extraction metrics
   */
  private calculateExtractionMetrics(events: TelemetryEvent[]): DesignSystemMetrics['extraction'] {
    const completeEvents = events.filter(e => e.type === 'extraction_complete')
    const errorEvents = events.filter(e => e.type === 'extraction_error')

    const totalExtractions = completeEvents.length + errorEvents.length
    const successfulExtractions = completeEvents.length
    const failedExtractions = errorEvents.length

    const averageExtractionTime = completeEvents.length > 0
      ? completeEvents.reduce((sum, event) => sum + (event.duration || 0), 0) / completeEvents.length
      : 0

    const averageTokensExtracted = completeEvents.length > 0
      ? completeEvents.reduce((sum, event) => sum + (event.data?.tokensExtracted || 0), 0) / completeEvents.length
      : 0

    const averageConfidence = completeEvents.length > 0
      ? completeEvents.reduce((sum, event) => sum + (event.data?.confidence || 0), 0) / completeEvents.length
      : 0

    const extractionRateByHour: Record<string, number> = {}
    for (const event of completeEvents) {
      const hour = event.timestamp.getHours().toString().padStart(2, '0')
      extractionRateByHour[hour] = (extractionRateByHour[hour] || 0) + 1
    }

    return {
      totalExtractions,
      successfulExtractions,
      failedExtractions,
      averageExtractionTime,
      averageTokensExtracted,
      averageConfidence,
      extractionRateByHour
    }
  }

  /**
   * Calculate override metrics
   */
  private calculateOverrideMetrics(events: TelemetryEvent[]): DesignSystemMetrics['overrides'] {
    const overrideEvents = events.filter(e => e.type === 'override_applied')
    const resetEvents = events.filter(e => e.type === 'override_reset')
    const backupEvents = events.filter(e => e.type === 'backup_created')
    const restoreEvents = events.filter(e => e.type === 'backup_restored')

    const overridesByCategory: Record<string, number> = {}
    for (const event of overrideEvents) {
      const category = event.data?.category || 'unknown'
      overridesByCategory[category] = (overridesByCategory[category] || 0) + 1
    }

    return {
      totalOverrides: overrideEvents.length,
      overridesByCategory,
      overridesReset: resetEvents.length,
      backupCreations: backupEvents.length,
      backupRestorations: restoreEvents.length
    }
  }

  /**
   * Calculate performance metrics
   */
  private calculatePerformanceMetrics(events: TelemetryEvent[]): DesignSystemMetrics['performance'] {
    const cacheEvents = events.filter(e => e.type === 'cache_hit' || e.type === 'cache_miss')
    const slowQueryEvents = events.filter(e => e.type === 'slow_query')

    const cacheHits = cacheEvents.filter(e => e.type === 'cache_hit').length
    const cacheMisses = cacheEvents.filter(e => e.type === 'cache_miss').length
    const cacheHitRate = cacheEvents.length > 0 ? (cacheHits / cacheEvents.length) * 100 : 0

    const averageResponseTime = events.length > 0
      ? events.reduce((sum, event) => sum + (event.duration || 0), 0) / events.length
      : 0

    const errorEvents = events.filter(e => e.type === 'extraction_error')
    const errorRate = events.length > 0 ? (errorEvents.length / events.length) * 100 : 0

    return {
      cacheHitRate,
      averageResponseTime,
      errorRate,
      slowQueries: slowQueryEvents.length
    }
  }

  /**
   * Calculate usage metrics
   */
  private async calculateUsageMetrics(events: TelemetryEvent[]): Promise<DesignSystemMetrics['usage']> {
    // This would typically query the database for current usage
    // For now, return placeholder data
    return {
      websiteCount: 0,
      activeDesignSystems: 0,
      tokensInUse: 0,
      popularTokens: []
    }
  }
}
