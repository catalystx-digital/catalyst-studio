import { NextRequest } from 'next/server'
import { getAuthContext } from '@/lib/auth/context'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const maxDuration = 30 // Vercel serverless limit

/**
 * GET /api/ai-context/[sessionId]/stream
 *
 * Server-Sent Events (SSE) endpoint for real-time AI context updates.
 * Streams new messages as they arrive instead of requiring polling.
 *
 * @see PRD: docs/prd-sse-real-time-upgrade.md Task 2.1
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params
  const websiteId = req.nextUrl.searchParams.get('websiteId')

  // Auth check
  let auth
  try {
    auth = await getAuthContext(req)
  } catch {
    return new Response('Unauthorized', { status: 401 })
  }

  // Verify website belongs to account (if websiteId provided)
  if (websiteId) {
    const website = await prisma.website.findFirst({
      where: { id: websiteId, accountId: auth.accountId },
      select: { id: true }
    })
    if (!website) {
      return new Response('Forbidden', { status: 403 })
    }
  }

  const encoder = new TextEncoder()
  let isConnectionClosed = false
  let lastMessageCount = 0
  let lastUpdatedAt: Date | null = null
  let heartbeatInterval: NodeJS.Timeout | null = null
  let pollInterval: NodeJS.Timeout | null = null

  const stream = new ReadableStream({
    async start(controller) {
      const checkForUpdates = async () => {
        if (isConnectionClosed) return

        try {
          const context = await prisma.aIContext.findUnique({
            where: {
              websiteId_sessionId: {
                websiteId: websiteId ?? '',
                sessionId,
              }
            },
            select: {
              context: true,
              metadata: true,
              updatedAt: true,
            }
          })

          if (isConnectionClosed) return

          // Check if there are new updates
          // The context field contains { messages: [...] }
          const contextData = context?.context as { messages?: unknown[] } | null
          const messages = contextData?.messages ?? []
          const currentCount = messages.length
          const currentUpdatedAt = context?.updatedAt

          const hasNewData =
            currentCount !== lastMessageCount ||
            (currentUpdatedAt && lastUpdatedAt && currentUpdatedAt > lastUpdatedAt) ||
            lastMessageCount === 0 // Always send on first check

          if (hasNewData) {
            lastMessageCount = currentCount
            lastUpdatedAt = currentUpdatedAt ?? null

            const data = {
              sessionId,
              messages,
              metadata: context?.metadata ?? {},
              messageCount: currentCount,
              timestamp: currentUpdatedAt?.toISOString(),
            }

            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
            )
          }

          // Schedule next check (3 second interval)
          pollInterval = setTimeout(checkForUpdates, 3000)
        } catch (error) {
          console.error('[AI Context SSE] Error:', error)
          if (!isConnectionClosed) {
            cleanup()
            controller.close()
          }
        }
      }

      const sendHeartbeat = () => {
        if (isConnectionClosed) return
        try {
          // SSE comment format for heartbeat
          controller.enqueue(encoder.encode(`: heartbeat\n\n`))
        } catch {
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

      // Start checking for updates
      await checkForUpdates()
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
      'X-Accel-Buffering': 'no',
    },
  })
}
