import type { Prisma } from '@/lib/generated/prisma'
import { prisma } from '@/lib/prisma'
import { studioEventBus, type StudioEventRecord } from '@/lib/studio/activity/studio-event-bus'
import { deriveTitleFromUrl, normalizePath } from '@/lib/studio/import/utils/path-utils'
import { ImportActivityReadService } from './import-activity-read-service'

const db = prisma as any
const IMPORT_DRAFT_TRANSACTION_TIMEOUT_MS = 30_000

type ImportDraftStatus =
  | 'pending'
  | 'materializing_drafts'
  | 'detecting'
  | 'detected'
  | 'normalizing'
  | 'staged'
  | 'committing'
  | 'committed'
  | 'failed'
  | 'cancelled'
  | 'skipped_existing'

interface MaterializeResult {
  created: number
  reused: number
  skippedExisting: number
}

interface StageForMaterialization {
  id: string
  runId: string
  websiteId: string
  sourceUrl: string
  normalizedPageUrl: string
  normalizedPath: string
  title: string | null
  status: string
  phase: string
  draftPageId: string | null
  draftStructureId: string | null
}

export class ImportDraftMaterializer {
  async materializeForJob(jobId: string): Promise<MaterializeResult | null> {
    if (typeof db.importRun?.findUnique !== 'function') {
      return null
    }
    const run = await db.importRun.findUnique({
      where: { importJobId: jobId },
      include: { pageStages: { orderBy: [{ normalizedPath: 'asc' }, { firstSeenAt: 'asc' }] } },
    })
    if (!run) return null

    return this.materializeRun(run.id)
  }

