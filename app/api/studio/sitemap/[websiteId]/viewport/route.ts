import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { viewportQueryService } from '@/lib/studio/services/spatial/viewport-query-service';
import { unifiedLayoutService, LAYOUT_CONSTANTS } from '@/lib/studio/services/layout/unified-layout-service';
import { getAuthContext } from '@/lib/auth/context';
import { assertWebsiteOwnership } from '@/lib/auth/ownership';
import { normalizePageContent } from '@/lib/studio/page-content';

/**
 * GET /api/studio/sitemap/[websiteId]/viewport
 *
 * Returns nodes within a viewport area for progressive loading.
 * Uses grid-based spatial index for O(log n) performance.
 *
 * KEY CHANGE: Positions now come from NodePosition table,
 * ensuring consistency with skeleton load.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ websiteId: string }> }
) {
  // Auth check - always required
  let auth;
  try {
    auth = await getAuthContext(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = performance.now();
  const { websiteId } = await params;
  const { searchParams } = new URL(request.url);

  // Validate websiteId
  if (!websiteId || websiteId.length > 100 || websiteId.length < 1) {
    return NextResponse.json({ error: 'Invalid website ID' }, { status: 400 });
  }

  // Verify ownership
  try {
    await assertWebsiteOwnership(prisma as any, auth.accountId, websiteId);
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Parse viewport parameters
  const x = parseFloat(searchParams.get('x') || '0');
  const y = parseFloat(searchParams.get('y') || '0');
  const width = parseFloat(searchParams.get('width') || '1920');
  const height = parseFloat(searchParams.get('height') || '1080');
  const zoom = parseFloat(searchParams.get('zoom') || '1');
  const buffer = parseFloat(searchParams.get('buffer') || '200');
  const requestedDetail = searchParams.get('detail') as
    | 'skeleton'
    | 'minimal'
    | 'standard'
    | 'full'
    | null;

  try {
    // Ensure positions exist
    await unifiedLayoutService.ensurePositionsExist(websiteId);

    // Determine detail level based on zoom
    const autoDetailLevel =
      zoom >= 0.8 ? 'full' : zoom >= 0.5 ? 'standard' : zoom >= 0.25 ? 'minimal' : 'skeleton';
    const detailLevel = requestedDetail || autoDetailLevel;

    // Calculate viewport bounds (accounting for zoom)
    const viewport = {
      minX: x,
      maxX: x + width / zoom,
      minY: y,
      maxY: y + height / zoom,
    };

    // Query visible nodes using spatial index
    const visibleNodes = await viewportQueryService.getNodesInViewport({
      websiteId,
      viewport,
      buffer,
      detailLevel,
      maxNodes: 500,
    });

    // Debug: Log first node to see structure
    if (detailLevel === 'full' && visibleNodes.length > 0) {
      const firstNode = visibleNodes[0];
      console.log('[ViewportAPI] First node structure debug:', {
        structureId: firstNode.structureId,
        hasStructure: !!firstNode.structure,
        structureKeys: firstNode.structure ? Object.keys(firstNode.structure) : [],
        websitePageId: firstNode.structure?.websitePageId,
        hasWebsitePage: !!firstNode.structure?.websitePage,
      });
    }

    // Transform to React Flow format
    const nodes = visibleNodes.map((node) => {
      const pageData = node.structure?.websitePage;
      const normalizedContent = pageData
        ? normalizePageContent(pageData.content, { mode: 'strict-read' })
        : null
      const components = normalizedContent?.pageContent.components ?? [];

      // Debug: log component loading for ALL nodes when full detail
      if (detailLevel === 'full') {
        console.log('[ViewportAPI] Node component data:', {
          structureId: node.structureId,
          hasStructure: !!node.structure,
          websitePageId: node.structure?.websitePageId,
          hasWebsitePage: !!pageData,
          hasContent: !!pageData?.content,
          componentCount: components.length,
        });
      }

      return {
        id: node.structureId,
        type: 'page',
        position: { x: node.x, y: node.y },
        // Include width and height from server-calculated positions for dynamic node heights
        width: node.width,
        height: node.height,
        data: {
          label: pageData?.title || node.pageSlug || 'Untitled',
          slug: node.pageSlug,
          fullPath: node.fullPath,
          status: pageData?.status || 'draft',
          hasContent: !!node.structure?.websitePageId,
          components: detailLevel === 'full' ? components : undefined,
          componentCount: components.length,
          pageContentDiagnostics: detailLevel === 'full' && normalizedContent?.diagnostics.length
            ? normalizedContent.diagnostics
            : undefined,
          metadata: pageData?.metadata,
          websitePageId: node.structure?.websitePageId,
          parentId: node.structure?.parentId,
          pathDepth: node.pathDepth, // Include for reference
          // Include dimensions in data for component access (React Flow doesn't pass width/height to components)
          _nodeWidth: node.width,
          _nodeHeight: node.height,
          _detailLevel: detailLevel,
          _needsDetailLoad: false,
        },
      };
    });

    const duration = performance.now() - startTime;

    // DEBUG: Log the actual response data for first node
    if (nodes.length > 0) {
      const firstNode = nodes[0];
      console.log('[ViewportAPI] Response first node:', {
        id: firstNode.id,
        dataHasComponents: !!firstNode.data?.components,
        componentsLength: firstNode.data?.components?.length || 0,
        componentTypes: firstNode.data?.components?.slice(0, 3).map((c: any) => c.type) || [],
        _detailLevel: firstNode.data?._detailLevel,
        _needsDetailLoad: firstNode.data?._needsDetailLoad,
      });
    }

    console.info('[ViewportAPI]', {
      websiteId,
      viewport: { x, y, width, height, zoom },
      visible: nodes.length,
      detailLevel,
      durationMs: duration.toFixed(1),
    });

    return NextResponse.json({
      visible: nodes,
      buffer: [], // Could add buffer nodes if needed
      meta: {
        visibleCount: nodes.length,
        detailLevel,
        viewport,
        loadTimeMs: duration,
        nodeWidth: LAYOUT_CONSTANTS.NODE_WIDTH,
        // Note: nodeHeight is dynamic per level, use node.height from each node
        dynamicHeights: true,
      },
    });
  } catch (error) {
    console.error('[ViewportAPI] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch viewport nodes' }, { status: 500 });
  }
}

/**
 * DELETE /api/studio/sitemap/[websiteId]/viewport
 *
 * Invalidate positions for a website.
 * Call this after any structure change.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ websiteId: string }> }
) {
  // Auth check - always required
  let auth;
  try {
    auth = await getAuthContext(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { websiteId } = await params;

  // Verify ownership
  try {
    await assertWebsiteOwnership(prisma as any, auth.accountId, websiteId);
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    await unifiedLayoutService.invalidatePositions(websiteId);
    return NextResponse.json({ success: true, message: 'Positions invalidated' });
  } catch (error) {
    console.error('[ViewportAPI] Delete error:', error);
    return NextResponse.json({ error: 'Failed to invalidate positions' }, { status: 500 });
  }
}
