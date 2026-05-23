import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { PageService } from '@/lib/services/page-service';
import { Prisma } from '@/lib/generated/prisma';
import { validateContentItemsQuery, validateCreateContentItem } from '@/lib/api/validation/content-item';
import { ContentStatus } from '@/types/api';
import { getAuthContext } from '@/lib/auth/context';
import { assertWebsiteOwnership } from '@/lib/auth/ownership';
import { PageContentNormalizationError } from '@/lib/studio/page-content';

// GET /api/content/pages - Get paginated pages
export async function GET(request: NextRequest) {
  try {
    // Auth check - always required
    let auth;
    try {
      auth = await getAuthContext(request);
    } catch {
      return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;

    // Validate query parameters
    const validation = validateContentItemsQuery(searchParams);
    if (!validation.success) {
      return NextResponse.json(
        { error: { message: 'Invalid query parameters', details: validation.error.errors } },
        { status: 400 }
      );
    }

    const { page, limit, status, contentTypeId, websiteId, sortBy, sortOrder } = validation.data;

    // If websiteId is provided, verify ownership
    if (websiteId) {
      await assertWebsiteOwnership(prisma as any, auth.accountId, websiteId);
    }

    // Build where clause for WebsitePage
    const where: Prisma.WebsitePageWhereInput = {
      type: { in: ['page', 'folder'] }, // Only pages and folders
    };

    if (status) {
      where.status = status;
    }
    if (contentTypeId) {
      where.contentTypeId = contentTypeId;
    }
    if (websiteId) {
      where.websiteId = websiteId;
    } else {
      // If no websiteId filter, only show pages from user's websites
      const userWebsites = await prisma.website.findMany({
        where: { accountId: auth.accountId },
        select: { id: true }
      });
      where.websiteId = { in: userWebsites.map(w => w.id) };
    }

    // Count total items
    const total = await prisma.websitePage.count({ where });

    // Fetch paginated items
    const skip = (page - 1) * limit;
    const items = await prisma.websitePage.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: {
        contentType: {
          include: {
            website: true
          }
        },
        website: true,
        structures: true,
      },
    });

    const totalPages = Math.ceil(total / limit);

    const response = {
      data: items.map(item => ({
        id: item.id,
        contentTypeId: item.contentTypeId,
        websiteId: item.websiteId,
        type: item.type,
        title: item.title,
        content: item.content || {},
        metadata: item.metadata,
        status: item.status as ContentStatus,
        publishedAt: item.publishedAt,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        contentType: item.contentType,
        website: item.website,
        structures: item.structures,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[API Error] GET /api/content/pages:', error);

    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 }
    );
  }
}

// POST /api/content/pages - Create a new page
export async function POST(request: NextRequest) {
  try {
    // Auth check - always required
    let auth;
    try {
      auth = await getAuthContext(request);
    } catch {
      return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
    }

    const body = await request.json();

    // Validate request body
    const validation = validateCreateContentItem(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: { message: 'Invalid request body', details: validation.error.errors } },
        { status: 400 }
      );
    }

    // Verify ownership of the website
    if (body.websiteId) {
      await assertWebsiteOwnership(prisma as any, auth.accountId, body.websiteId);
    }

    const pageService = new PageService(prisma);

    // Create page using service
    const result = await pageService.createPage({
      websiteId: body.websiteId,
      contentTypeId: body.contentTypeId,
      type: body.type || 'page',
      title: body.title,
      slug: body.slug,
      content: body.content,
      description: body.description,
      seoTitle: body.seoTitle,
      seoDescription: body.seoDescription,
      seoKeywords: body.seoKeywords,
      ogImage: body.ogImage,
      parentId: body.parentId,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('[API Error] POST /api/content/pages:', error);

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return NextResponse.json(
          { error: { message: 'A page with this slug already exists' } },
          { status: 409 }
        );
      }
    }

    if (
      error instanceof Error
      && (error.message === 'Content type not found for website' || error.message === 'Content type not found')
    ) {
      return NextResponse.json(
        { error: { message: 'Content type not found' } },
        { status: 404 }
      );
    }

    if (error instanceof PageContentNormalizationError) {
      return NextResponse.json(
        { error: { message: 'Invalid page content', details: error.diagnostics } },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 }
    );
  }
}
