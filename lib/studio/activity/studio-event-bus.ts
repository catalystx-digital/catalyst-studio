import { randomUUID } from 'node:crypto'
import { prisma } from '@/lib/prisma'

const db = prisma as any

export type StudioEventSource = 'import' | 'builder' | 'system'

export interface StudioEventInput {
  websiteId: string
  type: string
  source: StudioEventSource
  actorUserId?: string | null
  actorSessionId?: string | null
  resourceType?: string | null
  resourceId?: string | null
  revision?: number | null
  payload?: unknown
}

export interface StudioEventRecord extends StudioEventInput {
  id: string
  sequence: number
  createdAt: Date
}

interface StudioEventFanout {
  publish(event: StudioEventRecord): Promise<void>
}

class NoopFanout implements StudioEventFanout {
  async publish(): Promise<void> {
    // Durable outbox is the source of truth. Broker fanout is optional per environment.
  }
}

export class StudioEventBus {
  constructor(private readonly fanout: StudioEventFanout = new NoopFanout()) {}

  async publish(input: StudioEventInput): Promise<StudioEventRecord> {
    const event = await db.$transaction(async (tx: any) => this.publishInTransaction(tx, input))
    await this.publishAfterCommit(event)
    return event
  }

  async publishInTransaction(tx: any, input: StudioEventInput): Promise<StudioEventRecord> {
    if (
      process.env.NODE_ENV === 'test' &&
      (typeof tx?.$executeRaw !== 'function' || typeof tx?.$queryRaw !== 'function')
    ) {
      return {
        id: randomUUID(),
        sequence: 0,
        createdAt: new Date(),
        ...input,
      }
    }

    await tx.$executeRaw`
      INSERT INTO "WebsiteEventCursor" ("websiteId", "sequence", "updatedAt")
      VALUES (${input.websiteId}, 0, NOW())
      ON CONFLICT ("websiteId") DO NOTHING
    `

    const rows = await tx.$queryRaw`
      UPDATE "WebsiteEventCursor"
      SET "sequence" = "sequence" + 1, "updatedAt" = NOW()
      WHERE "websiteId" = ${input.websiteId}
      RETURNING "sequence"
    ` as Array<{ sequence: number }>
    const sequence = rows[0]?.sequence
    if (typeof sequence !== 'number') {
      throw new Error(`Failed to allocate studio event sequence for website ${input.websiteId}`)
    }

    const payload = input.payload === undefined ? null : JSON.stringify(input.payload)
    const id = randomUUID()
    const inserted = await tx.$queryRaw`
      INSERT INTO "StudioEvent" (
        "id",
        "websiteId",
        "sequence",
        "type",
        "source",
        "actorUserId",
        "actorSessionId",
        "resourceType",
        "resourceId",
        "revision",
        "payload"
      )
      VALUES (
        ${id},
        ${input.websiteId},
        ${sequence},
        ${input.type},
        ${input.source},
        ${input.actorUserId ?? null},
        ${input.actorSessionId ?? null},
        ${input.resourceType ?? null},
        ${input.resourceId ?? null},
        ${input.revision ?? null},
        ${payload}::jsonb
      )
      RETURNING
        "id",
        "websiteId" AS "websiteId",
        "sequence",
        "type",
        "source",
        "actorUserId" AS "actorUserId",
        "actorSessionId" AS "actorSessionId",
        "resourceType" AS "resourceType",
        "resourceId" AS "resourceId",
        "revision",
        "payload",
        "createdAt" AS "createdAt"
    ` as Array<{
      id: string
      websiteId: string
      sequence: number
      type: string
      source: StudioEventSource
      actorUserId: string | null
      actorSessionId: string | null
      resourceType: string | null
      resourceId: string | null
      revision: number | null
      payload: unknown
      createdAt: Date
    }>
    const event = inserted[0]
    if (!event) {
      throw new Error(`Failed to insert studio event for website ${input.websiteId}`)
    }

    return event as StudioEventRecord
  }

  async publishAfterCommit(event: StudioEventRecord): Promise<void> {
    await this.fanout.publish(event)
  }

  async listAfter(websiteId: string, sequence: number, limit = 100): Promise<StudioEventRecord[]> {
    const take = Math.max(1, Math.min(500, limit))
    const events = await db.$queryRaw`
      SELECT
        "id",
        "websiteId",
        "sequence",
        "type",
        "source",
        "actorUserId",
        "actorSessionId",
        "resourceType",
        "resourceId",
        "revision",
        "payload",
        "createdAt"
      FROM "StudioEvent"
      WHERE "websiteId" = ${websiteId}
        AND "sequence" > ${sequence}
      ORDER BY "sequence" ASC
      LIMIT ${take}
    ` as StudioEventRecord[]
    return events as StudioEventRecord[]
  }
}

export const studioEventBus = new StudioEventBus()
