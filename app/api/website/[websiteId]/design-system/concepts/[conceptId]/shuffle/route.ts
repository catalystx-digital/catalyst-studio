import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { DesignConceptService } from '@/lib/studio/design-system/design-concept.service'
import { invalidateDesignSystemCache } from '@/lib/studio/design-system/cache-utils.server'
import { isStudioDesignConceptsEnabled } from '@/lib/studio/config/feature-flags'
import { getAuthContext } from '@/lib/auth/context'
import { assertWebsiteOwnership } from '@/lib/auth/ownership'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ websiteId: string; conceptId: string }> }
) {
  // Auth check - always required
  let auth
  try {
    auth = await getAuthContext(request)
  } catch {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    if (!isStudioDesignConceptsEnabled()) {
      return NextResponse.json(
        { success: false, error: 'Design concepts feature is disabled' },
        { status: 403 }
      )
    }

    const { websiteId, conceptId } = await context.params
    const { requestedBy } = await request.json().catch(() => ({}))

    if (!websiteId || !conceptId) {
      return NextResponse.json(
        { success: false, error: 'Website ID and conceptId are required' },
        { status: 400 }
      )
    }

    // Verify ownership
    await assertWebsiteOwnership(prisma as any, auth.accountId, websiteId)

    const website = await prisma.website.findUnique({
      where: { id: websiteId },
      select: { id: true }
    })

    if (!website) {
      return NextResponse.json(
        { success: false, error: 'Website not found' },
        { status: 404 }
      )
    }

    const conceptService = new DesignConceptService(prisma)
    const result = await conceptService.shuffleConceptPalette({
      websiteId,
      conceptId,
      requestedBy
    })

    invalidateDesignSystemCache(websiteId, conceptId)

    return NextResponse.json({
      success: true,
      data: {
        concept: result.concept,
        designSystem: result.designSystem,
        seed: result.seed
      }
    })
  } catch (error) {
    console.error('Failed to shuffle palette:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to shuffle palette',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
