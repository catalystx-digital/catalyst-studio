import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthContext } from '@/lib/auth/context';
import { assertWebsiteOwnership } from '@/lib/auth/ownership';
import { createErrorResponse, createSuccessResponse } from '@/lib/studio/utils/api-error-handler';

/**
 * GET /api/studio/site-builder/pages
 * List all pages for a website with hierarchy information
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const websiteId = searchParams.get('websiteId');
    const search = searchParams.get('search') || '';

    if (!websiteId) {
      return createErrorResponse(
        new Error('websiteId is required'),
        'websiteId is required'
      );
    }

    // Auth check - always required
    let auth;
    try {
      auth = await getAuthContext(request);
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    await assertWebsiteOwnership(prisma as any, auth.accountId, websiteId);

    // Query WebsiteStructure joined with WebsitePage
    const structures = await prisma.websiteStructure.findMany({
      where: {
        websiteId,
        websitePageId: { not: null },
        ...(search && {
          OR: [
            { slug: { contains: search, mode: 'insensitive' } },
            { websitePage: { title: { contains: search, mode: 'insensitive' } } }
          ]
        })
      },
      include: {
        websitePage: { select: { id: true, title: true } }
      },
      orderBy: [{ pathDepth: 'asc' }, { position: 'asc' }]
    });

    const pages = structures.map(s => ({
      id: s.websitePageId!,
      title: s.websitePage?.title || s.slug,
      path: s.fullPath,
      depth: s.pathDepth
    }));

    return createSuccessResponse(
      { pages },
      { pages }
    );

  } catch (error) {
    return createErrorResponse(error, 'Failed to fetch pages');
  }
}
