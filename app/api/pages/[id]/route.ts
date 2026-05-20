import { NextRequest, NextResponse } from 'next/server';
import { pageOrchestrator } from '@/lib/services/site-structure/page-orchestrator';
import { UpdatePageDto, DeleteOptions } from '@/lib/types/page-orchestrator.types';
import { getAuthorizedContext, assertPermission } from '@/lib/auth/authorization';
import { assertWebsiteOwnership } from '@/lib/auth/ownership';
import { prisma } from '@/lib/prisma';

/**
 * Helper to get websiteId from a websiteStructure id
 */
async function getStructureWebsiteId(structureId: string): Promise<string | null> {
  const structure = await prisma.websiteStructure.findUnique({
    where: { id: structureId },
    select: { websiteId: true }
  });
  return structure?.websiteId ?? null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;

    // 1. Get authorized context (includes role)
    const context = await getAuthorizedContext(request);

    // 2. Check permission
    await assertPermission(context, 'content:view');

    // 3. Verify website ownership
    const websiteId = await getStructureWebsiteId(resolvedParams.id);
    if (!websiteId) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }
    await assertWebsiteOwnership(prisma as any, context.accountId, websiteId);

    // 4. Get the page
    const result = await pageOrchestrator.getPage(resolvedParams.id);

    if (!result) {
      return NextResponse.json(
        { error: 'Page not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error getting page:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get page' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;

    // 1. Get authorized context (includes role)
    const context = await getAuthorizedContext(request);

    // 2. Check permission
    await assertPermission(context, 'content:edit');

    // 3. Verify website ownership
    const websiteId = await getStructureWebsiteId(resolvedParams.id);
    if (!websiteId) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }
    await assertWebsiteOwnership(prisma as any, context.accountId, websiteId);

    // 4. Update the page
    const body: UpdatePageDto = await request.json();
    const result = await pageOrchestrator.updatePage(resolvedParams.id, body);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error updating page:', error);

    // Handle specific error types
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (errorMessage.includes('Duplicate') || errorMessage.includes('already exists')) {
      return NextResponse.json({ error: errorMessage }, { status: 409 });
    }

    if (errorMessage.includes('Invalid slug')) {
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    if (errorMessage.includes('not found')) {
      return NextResponse.json({ error: errorMessage }, { status: 404 });
    }

    return NextResponse.json(
      { error: errorMessage || 'Failed to update page' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;

    // 1. Get authorized context (includes role)
    const context = await getAuthorizedContext(request);

    // 2. Check permission
    await assertPermission(context, 'content:delete');

    // 3. Verify website ownership
    const websiteId = await getStructureWebsiteId(resolvedParams.id);
    if (!websiteId) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }
    await assertWebsiteOwnership(prisma as any, context.accountId, websiteId);

    // 4. Parse delete options from query params
    const url = new URL(request.url);
    const options: DeleteOptions = {
      cascade: url.searchParams.get('cascade') === 'true',
      orphanChildren: url.searchParams.get('orphanChildren') === 'true',
      deleteContent: url.searchParams.get('deleteContent') !== 'false'
    };

    // 5. Delete the page
    await pageOrchestrator.deletePage(resolvedParams.id, options);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Error deleting page:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (errorMessage.includes('not found')) {
      return NextResponse.json({ error: errorMessage }, { status: 404 });
    }

    if (errorMessage.includes('has children')) {
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    return NextResponse.json(
      { error: errorMessage || 'Failed to delete page' },
      { status: 500 }
    );
  }
}