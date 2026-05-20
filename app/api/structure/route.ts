import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { StructureService } from '@/lib/services/structure-service';
import { Prisma } from '@/lib/generated/prisma';
import { getAuthContext } from '@/lib/auth/context';
import { assertWebsiteOwnership } from '@/lib/auth/ownership';
import { ApiError, handleApiError } from '@/lib/api/errors';

// GET /api/structure - Get website structure
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const websiteId = searchParams.get('websiteId');
    const parentId = searchParams.get('parentId');
    const includePages = searchParams.get('includePages') === 'true';

    if (!websiteId) {
      return NextResponse.json(
        { error: { message: 'websiteId is required' } },
        { status: 400 }
      );
    }

    // Auth check - always required
    let auth;
    try {
      auth = await getAuthContext(request);
    } catch {
      return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
    }
    await assertWebsiteOwnership(prisma as any, auth.accountId, websiteId);

    // Build where clause
    const where: Prisma.WebsiteStructureWhereInput = {
      websiteId,
      parentId: parentId || null
    };

    // Get structures
    const structures = await prisma.websiteStructure.findMany({
      where,
      orderBy: { position: 'asc' },
      include: includePages ? {
        websitePage: true,
        children: {
          orderBy: { position: 'asc' }
        }
      } : undefined
    });

    return NextResponse.json(structures);
  } catch (error) {
    if (error instanceof ApiError) {
      return handleApiError(error);
    }
    console.error('[API Error] GET /api/structure:', error);

    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 }
    );
  }
}

// POST /api/structure - Create structure entry
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.websiteId || !body.slug) {
      return NextResponse.json(
        { error: { message: 'websiteId and slug are required' } },
        { status: 400 }
      );
    }

    // Auth check - always required
    let auth;
    try {
      auth = await getAuthContext(request);
    } catch {
      return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
    }
    await assertWebsiteOwnership(prisma as any, auth.accountId, body.websiteId);

    const structureService = new StructureService(prisma);

    // Check for duplicate slug at same level
    const existing = await prisma.websiteStructure.findFirst({
      where: {
        websiteId: body.websiteId,
        slug: body.slug,
        parentId: body.parentId || null
      }
    });

    if (existing) {
      return NextResponse.json(
        { error: { message: 'A structure with this slug already exists at this level' } },
        { status: 409 }
      );
    }

    // Create structure using service
    const structure = await structureService.createStructure({
      websiteId: body.websiteId,
      slug: body.slug,
      websitePageId: body.websitePageId,
      parentId: body.parentId,
      position: body.position,
    });
    
    return NextResponse.json(structure, { status: 201 });
  } catch (error) {
    if (error instanceof ApiError) {
      return handleApiError(error);
    }
    console.error('[API Error] POST /api/structure:', error);

    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 }
    );
  }
}

// PUT /api/structure - Update structure (for moves/reorders)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.id) {
      return NextResponse.json(
        { error: { message: 'Structure ID is required' } },
        { status: 400 }
      );
    }

    // Auth check - always required
    let auth;
    try {
      auth = await getAuthContext(request);
    } catch {
      return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
    }
    const existing = await prisma.websiteStructure.findUnique({
      where: { id: body.id },
      select: { websiteId: true }
    });
    if (!existing) {
      return NextResponse.json({ error: { message: 'Structure not found' } }, { status: 404 });
    }
    await assertWebsiteOwnership(prisma as any, auth.accountId, existing.websiteId);

    const structureService = new StructureService(prisma);

    // Handle move operation
    if ('parentId' in body || 'position' in body) {
      const moved = await structureService.moveStructure({
        structureId: body.id,
        newParentId: body.parentId,
        position: body.position
      });
      
      return NextResponse.json(moved);
    }
    
    // Handle regular update
    const updated = await structureService.updateStructure(body.id, {
      slug: body.slug,
    });
    
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof ApiError) {
      return handleApiError(error);
    }
    console.error('[API Error] PUT /api/structure:', error);

    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 }
    );
  }
}
