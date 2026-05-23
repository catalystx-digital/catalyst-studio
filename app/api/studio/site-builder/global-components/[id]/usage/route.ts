import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@/lib/generated/prisma';
import { ContentRepository } from '@/lib/services/unified-content-repository';
import { getAuthContext } from '@/lib/auth/context';
import { assertWebsiteOwnership } from '@/lib/auth/ownership';
import { normalizePageContent, PageContentNormalizationError, toCanonicalPageContent } from '@/lib/studio/page-content';

// Type for page content structure
interface PageContent {
  components: Array<{
    id: string;
    type: string;
    position: number;
    parentId?: string;
    props?: Record<string, unknown>;
    styles?: Record<string, unknown>;
  }>;
  metadata?: {
    lastModified?: string;
    version?: string;
  };
}

/**
 * GET /api/studio/site-builder/global-components/[id]/usage
 * Get usage information for a global component
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Auth check - always required
  let auth;
  try {
    auth = await getAuthContext(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;

    // Get shared component
    const sharedComponent = await prisma.websiteSharedComponent.findUnique({
      where: {
        id: id
      }
    });
    
    if (!sharedComponent) {
      return NextResponse.json(
        { error: 'Global component not found' },
        { status: 404 }
      );
    }

    // Verify ownership
    await assertWebsiteOwnership(prisma as any, auth.accountId, sharedComponent.websiteId);

    // Search for usage in WebsitePage content
    // Using raw query as Prisma's JSON filtering can be complex for nested arrays
    const pagesWithUsage = await prisma.$queryRaw<Array<{ 
      id: string; 
      title: string; 
      type: string; 
      content: Record<string, unknown>;
      status: string;
    }>>`
      SELECT DISTINCT p.id, p.title, p.type, p.content, p.status
      FROM "WebsitePage" p,
           jsonb_array_elements(p.content->'components') AS component
      WHERE p."websiteId" = ${sharedComponent.websiteId}
        AND component->'props'->>'sharedComponentId' = ${id}
    `;

    // Get WebsiteStructure info for pages
    const pageIds = pagesWithUsage.map(p => p.id);
    const structures = pageIds.length > 0 ? await prisma.websiteStructure.findMany({
      where: {
        websitePageId: { in: pageIds }
      },
      select: {
        websitePageId: true,
        slug: true,
        fullPath: true
      }
    }) : [];

    const structureMap = new Map(structures.map(s => [s.websitePageId, s]));

    // Build usage response from canonical props.sharedComponentId references.
    const pageUsageDetails = pagesWithUsage.map((page, index) => {
      const structure = structureMap.get(page.id);
      const content = page.content as unknown as PageContent;
      
      // Find the component instance in the content
      const componentInstance = content.components?.find(
        c => c.props?.sharedComponentId === id
      );
      const overrides = (componentInstance?.props as Record<string, unknown> | undefined)?.overrides as Record<string, unknown> | undefined;
      const hasOverrides = !!(
        (componentInstance?.props && 'hasOverrides' in (componentInstance.props as Record<string, unknown>) && (componentInstance.props as Record<string, unknown>).hasOverrides) ||
        (overrides && Object.keys(overrides).length > 0)
      );
      const overridesSummary = overrides ? Object.keys(overrides) : [];
      
      return {
        usageId: `page-${page.id}`, // Generate stable ID
        pageId: page.id,
        pageTitle: page.title || 'Unknown Page',
        pageSlug: structure?.slug || '',
        pageStatus: page.status || 'unknown',
        position: componentInstance?.position ?? index,
        hasOverrides,
        overridesSummary
      };
    });

    return NextResponse.json({
      usageCount: sharedComponent.usageCount,
      actualUsageCount: pageUsageDetails.length,
      pages: pageUsageDetails
    });
    
  } catch (error) {
    console.error('Error fetching component usage:', error);
    return NextResponse.json(
      { error: 'Failed to fetch component usage' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/studio/site-builder/global-components/[id]/usage
 * Track new usage of a global component
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Auth check - always required
  let auth;
  try {
    auth = await getAuthContext(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { pageId, position, overrides } = body;

    if (!pageId || position === undefined) {
      return NextResponse.json(
        { error: 'pageId and position are required' },
        { status: 400 }
      );
    }

    // Check if shared component exists
    const sharedComponent = await prisma.websiteSharedComponent.findUnique({
      where: { id: id },
      select: {
        id: true,
        websiteId: true,
      }
    });
    
    if (!sharedComponent) {
      return NextResponse.json(
        { error: 'Global component not found' },
        { status: 404 }
      );
    }

    // Verify ownership
    await assertWebsiteOwnership(prisma as any, auth.accountId, sharedComponent.websiteId);

    // Ensure target is a WebsitePage (scope POST to pages only)
    const targetPage = await prisma.websitePage.findUnique({ where: { id: pageId } });
    if (!targetPage) {
      return NextResponse.json(
        { error: 'Only WebsitePage targets are supported in usage POST' },
        { status: 400 }
      );
    }

    const { instanceId } = await ContentRepository.addSharedInstanceToPage(pageId, id, Number(position), overrides);
    // Update usageCount metadata
    await prisma.websiteSharedComponent.update({ where: { id }, data: { usageCount: { increment: 1 } } });

    return NextResponse.json({ success: true, usageId: instanceId });
    
  } catch (error) {
    console.error('Error tracking component usage:', error);

    if (error instanceof PageContentNormalizationError) {
      return NextResponse.json(
        { error: 'Invalid page content', diagnostics: error.diagnostics },
        { status: 400 }
      );
    }
    
    if (error instanceof Error && 'code' in error && (error as { code: string }).code === 'P2002') {
      return NextResponse.json(
        { error: 'Usage already tracked for this page and component' },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to track component usage' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/studio/site-builder/global-components/[id]/usage
 * Remove usage tracking for a global component
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Auth check - always required
  let auth;
  try {
    auth = await getAuthContext(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const usageId = searchParams.get('usageId');
    const pageId = searchParams.get('pageId');
    const instanceId = usageId || searchParams.get('instanceId');

    if (!instanceId && !pageId) {
      return NextResponse.json(
        { error: 'Provide instanceId+pageId to remove a specific instance, or pageId to remove all instances on page.' },
        { status: 400 }
      );
    }

    // Get the shared component first
    const sharedComponent = await prisma.websiteSharedComponent.findUnique({
      where: { id: id },
      select: {
        id: true,
        websiteId: true,
        usageCount: true
      }
    });
    
    if (!sharedComponent) {
      return NextResponse.json(
        { error: 'Global component not found' },
        { status: 404 }
      );
    }

    // Verify ownership
    await assertWebsiteOwnership(prisma as any, auth.accountId, sharedComponent.websiteId);

    let removedCount = 0;
    if (instanceId && pageId) {
      await ContentRepository.removeSharedInstanceFromPage(pageId, instanceId);
      await prisma.websiteSharedComponent.update({ where: { id }, data: { usageCount: { decrement: 1 } } });
      removedCount = 1;
    } else if (pageId) {
      // Remove all matching instances from the specified page.
      const page = await prisma.websitePage.findUnique({ where: { id: pageId } });
      if (!page) {
        return NextResponse.json({ error: 'Page not found' }, { status: 404 });
      }
      const content = (page.content || {}) as unknown as PageContent;
      const components = normalizePageContent(content, { mode: 'strict-write' }).pageContent.components as unknown as PageContent['components'];
      const filtered = components.filter(
        (c) => !(c?.props && (c.props as Record<string, unknown>).sharedComponentId === id)
      );
      removedCount = components.length - filtered.length;
      if (removedCount > 0) {
        await prisma.websitePage.update({
          where: { id: pageId },
          data: { content: toCanonicalPageContent(content, filtered, { mode: 'strict-write' }) as Prisma.InputJsonValue },
        });
        await prisma.websiteSharedComponent.update({ where: { id }, data: { usageCount: { decrement: removedCount } } });
      }
    }

    const updatedComponent = await prisma.websiteSharedComponent.findUnique({ where: { id }, select: { usageCount: true } });
    return NextResponse.json({ success: true, removedCount, remainingUsages: updatedComponent?.usageCount || 0 });
    
  } catch (error) {
    console.error('Error removing component usage:', error);

    if (error instanceof PageContentNormalizationError) {
      return NextResponse.json(
        { error: 'Invalid page content', diagnostics: error.diagnostics },
        { status: 400 }
      );
    }
    
    if (error instanceof Error && 'code' in error && (error as { code: string }).code === 'P2025') {
      return NextResponse.json(
        { error: 'Usage record not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to remove component usage' },
      { status: 500 }
    );
  }
}
