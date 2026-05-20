import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { PageService } from '@/lib/services/page-service';
import { Prisma } from '@/lib/generated/prisma';
import { validateUpdateContentItem } from '@/lib/api/validation/content-item';
import { getAuthContext } from '@/lib/auth/context';
import { assertWebsiteOwnership } from '@/lib/auth/ownership';

// GET /api/content/pages/[id] - Get a single page
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { error: { message: 'Page ID is required' } },
        { status: 400 }
      );
    }

    const pageService = new PageService(prisma);
    const page = await pageService.getPage(id);

    if (!page) {
      return NextResponse.json(
        { error: { message: 'Page not found' } },
        { status: 404 }
      );
    }

    // Auth check - always required
    let auth;
    try {
      auth = await getAuthContext(request);
    } catch {
      return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
    }
    await assertWebsiteOwnership(prisma as any, auth.accountId, page.websiteId);

    return NextResponse.json(page);
  } catch (error) {
    console.error('[API Error] GET /api/content/pages/[id]:', error);
    
    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 }
    );
  }
}

// PUT /api/content/pages/[id] - Update a page
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { error: { message: 'Page ID is required' } },
        { status: 400 }
      );
    }

    const pageService = new PageService(prisma);

    // Check if page exists
    const existingPage = await pageService.getPage(id);
    if (!existingPage) {
      return NextResponse.json(
        { error: { message: 'Page not found' } },
        { status: 404 }
      );
    }

    // Auth check - always required
    let auth;
    try {
      auth = await getAuthContext(request);
    } catch {
      return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
    }
    await assertWebsiteOwnership(prisma as any, auth.accountId, existingPage.websiteId);

    const body = await request.json();

    // Validate request body
    const validation = validateUpdateContentItem(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: { message: 'Invalid request body', details: validation.error.errors } },
        { status: 400 }
      );
    }

    // Update page using service
    const updatedPage = await pageService.updatePage(id, {
      title: body.title,
      slug: body.slug,
      content: body.content,
      description: body.description,
      seoTitle: body.seoTitle,
      seoDescription: body.seoDescription,
      seoKeywords: body.seoKeywords,
      ogImage: body.ogImage,
      status: body.status,
      publishedAt: body.publishedAt,
    });
    
    return NextResponse.json(updatedPage);
  } catch (error) {
    console.error('[API Error] PUT /api/content/pages/[id]:', error);
    
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return NextResponse.json(
          { error: { message: 'A page with this slug already exists' } },
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

// DELETE /api/content/pages/[id] - Delete a page
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { error: { message: 'Page ID is required' } },
        { status: 400 }
      );
    }

    const pageService = new PageService(prisma);

    // Check if page exists
    const existingPage = await pageService.getPage(id);
    if (!existingPage) {
      return NextResponse.json(
        { error: { message: 'Page not found' } },
        { status: 404 }
      );
    }

    // Auth check - always required
    let auth;
    try {
      auth = await getAuthContext(request);
    } catch {
      return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
    }
    await assertWebsiteOwnership(prisma as any, auth.accountId, existingPage.websiteId);

    // Delete page using service
    await pageService.deletePage(id);
    
    return NextResponse.json(
      { message: 'Page deleted successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('[API Error] DELETE /api/content/pages/[id]:', error);
    
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2003') {
        return NextResponse.json(
          { error: { message: 'Cannot delete page with child pages' } },
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