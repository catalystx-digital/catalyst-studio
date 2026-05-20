import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ContentDataService } from '@/lib/services/content-data-service';
import { validateUpdateContentItem } from '@/lib/api/validation/content-item';
import { getAuthContext } from '@/lib/auth/context';
import { assertWebsiteOwnership } from '@/lib/auth/ownership';

// Helper to get content data's websiteId for ownership check
async function assertContentDataOwnership(accountId: string, contentDataId: string) {
  const contentData = await prisma.websiteCustomContentData.findUnique({
    where: { id: contentDataId },
    select: { websiteId: true }
  });
  if (!contentData) {
    return null; // Will be handled as 404 by caller
  }
  await assertWebsiteOwnership(prisma as any, accountId, contentData.websiteId);
  return contentData;
}

// GET /api/content/data/[id] - Get single custom content data
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Auth check - always required
    let auth;
    try {
      auth = await getAuthContext(request);
    } catch {
      return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { error: { message: 'Content data ID is required' } },
        { status: 400 }
      );
    }

    // Verify ownership of the content data's website
    const ownershipCheck = await assertContentDataOwnership(auth.accountId, id);
    if (!ownershipCheck) {
      return NextResponse.json(
        { error: { message: 'Content data not found' } },
        { status: 404 }
      );
    }

    const contentDataService = new ContentDataService(prisma);
    const contentData = await contentDataService.getContentDataWithType(id);

    if (!contentData) {
      return NextResponse.json(
        { error: { message: 'Content data not found' } },
        { status: 404 }
      );
    }

    return NextResponse.json(contentData);
  } catch (error) {
    console.error('[API Error] GET /api/content/data/[id]:', error);

    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 }
    );
  }
}

// PUT /api/content/data/[id] - Update custom content data
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Auth check - always required
    let auth;
    try {
      auth = await getAuthContext(request);
    } catch {
      return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { error: { message: 'Content data ID is required' } },
        { status: 400 }
      );
    }

    // Verify ownership of the content data's website
    const ownershipCheck = await assertContentDataOwnership(auth.accountId, id);
    if (!ownershipCheck) {
      return NextResponse.json(
        { error: { message: 'Content data not found' } },
        { status: 404 }
      );
    }

    const body = await request.json();

    // Validate request body
    const validation = validateUpdateContentItem(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: { message: 'Invalid request body', details: validation.error.errors } },
        { status: 400 }
      );
    }

    const contentDataService = new ContentDataService(prisma);

    // Check if content data exists
    const existingData = await contentDataService.getContentData(id);
    if (!existingData) {
      return NextResponse.json(
        { error: { message: 'Content data not found' } },
        { status: 404 }
      );
    }

    // Update content data using service
    const updatedData = await contentDataService.updateContentData(id, {
      title: body.title,
      data: body.content || body.data,
      status: body.status,
      publishedAt: body.publishedAt,
      // publishedById and customFields removed from model
    });

    return NextResponse.json(updatedData);
  } catch (error) {
    console.error('[API Error] PUT /api/content/data/[id]:', error);

    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 }
    );
  }
}

// DELETE /api/content/data/[id] - Delete custom content data
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Auth check - always required
    let auth;
    try {
      auth = await getAuthContext(request);
    } catch {
      return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { error: { message: 'Content data ID is required' } },
        { status: 400 }
      );
    }

    // Verify ownership of the content data's website
    const ownershipCheck = await assertContentDataOwnership(auth.accountId, id);
    if (!ownershipCheck) {
      return NextResponse.json(
        { error: { message: 'Content data not found' } },
        { status: 404 }
      );
    }

    const contentDataService = new ContentDataService(prisma);

    // Check if content data exists
    const existingData = await contentDataService.getContentData(id);
    if (!existingData) {
      return NextResponse.json(
        { error: { message: 'Content data not found' } },
        { status: 404 }
      );
    }

    // Delete content data using service
    await contentDataService.deleteContentData(id);

    return NextResponse.json(
      { message: 'Content data deleted successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('[API Error] DELETE /api/content/data/[id]:', error);

    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 }
    );
  }
}