/**
 * Preview Sandbox Update API
 *
 * POST /api/preview/sandbox/update
 *   Deprecated legacy sandbox mutation endpoint
 *
 * Active previews render persisted Studio data through the UCS runtime. Design
 * system and component changes should be saved to Studio data, not pushed into
 * sandbox files.
 */

import { NextRequest, NextResponse } from 'next/server'
import { assertStudioWebsiteAccess, previewAccessErrorResponse } from '@/lib/studio/preview/access'
import {
  isSandboxConfigured,
  type SandboxResponse,
} from '@/lib/studio/preview/sandbox'

/**
 * POST - Deprecated sandbox mutation endpoint
 */
export async function POST(request: NextRequest): Promise<NextResponse<SandboxResponse>> {
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
    } catch (error) {
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
        error: 'Sandbox file/component updates are deprecated. Update persisted Studio data and let the UCS runtime render from the database.',
      },
      { status: 410 }
    )
  } catch (error) {
    console.error('Sandbox update error:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update sandbox',
      },
      { status: 500 }
    )
  }
}
