import { NextRequest, NextResponse } from 'next/server'
import { start } from 'workflow/api'
import { prisma } from '@/lib/prisma'
import { getAuthContext } from '@/lib/auth/context'
import { importWebsiteWorkflow } from '@/lib/studio/workflows/import-website.workflow'
import { randomUUID } from 'node:crypto'

const importDb = prisma as any

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

    const resetResult = await importDb.importPageStage.updateMany({
      where: {
        runId: run.id,
        status: { in: ['failed_retryable'] },
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

    await start(importWebsiteWorkflow, [{
      jobId,
      websiteId: run.websiteId,
      url: run.sourceUrl,
      accountId: auth.accountId,
    }])

    return NextResponse.json({ success: true, jobId, retryingPages: resetResult.count })
  } catch (error) {
    console.error('Failed to retry import', error)
    return NextResponse.json(
      { error: 'Failed to retry import' },
      { status: 500 },
    )
  }
}
