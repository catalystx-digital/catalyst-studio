/**
 * Preview Sandbox API
 *
 * POST /api/preview/sandbox
 *   Create or get a sandbox for a website (async with job tracking)
 *   Returns 202 Accepted with { jobId } - poll GET /api/preview/sandbox/job?jobId=xxx
 *
 * GET /api/preview/sandbox?websiteId=xxx
 *   Get sandbox status for a website
 *
 * DELETE /api/preview/sandbox?websiteId=xxx
 *   Stop and cleanup a sandbox
 *
 * This API uses Vercel Sandbox to run real Next.js dev servers
 * for each website, solving the 'use client' component rendering issue.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

/**
 * waitUntil polyfill for local development
 * On Vercel, @vercel/functions provides waitUntil to run tasks after response is sent.
 * Locally, we just fire-and-forget the promise (it will complete in the background).
 */
let waitUntil: (promise: Promise<unknown>) => void

try {
  // Try to use Vercel's waitUntil if available (production/Vercel deployment)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const vercelFunctions = require('@vercel/functions')
  waitUntil = vercelFunctions.waitUntil
} catch {
  // Fallback for local development: fire-and-forget
  // The promise will run in the background but won't block the response
  waitUntil = (promise: Promise<unknown>) => {
    promise.catch((error) => {
      console.error('[waitUntil fallback] Background task error:', error)
    })
  }
}
import { PreviewJobStatus } from '@/lib/generated/prisma'
import {
  createSandbox,
  getSandbox,
  stopSandbox,
  isSandboxConfigured,
  type CreateSandboxRequest,
  type SandboxResponse,
  type PreviewDesignTokens,
  type PreviewComponentConfig,
} from '@/lib/studio/preview/sandbox'

/**
 * Check if a sandbox URL is still alive by making a HEAD request
 * Returns true if sandbox is reachable, false if dead (410, timeout, etc.)
 */
async function isSandboxAlive(previewUrl: string): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000) // 5s timeout

    const response = await fetch(previewUrl, {
      method: 'HEAD',
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    // 410 Gone = sandbox was stopped
    // 502/503 = sandbox is hibernating or dead
    if (response.status === 410 || response.status === 502 || response.status === 503) {
      console.log(`[SandboxHealthCheck] Sandbox at ${previewUrl} is dead (status ${response.status})`)
      return false
    }

    return true
  } catch (error) {
    // Network error, timeout, or sandbox unreachable
    console.log(`[SandboxHealthCheck] Sandbox at ${previewUrl} unreachable:`, error)
    return false
  }
}

/**
 * Response type for async POST endpoint
 */
interface AsyncJobResponse {
  success: boolean
  jobId?: string
  previewUrl?: string
  status?: PreviewJobStatus
  error?: string
}

/**
 * Background worker for sandbox creation
 * Updates job status and creates sandbox
 *
 * IMPORTANT: This runs inside waitUntil() on Vercel.
 * Any uncaught errors here will cause the job to be stuck.
 * We must ensure errors are always caught and the job status is updated.
 */