  async materializeRun(runId: string): Promise<MaterializeResult> {
    const eventsToPublish: StudioEventRecord[] = []
    const result = await db.$transaction(async (tx: any) => {
      const run = await tx.importRun.findUnique({
        where: { id: runId },
        include: { pageStages: { orderBy: [{ normalizedPath: 'asc' }, { firstSeenAt: 'asc' }] } },
      })
      if (!run) {
        return { created: 0, reused: 0, skippedExisting: 0 }
      }

      const contentType = await this.ensurePageContentType(tx, run.websiteId)
      const sortedStages = [...run.pageStages].sort((a: StageForMaterialization, b: StageForMaterialization) => {
        const depthA = depth(a.normalizedPath)
        const depthB = depth(b.normalizedPath)
        if (depthA !== depthB) return depthA - depthB
        return a.normalizedPath.localeCompare(b.normalizedPath)
      })

      let created = 0
      let reused = 0
      let skippedExisting = 0

      await tx.importRun.update({
        where: { id: run.id },
        data: {
          phase: 'materializing_drafts',
          message: 'Creating import draft pages',
        },
      })

      for (const stage of sortedStages as StageForMaterialization[]) {
        if (stage.draftPageId && stage.draftStructureId) {
          reused += 1
          continue
        }

        const fullPath = normalizePath(stage.normalizedPath || stage.normalizedPageUrl || stage.sourceUrl)
        const existingStructure = await tx.websiteStructure.findUnique({
          where: { websiteId_fullPath: { websiteId: run.websiteId, fullPath } },
          include: { websitePage: true },
        })

        if (existingStructure?.websitePageId) {
          const existingMetadata = asRecord(existingStructure.websitePage?.metadata)
          if (
            existingMetadata?.isImportDraft === true &&
            existingMetadata.importRunId === run.id &&
            existingMetadata.importStageId === stage.id
          ) {
            await tx.importPageStage.update({
              where: { id: stage.id },
              data: {
                draftPageId: existingStructure.websitePageId,
                draftStructureId: existingStructure.id,
              },
            })
            reused += 1
            continue
          }

          await tx.importPageStage.update({
            where: { id: stage.id },
            data: {
              status: 'skipped_existing',
              phase: 'materializing_drafts',
              error: {
                code: 'IMPORT_PATH_EXISTS',
                message: `A page already exists at ${fullPath}`,
                fullPath,
              } satisfies Prisma.InputJsonValue,
            },
          })
          skippedExisting += 1
          continue
        }

        const title = stage.title || deriveTitleFromUrl(stage.sourceUrl)
        const metadata = this.buildDraftMetadata({
          run,
          stage,
          fullPath,
          status: 'materializing_drafts',
        })
        const page = stage.draftPageId
          ? await tx.websitePage.update({
              where: { id: stage.draftPageId },
              data: { title, metadata, contentTypeId: contentType.id },
            })
          : await tx.websitePage.create({
              data: {
                websiteId: run.websiteId,
                type: 'page',
                title,
                status: 'draft',
                contentTypeId: contentType.id,
                content: buildEmptyDraftContent(stage.sourceUrl, fullPath),
                metadata,
              },
            })

        const parent = await this.findParentStructure(tx, run.websiteId, fullPath)
        const structure = existingStructure
          ? await tx.websiteStructure.update({
              where: { id: existingStructure.id },
              data: { websitePageId: page.id },
            })
          : await tx.websiteStructure.create({
              data: {
                websiteId: run.websiteId,
                slug: slugFromPath(fullPath),
                fullPath,
                websitePageId: page.id,
                parentId: parent?.id ?? null,
                position: await nextPosition(tx, run.websiteId, parent?.id ?? null),
                pathDepth: depth(fullPath),
                weight: 0,
              },
            })

        await tx.importPageStage.update({
          where: { id: stage.id },
          data: {
            draftPageId: page.id,
            draftStructureId: structure.id,
            phase: 'materializing_drafts',
          },
        })
        created += 1
      }

      const [failedPages, stagedPages] = await Promise.all([
        tx.importPageStage.count({
          where: { runId: run.id, status: { in: ['failed_retryable', 'failed_terminal', 'skipped_existing'] } },
        }),
        tx.importPageStage.count({
          where: { runId: run.id, status: { in: ['processing', 'detected', 'normalized', 'draft_created', 'staged', 'committed'] } },
        }),
      ])

      await tx.importRun.update({
        where: { id: run.id },
        data: {
          failedPages,
          stagedPages,
          phase: 'discover_urls',
          message:
            skippedExisting > 0
              ? `Discovered ${run.pageStages.length} pages; ${skippedExisting} already exist`
              : `Discovered ${run.pageStages.length} pages`,
        },
      })

      const website = await tx.website.update({
        where: { id: run.websiteId },
        data: { revision: { increment: 1 } },
        select: { revision: true },
      })

      eventsToPublish.push(
        await studioEventBus.publishInTransaction(tx, {
          websiteId: run.websiteId,
          type: 'website.graph.changed',
          source: 'import',
          resourceType: 'importRun',
          resourceId: run.id,
          revision: website.revision,
          payload: {
            jobId: run.importJobId,
            runId: run.id,
            reason: 'import.drafts.materialized',
            created,
            reused,
            skippedExisting,
          },
        }),
      )

      return { created, reused, skippedExisting }
    }, { timeout: IMPORT_DRAFT_TRANSACTION_TIMEOUT_MS })

    for (const event of eventsToPublish) {
      await studioEventBus.publishAfterCommit(event)
    }
    await this.publishActivity(runId)

    return result
  }

  async updateDraftForStage(jobId: string, stageId: string, status: ImportDraftStatus): Promise<void> {
    const run = await db.importRun.findUnique({ where: { importJobId: jobId } })
    if (!run) return

    let eventToPublish: StudioEventRecord | null = null
    await db.$transaction(async (tx: any) => {
      const stage = await tx.importPageStage.findUnique({ where: { id: stageId } })
      if (!stage?.draftPageId) return

      const page = await tx.websitePage.findUnique({ where: { id: stage.draftPageId } })
      if (!page || page.websiteId !== run.websiteId) return

      const nextMetadata = {
        ...asRecord(page.metadata),
        isImportDraft: status !== 'committed',
        importVisibility: status === 'committed' ? 'visible' : status === 'cancelled' ? 'cancelled' : status === 'failed' ? 'failed' : 'draft',
        importStatus: status,
        importStageStatus: stage.status,
        importPhase: stage.phase,
        committedPageId: stage.committedPageId ?? null,
        importError: stage.error ?? null,
      } satisfies Prisma.InputJsonValue

      await tx.websitePage.update({
        where: { id: page.id },
        data: {
          title: stage.title || page.title,
          content: stage.pageContent ?? page.content,
          metadata: nextMetadata,
        },
      })

      if (status === 'committed') {
        const website = await tx.website.update({
          where: { id: run.websiteId },
          data: { revision: { increment: 1 } },
          select: { revision: true },
        })
        await tx.nodePosition.deleteMany({ where: { websiteId: run.websiteId } })
        eventToPublish = await studioEventBus.publishInTransaction(tx, {
          websiteId: run.websiteId,
          type: 'website.page.changed',
          source: 'import',
          resourceType: 'websitePage',
          resourceId: page.id,
          revision: website.revision,
          payload: {
            jobId,
            runId: run.id,
            stageId: stage.id,
            reason: 'import.page.committed',
          },
        })
      }
    }, { timeout: IMPORT_DRAFT_TRANSACTION_TIMEOUT_MS })
    if (eventToPublish) {
      await studioEventBus.publishAfterCommit(eventToPublish)
    }
  }

