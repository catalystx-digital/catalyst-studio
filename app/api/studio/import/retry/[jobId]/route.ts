import { NextRequest, NextResponse } from 'next/server'
import { start } from 'workflow/api'
import { prisma } from '@/lib/prisma'
import { getAuthContext } from '@/lib/auth/context'
import { importWebsiteWorkflow } from '@/lib/studio/workflows/import-website.workflow'
import { randomUUID } from 'node:crypto'

const importDb = prisma as any
const PAGE_RETRY_STATUSES = ['failed_retryable']
const RUN_RESTART_STATUSES = ['discovered', 'queued', 'pending', 'processing', 'detected']
const RETRYABLE_RUN_STATUSES = ['failed_retryable']

function startImportProcessing(input: {
  jobId: string
  websiteId: string
  url: string
  accountId: string
  model?: string
}): void | Promise<unknown> {
  if (process.env.STUDIO_DISABLE_WORKFLOW_PLUGIN === 'true') {
    void importWebsiteWorkflow(input).then((result) => {
      console.log('[import/retry] Local import workflow completed', {
        jobId: input.jobId,
        websiteId: input.websiteId,
        success: result.success,
        pagesProcessed: result.pagesProcessed,
        componentsDetected: result.componentsDetected,
        errorCount: result.errors.length,
      })
    }).catch((error) => {
      console.error('[import/retry] Local import workflow failed', {
        jobId: input.jobId,
        websiteId: input.websiteId,
        error: error instanceof Error ? error.message : String(error),
      })
    })
    return
  }

  return start(importWebsiteWorkflow, [input])
}

function getRetryModel(importPlan: unknown): string | undefined {
  if (!importPlan || typeof importPlan !== 'object' || Array.isArray(importPlan)) {
    return undefined
  }

  const modelChain = (importPlan as Record<string, unknown>).modelChain
  if (typeof modelChain !== 'string') {
    return undefined
  }

  return modelChain.split('|').map((value) => value.trim()).find(Boolean)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params
    if (!jobId) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 })
    }

    const auth = await getAuthContext(request)
    const run = await importDb.importRun.findUnique({
      where: { importJobId: jobId },
      include: {
        importJob: true,
        website: { select: { accountId: true } },
      },
    })

    if (!run || run.website.accountId !== auth.accountId) {
      return NextResponse.json({ error: 'Import run not found' }, { status: 404 })
    }

    let resetResult = await importDb.importPageStage.updateMany({
      where: {
        runId: run.id,
        status: { in: PAGE_RETRY_STATUSES },
      },
      data: {
        status: 'queued',
        phase: 'queued',
        error: null,
        detectionPayload: null,
        attemptToken: randomUUID(),
        attempts: { increment: 1 },
        lastAttemptAt: new Date(),
      },
    })

    const runStatus = typeof run.status === 'string' ? run.status.toLowerCase() : ''
    if (resetResult.count === 0 && RETRYABLE_RUN_STATUSES.includes(runStatus)) {
      resetResult = await importDb.importPageStage.updateMany({
        where: {
          runId: run.id,
          status: { in: RUN_RESTART_STATUSES },
        },
        data: {
          status: 'queued',
          phase: 'queued',
          error: null,
          detectionPayload: null,
          attemptToken: randomUUID(),
          attempts: { increment: 1 },
          lastAttemptAt: new Date(),
        },
      })
    }

    if (resetResult.count === 0) {
      return NextResponse.json(
        { error: 'No retryable pages found for this import' },
        { status: 409 },
      )
    }

    await importDb.importRun.update({
      where: { id: run.id },
      data: {
        status: 'running',
        phase: 'queued',
        progress: Math.min(run.progress ?? 0, 90),
        message: `Retrying ${resetResult.count} failed page${resetResult.count === 1 ? '' : 's'}`,
        completedAt: null,
        cancellationRequestedAt: null,
        recoverableActions: [],
      },
    })

    await importDb.importJob.update({
      where: { id: jobId },
      data: {
        status: 'processing',
        errorMessage: null,
        completedAt: null,
      },
    })

    await startImportProcessing({
      jobId,
      websiteId: run.websiteId,
      url: run.sourceUrl,
      accountId: auth.accountId,
      model: getRetryModel(run.importPlan),
    })

    return NextResponse.json({ success: true, jobId, retryingPages: resetResult.count })
  } catch (error) {
    console.error('Failed to retry import', error)
    return NextResponse.json(
      { error: 'Failed to retry import' },
      { status: 500 },
    )
  }
}
