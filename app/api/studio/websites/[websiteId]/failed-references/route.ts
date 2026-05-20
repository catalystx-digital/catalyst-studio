import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthContext } from '@/lib/auth/context'
import { assertWebsiteOwnership } from '@/lib/auth/ownership'
import { resolveImportedReferences } from '@/lib/studio/import/services/reference-resolver'

interface RouteParams {
  params: Promise<{
    websiteId: string
  }>
}

/**
 * GET /api/studio/websites/[websiteId]/failed-references
 * List all failed references for a website
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  // Auth check
  let auth
  try {
    auth = await getAuthContext(request)
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { websiteId } = await params

  // Verify ownership
  try {
    await assertWebsiteOwnership(prisma as any, auth.accountId, websiteId)
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const failedReferences = await prisma.failedReference.findMany({
      where: { websiteId },
      orderBy: { lastAttempt: 'desc' },
    })

    return NextResponse.json({
      success: true,
      data: {
        failedReferences,
        total: failedReferences.length,
      },
    })
  } catch (error) {
    console.error('[FailedReferences] Error fetching failed references:', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch failed references' } },
      { status: 500 }
    )
  }
}

/**
 * POST /api/studio/websites/[websiteId]/failed-references
 * Retry resolving failed references
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  // Auth check
  let auth
  try {
    auth = await getAuthContext(request)
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { websiteId } = await params

  // Verify ownership
  try {
    await assertWebsiteOwnership(prisma as any, auth.accountId, websiteId)
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    // Parse optional body for specific reference IDs
    let referenceIds: string[] | undefined
    try {
      const body = await request.json()
      if (body.referenceIds && Array.isArray(body.referenceIds)) {
        referenceIds = body.referenceIds
      }
    } catch {
      // Empty body is fine - retry all
    }

    // Get count before retry
    const beforeCount = await prisma.failedReference.count({
      where: {
        websiteId,
        ...(referenceIds ? { id: { in: referenceIds } } : {}),
      },
    })

    if (beforeCount === 0) {
      return NextResponse.json({
        success: true,
        data: {
          message: 'No failed references to retry',
          retried: 0,
          resolved: 0,
          stillFailed: 0,
        },
      })
    }

    // Run reference resolution again - it will attempt to resolve all references
    // including previously failed ones
    const result = await resolveImportedReferences(websiteId)

    // Get count after retry
    const afterCount = await prisma.failedReference.count({
      where: { websiteId },
    })

    return NextResponse.json({
      success: true,
      data: {
        message: 'Retry completed',
        retried: beforeCount,
        resolved: beforeCount - afterCount,
        stillFailed: afterCount,
        resolution: result,
      },
    })
  } catch (error) {
    console.error('[FailedReferences] Error retrying failed references:', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to retry references' } },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/studio/websites/[websiteId]/failed-references
 * Clear failed references (acknowledge/dismiss)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  // Auth check
  let auth
  try {
    auth = await getAuthContext(request)
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { websiteId } = await params

  // Verify ownership
  try {
    await assertWebsiteOwnership(prisma as any, auth.accountId, websiteId)
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    // Parse optional body for specific reference IDs
    let referenceIds: string[] | undefined
    try {
      const body = await request.json()
      if (body.referenceIds && Array.isArray(body.referenceIds)) {
        referenceIds = body.referenceIds
      }
    } catch {
      // Empty body is fine - delete all
    }

    const deleteResult = await prisma.failedReference.deleteMany({
      where: {
        websiteId,
        ...(referenceIds ? { id: { in: referenceIds } } : {}),
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        deleted: deleteResult.count,
      },
    })
  } catch (error) {
    console.error('[FailedReferences] Error deleting failed references:', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to delete references' } },
      { status: 500 }
    )
  }
}