async function backgroundCreateSandbox(
  jobId: string,
  websiteId: string,
  designSystem?: PreviewDesignTokens,
  components?: PreviewComponentConfig[]
): Promise<void> {
  console.log(`[PreviewJob ${jobId}] Background worker started for website ${websiteId}`)

  // Helper to safely update job status (never throws)
  async function safeUpdateJobStatus(
    status: PreviewJobStatus,
    data?: { sandboxId?: string; previewUrl?: string; error?: string }
  ): Promise<boolean> {
    try {
      await prisma.previewJob.update({
        where: { id: jobId },
        data: { status, ...data },
      })
      console.log(`[PreviewJob ${jobId}] Status updated to ${status}`)
      return true
    } catch (updateError) {
      console.error(`[PreviewJob ${jobId}] Failed to update status to ${status}:`, updateError)
      return false
    }
  }

  try {
    // Step 1: Update status to CREATING_SANDBOX
    console.log(`[PreviewJob ${jobId}] Step 1: Updating status to CREATING_SANDBOX`)
    const step1Success = await safeUpdateJobStatus(PreviewJobStatus.CREATING_SANDBOX)
    if (!step1Success) {
      console.error(`[PreviewJob ${jobId}] Failed at step 1, aborting`)
      return
    }

    // Step 2: Create sandbox (this is the slow operation - ~30 seconds with pre-compiled tarball)
    console.log(`[PreviewJob ${jobId}] Step 2: Creating sandbox (this typically takes ~30 seconds)...`)
    const startTime = Date.now()

    let sandbox
    try {
      sandbox = await createSandbox(websiteId, designSystem, components)
      const duration = ((Date.now() - startTime) / 1000).toFixed(1)
      console.log(`[PreviewJob ${jobId}] Step 2 complete: Sandbox created in ${duration}s - ${sandbox.previewUrl}`)
    } catch (sandboxError) {
      const duration = ((Date.now() - startTime) / 1000).toFixed(1)
      const errorMessage = sandboxError instanceof Error
        ? `${sandboxError.name}: ${sandboxError.message}`
        : 'Unknown sandbox creation error'
      console.error(`[PreviewJob ${jobId}] Step 2 failed after ${duration}s:`, sandboxError)

      // Update to ERROR status
      await safeUpdateJobStatus(PreviewJobStatus.ERROR, { error: errorMessage })
      return
    }

    // Step 3: Update job to READY with previewUrl
    console.log(`[PreviewJob ${jobId}] Step 3: Updating job to READY`)
    await safeUpdateJobStatus(PreviewJobStatus.READY, {
      sandboxId: sandbox.id,
      previewUrl: sandbox.previewUrl,
    })

    console.log(`[PreviewJob ${jobId}] Background worker completed successfully`)
  } catch (unexpectedError) {
    // Catch-all for any unexpected errors
    const errorMessage = unexpectedError instanceof Error
      ? `Unexpected: ${unexpectedError.name}: ${unexpectedError.message}`
      : 'Unexpected error in background worker'
    console.error(`[PreviewJob ${jobId}] Unexpected error in background worker:`, unexpectedError)

    // Try to update job status to ERROR
    await safeUpdateJobStatus(PreviewJobStatus.ERROR, { error: errorMessage })
  }
}

/**
 * POST - Create or get a sandbox for a website (async pattern)
 *
 * Returns 202 Accepted with { jobId } immediately
 * Sandbox creation happens in background via waitUntil
 */
