import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ContentStatus } from '@/types/api';
import { Prisma } from '@/lib/generated/prisma';
import { validateContentItemsQuery, validateCreateContentItem } from '@/lib/api/validation/content-item';
import { safeJsonParse } from '@/lib/utils/safe-json';
import { ServiceFactory } from '@/lib/services';
import { routeContentItemRequest } from '@/lib/api/middleware/backward-compatibility';

// GET /api/content-items - DEPRECATED: Redirects to new endpoints
export async function GET(request: NextRequest) {
  // Use backward compatibility routing
  return routeContentItemRequest(request);
}

// Original GET implementation (kept for reference but not used)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function _originalGET(request: NextRequest) {
  try {
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
    
    // First, determine which model to query based on content type
    let contentTypeCategory: 'page' | 'component' | null = null;
    
    if (contentTypeId) {
      const contentType = await prisma.contentType.findUnique({
        where: { id: contentTypeId },
        select: { category: true }
      });
      if (contentType) {
        contentTypeCategory = contentType.category as 'page' | 'component';
      }
    }
    
    // Build where clauses for both models
    const pageWhere: Prisma.WebsitePageWhereInput = {};
    const customWhere: Prisma.WebsiteCustomContentDataWhereInput = {};
    
    if (status) {
      pageWhere.status = status;
      customWhere.status = status;
    }
    if (contentTypeId) {
      pageWhere.contentTypeId = contentTypeId;
      customWhere.contentTypeId = contentTypeId;
    }
    if (websiteId) {
      pageWhere.websiteId = websiteId;
      customWhere.websiteId = websiteId;
    }
    
    // Query appropriate model(s)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let pages: Array<any> = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let customData: Array<any> = [];
    let total = 0;
    
    const skip = (page - 1) * limit;
    
    if (!contentTypeCategory || contentTypeCategory === 'page') {
      // Query WebsitePage
      const pageCount = await prisma.websitePage.count({ where: pageWhere });
      pages = await prisma.websitePage.findMany({
        where: pageWhere,
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
      total += pageCount;
    }
    
    if (!contentTypeCategory || contentTypeCategory === 'component') {
      // Query WebsiteCustomContentData
      const customCount = await prisma.websiteCustomContentData.count({ where: customWhere });
      customData = await prisma.websiteCustomContentData.findMany({
        where: customWhere,
        skip: contentTypeCategory === 'component' ? skip : Math.max(0, skip - total),
        take: contentTypeCategory === 'component' ? limit : Math.max(0, limit - pages.length),
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
      total += customCount;
    }
    
    // Combine and transform results
    const transformedItems = [
      ...pages.map(item => ({
        id: item.id,
        contentTypeId: item.contentTypeId,
        websiteId: item.websiteId,
        title: item.title,
        slug: item.type === 'page' ? item.title.toLowerCase().replace(/\s+/g, '-') : null,
        content: item.content || {},
        metadata: item.metadata,
        status: item.status as ContentStatus,
        publishedAt: item.publishedAt,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        contentType: item.contentType,
        website: item.website,
        modelType: 'websitePage' as const,
      })),
      ...customData.map(item => ({
        id: item.id,
        contentTypeId: item.contentTypeId,
        websiteId: item.websiteId,
        title: item.title,
        slug: item.title.toLowerCase().replace(/\s+/g, '-'),
        content: item.data || {},
        metadata: {},
        status: item.status as ContentStatus,
        publishedAt: item.publishedAt,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        contentType: item.contentType,
        website: item.website,
        modelType: 'websiteCustomContentData' as const,
      })),
    ];
    
    const totalPages = Math.ceil(total / limit);
    
    const response = {
      data: transformedItems,
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
    console.error('Error fetching content items:', error);
    return NextResponse.json(
      { error: { message: 'Failed to fetch content items' } },
      { status: 500 }
    );
  }
}

// POST /api/content-items - DEPRECATED: Redirects to new endpoints
export async function POST(request: NextRequest) {
  // Use backward compatibility routing
  return routeContentItemRequest(request);
}

// Original POST implementation (kept for reference but not used)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function _originalPOST(request: NextRequest) {
  try {
    // Handle empty body
    const contentType = request.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return NextResponse.json(
        { error: { message: 'Content-Type must be application/json' } },
        { status: 400 }
      );
    }

    let body;
    try {
      const text = await request.text();
      if (!text) {
        return NextResponse.json(
          { error: { message: 'Request body is required' } },
          { status: 400 }
        );
      }
      body = safeJsonParse(text, {});
      if (!body) {
        return NextResponse.json(
          { error: 'Invalid JSON in request body' },
          { status: 400 }
        );
      }
    } catch {
      return NextResponse.json(
        { error: { message: 'Invalid JSON in request body' } },
        { status: 400 }
      );
    }
    
    // Validate request body
    const validation = validateCreateContentItem(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: { message: 'Invalid request body', details: validation.error.errors } },
        { status: 400 }
      );
    }
    
    const validatedData = validation.data;
    
    // Initialize services
    const services = ServiceFactory.getInstance(prisma);
    
    // Determine which model to use based on content type
    const foundContentType = await prisma.contentType.findUnique({
      where: { id: validatedData.contentTypeId },
      select: { category: true }
    });
    
    if (!foundContentType) {
      return NextResponse.json(
        { error: { message: 'Content type not found' } },
        { status: 404 }
      );
    }
    
    let createdItem;
    
    if (foundContentType.category === 'page') {
      // Use PageService to create page
      const pageData = {
        websiteId: validatedData.websiteId,
        type: 'page' as const,
        title: validatedData.title,
        content: validatedData.content,
        slug: validatedData.slug,
        description: validatedData.metadata?.description,
        seoTitle: validatedData.metadata?.seoTitle,
        seoDescription: validatedData.metadata?.seoDescription,
        seoKeywords: validatedData.metadata?.seoKeywords,
        ogImage: validatedData.metadata?.ogImage,
      };
      
      const page = await services.pageService.createPage(pageData);
      
      // Load full data for response
      const fullPage = await prisma.websitePage.findUnique({
        where: { id: page.id },
        include: {
          contentType: true,
          website: true,
        },
      });
      
      // Transform response
      createdItem = {
        ...fullPage,
        slug: page.structure?.slug || validatedData.slug,
        content: fullPage?.content || {},
        modelType: 'websitePage',
      };
    } else {
      // Use ContentDataService to create custom content data
      const contentData = await services.contentDataService.createContentData({
        websiteId: validatedData.websiteId,
        title: validatedData.title,
        data: validatedData.content,
        contentTypeId: validatedData.contentTypeId,
        publishedAt: validatedData.publishedAt ? new Date(validatedData.publishedAt) : undefined,
        // metadata is not a field in WebsiteCustomContentData
      });
      
      // Load full data for response
      const fullContentData = await prisma.websiteCustomContentData.findUnique({
        where: { id: contentData.id },
        include: {
          contentType: true,
          website: true,
        },
      });
      
      // Transform response
      createdItem = {
        ...fullContentData,
        slug: validatedData.slug,
        content: fullContentData?.data || {},
        metadata: validatedData.metadata || {},
        modelType: 'websiteCustomContentData',
      };
    }
    
    const transformed = {
      ...createdItem,
      contentType: createdItem?.contentType,
      website: createdItem?.website,
    };
    
    return NextResponse.json({ data: transformed }, { status: 201 });
  } catch (error) {
    console.error('Error creating content item:', error);
    return NextResponse.json(
      { error: { message: 'Failed to create content item' } },
      { status: 500 }
    );
  }
}