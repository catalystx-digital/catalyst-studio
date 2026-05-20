import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { getAuthContext } from '@/lib/auth/context'
import { assertWebsiteOwnership } from '@/lib/auth/ownership'

// Schema for updating WebsiteComponentType
const UpdateComponentTypeSchema = z.object({
  category: z.string().optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  defaultConfig: z.any().optional(),
  placeholderData: z.any().optional(),
  aiMetadata: z.any().optional(),
  version: z.string().optional(),
})

type RouteParams = {
  params: Promise<{ id: string }>
}

function unauthorizedResponse() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

// GET /api/studio/site-builder/components/[id]
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params

    const componentType = await prisma.websiteComponentType.findUnique({
      where: { id }
    })

    if (!componentType) {
      return NextResponse.json(
        { error: 'Component type not found' },
        { status: 404 }
      )
    }

    // Auth check - always required
    let auth
    try {
      auth = await getAuthContext(request)
    } catch {
      return unauthorizedResponse()
    }

    const websiteId = (componentType as any).websiteId as string | undefined
    if (!websiteId) {
      return NextResponse.json({ error: 'Component type not scoped to website' }, { status: 400 })
    }
    await assertWebsiteOwnership(prisma as any, auth.accountId, websiteId)

    return NextResponse.json(componentType)
  } catch (error) {
    console.error('Failed to fetch component type:', error)
    return NextResponse.json(
      { error: 'Failed to fetch component type' },
      { status: 500 }
    )
  }
}

// PUT /api/studio/site-builder/components/[id]
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const body = await request.json()
    const validation = UpdateComponentTypeSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const existing = await prisma.websiteComponentType.findUnique({
      where: { id }
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Component type not found' },
        { status: 404 }
      )
    }

    // Auth check - always required
    let auth
    try {
      auth = await getAuthContext(request)
    } catch {
      return unauthorizedResponse()
    }

    const websiteId = (existing as any).websiteId as string | undefined
    if (!websiteId) {
      return NextResponse.json({ error: 'Component type not scoped to website' }, { status: 400 })
    }
    await assertWebsiteOwnership(prisma as any, auth.accountId, websiteId)

    const updatedComponentType = await prisma.websiteComponentType.update({
      where: { id },
      data: validation.data
    })

    return NextResponse.json(updatedComponentType)
  } catch (error) {
    console.error('Failed to update component type:', error)
    return NextResponse.json(
      { error: 'Failed to update component type' },
      { status: 500 }
    )
  }
}

// DELETE /api/studio/site-builder/components/[id]
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params

    const existing = await prisma.websiteComponentType.findUnique({
      where: { id }
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Component type not found' },
        { status: 404 }
      )
    }

    // Auth check - always required
    let auth
    try {
      auth = await getAuthContext(request)
    } catch {
      return unauthorizedResponse()
    }

    const websiteId = (existing as any).websiteId as string | undefined
    if (!websiteId) {
      return NextResponse.json({ error: 'Component type not scoped to website' }, { status: 400 })
    }
    await assertWebsiteOwnership(prisma as any, auth.accountId, websiteId)

    await prisma.websiteComponentType.delete({
      where: { id }
    })

    return NextResponse.json({ message: 'Component type deleted successfully' })
  } catch (error) {
    console.error('Failed to delete component type:', error)
    return NextResponse.json(
      { error: 'Failed to delete component type' },
      { status: 500 }
    )
  }
}
