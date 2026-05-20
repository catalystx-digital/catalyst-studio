import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@/lib/generated/prisma'
import { prisma } from '@/lib/prisma'
import { ApiError } from '@/lib/api/errors'
import { getAuthContext } from '@/lib/auth/context'
import { ReImportService } from '@/lib/studio/import/services/reimport-service'
import { ImportPipeline } from '@/lib/studio/import/import-pipeline'
import { ReImportConfig } from '@/lib/studio/import/config'
import type { ReImportResult } from '@/lib/studio/import/types/reimport.types'

/**
 * POST /api/studio/import/reimport
 *
 * Re-import one or more pages for an existing website.
 *
 * Request body:
 * {
 *   websiteId: string;        // Required - target website ID
 *   urls: string[];           // Required - URLs to re-import
 *   options?: {
 *     preserveCustomizations?: boolean;  // Keep local edits (default: false)
 *     skipDesignSystem?: boolean;        // Skip design token update (default: true)
 *     skipSharedComponents?: boolean;    // Skip shared component detection (default: false)
 *     createIfNotExists?: boolean;       // Create page if not found (default: true)
 *   };
 * }
 *
 * Response:
 * {
 *   jobId: string;
 *   status: 'processing' | 'completed' | 'failed';
 *   results: PageReImportResult[];
 *   summary: ReImportSummary;
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { websiteId, urls, options = {} } = body as {
      websiteId?: string
      urls?: string[]
      options?: {
        preserveCustomizations?: boolean
        skipDesignSystem?: boolean
        skipSharedComponents?: boolean
        createIfNotExists?: boolean
      }
    }

    // Validate required fields
    if (!websiteId) {
      return NextResponse.json(
        { error: 'websiteId is required' },
        { status: 400 }
      )
    }

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json(
        { error: 'urls is required and must be a non-empty array' },
        { status: 400 }
      )
    }

    // Validate max URLs per request
    if (urls.length > ReImportConfig.maxUrlsPerRequest) {
      return NextResponse.json(
        { error: `Too many URLs. Maximum ${ReImportConfig.maxUrlsPerRequest} URLs per request.` },
        { status: 400 }
      )
    }

    // Validate URL format
    for (const url of urls) {
      try {
        const urlObj = new URL(url)

        if (!['http:', 'https:'].includes(urlObj.protocol)) {
          return NextResponse.json(
            { error: `Invalid URL protocol for ${url}. Must be HTTP or HTTPS.` },
            { status: 400 }
          )
        }

        const hostname = urlObj.hostname.toLowerCase()
        if (
          hostname === 'localhost' ||
          hostname === '127.0.0.1' ||
          hostname.startsWith('192.168.') ||
          hostname.startsWith('10.') ||
          hostname.startsWith('172.')
        ) {
          return NextResponse.json(
            { error: `Cannot import from localhost or internal IP addresses: ${url}` },
            { status: 400 }
          )
        }
      } catch {
        return NextResponse.json(
          { error: `Invalid URL format: ${url}` },
          { status: 400 }
        )
      }
    }

    // Authenticate and authorize
    const auth = await getAuthContext(request)

    // Verify website exists and belongs to account
    const website = await prisma.website.findUnique({
      where: { id: websiteId },
      select: { id: true, accountId: true, name: true }
    })

    if (!website) {
      return NextResponse.json(
        { error: 'Website not found' },
        { status: 404 }
      )
    }

    if (website.accountId !== auth.accountId) {
      return NextResponse.json(
        { error: 'You do not have permission to access this website' },
        { status: 403 }
      )
    }

    // Validate OpenRouter API key
    const openRouterApiKey = process.env.OPENROUTER_API_KEY
    if (!openRouterApiKey) {
      return NextResponse.json(
        { error: 'Import service not configured. Please contact support.' },
        { status: 500 }
      )
    }

    // Create re-import service
    const importPipeline = new ImportPipeline()
    const reimportService = new ReImportService({
      prisma,
      importPipeline
    })

    // Generate a job ID for tracking
    const jobId = `reimport-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    // Execute re-import
    // For small batches, execute synchronously
    // For large batches (>10 URLs), could implement async job processing
    const result: ReImportResult = await reimportService.reimport({
      websiteId,
      urls,
      preserveCustomizations: options.preserveCustomizations,
      skipDesignSystem: options.skipDesignSystem,
      skipSharedComponents: options.skipSharedComponents,
      createIfNotExists: options.createIfNotExists,
      jobId,
      enableCheckpoint: urls.length > 5 // Enable checkpoint for larger batches
    })

    return NextResponse.json({
      jobId,
      status: result.success ? 'completed' : 'failed',
      results: result.results,
      summary: result.summary,
      warnings: result.warnings,
      processingTimeMs: result.processingTimeMs
    })

  } catch (error) {
    console.error('Error in re-import:', error)

    if (error instanceof ApiError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      )
    }

    const message = error instanceof Error ? error.message : 'Failed to re-import pages'

    if (message.toLowerCase().includes('rate limit')) {
      return NextResponse.json(
        { error: 'Re-import temporarily unavailable. Please try again in a few minutes.' },
        { status: 429 }
      )
    }

    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}

/**
 * GET /api/studio/import/reimport?websiteId=xxx&pageId=yyy
 *
 * Get re-import status for a page or list available pages to re-import
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const websiteId = searchParams.get('websiteId')
    const pageId = searchParams.get('pageId')

    if (!websiteId) {
      return NextResponse.json(
        { error: 'websiteId is required' },
        { status: 400 }
      )
    }

    // Authenticate
    const auth = await getAuthContext(request)

    // Verify website access
    const website = await prisma.website.findUnique({
      where: { id: websiteId },
      select: { id: true, accountId: true }
    })

    if (!website || website.accountId !== auth.accountId) {
      return NextResponse.json(
        { error: 'Website not found' },
        { status: 404 }
      )
    }

    if (pageId) {
      // Get specific page re-import info
      const page = await prisma.websitePage.findUnique({
        where: { id: pageId },
        select: {
          id: true,
          title: true,
          status: true,
          metadata: true,
          updatedAt: true
        }
      })

      if (!page) {
        return NextResponse.json(
          { error: 'Page not found' },
          { status: 404 }
        )
      }

      const metadata = page.metadata as Record<string, unknown> | null

      return NextResponse.json({
        pageId: page.id,
        title: page.title,
        status: page.status,
        importSource: metadata?.importSource,
        lastReimportedAt: metadata?.lastReimportedAt,
        reimportHistory: metadata?.reimportHistory || [],
        sourceNotFoundAt: metadata?.sourceNotFoundAt,
        sourceMovedTo: metadata?.sourceMovedTo
      })
    }

    // List pages that can be re-imported (have import source)
    const pages = await prisma.websitePage.findMany({
      where: {
        websiteId,
        metadata: {
          path: ['importSource'],
          not: Prisma.JsonNull
        }
      },
      select: {
        id: true,
        title: true,
        status: true,
        metadata: true,
        updatedAt: true
      },
      orderBy: { updatedAt: 'desc' }
    })

    const reimportablePages = pages.map(page => {
      const metadata = page.metadata as Record<string, unknown> | null
      return {
        pageId: page.id,
        title: page.title,
        status: page.status,
        importSource: metadata?.importSource,
        lastReimportedAt: metadata?.lastReimportedAt,
        sourceNotFoundAt: metadata?.sourceNotFoundAt
      }
    })

    return NextResponse.json({
      websiteId,
      pages: reimportablePages,
      total: reimportablePages.length
    })

  } catch (error) {
    console.error('Error getting re-import info:', error)

    if (error instanceof ApiError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      )
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get re-import info' },
      { status: 500 }
    )
  }
}
