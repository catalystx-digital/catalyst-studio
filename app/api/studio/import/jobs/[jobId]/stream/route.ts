import { NextRequest } from 'next/server'
import { getAuthContext } from '@/lib/auth/context'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const maxDuration = 30 // Vercel serverless limit

/**
 * GET /api/studio/import/jobs/[jobId]/stream
 *
 * Server-Sent Events (SSE) endpoint for real-time import progress updates.
 * Much more efficient than polling - only sends data when progress changes.
 *
 * Progress is calculated from:
 * - ImportJob.status for overall state
 * - ImportPageDetection count for processed pages
 * - detectionResults JSON for additional metadata
 *
 * @see PRD: docs/prd-sse-real-time-upgrade.md Task 1.1
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params

  // Auth check
  let auth
  try {
    auth = await getAuthContext(req)
  } catch {
    return new Response('Unauthorized', { status: 401 })
  }

  // Verify job exists and belongs to user's account
  const job = await prisma.importJob.findFirst({
    where: {
      id: jobId,
      website: { accountId: auth.accountId }
    },
    select: { id: true, status: true }
  })

  if (!job) {
    return new Response('Not found', { status: 404 })
  }

  const encoder = new TextEncoder()
  let isConnectionClosed = false
  let heartbeatInterval: NodeJS.Timeout | null = null
  let pollInterval: NodeJS.Timeout | null = null

  const stream = new ReadableStream({
    async start(controller) {
      // Track last sent data to avoid sending duplicates
      let lastDataHash = ''

      const sendProgress = async () => {
        if (isConnectionClosed) return

        try {
          // Fetch job with page detection count
          const [jobData, pageCount] = await Promise.all([
            prisma.importJob.findUnique({
              where: { id: jobId },
              select: {
                id: true,
                status: true,
                url: true,
                errorMessage: true,
                detectionResults: true,
                updatedAt: true,
              }
            }),
            prisma.importPageDetection.count({
              where: { jobId }
            })
          ])

          if (!jobData || isConnectionClosed) {
            cleanup()
            controller.close()
            return
          }

          // Parse detection results for additional progress info
          const detectionResults = jobData.detectionResults as Record<string, unknown> | null
          const progressSummary = detectionResults?.progressSummary as Record<string, unknown> | null

          // Read totalPages from root level (set by workflow) or progressSummary.totalCount
          const totalPages = (detectionResults?.totalPages as number)
            ?? (progressSummary?.totalCount as number)
            ?? 0

          // Read processedCount from progressSummary (set by workflow), fallback to DB count
          const processedFromSummary = progressSummary?.processedCount as number | undefined
          const processedCount = typeof processedFromSummary === 'number' ? processedFromSummary : pageCount

          const currentUrl = (detectionResults?.currentUrl as string)
            ?? (progressSummary?.currentUrl as string)
            ?? null
          const stage = mapStatusToStage(jobData.status, processedCount, totalPages)

          // Determine progress: For terminal states, use fixed values
          // This ensures COMPLETED always shows 100% even if detectionResults.progress wasn't updated
          let progressPercent: number
          if (jobData.status === 'COMPLETED') {
            progressPercent = 100
          } else if (jobData.status === 'FAILED' || jobData.status === 'CANCELLED') {
            // For failed jobs, show last known progress or calculate from page count
            const storedProgress = typeof detectionResults?.progress === 'number' ? detectionResults.progress : null
            progressPercent = storedProgress ?? calculateProgress(jobData.status, processedCount, totalPages)
          } else {
            // For in-progress jobs, use stored progress or calculate
            const storedProgress = typeof detectionResults?.progress === 'number' ? detectionResults.progress : null
            progressPercent = storedProgress ?? calculateProgress(jobData.status, processedCount, totalPages)
          }

          const data = {
            jobId: jobData.id,
            status: jobData.status,
            progress: progressPercent,
            stage,
            processedCount,
            totalCount: totalPages,
            currentUrl,
            error: jobData.errorMessage,
            timestamp: jobData.updatedAt?.toISOString(),
          }

          // Create a simple hash to detect changes
          const dataHash = JSON.stringify(data)

          // Only send if data has changed (or first message)
          if (dataHash !== lastDataHash) {
            lastDataHash = dataHash
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
            )
          }

          // Close stream if job is in terminal state
          const terminalStatuses = ['COMPLETED', 'FAILED', 'CANCELLED']
          if (terminalStatuses.includes(jobData.status)) {
            // Send final update and close
            cleanup()
            controller.close()
            return
          }

          // Schedule next update (2 second server-side throttle)
          pollInterval = setTimeout(sendProgress, 2000)
        } catch (error) {
          console.error('[SSE] Error fetching progress:', error)
          cleanup()
          controller.close()
        }
      }

      const sendHeartbeat = () => {
        if (isConnectionClosed) return
        try {
          // SSE comment format for heartbeat (keeps connection alive)
          controller.enqueue(encoder.encode(`: heartbeat\n\n`))
        } catch {
          // Connection likely closed
          cleanup()
        }
      }

      const cleanup = () => {
        isConnectionClosed = true
        if (heartbeatInterval) {
          clearInterval(heartbeatInterval)
          heartbeatInterval = null
        }
        if (pollInterval) {
          clearTimeout(pollInterval)
          pollInterval = null
        }
      }

      // Send heartbeat every 25 seconds to prevent Vercel timeout
      heartbeatInterval = setInterval(sendHeartbeat, 25000)

      // Send initial progress immediately
      await sendProgress()
    },
    cancel() {
      isConnectionClosed = true
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval)
        heartbeatInterval = null
      }
      if (pollInterval) {
        clearTimeout(pollInterval)
        pollInterval = null
      }
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable Nginx buffering
    },
  })
}

/**
 * Map import job status to a stage identifier.
 */
function mapStatusToStage(status: string, processedPages: number, totalPages: number): string {
  switch (status) {
    case 'PENDING':
    case 'QUEUED':
      return 'queued'
    case 'PROCESSING':
      if (processedPages === 0) return 'initializing'
      if (totalPages > 0 && processedPages >= totalPages) return 'finalizing'
      return 'page_processing'
    case 'COMPLETED':
      return 'completed'
    case 'FAILED':
    case 'CANCELLED':
      return 'failed'
    default:
      return 'page_processing'
  }
}

/**
 * Calculate overall progress percentage based on job status and page count.
 */
function calculateProgress(status: string, processedPages: number, totalPages: number): number {
  switch (status) {
    case 'PENDING':
    case 'QUEUED':
      return 0
    case 'PROCESSING':
      if (totalPages === 0) return 10 // Starting, but no pages discovered yet
      // Reserve 10% for init, 80% for pages, 10% for finalization
      const pageProgress = Math.min(processedPages / totalPages, 1)
      return Math.round(10 + pageProgress * 80)
    case 'COMPLETED':
      return 100
    case 'FAILED':
    case 'CANCELLED':
      // Return last known progress
      if (totalPages === 0) return 0
      const failedProgress = Math.min(processedPages / totalPages, 1)
      return Math.round(10 + failedProgress * 80)
    default:
      return 0
  }
}
