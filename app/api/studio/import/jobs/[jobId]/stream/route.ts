import { NextRequest } from 'next/server'
import { getAuthContext } from '@/lib/auth/context'
import { ImportActivityReadService } from '@/lib/studio/import/services/import-activity-read-service'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const TERMINAL_STATUSES = new Set([
  'success',
  'partial_success',
  'completed',
  'completed_with_warnings',
  'failed',
  'cancelled',
  'recoverable_stuck',
  'unknown',
])

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params

  let accountId: string
  try {
    const auth = await getAuthContext(req)
    accountId = auth.accountId
  } catch {
    return new Response('Unauthorized', { status: 401 })
  }

  const activity = new ImportActivityReadService()
  const initial = await activity.getProgressSnapshot(accountId, jobId)
  if (!initial) {
    return new Response('Not found', { status: 404 })
  }

  const encoder = new TextEncoder()
  let closed = false
  let heartbeatInterval: NodeJS.Timeout | null = null
  let pollTimeout: NodeJS.Timeout | null = null

  const cleanup = () => {
    closed = true
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval)
      heartbeatInterval = null
    }
    if (pollTimeout) {
      clearTimeout(pollTimeout)
      pollTimeout = null
    }
  }

  const stream = new ReadableStream({
    async start(controller) {
      let lastDataHash = ''

      const sendProgress = async () => {
        if (closed) return
        try {
          const snapshot = await activity.getProgressSnapshot(accountId, jobId)
          if (!snapshot || closed) {
            cleanup()
            controller.close()
            return
          }

          const data = {
            jobId: snapshot.jobId,
            status: snapshot.status,
            productStatus: snapshot.productStatus,
            rawStatus: snapshot.rawStatus,
            progress: snapshot.progress,
            stage: snapshot.stage,
            processedCount: snapshot.processedCount,
            totalCount: snapshot.totalCount,
            currentUrl: snapshot.currentUrl,
            error: snapshot.error,
            recoverableActions: snapshot.recoverableActions,
            timestamp: snapshot.timestamp,
          }
          const dataHash = JSON.stringify(data)
          if (dataHash !== lastDataHash) {
            lastDataHash = dataHash
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
          }

          if (TERMINAL_STATUSES.has(snapshot.status) || TERMINAL_STATUSES.has(snapshot.productStatus)) {
            cleanup()
            controller.close()
            return
          }

          pollTimeout = setTimeout(sendProgress, 2000)
        } catch (error) {
          console.error('[SSE] Error fetching import progress:', error)
          cleanup()
          controller.close()
        }
      }

      heartbeatInterval = setInterval(() => {
        if (!closed) {
          try {
            controller.enqueue(encoder.encode(`: heartbeat\n\n`))
          } catch {
            cleanup()
          }
        }
      }, 25000)

      await sendProgress()
    },
    cancel() {
      cleanup()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
