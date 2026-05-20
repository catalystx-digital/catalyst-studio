import { NextRequest, NextResponse } from 'next/server';
import { pageOrchestrator } from '@/lib/services/site-structure/page-orchestrator';
import { MovePageDto } from '@/lib/types/page-orchestrator.types';
import { getAuthContext } from '@/lib/auth/context';
import { assertWebsiteOwnership } from '@/lib/auth/ownership';
import { prisma } from '@/lib/prisma';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Auth check - always required
    let auth;
    try {
      auth = await getAuthContext(request);
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;

    // Get structure to find websiteId for ownership check
    const structure = await prisma.websiteStructure.findUnique({
      where: { id: resolvedParams.id },
      select: { websiteId: true }
    });
    if (!structure) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }
    await assertWebsiteOwnership(prisma as any, auth.accountId, structure.websiteId);

    const body: MovePageDto = await request.json();
    const result = await pageOrchestrator.movePage(resolvedParams.id, body);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error moving page:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    if (errorMessage.includes('Circular')) {
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    if (errorMessage.includes('not found')) {
      return NextResponse.json({ error: errorMessage }, { status: 404 });
    }

    return NextResponse.json(
      { error: errorMessage || 'Failed to move page' },
      { status: 500 }
    );
  }
}