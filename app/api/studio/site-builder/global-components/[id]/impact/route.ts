import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@/lib/generated/prisma';
import { getAuthContext } from '@/lib/auth/context';
import { assertWebsiteOwnership } from '@/lib/auth/ownership';

interface ComponentUsage {
  pageId: string;
  position: number;
  hasOverrides: boolean;
}

interface AffectedPage {
  id: string;
  title: string;
  path: string;
  status: string;
  lastModified: Date;
  isPublished: boolean;
  hasOverrides: boolean;
  position: number;
}

/**
 * GET /api/studio/site-builder/global-components/[id]/impact
 * Analyze the impact of changes to a global component
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
    
    // Search for usage in WebsitePage content JSON
    const websitePages = await prisma.websitePage.findMany({
      where: {
        websiteId: sharedComponent.websiteId,
        content: {
          path: ['$'],
          string_contains: `"sharedComponentId":"${id}"`
        } as Prisma.JsonFilter
      },
      select: {
        id: true,
        title: true,
        status: true,
        updatedAt: true,
        publishedAt: true,
        content: true
      }
    });
    
    // Search for usage in WebsiteCustomContentData JSON (if applicable)
    const customContentData = await prisma.websiteCustomContentData.findMany({
      where: {
        websiteId: sharedComponent.websiteId,
        data: {
          path: ['$'],
          string_contains: `"sharedComponentId":"${id}"`
        } as Prisma.JsonFilter
      },
      select: {
        id: true,
        title: true,
        status: true,
        updatedAt: true,
        publishedAt: true,
        data: true
      }
    });
    
    // Get site structure for full paths using parallel queries
    const pageIds = websitePages.map(p => p.id);
    const customIds = customContentData.map(c => c.id);
    
    const [pageStructures, customStructures] = await Promise.all([
      pageIds.length > 0 ? prisma.websiteStructure.findMany({
        where: {
          websitePageId: {
            in: pageIds
          }
        },
        select: {
          websitePageId: true,
          fullPath: true
        }
      }) : Promise.resolve([]),
      
      // Note: Custom content may not have structure entries
      customIds.length > 0 ? prisma.websiteStructure.findMany({
        where: {
          websitePageId: {
            in: customIds
          }
        },
        select: {
          websitePageId: true,
          fullPath: true
        }
      }) : Promise.resolve([])
    ]);
    
    // Extract usage details from JSON content
    const extractUsageFromContent = (content: unknown): ComponentUsage[] => {
      const usages: ComponentUsage[] = [];
      
      // Recursive function to find components in the tree
      const findComponents = (obj: unknown, position: number = 0): void => {
        if (!obj || typeof obj !== 'object') return;
        
        // Type guard for component object
        const componentObj = obj as Record<string, unknown>;
        
        const props = componentObj.props as Record<string, unknown> | undefined;
        if (props && props.sharedComponentId === id) {
          const overrides = (props.overrides as Record<string, unknown>) || undefined;
          const hasOverrides = !!(props.hasOverrides || (overrides && Object.keys(overrides).length > 0));
          usages.push({ pageId: '', position, hasOverrides });
        }
        
        // Check arrays (component lists)
        if (Array.isArray(obj)) {
          obj.forEach((item, index) => findComponents(item, index));
        } else {
          // Check nested objects
          Object.values(componentObj).forEach(value => findComponents(value, position));
        }
      };
      
      findComponents(content);
      return usages;
    };
    
    // Create maps for quick lookup
    const pathMap = new Map<string, string>();
    pageStructures.forEach(s => {
      if (s.websitePageId) pathMap.set(s.websitePageId, s.fullPath);
    });
    customStructures.forEach(s => {
      if (s.websitePageId) pathMap.set(s.websitePageId, s.fullPath);
    });
    
    // Build affected pages list
    const affectedPages: AffectedPage[] = [];
    
    // Process website pages
    websitePages.forEach(page => {
      const usages = extractUsageFromContent(page.content);
      usages.forEach(usage => {
        const fullPath = pathMap.get(page.id);
        affectedPages.push({
          id: page.id,
          title: page.title || 'Untitled Page',
          path: fullPath || `/page/${page.id}`,
          status: page.status || 'draft',
          lastModified: page.updatedAt,
          isPublished: !!page.publishedAt,
          hasOverrides: usage.hasOverrides,
          position: usage.position
        });
      });
    });
    
    // Process custom content data
    customContentData.forEach(item => {
      const usages = extractUsageFromContent(item.data);
      usages.forEach(usage => {
        const fullPath = pathMap.get(item.id);
        affectedPages.push({
          id: item.id,
          title: item.title || 'Untitled Content',
          path: fullPath || `/content/${item.id}`,
          status: item.status || 'draft',
          lastModified: item.updatedAt,
          isPublished: !!item.publishedAt,
          hasOverrides: usage.hasOverrides,
          position: usage.position
        });
      });
    });
    
    // Group by status for summary
    const statusCounts = affectedPages.reduce((acc: Record<string, number>, page) => {
      acc[page.status] = (acc[page.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    // Calculate impact severity
    const publishedCount = affectedPages.filter(p => p.isPublished).length;
    const draftCount = affectedPages.filter(p => !p.isPublished).length;
    const severity = publishedCount > 10 ? 'high' : publishedCount >= 5 ? 'medium' : 'low';
    
    // Calculate average last modified date
    const avgLastModified = affectedPages.length > 0
      ? new Date(
          affectedPages.reduce((sum, page) => sum + page.lastModified.getTime(), 0) / affectedPages.length
        )
      : new Date();
    
    // Generate recommendations based on impact
    const recommendations: string[] = [];
    if (severity === 'high') {
      recommendations.push('Consider scheduling this update during low-traffic hours');
      recommendations.push('Notify stakeholders before making changes');
      recommendations.push('Test changes thoroughly in staging environment');
    } else if (severity === 'medium') {
      recommendations.push('Review all affected pages before publishing changes');
      recommendations.push('Consider creating a backup of current component state');
    } else {
      recommendations.push('Safe to update with minimal impact');
      recommendations.push('Standard testing recommended');
    }
    
    // Return response matching the documented format
    return NextResponse.json({
      affectedPages,
      totalCount: affectedPages.length,
      statusCounts,
      severity,
      publishedCount,
      draftCount,
      averageLastModified: avgLastModified,
      recommendations
    });
    
  } catch (error) {
    console.error('Error analyzing component impact:', error);
    return NextResponse.json(
      { error: 'Failed to analyze component impact' },
      { status: 500 }
    );
  }
}
