/**
 * Telemetry Storage Implementation
 *
 * Database-backed storage for design system telemetry events.
 * Provides event recording, metrics calculation, and cleanup functionality.
 *
 * @module telemetry-storage
 */

import { PrismaClient } from '@/lib/generated/prisma'
import type { TelemetryEvent, DesignSystemMetrics, TelemetryStorage as ITelemetryStorage } from './design-system-telemetry'

export class DatabaseTelemetryStorage implements ITelemetryStorage {
  private prisma: PrismaClient

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma || new PrismaClient()
  }

  private normalizeEvents(rawEvents: any[]): TelemetryEvent[] {
    if (!Array.isArray(rawEvents)) {
      return []
    }

    return rawEvents
      .map(raw => {
        if (!raw) return null

        const timestampValue = raw.timestamp
        if (!timestampValue) return null

        const timestamp =
          timestampValue instanceof Date ? timestampValue : new Date(timestampValue)

        if (!(timestamp instanceof Date) || Number.isNaN(timestamp.getTime())) {
          return null
        }

        return {
          ...raw,
          timestamp
        } as TelemetryEvent
      })
      .filter((event): event is TelemetryEvent => event !== null)
  }

  /**
   * Record a telemetry event
   */
  async recordEvent(event: TelemetryEvent): Promise<void> {
    try {
      // Store in website settings for now - could be moved to a dedicated telemetry table later
      const website = await this.prisma.website.findUnique({
        where: { id: event.websiteId },
        select: { settings: true }
      })

      if (!website) {
        console.warn(`Telemetry event received for unknown website ${event.websiteId}`)
        return
      }

      const existingSettings = (website.settings as Record<string, any> | null) ?? {}
      const legacyKeys = ['designSystemExtractorTelemetry', 'designSystemTelemetryLegacy']
      const archiveKey = 'designSystemTelemetryArchive'
      let archivedLegacyEvents: TelemetryEvent[] = []

      for (const key of legacyKeys) {
        const legacyEvents = existingSettings[key]
        if (Array.isArray(legacyEvents) && legacyEvents.length > 0) {
          archivedLegacyEvents = archivedLegacyEvents.concat(this.normalizeEvents(legacyEvents))
        }
        if (key in existingSettings) {
          delete existingSettings[key]
        }
      }

      if (archivedLegacyEvents.length > 0) {
        const archive = Array.isArray(existingSettings[archiveKey])
          ? this.normalizeEvents(existingSettings[archiveKey] as any[])
          : []
        existingSettings[archiveKey] = [...archive, ...archivedLegacyEvents].slice(-2000)
      }

      const telemetryEvents = Array.isArray(existingSettings.designSystemTelemetry)
        ? [...existingSettings.designSystemTelemetry]
        : []

      telemetryEvents.push(event)

      // Keep only last 1000 events per website
      const limitedEvents = telemetryEvents.slice(-1000)

      await this.prisma.website.update({
        where: { id: event.websiteId },
        data: {
          settings: {
            ...existingSettings,
            designSystemTelemetry: limitedEvents
          }
        }
      })
    } catch (error) {
      console.error('Failed to record telemetry event:', error)
    }
  }

  /**
   * Get metrics for a time range
   */
  async getMetrics(timeRange?: { start: Date; end: Date }): Promise<DesignSystemMetrics> {
    try {
      // Get all websites with design systems
      const websites = await this.prisma.website.findMany({
        where: {
          settings: {
            not: undefined
          }
        },
        select: {
          id: true,
          settings: true
        }
      })

      const allEvents: TelemetryEvent[] = []

      // Collect all events from all websites
      for (const website of websites) {
        const settings = website.settings as any
        const events = this.normalizeEvents(settings.designSystemTelemetry || [])

        const filteredEvents = timeRange
          ? events.filter(event => event.timestamp >= timeRange.start && event.timestamp <= timeRange.end)
          : events

        allEvents.push(...filteredEvents)
      }

      // Calculate metrics from events
      return this.calculateMetricsFromEvents(allEvents)

    } catch (error) {
      console.error('Failed to get metrics:', error)
      return this.getEmptyMetrics()
    }
  }

  /**
   * Get events with optional filters
   */
  async getEvents(filters?: {
    websiteId?: string
    type?: string
    timeRange?: { start: Date; end: Date }
  }): Promise<TelemetryEvent[]> {
    try {
      if (filters?.websiteId) {
        // Get events for specific website
        const website = await this.prisma.website.findUnique({
          where: { id: filters.websiteId },
          select: { settings: true }
        })

        if (website?.settings) {
          const settings = website.settings as any
          let events = this.normalizeEvents(settings.designSystemTelemetry || [])

          if (filters?.type) {
            events = events.filter(event => event.type === filters.type)
          }

          if (filters?.timeRange) {
            events = events.filter(event =>
              event.timestamp >= filters.timeRange!.start && event.timestamp <= filters.timeRange!.end)
          }

          return events
        }
      } else {
        // Get events from all websites
        const websites = await this.prisma.website.findMany({
          where: {
            settings: {
              not: undefined
            }
          },
          select: {
            id: true,
            settings: true
          }
        })

        const allEvents: TelemetryEvent[] = []

        for (const website of websites) {
          const settings = website.settings as any
          let events = this.normalizeEvents(settings.designSystemTelemetry || [])

          if (filters?.type) {
            events = events.filter(event => event.type === filters.type)
          }

          if (filters?.timeRange) {
            events = events.filter(event =>
              event.timestamp >= filters.timeRange!.start && event.timestamp <= filters.timeRange!.end)
          }

          allEvents.push(...events)
        }

        return allEvents
      }

      return []

    } catch (error) {
      console.error('Failed to get events:', error)
      return []
    }
  }

  /**
   * Clear old events
   */
  async clearOldEvents(olderThan: Date): Promise<number> {
    try {
      const websites = await this.prisma.website.findMany({
        where: {
          settings: {
            not: undefined
          }
        },
        select: {
          id: true,
          settings: true
        }
      })

      let totalCleared = 0

      for (const website of websites) {
        const settings = website.settings as any
        const events = this.normalizeEvents(settings.designSystemTelemetry || [])
        const recentEvents = events.filter(event => event.timestamp >= olderThan)

        const clearedCount = events.length - recentEvents.length
        totalCleared += clearedCount

        if (clearedCount > 0) {
          await this.prisma.website.update({
            where: { id: website.id },
            data: {
              settings: {
                ...settings,
                designSystemTelemetry: recentEvents
              }
            }
          })
        }
      }

      return totalCleared

    } catch (error) {
      console.error('Failed to clear old events:', error)
      return 0
    }
  }

  /**
   * Get metrics for a specific website
   */
  async getWebsiteMetrics(websiteId: string, timeRange?: { start: Date; end: Date }): Promise<DesignSystemMetrics> {
    try {
      const website = await this.prisma.website.findUnique({
        where: { id: websiteId },
        select: { settings: true }
      })

      if (!website?.settings) {
        return this.getEmptyMetrics()
      }

      const settings = website.settings as any
      let events = this.normalizeEvents(settings.designSystemTelemetry || [])

      if (timeRange) {
        events = events.filter(event =>
          event.timestamp >= timeRange.start && event.timestamp <= timeRange.end)
      }

      return this.calculateMetricsFromEvents(events)

    } catch (error) {
      console.error('Failed to get website metrics:', error)
      return this.getEmptyMetrics()
    }
  }

  /**
   * Get daily activity summary
   */
  async getDailyActivitySummary(days: number = 30): Promise<Array<{
    date: string
    extractions: number
    overrides: number
    errors: number
  }>> {
    try {
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - days)

      const events = await this.getEvents({
        timeRange: { start: startDate, end: new Date() }
      })

      const dailySummary = new Map<string, {
        extractions: number
        overrides: number
        errors: number
      }>()

      for (const event of events) {
        const date = event.timestamp.toISOString().split('T')[0]
        const summary = dailySummary.get(date) || {
          extractions: 0,
          overrides: 0,
          errors: 0
        }

        switch (event.type) {
          case 'extraction_complete':
            summary.extractions++
            break
          case 'override_applied':
            summary.overrides++
            break
          case 'extraction_error':
            summary.errors++
            break
        }

        dailySummary.set(date, summary)
      }

      // Convert to array and sort by date
      return Array.from(dailySummary.entries())
        .map(([date, summary]) => ({ date, ...summary }))
        .sort((a, b) => a.date.localeCompare(b.date))

    } catch (error) {
      console.error('Failed to get daily activity summary:', error)
      return []
    }
  }

  /**
   * Calculate metrics from events
   */
  private calculateMetricsFromEvents(events: TelemetryEvent[]): DesignSystemMetrics {
    const extractionMetrics = this.calculateExtractionMetrics(events)
    const overrideMetrics = this.calculateOverrideMetrics(events)
    const performanceMetrics = this.calculatePerformanceMetrics(events)

    return {
      extraction: extractionMetrics,
      overrides: overrideMetrics,
      performance: performanceMetrics,
      usage: {
        websiteCount: 0, // Would need separate query
        activeDesignSystems: 0, // Would need separate query
        tokensInUse: 0, // Would need separate query
        popularTokens: [] // Would need separate query
      }
    }
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
   * Get empty metrics structure
   */
  private getEmptyMetrics(): DesignSystemMetrics {
    return {
      extraction: {
        totalExtractions: 0,
        successfulExtractions: 0,
        failedExtractions: 0,
        averageExtractionTime: 0,
        averageTokensExtracted: 0,
        averageConfidence: 0,
        extractionRateByHour: {}
      },
      overrides: {
        totalOverrides: 0,
        overridesByCategory: {},
        overridesReset: 0,
        backupCreations: 0,
        backupRestorations: 0
      },
      performance: {
        cacheHitRate: 0,
        averageResponseTime: 0,
        errorRate: 0,
        slowQueries: 0
      },
      usage: {
        websiteCount: 0,
        activeDesignSystems: 0,
        tokensInUse: 0,
        popularTokens: []
      }
    }
  }
}
