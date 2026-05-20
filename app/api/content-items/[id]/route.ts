import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@/lib/generated/prisma';
import { validateUpdateContentItem } from '@/lib/api/validation/content-item';
import { routeContentItemRequest } from '@/lib/api/middleware/backward-compatibility';

// GET /api/content-items/[id] - DEPRECATED: Redirects to new endpoints
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  return routeContentItemRequest(request, resolvedParams);
}

// Original GET implementation (kept for reference but not used)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function _originalGET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Try to find in WebsitePage first
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let item: any = await prisma.websitePage.findUnique({
      where: { id },
      include: {
        contentType: true,
        website: true,
      },
    });
    
    let modelType = 'websitePage';
    
    // If not found, try WebsiteCustomContentData
    if (!item) {
      const customItem = await prisma.websiteCustomContentData.findUnique({
        where: { id },
        include: {
          contentType: true,
          website: true,
        },
      });
      
      if (customItem) {
        item = customItem;
        modelType = 'websiteCustomContentData';
      }
    }
    
    if (!item) {
      return NextResponse.json(
        { error: { message: 'Content item not found' } },
        { status: 404 }
      );
    }
    
    // Transform response based on model type
    const transformed = {
      id: item.id,
      contentTypeId: item.contentTypeId,
      websiteId: item.websiteId,
      title: item.title,
      slug: modelType === 'websitePage' && 'type' in item && item.type === 'page' 
        ? item.title.toLowerCase().replace(/\s+/g, '-') 
        : item.title.toLowerCase().replace(/\s+/g, '-'),
      content: modelType === 'websitePage' && 'content' in item ? item.content : 'data' in item ? item.data : {},
      metadata: modelType === 'websitePage' && 'metadata' in item ? item.metadata : {},
      status: item.status,
      publishedAt: item.publishedAt,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      contentType: {
        ...item.contentType,
        fields: item.contentType.fields,
      },
      website: {
        ...item.website,
        metadata: item.website.metadata,
        settings: item.website.settings,
      },
      modelType,
    };
    
    return NextResponse.json({ data: transformed });
  } catch (error) {
    console.error('Error fetching content item:', error);
    return NextResponse.json(
      { error: { message: 'Failed to fetch content item' } },
      { status: 500 }
    );
  }
}

// PUT /api/content-items/[id] - DEPRECATED: Redirects to new endpoints
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  return routeContentItemRequest(request, resolvedParams);
}

