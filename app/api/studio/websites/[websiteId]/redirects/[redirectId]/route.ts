import { NextRequest, NextResponse } from 'next/server'
import { redirectService } from '@/lib/services/redirect-service'
import { prisma } from '@/lib/prisma'
import { getAuthContext } from '@/lib/auth/context'
import { assertWebsiteOwnership } from '@/lib/auth/ownership'

interface RouteParams {
  params: Promise<{
    websiteId: string
    redirectId: string
  }>
}

/**
 * GET /api/studio/websites/[websiteId]/redirects/[redirectId]
 * Get a single redirect
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  // Auth check - always required
  let auth
  try {
    auth = await getAuthContext(request)
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { websiteId, redirectId } = await params

  // Verify ownership
  try {
    await assertWebsiteOwnership(prisma as any, auth.accountId, websiteId)
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const result = await redirectService.getRedirect(redirectId)

  if (!result.success) {
    return NextResponse.json(
      { error: result.error },
      { status: result.error?.code === 'NOT_FOUND' ? 404 : 500 }
    )
  }

  return NextResponse.json({ redirect: result.data })
}

/**
 * PUT /api/studio/websites/[websiteId]/redirects/[redirectId]
 * Update an existing redirect
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  // Auth check - always required
  let auth
  try {
    auth = await getAuthContext(request)
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { websiteId, redirectId } = await params

  // Verify ownership
  try {
    await assertWebsiteOwnership(prisma as any, auth.accountId, websiteId)
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: {
    sourcePath?: string
    targetPath?: string
    redirectType?: number
    isActive?: boolean
    isExternal?: boolean
    showInNav?: boolean
    navLabel?: string
    openInNewTab?: boolean
    source?: string
    description?: string
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON body' } },
      { status: 400 }
    )
  }

  // Validate redirectType if provided
  let redirectType: 301 | 302 | undefined
  if (body.redirectType !== undefined) {
    redirectType = body.redirectType === 302 ? 302 : 301
  }

  const result = await redirectService.updateRedirect({
    id: redirectId,
    sourcePath: body.sourcePath,
    targetPath: body.targetPath,
    redirectType,
    isActive: body.isActive,
    isExternal: body.isExternal,
    showInNav: body.showInNav,
    navLabel: body.navLabel,
    openInNewTab: body.openInNewTab,
    source: body.source,
    description: body.description,
  })

  if (!result.success) {
    const status =
      result.error?.code === 'NOT_FOUND'
        ? 404
        : result.error?.code === 'VALIDATION_ERROR'
        ? 400
        : 500

    return NextResponse.json({ error: result.error }, { status })
  }

  return NextResponse.json({ redirect: result.data })
}

/**
 * DELETE /api/studio/websites/[websiteId]/redirects/[redirectId]
 * Delete a redirect
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  // Auth check - always required
  let auth
  try {
    auth = await getAuthContext(request)
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { websiteId, redirectId } = await params

  // Verify ownership
  try {
    await assertWebsiteOwnership(prisma as any, auth.accountId, websiteId)
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const result = await redirectService.deleteRedirect(redirectId)

  if (!result.success) {
    return NextResponse.json(
      { error: result.error },
      { status: result.error?.code === 'NOT_FOUND' ? 404 : 500 }
    )
  }

  return NextResponse.json({ success: true })
}
