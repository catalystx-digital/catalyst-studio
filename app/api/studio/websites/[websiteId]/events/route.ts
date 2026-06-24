import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { assertPermission, getAuthorizedContext } from '@/lib/auth/authorization'
import { assertWebsiteOwnership } from '@/lib/auth/ownership'
import { studioEventBus } from '@/lib/studio/activity/studio-event-bus'
import { ImportActivityReadService } from '@/lib/studio/import/services/import-activity-read-service'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const STREAM_POLL_MS = 5000
const HEARTBEAT_MS = 25000

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ websiteId: string }> },
) {
  let auth
  try {
    auth = await getAuthorizedContext(request)
  } catch {
    return new Response('Unauthorized', { status: 401 })
  }

  const { websiteId } = await params
  try {
    await assertWebsiteOwnership(prisma as any, auth.accountId, websiteId)
    await assertPermission(auth, 'website:view', websiteId)
  } catch {
    return new Response('Forbidden', { status: 403 })
  }

  const encoder = new TextEncoder()
  let closed = false
  let pollTimer: NodeJS.Timeout | null = null
  let heartbeatTimer: NodeJS.Timeout | null = null
  let cursor = resolveCursor(request)

  const cleanup = () => {
    closed = true
    if (pollTimer) {
      clearTimeout(pollTimer)
      pollTimer = null
    }
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer)
      heartbeatTimer = null
    }
  }

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown, id?: number) => {
        if (closed) return false
        const lines = [
          id !== undefined ? `id: ${id}` : null,
          `event: ${event}`,
          `data: ${JSON.stringify(data)}`,
          '',
          '',
        ].filter((line): line is string => line !== null)
        try {
          controller.enqueue(encoder.encode(lines.join('\n')))
          return true
        } catch (error) {
          cleanup()
          if (process.env.NODE_ENV === 'development') {
            console.warn('[StudioEvents] Failed to enqueue SSE event:', error)
          }
          return false
        }
      }

      try {
        const snapshot = await buildSnapshot(auth.accountId, websiteId)
        cursor = Math.max(cursor, snapshot.sequence)
        if (!send('studio.snapshot', snapshot, snapshot.sequence)) {
          return
        }
      } catch (error) {
        console.error('[StudioEvents] Failed to build snapshot:', error)
        cleanup()
        try {
          controller.error(error)
        } catch {
          // The client may already have closed the stream while the snapshot was building.
        }
        return
      }

      const poll = async () => {
        if (closed) return
        try {
          const events = await studioEventBus.listAfter(websiteId, cursor, 100)
          for (const event of events) {
            if (event.sequence <= cursor) continue
            cursor = event.sequence
            send(event.type, event, event.sequence)
          }
        } catch (error) {
          console.error('[StudioEvents] Failed to stream events:', error)
        } finally {
          if (!closed) {
            pollTimer = setTimeout(poll, STREAM_POLL_MS)
          }
        }
      }

      heartbeatTimer = setInterval(() => {
        if (!closed) {
          try {
            controller.enqueue(encoder.encode(': heartbeat\n\n'))
          } catch {
            cleanup()
          }
        }
      }, HEARTBEAT_MS)

      await poll()
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

function resolveCursor(request: NextRequest): number {
  const explicit = request.nextUrl.searchParams.get('after')
  const lastEventId = request.headers.get('last-event-id')
  const raw = explicit ?? lastEventId ?? '0'
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0
}

async function buildSnapshot(accountId: string, websiteId: string) {
  const cursor = await readHighWaterSequence(websiteId)
  const [website, imports] = await Promise.all([
    (prisma as any).website.findUnique({
      where: { id: websiteId },
      select: { id: true, revision: true },
    }),
    new ImportActivityReadService().listForAccount(accountId, {
      websiteId,
      limit: 10,
      includePageStages: true,
    }),
  ])

  return {
    websiteId,
    revision: website?.revision ?? 0,
    sequence: cursor,
    imports,
    createdAt: new Date().toISOString(),
  }
}

async function readHighWaterSequence(websiteId: string): Promise<number> {
  const rows = (await (prisma as any).$queryRaw`
    SELECT "sequence"
    FROM "WebsiteEventCursor"
    WHERE "websiteId" = ${websiteId}
    LIMIT 1
  `) as Array<{ sequence: number }>
  return rows[0]?.sequence ?? 0
}
