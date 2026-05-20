import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ContentDataService } from '@/lib/services/content-data-service';
import { Prisma } from '@/lib/generated/prisma';
import { validateContentItemsQuery, validateCreateContentItem } from '@/lib/api/validation/content-item';
import { ContentStatus } from '@/types/api';
import { getAuthContext } from '@/lib/auth/context';
import { assertWebsiteOwnership } from '@/lib/auth/ownership';

// GET /api/content/data - Get paginated custom content data
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

    // Build where clause for WebsiteCustomContentData
    const where: Prisma.WebsiteCustomContentDataWhereInput = {};

    if (status) {
      where.status = status;
    }
    if (contentTypeId) {
      where.contentTypeId = contentTypeId;
    }
    if (websiteId) {
      where.websiteId = websiteId;
    } else {
      // If no websiteId filter, only show data from user's websites
      const userWebsites = await prisma.website.findMany({
        where: { accountId: auth.accountId },
        select: { id: true }
      });
      where.websiteId = { in: userWebsites.map(w => w.id) };
    }

    // Count total items
    const total = await prisma.websiteCustomContentData.count({ where });

    // Fetch paginated items
    const skip = (page - 1) * limit;
    const items = await prisma.websiteCustomContentData.findMany({
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
      },
    });

    const totalPages = Math.ceil(total / limit);

    const response = {
      data: items.map(item => ({
        id: item.id,
        contentTypeId: item.contentTypeId,
        websiteId: item.websiteId,
        title: item.title,
        data: item.data || {},
        // customFields removed from model
        status: item.status as ContentStatus,
        publishedAt: item.publishedAt,
        // publishedById removed from model
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        contentType: item.contentType,
        website: item.website,
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
    console.error('[API Error] GET /api/content/data:', error);

    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 }
    );
  }
}

// POST /api/content/data - Create new custom content data
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

    const contentDataService = new ContentDataService(prisma);

    // Create content data using service
    const result = await contentDataService.createContentData({
      websiteId: body.websiteId,
      title: body.title,
      data: body.content || body.data || {},
      contentTypeId: body.contentTypeId,
      publishedAt: body.publishedAt,
      // publishedById and customFields removed from model
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('[API Error] POST /api/content/data:', error);

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return NextResponse.json(
          { error: { message: 'Content data with this identifier already exists' } },
          { status: 409 }
        );
      }
    }

    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 }
    );
  }
}