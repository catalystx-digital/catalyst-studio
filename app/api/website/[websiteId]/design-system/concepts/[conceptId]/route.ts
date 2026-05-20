import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { DesignConceptService } from '@/lib/studio/design-system/design-concept.service'
import { invalidateDesignSystemCache } from '@/lib/studio/design-system/cache-utils.server'
import { isStudioDesignConceptsEnabled } from '@/lib/studio/config/feature-flags'
import { getAuthContext } from '@/lib/auth/context'
import { assertWebsiteOwnership } from '@/lib/auth/ownership'

export async function PATCH(
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
    const { name, description, metadata, isDefault } = await request.json()

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

    if (isDefault === true) {
      await conceptService.setDefaultConcept(websiteId, conceptId)
    }

    if (name || description || metadata) {
      await conceptService.updateConceptDetails(websiteId, conceptId, {
        name,
        description,
        metadata
      })
    }

    const concept = await conceptService.getConcept(websiteId, conceptId)
    return NextResponse.json({ success: true, data: { concept } })
  } catch (error) {
    console.error('Failed to update concept:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update concept',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function DELETE(
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
    await conceptService.deleteConcept({ websiteId, conceptId })
    invalidateDesignSystemCache(websiteId, conceptId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete concept:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete concept',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
