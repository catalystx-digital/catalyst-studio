/**
 * API Route: Design System Telemetry
 *
 * Provides access to design system telemetry and metrics.
 * Admin-only endpoint for monitoring system performance and usage.
 *
 * @module telemetry-api
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { DesignSystemTelemetry } from '@/lib/studio/telemetry/design-system-telemetry'
import { DatabaseTelemetryStorage } from '@/lib/studio/telemetry/telemetry-storage'
import { addCachingHeaders } from '@/lib/studio/design-system/cache-utils.server'
import { getAuthContext } from '@/lib/auth/context'

/**
 * GET /api/admin/telemetry/design-system
 *
 * Get design system metrics and telemetry data
 */
export async function GET(request: NextRequest) {
  // Auth check - always required
  try {
    await getAuthContext(request)
  } catch {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    const { searchParams } = new URL(request.url)
    const timeRange = searchParams.get('timeRange')
    const websiteId = searchParams.get('websiteId')
    const type = searchParams.get('type') // 'overview', 'extraction', 'overrides', 'performance'

    const telemetryStorage = new DatabaseTelemetryStorage(prisma)
    const telemetry = new DesignSystemTelemetry(telemetryStorage)

    let timeRangeFilter: { start: Date; end: Date } | undefined

    if (timeRange) {
      const now = new Date()
      const ranges: Record<string, { start: Date; end: Date }> = {
        '24h': { start: new Date(now.getTime() - 24 * 60 * 60 * 1000), end: now },
        '7d': { start: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), end: now },
        '30d': { start: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), end: now },
        '90d': { start: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000), end: now }
      }

      timeRangeFilter = ranges[timeRange]
    }

    let data: any

    switch (type) {
      case 'overview':
        data = await telemetry.getMetrics(timeRangeFilter)
        break

      case 'extraction':
        const extractionMetrics = await telemetry.getMetrics(timeRangeFilter)
        const successRate = await telemetry.getExtractionSuccessRate(timeRangeFilter)
        const hourlyActivity = await telemetry.getHourlyActivity(timeRangeFilter)
        data = {
          ...extractionMetrics.extraction,
          successRate,
          hourlyActivity
        }
        break

      case 'overrides':
        const overrideMetrics = await telemetry.getMetrics(timeRangeFilter)
        const popularTokens = await telemetry.getPopularTokens(20)
        data = {
          ...overrideMetrics.overrides,
          popularTokens
        }
        break

      case 'performance':
        const performanceMetrics = await telemetry.getMetrics(timeRangeFilter)
        data = performanceMetrics.performance
        break

      case 'daily-activity':
        const days = parseInt(searchParams.get('days') || '30')
        data = await telemetryStorage.getDailyActivitySummary(days)
        break

      default:
        data = await telemetry.getMetrics(timeRangeFilter)
    }

    const response = NextResponse.json({
      success: true,
      data: {
        metrics: data,
        timeRange: timeRange || 'all',
        websiteId: websiteId || 'all',
        generatedAt: new Date().toISOString()
      }
    })

    // Add caching headers for telemetry data
    return addCachingHeaders(response, 'telemetry', 300) // 5 minutes cache

  } catch (error) {
    console.error('Failed to get design system telemetry:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get design system telemetry',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/telemetry/design-system/cleanup
 *
 * Clean up old telemetry events
 */
export async function POST(request: NextRequest) {
  // Auth check - always required
  try {
    await getAuthContext(request)
  } catch {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    const body = await request.json()
    const { olderThanDays = 90 } = body

    const telemetryStorage = new DatabaseTelemetryStorage(prisma)
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays)

    const clearedCount = await telemetryStorage.clearOldEvents(cutoffDate)

    const response = NextResponse.json({
      success: true,
      data: {
        clearedCount,
        cutoffDate: cutoffDate.toISOString(),
        olderThanDays
      }
    })

    return addCachingHeaders(response, 'telemetry', 60) // 1 minute cache

  } catch (error) {
    console.error('Failed to cleanup telemetry events:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to cleanup telemetry events',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
