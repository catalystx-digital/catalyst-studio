import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { getAuthContext } from '@/lib/auth/context'
import { assertWebsiteOwnership } from '@/lib/auth/ownership'
import { ApiError, handleApiError } from '@/lib/api/errors'

// Schema for WebsiteComponentType - matches actual database schema
const ComponentTypeSchema = z.object({
  websiteId: z.string().optional(), // Optional for GET requests
  type: z.string(),
  category: z.string().optional(),
  defaultConfig: z.any().optional(), // Stores name, description, and settings
  placeholderData: z.any().optional(),
  styles: z.any().optional(),
  aiMetadata: z.any().optional(),
  version: z.string().optional(),
  isGlobal: z.boolean().optional(),
  confidence: z.number().optional(),
})

// GET /api/studio/site-builder/components
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const websiteId = searchParams.get('websiteId')
    const category = searchParams.get('category')
    const categories = searchParams.get('categories')
    const aiTag = searchParams.get('aiTag')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')

    // Auth check - always required
    let auth;
    try {
      auth = await getAuthContext(request);
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!websiteId) {
      return NextResponse.json({ error: 'websiteId is required' }, { status: 400 });
    }

    await assertWebsiteOwnership(prisma as any, auth.accountId, websiteId);

    // Build where clause
    const where: Record<string, unknown> = { websiteId }

    if (category) {
      where.category = category
    } else if (categories) {
      where.category = { in: categories.split(',') }
    }

    if (aiTag) {
      where.aiMetadata = {
        path: '$.tags',
        array_contains: aiTag
      }
    }

    const skip = (page - 1) * limit

    const [items, total] = await Promise.all([
      prisma.websiteComponentType.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.websiteComponentType.count({ where })
    ])

    return NextResponse.json({
      items,
      total,
      page,
      limit
    })
  } catch (error) {
    if (error instanceof ApiError) {
      return handleApiError(error)
    }
    console.error('Failed to fetch component types:', error)
    return NextResponse.json(
      { error: 'Failed to fetch component types' },
      { status: 500 }
    )
  }
}

// POST /api/studio/site-builder/components
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validation = ComponentTypeSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const createData: any = {
      type: validation.data.type,
      category: validation.data.category || 'general',
      defaultConfig: validation.data.defaultConfig || {},
      placeholderData: validation.data.placeholderData || {},
      styles: validation.data.styles || null,
      aiMetadata: validation.data.aiMetadata || {},
      version: validation.data.version || '1.0.0',
      isGlobal: validation.data.isGlobal || false,
      confidence: validation.data.confidence || 0,
      createdBy: 'api' // Required field in schema
    }
    
    if (validation.data.websiteId) {
      createData.websiteId = validation.data.websiteId
    }

    let auth;
    try {
      auth = await getAuthContext(request);
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!createData.websiteId) {
      return NextResponse.json({ error: 'websiteId is required' }, { status: 400 });
    }

    await assertWebsiteOwnership(prisma as any, auth.accountId, createData.websiteId);

    const componentType = await prisma.websiteComponentType.create({
      data: createData
    })

    return NextResponse.json(componentType, { status: 201 })
  } catch (error) {
    if (error instanceof ApiError) {
      return handleApiError(error)
    }
    console.error('Failed to create component type:', error)

    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return NextResponse.json(
        { error: 'Component type already exists' },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to create component type' },
      { status: 500 }
    )
  }
}

// PUT /api/studio/site-builder/components
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Component type ID is required' },
        { status: 400 }
      )
    }

    let auth
    try {
      auth = await getAuthContext(request)
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const existing = await prisma.websiteComponentType.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Component type not found' },
        { status: 404 }
      )
    }

    const websiteId = (existing as any).websiteId as string | undefined
    if (!websiteId) {
      return NextResponse.json(
        { error: 'Component type not scoped to a website' },
        { status: 400 }
      )
    }

    await assertWebsiteOwnership(prisma as any, auth.accountId, websiteId)

    const componentType = await prisma.websiteComponentType.update({
      where: { id },
      data: updateData
    })

    return NextResponse.json(componentType)
  } catch (error) {
    if (error instanceof ApiError) {
      return handleApiError(error)
    }
    console.error('Failed to update component type:', error)
    return NextResponse.json(
      { error: 'Failed to update component type' },
      { status: 500 }
    )
  }
}

// DELETE /api/studio/site-builder/components
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Component type ID is required' },
        { status: 400 }
      )
    }

    let auth
    try {
      auth = await getAuthContext(request)
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const existing = await prisma.websiteComponentType.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Component type not found' },
        { status: 404 }
      )
    }

    const websiteId = (existing as any).websiteId as string | undefined
    if (!websiteId) {
      return NextResponse.json(
        { error: 'Component type not scoped to a website' },
        { status: 400 }
      )
    }

    await assertWebsiteOwnership(prisma as any, auth.accountId, websiteId)

    await prisma.websiteComponentType.delete({
      where: { id }
    })

    return NextResponse.json({ message: 'Component type deleted successfully' })
  } catch (error) {
    if (error instanceof ApiError) {
      return handleApiError(error)
    }
    console.error('Failed to delete component type:', error)
    return NextResponse.json(
      { error: 'Failed to delete component type' },
      { status: 500 }
    )
  }
}

