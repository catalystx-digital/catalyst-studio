import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ImportJobStatus } from '@/lib/studio/import/types/import-job.types';
import { getAuthContext } from '@/lib/auth/context';

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
    const job = await prisma.importJob.findUnique({
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
    const site: any = await prisma.website.findUnique({ where: { id: job.websiteId } });
    if (!site?.accountId || site.accountId !== auth.accountId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check if job is already completed or failed
    if (job.status === ImportJobStatus.COMPLETED || job.status === ImportJobStatus.FAILED) {
      return NextResponse.json(
        { error: `Cannot cancel job with status: ${job.status}` },
        { status: 400 }
      );
    }

    // Update job status to cancelled
    const updatedJob = await prisma.importJob.update({
      where: { id: jobId },
      data: {
        status: ImportJobStatus.CANCELLED,
        errorMessage: 'Import cancelled by user',
        completedAt: new Date(),
      },
    });

    // Clean up partial data
    try {
      // Delete any WebsiteComponentType records created with this jobId
      // Note: WebsiteComponentType doesn't have importJobId field directly, 
      // but we can check through aiMetadata JSON field
      const components = await prisma.websiteComponentType.findMany({
        where: {
          websiteId: job.websiteId,
        },
      });

      // Filter components that were created by this import job
      const componentsToDelete = components.filter((component: Record<string, unknown>) => {
        const aiMetadata = component.aiMetadata as Record<string, unknown>;
        return aiMetadata?.importJobId === jobId;
      });

      if (componentsToDelete.length > 0) {
        await prisma.websiteComponentType.deleteMany({
          where: {
            id: {
              in: componentsToDelete.map((c: Record<string, unknown>) => c.id as string),
            },
          },
        });
      }

      // Check if website has any other successful imports
      const otherImports = await prisma.importJob.findMany({
        where: {
          websiteId: job.websiteId,
          status: ImportJobStatus.COMPLETED,
          id: {
            not: jobId,
          },
        },
      });

      // If no other successful imports, mark website as import_cancelled
      if (otherImports.length === 0) {
        await prisma.website.update({
          where: { id: job.websiteId },
          data: {
            // Add a metadata field to indicate import was cancelled
            // Since Website model doesn't have a specific field for this,
            // we'll just log it
            updatedAt: new Date(),
          },
        });
      }

      // Log cancellation with details
      const detectionResults = job.detectionResults as Record<string, unknown>;
      const progressAtCancellation = (detectionResults?.progress as number) || 0;
      
      console.log(`Import cancelled for job ${jobId}:`, {
        websiteId: job.websiteId,
        progressAtCancellation,
        timestamp: new Date().toISOString(),
        componentsDeleted: componentsToDelete.length,
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
