import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { CreateContentItemRequest } from '@/types/api';
import { getAuthContext } from '@/lib/auth/context';
import { assertWebsiteOwnership } from '@/lib/auth/ownership';

// POST /api/content-items/bulk - Bulk create/update content items
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
    const { items } = body as { items: CreateContentItemRequest[] };

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: { message: 'Items array is required and must not be empty' } },
        { status: 400 }
      );
    }

    // Validate all items have required fields
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.contentTypeId || !item.websiteId || !item.title || !item.content) {
        return NextResponse.json(
          { error: { message: `Item at index ${i} missing required fields (title, content)` } },
          { status: 400 }
        );
      }
    }

    // Verify ownership of all websites involved
    const websiteIds = [...new Set(items.map(item => item.websiteId))];
    for (const websiteId of websiteIds) {
      await assertWebsiteOwnership(prisma as any, auth.accountId, websiteId);
    }
    
    // Group items by content type category
    const contentTypeIds = [...new Set(items.map(item => item.contentTypeId))];
    const contentTypes = await prisma.contentType.findMany({
      where: { id: { in: contentTypeIds } },
      select: { id: true, category: true }
    });
    
    const contentTypeMap = new Map(contentTypes.map(ct => [ct.id, ct.category]));
    
    const pageItems = items.filter(item => contentTypeMap.get(item.contentTypeId) === 'page');
    const customItems = items.filter(item => contentTypeMap.get(item.contentTypeId) === 'component');
    
    // Perform bulk create using transaction
    const createdItems = await prisma.$transaction(async (tx) => {
      const pages = await Promise.all(
        pageItems.map(item => 
          tx.websitePage.create({
            data: {
              websiteId: item.websiteId,
              type: 'page',
              title: item.title,
              content: item.content,
              metadata: item.metadata || undefined,
              contentTypeId: item.contentTypeId,
              status: item.status || 'draft',
              publishedAt: item.publishedAt ? new Date(item.publishedAt) : undefined,
            },
          })
        )
      );
      
      const customData = await Promise.all(
        customItems.map(item => 
          tx.websiteCustomContentData.create({
            data: {
              websiteId: item.websiteId,
              title: item.title,
              data: item.content,
              contentTypeId: item.contentTypeId,
              status: item.status || 'draft',
              publishedAt: item.publishedAt ? new Date(item.publishedAt) : undefined,
            },
          })
        )
      );
      
      return [...pages, ...customData];
    });
    
    // Transform response
    const transformedItems = createdItems.map(item => ({
      id: item.id,
      contentTypeId: item.contentTypeId,
      websiteId: item.websiteId,
      title: item.title,
      content: 'content' in item ? item.content : 'data' in item ? item.data : {},
      metadata: 'metadata' in item ? item.metadata : {},
      status: item.status,
      publishedAt: item.publishedAt,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      modelType: 'content' in item ? 'websitePage' : 'websiteCustomContentData',
    }));
    
    return NextResponse.json({ 
      data: transformedItems,
      message: `Successfully created ${createdItems.length} content items` 
    }, { status: 201 });
  } catch (error) {
    console.error('Error bulk creating content items:', error);
    return NextResponse.json(
      { error: { message: 'Failed to bulk create content items' } },
      { status: 500 }
    );
  }
}

// DELETE /api/content-items/bulk - Bulk archive content items
export async function DELETE(request: NextRequest) {
  try {
    // Auth check - always required
    let auth;
    try {
      auth = await getAuthContext(request);
    } catch {
      return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
    }

    const body = await request.json();
    const { ids } = body as { ids: string[] };

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: { message: 'IDs array is required and must not be empty' } },
        { status: 400 }
      );
    }

    // Check which model each ID belongs to and verify ownership
    const [pages, customData] = await Promise.all([
      prisma.websitePage.findMany({
        where: { id: { in: ids } },
        select: { id: true, websiteId: true },
      }),
      prisma.websiteCustomContentData.findMany({
        where: { id: { in: ids } },
        select: { id: true, websiteId: true },
      }),
    ]);

    // Verify ownership of all websites involved
    const websiteIds = [...new Set([...pages.map(p => p.websiteId), ...customData.map(c => c.websiteId)])];
    for (const websiteId of websiteIds) {
      await assertWebsiteOwnership(prisma as any, auth.accountId, websiteId);
    }
    
    const pageIds = pages.map(p => p.id);
    const customIds = customData.map(c => c.id);
    
    // Perform bulk soft delete (archive) using transaction
    const results = await prisma.$transaction(async (tx) => {
      const pageResult = pageIds.length > 0 
        ? await tx.websitePage.updateMany({
            where: { id: { in: pageIds } },
            data: { status: 'archived' },
          })
        : { count: 0 };
      
      const customResult = customIds.length > 0
        ? await tx.websiteCustomContentData.updateMany({
            where: { id: { in: customIds } },
            data: { status: 'archived' },
          })
        : { count: 0 };
      
      return { pageCount: pageResult.count, customCount: customResult.count };
    });
    
    const totalCount = results.pageCount + results.customCount;
    
    return NextResponse.json({ 
      data: { 
        count: totalCount,
        pageCount: results.pageCount,
        customCount: results.customCount,
        message: `Successfully archived ${totalCount} content items` 
      } 
    });
  } catch (error) {
    console.error('Error bulk archiving content items:', error);
    return NextResponse.json(
      { error: { message: 'Failed to bulk archive content items' } },
      { status: 500 }
    );
  }
}