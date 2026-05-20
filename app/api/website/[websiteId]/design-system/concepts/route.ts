import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { DesignConceptService } from '@/lib/studio/design-system/design-concept.service'
import { isStudioDesignConceptsEnabled } from '@/lib/studio/config/feature-flags'
import { getAuthContext } from '@/lib/auth/context'
import { assertWebsiteOwnership } from '@/lib/auth/ownership'

/**
 * GET /api/website/[websiteId]/design-system/concepts
 *
 * Lists all design concepts for a website
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ websiteId: string }> }
) {
  // Auth check - always required
  let auth
  try {
    auth = await getAuthContext(request)
  } catch {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { websiteId } = await context.params

    if (!websiteId) {
      return NextResponse.json(
        { success: false, error: 'Website ID is required' },
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
    const concepts = await conceptService.listConcepts(websiteId)

    return NextResponse.json({
      success: true,
      concepts
    })
  } catch (error) {
    console.error('Failed to list concepts:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to list concepts',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ websiteId: string }> }
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

    const { websiteId } = await context.params
    const { name, sourceConceptId, duplicatePalette } = await request.json()

    if (!websiteId) {
      return NextResponse.json(
        { success: false, error: 'Website ID is required' },
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
    const result = await conceptService.createConcept({
      websiteId,
      name,
      sourceConceptId,
      duplicatePalette: Boolean(duplicatePalette)
    })

    return NextResponse.json({
      success: true,
      data: {
        concept: result.concept,
        designSystem: result.designSystem,
        seed: result.seed
      }
    })
  } catch (error) {
    console.error('Failed to create concept:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create concept',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
