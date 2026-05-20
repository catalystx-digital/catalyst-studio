/**
 * Preview Job Status API
 *
 * GET /api/preview/sandbox/status/[jobId]
 *   Check the status of a sandbox creation job
 *   Returns job status, previewUrl (when ready), error (when failed)
 *   Includes Retry-After header for polling guidance
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { PreviewJobStatus } from '@/lib/generated/prisma'

/**
 * Response type for job status
 */
interface JobStatusResponse {
  jobId: string
  status: PreviewJobStatus
  previewUrl?: string
  error?: string
  createdAt: string
  updatedAt: string
}

interface ErrorResponse {
  error: string
}

/**
 * GET - Get status of a sandbox creation job
 *
 * Returns current job status with:
 * - previewUrl when status is READY
 * - error when status is ERROR
 * - Retry-After header (3 seconds) for polling guidance
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
): Promise<NextResponse<JobStatusResponse | ErrorResponse>> {
  const { jobId } = await params

  if (!jobId) {
    return NextResponse.json(
      { error: 'Missing jobId parameter' },
      { status: 400 }
    )
  }

  try {
    const job = await prisma.previewJob.findUnique({
      where: { id: jobId },
    })

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      )
    }

    // Build response
    const response: JobStatusResponse = {
      jobId: job.id,
      status: job.status,
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
    }

    // Include previewUrl when ready
    if (job.status === PreviewJobStatus.READY && job.previewUrl) {
      response.previewUrl = job.previewUrl
    }

    // Include error when failed
    if (job.status === PreviewJobStatus.ERROR && job.error) {
      response.error = job.error
    }

    // Create response with Retry-After header for polling guidance
    const jsonResponse = NextResponse.json(response)

    // Add Retry-After header for non-terminal states
    if (
      job.status !== PreviewJobStatus.READY &&
      job.status !== PreviewJobStatus.ERROR
    ) {
      jsonResponse.headers.set('Retry-After', '3')
    }

    return jsonResponse
  } catch (error) {
    console.error('Job status lookup error:', error)

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get job status' },
      { status: 500 }
    )
  }
}
