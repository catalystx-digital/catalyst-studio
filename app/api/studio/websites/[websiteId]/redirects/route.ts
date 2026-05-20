import { NextRequest, NextResponse } from 'next/server'
import { redirectService } from '@/lib/services/redirect-service'
import { prisma } from '@/lib/prisma'
import { getAuthContext } from '@/lib/auth/context'
import { assertWebsiteOwnership } from '@/lib/auth/ownership'

interface RouteParams {
  params: Promise<{
    websiteId: string
  }>
}

/**
 * GET /api/studio/websites/[websiteId]/redirects
 * List all redirects for a website
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  // Auth check - always required
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

  const result = await redirectService.listRedirects(websiteId, {
    limit: 1000, // Get all redirects
  })

  if (!result.success) {
    return NextResponse.json(
      { error: result.error },
      { status: result.error?.code === 'NOT_FOUND' ? 404 : 500 }
    )
  }

  return NextResponse.json({ redirects: result.data })
}

/**
 * POST /api/studio/websites/[websiteId]/redirects
 * Create a new redirect
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  // Auth check - always required
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

  let body: {
    sourcePath: string
    targetPath: string
    redirectType: number
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

  // Validate required fields
  if (!body.sourcePath || !body.targetPath) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'sourcePath and targetPath are required',
        },
      },
      { status: 400 }
    )
  }

  // Validate redirectType
  const redirectType = body.redirectType === 302 ? 302 : 301

  const result = await redirectService.createRedirect({
    websiteId,
    sourcePath: body.sourcePath,
    targetPath: body.targetPath,
    redirectType,
    isExternal: body.isExternal,
    showInNav: body.showInNav,
    navLabel: body.navLabel,
    openInNewTab: body.openInNewTab,
    source: body.source || 'manual',
    description: body.description,
  })

  if (!result.success) {
    const status =
      result.error?.code === 'CONFLICT'
        ? 409
        : result.error?.code === 'VALIDATION_ERROR'
        ? 400
        : 500

    return NextResponse.json({ error: result.error }, { status })
  }

  return NextResponse.json({ redirect: result.data }, { status: 201 })
}