// Original PUT implementation (kept for reference but not used)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function _originalPUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    // Validate request body
    const validation = validateUpdateContentItem(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: { message: 'Invalid request body', details: validation.error.errors } },
        { status: 400 }
      );
    }
    
    const validatedData = validation.data;
    
    // Check if item exists in either model
    let existing: any = await prisma.websitePage.findUnique({
      where: { id },
      include: { contentType: true },
    });
    
    let modelType = 'websitePage';
    
    if (!existing) {
      const customExisting = await prisma.websiteCustomContentData.findUnique({
        where: { id },
        include: { contentType: true },
      });
      
      if (customExisting) {
        existing = customExisting;
        modelType = 'websiteCustomContentData';
      }
    }
    
    if (!existing) {
      return NextResponse.json(
        { error: { message: 'Content item not found' } },
        { status: 404 }
      );
    }
    
    let updatedItem;
    
    if (modelType === 'websitePage') {
      // Prepare update data for WebsitePage
      const pageUpdateData: Prisma.WebsitePageUpdateInput = {};
      if (validatedData.title !== undefined) pageUpdateData.title = validatedData.title;
      if (validatedData.content !== undefined) pageUpdateData.content = validatedData.content;
      if (validatedData.metadata !== undefined) pageUpdateData.metadata = validatedData.metadata;
      if (validatedData.status !== undefined) pageUpdateData.status = validatedData.status;
      if (validatedData.publishedAt !== undefined) {
        pageUpdateData.publishedAt = validatedData.publishedAt ? new Date(validatedData.publishedAt) : null;
      }
      
      // Update WebsitePage
      updatedItem = await prisma.websitePage.update({
        where: { id },
        data: pageUpdateData,
        include: {
          contentType: true,
          website: true,
        },
      });
    } else {
      // Prepare update data for WebsiteCustomContentData
      const customUpdateData: Prisma.WebsiteCustomContentDataUpdateInput = {};
      if (validatedData.title !== undefined) customUpdateData.title = validatedData.title;
      if (validatedData.content !== undefined) customUpdateData.data = validatedData.content;
      if (validatedData.status !== undefined) customUpdateData.status = validatedData.status;
      if (validatedData.publishedAt !== undefined) {
        customUpdateData.publishedAt = validatedData.publishedAt ? new Date(validatedData.publishedAt) : null;
      }
      
      // Update WebsiteCustomContentData
      updatedItem = await prisma.websiteCustomContentData.update({
        where: { id },
        data: customUpdateData,
        include: {
          contentType: true,
          website: true,
        },
      });
    }
    
    // Transform response based on model type
    const transformed = {
      id: updatedItem.id,
      contentTypeId: updatedItem.contentTypeId,
      websiteId: updatedItem.websiteId,
      title: updatedItem.title,
      slug: validatedData.slug || updatedItem.title.toLowerCase().replace(/\s+/g, '-'),
      content: modelType === 'websitePage' && 'content' in updatedItem 
        ? updatedItem.content 
        : 'data' in updatedItem ? updatedItem.data : {},
      metadata: modelType === 'websitePage' && 'metadata' in updatedItem 
        ? updatedItem.metadata 
        : {},
      status: updatedItem.status,
      publishedAt: updatedItem.publishedAt,
      createdAt: updatedItem.createdAt,
      updatedAt: updatedItem.updatedAt,
      contentType: {
        ...updatedItem.contentType,
        fields: updatedItem.contentType.fields,
      },
      website: {
        ...updatedItem.website,
        metadata: updatedItem.website.metadata,
        settings: updatedItem.website.settings,
      },
      modelType,
    };
    
    return NextResponse.json({ data: transformed });
  } catch (error) {
    console.error('Error updating content item:', error);
    return NextResponse.json(
      { error: { message: 'Failed to update content item' } },
      { status: 500 }
    );
  }
}

// DELETE /api/content-items/[id] - DEPRECATED: Redirects to new endpoints
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  return routeContentItemRequest(request, resolvedParams);
}

// Original DELETE implementation (kept for reference but not used)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function _originalDELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Check if item exists in either model
    let existing: any = await prisma.websitePage.findUnique({
      where: { id },
    });
    
    let modelType = 'websitePage';
    
    if (!existing) {
      const customExisting = await prisma.websiteCustomContentData.findUnique({
        where: { id },
      });
      
      if (customExisting) {
        existing = customExisting;
        modelType = 'websiteCustomContentData';
      }
    }
    
    if (!existing) {
      return NextResponse.json(
        { error: { message: 'Content item not found' } },
        { status: 404 }
      );
    }
    
    // Soft delete by setting status to archived
    let archivedItem;
    if (modelType === 'websitePage') {
      archivedItem = await prisma.websitePage.update({
        where: { id },
        data: { status: 'archived' },
      });
    } else {
      archivedItem = await prisma.websiteCustomContentData.update({
        where: { id },
        data: { status: 'archived' },
      });
    }
    
    return NextResponse.json({ 
      data: { 
        id: archivedItem.id, 
        status: archivedItem.status,
        message: 'Content item archived successfully',
        modelType
      } 
    });
  } catch (error) {
    console.error('Error deleting content item:', error);
    return NextResponse.json(
      { error: { message: 'Failed to delete content item' } },
      { status: 500 }
    );
  }
}