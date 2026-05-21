/**
 * Preview Sandbox Sync API
 *
 * PATCH /api/preview/sandbox/sync
 *   Deprecated legacy file sync endpoint
 *
 * Active previews boot the UCS runtime from the sandbox tarball and render
 * persisted Studio data from the database. Runtime file mutation is no longer
 * part of the supported preview path.
 */

import { NextRequest, NextResponse } from 'next/server'
import { assertStudioWebsiteAccess, previewAccessErrorResponse } from '@/lib/studio/preview/access'
import { isSandboxConfigured } from '@/lib/studio/preview/sandbox'
import type { SandboxResponse } from '@/lib/studio/preview/sandbox/types'

/**
 * PATCH - Deprecated sandbox file sync endpoint
 */
export async function PATCH(request: NextRequest): Promise<NextResponse<SandboxResponse>> {
  // Check if sandbox is configured
  if (!isSandboxConfigured()) {
    return NextResponse.json(
      {
        success: false,
        error: 'Vercel Sandbox is not configured.',
      },
      { status: 503 }
    )
  }

  try {
    // Parse request body
    let body: { websiteId?: string }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid JSON in request body',
        },
        { status: 400 }
      )
    }

    const { websiteId } = body

    if (!websiteId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required field: websiteId',
        },
        { status: 400 }
      )
    }

    try {
      await assertStudioWebsiteAccess(request, websiteId)
    } catch (error) {
      return previewAccessErrorResponse(error) as NextResponse<SandboxResponse>
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Sandbox file sync is deprecated. Update persisted Studio data and let the UCS runtime render from the database.',
      },
      { status: 410 }
    )
  } catch (error) {
    console.error('Sandbox sync error:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to sync files to sandbox',
      },
      { status: 500 }
    )
  }
}
