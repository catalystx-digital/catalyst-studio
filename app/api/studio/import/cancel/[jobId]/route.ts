import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ImportJobStatus } from '@/lib/studio/import/types/import-job.types';
import { getAuthContext } from '@/lib/auth/context';
import { ImportRunService } from '@/lib/studio/import/services/import-run-service';

const importDb = prisma as any;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;

    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      );
    }

    // Get the import job
    const job = await importDb.importJob.findUnique({
      where: { id: jobId },
      include: { website: true },
    });

    if (!job) {
      return NextResponse.json(
        { error: 'Import job not found' },
        { status: 404 }
      );
    }

    // Ownership check
    const auth = await getAuthContext(request);
    const site: any = await importDb.website.findUnique({ where: { id: job.websiteId } });
    if (!site?.accountId || site.accountId !== auth.accountId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check if job is already completed or failed
    if (
      job.status === ImportJobStatus.COMPLETED ||
      job.status === ImportJobStatus.COMPLETED_WITH_WARNINGS ||
      job.status === ImportJobStatus.FAILED
    ) {
      return NextResponse.json(
        { error: `Cannot cancel job with status: ${job.status}` },
        { status: 400 }
      );
    }

    // Update job status to cancelled
    const updatedJob = await importDb.importJob.update({
      where: { id: jobId },
      data: {
        status: ImportJobStatus.CANCELLED,
        errorMessage: 'Import cancelled by user',
        completedAt: new Date(),
      },
    });

    const runService = new ImportRunService();
    await runService.markCancelledForJob(jobId, 'Import cancelled by user');

    // Cancellation preserves any committed pages/components. It only stops future workflow work.
    try {
      const detectionResults = job.detectionResults as Record<string, unknown>;
      const progressAtCancellation = (detectionResults?.progress as number) || 0;
      
      console.log(`Import cancelled for job ${jobId}:`, {
        websiteId: job.websiteId,
        progressAtCancellation,
        timestamp: new Date().toISOString(),
        committedPagesPreserved: true,
      });
    } catch (cleanupError) {
      console.error('Error cleaning up cancelled import:', cleanupError);
      // Don't fail the cancellation if cleanup fails
    }

    return NextResponse.json({
      success: true,
      jobId: updatedJob.id,
      status: updatedJob.status,
    });
  } catch (error) {
    console.error('Error cancelling import:', error);
    
    return NextResponse.json(
      { error: 'Failed to cancel import' },
      { status: 500 }
    );
  }
}