export async function POST(request: NextRequest): Promise<NextResponse<AsyncJobResponse>> {
  // Check if sandbox is configured
  if (!isSandboxConfigured()) {
    return NextResponse.json(
      {
        success: false,
        error: 'Vercel Sandbox is not configured. Set VERCEL_TEAM_ID, VERCEL_PROJECT_ID, and VERCEL_TOKEN environment variables.',
      },
      { status: 503 }
    )
  }

  // Parse request body
  let body: CreateSandboxRequest
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

  // Validate request
  const { websiteId, designSystem, components } = body

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
    // Check for existing READY job for this website (sandbox reuse)
    const existingJob = await prisma.previewJob.findFirst({
      where: {
        websiteId,
        status: PreviewJobStatus.READY,
      },
      orderBy: { createdAt: 'desc' },
    })

    if (existingJob && existingJob.previewUrl) {
      // Verify sandbox is still alive before returning
      const isAlive = await isSandboxAlive(existingJob.previewUrl)

      if (isAlive) {
        // Return existing ready job
        return NextResponse.json({
          success: true,
          jobId: existingJob.id,
          previewUrl: existingJob.previewUrl,
          status: existingJob.status,
        })
      }

      // Sandbox is dead - mark job as expired and continue to create new one
      console.log(`[SandboxReuse] Job ${existingJob.id} sandbox is dead, marking as EXPIRED`)
      await prisma.previewJob.update({
        where: { id: existingJob.id },
        data: {
          status: PreviewJobStatus.ERROR,
          error: 'Sandbox expired or stopped by Vercel',
        },
      })
    }

    // Check for existing in-progress job (PENDING or CREATING_SANDBOX)
    const inProgressJob = await prisma.previewJob.findFirst({
      where: {
        websiteId,
        status: { in: [PreviewJobStatus.PENDING, PreviewJobStatus.CREATING_SANDBOX] },
      },
      orderBy: { createdAt: 'desc' },
    })

    if (inProgressJob) {
      // Check if job is stale (stuck for more than 5 minutes)
      const jobAge = Date.now() - new Date(inProgressJob.updatedAt).getTime()
      const STALE_JOB_THRESHOLD_MS = 5 * 60 * 1000 // 5 minutes

      if (jobAge > STALE_JOB_THRESHOLD_MS) {
        // Mark stale job as ERROR and continue to create new one
        console.log(`[SandboxJob] Job ${inProgressJob.id} is stale (${Math.round(jobAge / 1000)}s old), marking as ERROR`)
        await prisma.previewJob.update({
          where: { id: inProgressJob.id },
          data: {
            status: PreviewJobStatus.ERROR,
            error: 'Job timed out - sandbox creation took too long',
          },
        })
        // Continue to create a new job below
      } else {
        // Return existing in-progress job (client should poll)
        return NextResponse.json(
          {
            success: true,
            jobId: inProgressJob.id,
            status: inProgressJob.status,
          },
          { status: 202 }
        )
      }
    }

    // Create new job with PENDING status
    const job = await prisma.previewJob.create({
      data: {
        websiteId,
        status: PreviewJobStatus.PENDING,
      },
    })

    // Trigger background worker via waitUntil
    waitUntil(backgroundCreateSandbox(job.id, websiteId, designSystem, components))

    // Return 202 Accepted with jobId
    return NextResponse.json(
      {
        success: true,
        jobId: job.id,
        status: PreviewJobStatus.PENDING,
      },
      { status: 202 }
    )
  } catch (error) {
    console.error('Sandbox job creation error:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create sandbox job',
      },
      { status: 500 }
    )
  }
}

/**
 * GET - Get sandbox status for a website
 *
 * Special case: websiteId=_config_check
 *   Used by useSandboxConfigured() hook to check if sandbox is configured.
 *   Returns 503 if not configured, 200 if configured.
 */
export async function GET(request: NextRequest): Promise<NextResponse<SandboxResponse>> {
  const websiteId = request.nextUrl.searchParams.get('websiteId')

  if (!websiteId) {
    return NextResponse.json(
      {
        success: false,
        error: 'Missing required query parameter: websiteId',
      },
      { status: 400 }
    )
  }

  // Special case: configuration check for useSandboxConfigured() hook
  if (websiteId === '_config_check') {
    if (!isSandboxConfigured()) {
      return NextResponse.json(
        {
          success: false,
          error: 'Vercel Sandbox is not configured. Set VERCEL_TEAM_ID, VERCEL_PROJECT_ID, and VERCEL_TOKEN environment variables.',
        },
        { status: 503 }
      )
    }
    return NextResponse.json({
      success: true,
    })
  }

  const sandbox = getSandbox(websiteId)

  if (!sandbox) {
    return NextResponse.json(
      {
        success: false,
        error: `No sandbox found for website ${websiteId}`,
      },
      { status: 404 }
    )
  }

  return NextResponse.json({
    success: true,
    sandbox,
  })
}

/**
 * DELETE - Stop and cleanup a sandbox
 */
export async function DELETE(request: NextRequest): Promise<NextResponse<SandboxResponse>> {
  const websiteId = request.nextUrl.searchParams.get('websiteId')

  if (!websiteId) {
    return NextResponse.json(
      {
        success: false,
        error: 'Missing required query parameter: websiteId',
      },
      { status: 400 }
    )
  }

  try {
    await stopSandbox(websiteId)

    return NextResponse.json({
      success: true,
    })
  } catch (error) {
    console.error('Sandbox stop error:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to stop sandbox',
      },
      { status: 500 }
    )
  }
}
