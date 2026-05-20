import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthContext } from '@/lib/auth/context';
import { assertWebsiteOwnership } from '@/lib/auth/ownership';

// GET /api/structure/resolve - Resolve URL path to structure/page
export async function GET(request: NextRequest) {
  // Auth check - always required
  let auth;
  try {
    auth = await getAuthContext(request);
  } catch {
    return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const websiteId = searchParams.get('websiteId');
    const path = searchParams.get('path');

    if (!websiteId || !path) {
      return NextResponse.json(
        { error: { message: 'websiteId and path are required' } },
        { status: 400 }
      );
    }

    // Verify ownership
    await assertWebsiteOwnership(prisma as any, auth.accountId, websiteId);

    // Resolve the path directly using Prisma
    const structure = await prisma.websiteStructure.findFirst({
      where: {
        websiteId,
        fullPath: path
      }
    });
    
    if (!structure) {
      return NextResponse.json(
        { error: { message: 'Page not found for this path' } },
        { status: 404 }
      );
    }

    // Include the associated page if it exists
    const result = await prisma.websiteStructure.findUnique({
      where: { id: structure.id },
      include: {
        websitePage: true,
        parent: true,
        children: {
          orderBy: { position: 'asc' }
        }
      }
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[API Error] GET /api/structure/resolve:', error);
    
    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 }
    );
  }
}