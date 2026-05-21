/**
 * Preview Sandbox Sync API
 *
 * PATCH /api/preview/sandbox/sync
 *   Sync files to an existing sandbox (for live updates)
 *
 * This endpoint pushes updated files to the sandbox:
 * - Design system CSS (globals.css)
 * - Page content (app/preview/page.tsx)
 * - Component props (component-props.json)
 *
 * The Next.js dev server in the sandbox will hot-reload automatically.
 *
 * ARCHITECTURE NOTE (TKT-069):
 * On Vercel serverless, the in-memory sandbox cache may not have the handle
 * if a different instance created the sandbox. This endpoint now:
 * 1. First checks in-memory cache (fast path)
 * 2. Falls back to database lookup + Sandbox.get() to reconnect
 */

import { NextRequest, NextResponse } from 'next/server'
import { Sandbox } from '@vercel/sandbox'
import { prisma } from '@/lib/db/prisma'
import { PreviewJobStatus } from '@/lib/generated/prisma'
import { assertStudioWebsiteAccess, previewAccessErrorResponse } from '@/lib/studio/preview/access'
import {
  syncFilesToSandbox,
  getSandbox,
  isSandboxConfigured,
  reconnectSandbox,
} from '@/lib/studio/preview/sandbox'
import type { SandboxSyncRequest, SandboxResponse } from '@/lib/studio/preview/sandbox/types'

/**
 * PATCH - Sync files to sandbox for live preview updates
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
    let body: SandboxSyncRequest
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

    const { websiteId, files } = body

    if (!websiteId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required field: websiteId',
        },
        { status: 400 }
      )
    }

    if (!files || files.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required field: files (array of file updates)',
        },
        { status: 400 }
      )
    }

    try {
      await assertStudioWebsiteAccess(request, websiteId)
    } catch (error) {
      return previewAccessErrorResponse(error) as NextResponse<SandboxResponse>
    }

    // First, check in-memory cache (fast path for same-instance requests)
    let sandbox = getSandbox(websiteId)

    // If not in cache, try to reconnect using database
    if (!sandbox) {
      console.log(`[SandboxSync] No in-memory handle for ${websiteId}, checking database...`)

      // Look up the READY job from database
      const job = await prisma.previewJob.findFirst({
        where: {
          websiteId,
          status: PreviewJobStatus.READY,
        },
        orderBy: { createdAt: 'desc' },
      })

      if (!job || !job.sandboxId) {
        return NextResponse.json(
          {
            success: false,
            error: `No sandbox found for website ${websiteId}. Create one first with POST /api/preview/sandbox`,
          },
          { status: 404 }
        )
      }

      // Reconnect to the sandbox using the stored sandbox ID
      console.log(`[SandboxSync] Reconnecting to sandbox ${job.sandboxId} for website ${websiteId}`)
      try {
        sandbox = await reconnectSandbox(websiteId, job.sandboxId, job.previewUrl || '')
        console.log(`[SandboxSync] Successfully reconnected to sandbox ${job.sandboxId}`)
      } catch (reconnectError) {
        console.error(`[SandboxSync] Failed to reconnect to sandbox:`, reconnectError)
        return NextResponse.json(
          {
            success: false,
            error: `Sandbox ${job.sandboxId} is no longer available. It may have expired.`,
          },
          { status: 410 } // Gone - sandbox expired
        )
      }
    }

    if (sandbox.status !== 'ready') {
      return NextResponse.json(
        {
          success: false,
          error: `Sandbox is not ready (status: ${sandbox.status})`,
        },
        { status: 409 }
      )
    }

    // Sync files to sandbox
    await syncFilesToSandbox(websiteId, files)

    // Get updated sandbox info
    const updatedSandbox = getSandbox(websiteId)

    return NextResponse.json({
      success: true,
      sandbox: updatedSandbox,
    })
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
