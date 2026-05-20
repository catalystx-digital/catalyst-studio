import { NextRequest, NextResponse } from 'next/server';
import { ImportService } from '@/lib/studio/import/services/import-service';
import { getAuthContext } from '@/lib/auth/context';
import { ImportJobRepository } from '@/lib/studio/import/repositories/import-job.repository';
import { prisma } from '@/lib/prisma';

export async function GET(
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

    let auth;
    try {
      auth = await getAuthContext(request);
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const repo = new ImportJobRepository();
    const job = await repo.findById(jobId);

    if (!job) {
      return NextResponse.json(
        { error: 'Import job not found' },
        { status: 404 }
      );
    }

    const site: any = await prisma.website.findUnique({ where: { id: job.websiteId } });
    if (!site?.accountId || site.accountId !== auth.accountId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const importService = new ImportService();
    const progress = await importService.getJobProgress(jobId);

    return NextResponse.json(progress);
  } catch (error) {
    if (error instanceof Error && error.message === 'Import job not found') {
      return NextResponse.json(
        { error: 'Import job not found' },
        { status: 404 }
      );
    }

    console.error('Error fetching job progress:', error);
    return NextResponse.json(
      { error: 'Failed to fetch job progress' },
      { status: 500 }
    );
  }
}
