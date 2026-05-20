/**
 * API Route: GET /api/website/[websiteId]/design-system
 *
 * Retrieves the design system for a specific website
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { DesignSystemService } from '@/lib/studio/import/services/design-system-service'
import { DesignConceptService } from '@/lib/studio/design-system/design-concept.service'
import {
  CACHE_DURATIONS,
  addCachingHeaders,
  invalidateDesignSystemCache,
  validateDesignSystem
} from '@/lib/studio/design-system/cache-utils.server'
import { getAuthContext } from '@/lib/auth/context'
import { assertWebsiteOwnership } from '@/lib/auth/ownership'

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
      select: { id: true, name: true, isActive: true }
    })

    if (!website) {
      return NextResponse.json(
        { success: false, error: 'Website not found' },
        { status: 404 }
      )
    }

    const designSystemService = new DesignSystemService({ prisma })
    const conceptService = new DesignConceptService(prisma)
    const concepts = await conceptService.listConcepts(websiteId)

    if (concepts.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No design concepts available for this website' },
        { status: 404 }
      )
    }

    const searchParams = new URL(request.url).searchParams
    const requestedConceptId = searchParams.get('conceptId')
    const requestedConceptName = searchParams.get('conceptName')
    const requestedConceptSlug = searchParams.get('conceptSlug')

    const activeConcept =
      concepts.find((concept) => concept.id === requestedConceptId) ??
      concepts.find(
        (concept) => concept.slug === requestedConceptSlug && requestedConceptSlug
      ) ??
      concepts.find(
        (concept) =>
          requestedConceptName &&
          concept.name?.toLowerCase() === requestedConceptName.toLowerCase()
      ) ??
      concepts.find((concept) => concept.isDefault) ??
      concepts[0]

    const designSystem = await designSystemService.getLatestDesignSystem(
      websiteId,
      activeConcept?.id
    )

    const response = NextResponse.json({
      success: true,
      data: {
        website: {
          id: website.id,
          name: website.name,
          isActive: website.isActive
        },
        concepts,
        activeConcept,
        designSystem
      }
    })

    return addCachingHeaders(
      response,
      websiteId,
      CACHE_DURATIONS.DESIGN_SYSTEM,
      activeConcept?.id
    )
  } catch (error) {
    console.error('Failed to fetch design system:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch design system',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * API Route: PUT /api/website/[websiteId]/design-system
 *
 * Updates the design system for a specific website
 */
export async function PUT(
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

    const body = await request.json()
    const { designSystem, conceptId: requestedConceptId } = body

    if (!designSystem) {
      return NextResponse.json(
        { success: false, error: 'Design system data is required' },
        { status: 400 }
      )
    }

    const website = await prisma.website.findUnique({
      where: { id: websiteId },
      select: { id: true, name: true }
    })

    if (!website) {
      return NextResponse.json(
        { success: false, error: 'Website not found' },
        { status: 404 }
      )
    }

    const validation = validateDesignSystem(designSystem)
    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid design system structure',
          details: validation.errors
        },
        { status: 400 }
      )
    }

    const conceptService = new DesignConceptService(prisma)
    let concept = null
    if (requestedConceptId) {
      concept = await conceptService.getConcept(websiteId, requestedConceptId)
    } else {
      const conceptList = await conceptService.listConcepts(websiteId)
      concept = conceptList.find((entry) => entry.isDefault) ?? conceptList[0] ?? null
    }

    if (!concept) {
      return NextResponse.json(
        { success: false, error: 'No design concepts available for this website' },
        { status: 404 }
      )
    }

    const designSystemService = new DesignSystemService({ prisma })
    await designSystemService.persistConceptDesignSystem(websiteId, concept.id, designSystem)

    const updatedDesignSystem = await designSystemService.getLatestDesignSystem(
      websiteId,
      concept.id
    )

    invalidateDesignSystemCache(websiteId, concept.id)

    const response = NextResponse.json({
      success: true,
      data: {
        website: {
          id: website.id,
          name: website.name
        },
        concept,
        designSystem: updatedDesignSystem
      }
    })

    return addCachingHeaders(
      response,
      websiteId,
      CACHE_DURATIONS.DESIGN_SYSTEM,
      concept.id
    )
  } catch (error) {
    console.error('Failed to update design system:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update design system',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * API Route: DELETE /api/website/[websiteId]/design-system
 *
 * Deletes the design system for a specific website
 */
export async function DELETE(
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

    // Verify website exists
    const website = await prisma.website.findUnique({
      where: { id: websiteId },
      select: { id: true, name: true }
    })

    if (!website) {
      return NextResponse.json(
        { success: false, error: 'Website not found' },
        { status: 404 }
      )
    }

    // Delete design system using the service
    const designSystemService = new DesignSystemService({ prisma })
    const success = await designSystemService.deleteDesignSystem(websiteId)

    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Failed to delete design system' },
        { status: 500 }
      )
    }

    // Invalidate cache for this website since design system was deleted
    invalidateDesignSystemCache(websiteId)

    const response = NextResponse.json({
      success: true,
      data: {
        website: {
          id: website.id,
          name: website.name
        },
        message: 'Design system deleted successfully'
      }
    })

    // Add caching headers (short cache since design system was deleted)
    return addCachingHeaders(response, websiteId, 300) // 5 minutes
  } catch (error) {
    console.error('Failed to delete design system:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete design system',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

