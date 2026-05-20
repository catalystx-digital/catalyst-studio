/**
 * Preview Sandbox Update API
 *
 * POST /api/preview/sandbox/update
 *   Update sandbox content (design system or component props)
 *
 * This endpoint allows real-time updates to a running sandbox
 * without recreating it.
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  updateDesignSystem,
  updateComponent,
  getSandbox,
  isSandboxConfigured,
  type UpdateSandboxRequest,
  type SandboxResponse,
} from '@/lib/studio/preview/sandbox'

/**
 * POST - Update sandbox content
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
    let body: UpdateSandboxRequest & { websiteId: string; componentType?: string; props?: Record<string, unknown> }
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

    const { websiteId, designSystem, componentType, props } = body

    if (!websiteId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required field: websiteId',
        },
        { status: 400 }
      )
    }

    // Check if sandbox exists
    const sandbox = getSandbox(websiteId)
    if (!sandbox) {
      return NextResponse.json(
        {
          success: false,
          error: `No sandbox found for website ${websiteId}. Create one first with POST /api/preview/sandbox`,
        },
        { status: 404 }
      )
    }

    // Update design system if provided
    if (designSystem) {
      await updateDesignSystem(websiteId, designSystem)
    }

    // Update component props if provided
    if (componentType && props) {
      await updateComponent(websiteId, componentType, props)
    }

    // Get updated sandbox state
    const updatedSandbox = getSandbox(websiteId)

    return NextResponse.json({
      success: true,
      sandbox: updatedSandbox,
    })
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