  private async publishActivity(runId: string): Promise<void> {
    const run = await db.importRun.findUnique({
      where: { id: runId },
      select: { websiteId: true, importJobId: true },
    })
    if (!run) return
    const activity = await new ImportActivityReadService().getForJobByWebsite(run.websiteId, run.importJobId)
    if (!activity) return
    await studioEventBus.publish({
      websiteId: run.websiteId,
      type: 'import.run.updated',
      source: 'import',
      resourceType: 'importRun',
      resourceId: runId,
      payload: {
        jobId: run.importJobId,
        activity,
      },
    })
  }

  private async ensurePageContentType(tx: any, websiteId: string) {
    const existing = await tx.contentType.findFirst({
      where: { websiteId, category: 'page' },
      orderBy: { createdAt: 'asc' },
    })
    if (existing) return existing

    return tx.contentType.create({
      data: {
        websiteId,
        key: 'page',
        name: 'Page',
        pluralName: 'Pages',
        displayField: 'title',
        category: 'page',
        fields: {},
      },
    })
  }

  private async findParentStructure(tx: any, websiteId: string, fullPath: string) {
    const segments = fullPath.split('/').filter(Boolean)
    for (let i = segments.length - 1; i > 0; i -= 1) {
      const parentPath = `/${segments.slice(0, i).join('/')}`
      const parent = await tx.websiteStructure.findUnique({
        where: { websiteId_fullPath: { websiteId, fullPath: parentPath } },
      })
      if (parent?.websitePageId) return parent
    }
    return null
  }

  private buildDraftMetadata(input: {
    run: { id: string; importJobId: string; websiteId: string }
    stage: StageForMaterialization
    fullPath: string
    status: ImportDraftStatus
  }): Prisma.InputJsonValue {
    return {
      isImportDraft: true,
      importVisibility: 'draft',
      importJobId: input.run.importJobId,
      importRunId: input.run.id,
      importStageId: input.stage.id,
      importStatus: input.status,
      importStageStatus: input.stage.status,
      importPhase: input.stage.phase,
      importSource: input.stage.sourceUrl,
      importSourceNormalized: input.stage.normalizedPageUrl,
      sourceUrl: input.stage.sourceUrl,
      normalizedSourceUrl: input.stage.normalizedPageUrl,
      fullPath: input.fullPath,
    }
  }
}

function buildEmptyDraftContent(sourceUrl: string, fullPath: string): Prisma.InputJsonValue {
  return {
    version: 1,
    components: [],
    metadata: {
      isImportDraft: true,
      sourceUrl,
      fullPath,
    },
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? { ...(value as Record<string, unknown>) } : {}
}

function depth(path: string): number {
  return normalizePath(path).split('/').filter(Boolean).length
}

function slugFromPath(path: string): string {
  const normalized = normalizePath(path)
  if (normalized === '/') return 'home'
  return normalized.split('/').filter(Boolean).pop() || 'page'
}

async function nextPosition(tx: any, websiteId: string, parentId: string | null): Promise<number> {
  const last = await tx.websiteStructure.findFirst({
    where: { websiteId, parentId },
    orderBy: { position: 'desc' },
    select: { position: true },
  })
  return typeof last?.position === 'number' ? last.position + 1 : 0
}
