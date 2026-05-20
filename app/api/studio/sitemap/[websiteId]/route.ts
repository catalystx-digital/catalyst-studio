import { NextRequest, NextResponse } from 'next/server';
import { siteStructureService } from '@/lib/services/site-structure/site-structure-service';
import { performance } from 'node:perf_hooks';
import { prisma } from '@/lib/prisma';
import {
  unifiedLayoutService,
  LAYOUT_CONSTANTS,
} from '@/lib/studio/services/layout/unified-layout-service';
import { viewportQueryService } from '@/lib/studio/services/spatial/viewport-query-service';
import { getAuthContext } from '@/lib/auth/context';
import { assertWebsiteOwnership } from '@/lib/auth/ownership';

// Use threshold from layout constants (single source of truth)
const LARGE_SITE_THRESHOLD = LAYOUT_CONSTANTS.LARGE_SITE_THRESHOLD;

/**
 * GET /api/studio/sitemap/[websiteId]
 *
 * Returns tree structure for React Flow canvas render.
 * For small sites (<= 50 nodes): Full data with enriched components
 * For large sites (> 50 nodes): Skeleton data only, details loaded via /viewport endpoint
 *
 * KEY CHANGE: All positions now come from the NodePosition table
 * to ensure consistency between skeleton and viewport loads.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ websiteId: string }> }
) {
  const start = performance.now();

  try {
    // Auth check - always required
    let auth;
    try {
      auth = await getAuthContext(request);
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { websiteId } = await params;
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode') || 'auto'; // 'auto' | 'skeleton' | 'full'

    // Validate websiteId format
    if (!websiteId || websiteId.length > 100 || websiteId.length < 1) {
      return NextResponse.json({ error: 'Invalid website ID format' }, { status: 400 });
    }

    // Verify ownership
    await assertWebsiteOwnership(prisma as any, auth.accountId, websiteId);

    // Ensure positions are calculated and persisted
    const positionsWereCalculated = await unifiedLayoutService.ensurePositionsExist(websiteId);
    if (positionsWereCalculated) {
      console.info('[SitemapAPI] Positions were calculated for website:', websiteId);
    }

    // Get total node count
    const totalNodes = await prisma.websiteStructure.count({ where: { websiteId } });

    // Determine load mode
    const shouldUseSkeleton =
      mode === 'skeleton' || (mode === 'auto' && totalNodes > LARGE_SITE_THRESHOLD);

    const actualLoadMode = mode === 'full' ? 'full' : shouldUseSkeleton ? 'skeleton' : 'full';

    console.info('[SitemapAPI] load mode decision:', {
      websiteId,
      totalNodes,
      threshold: LARGE_SITE_THRESHOLD,
      requestedMode: mode,
      shouldUseSkeleton,
      actualLoadMode,
    });

    // For skeleton mode, return positions from database (no full page content)
    if (actualLoadMode === 'skeleton') {
      return await getSkeletonSitemap(websiteId, start, totalNodes);
    }

    // For full mode, load with enriched data
    return await getFullSitemap(websiteId, start, totalNodes);
  } catch (error) {
    console.error('Error fetching sitemap:', error);

    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return NextResponse.json({ error: 'Website not found' }, { status: 404 });
      }
    }

    return NextResponse.json({ error: 'Failed to fetch sitemap' }, { status: 500 });
  }
}

/**
 * Skeleton sitemap load - positions from database, minimal data
 */
async function getSkeletonSitemap(
  websiteId: string,
  startTime: number,
  totalNodes: number
) {
  // Get all positions from database (single source of truth)
  const positions = await viewportQueryService.getAllPositions(websiteId);

  // Build edges from structure
  const allStructures = await prisma.websiteStructure.findMany({
    where: { websiteId },
    select: { id: true, parentId: true, websitePageId: true },
  });

  // Filter out orphan nodes (structure entries without websitePageId)
  // These are created by ensureStructureChain during import but have no page content
  const orphanNodes = allStructures.filter((s) => !s.websitePageId);
  if (orphanNodes.length > 0) {
    console.warn('[SitemapAPI] Filtering orphan nodes (no websitePageId):', {
      websiteId,
      orphanCount: orphanNodes.length,
      orphanIds: orphanNodes.map((n) => n.id),
    });
  }

  const structures = allStructures.filter((s) => s.websitePageId);
  const validStructureIds = new Set(structures.map((s) => s.id));

  const edges = structures
    .filter((s) => s.parentId && validStructureIds.has(s.parentId))
    .map((s) => ({
      id: `${s.parentId}-${s.id}`,
      source: s.parentId!,
      target: s.id,
      type: 'smoothstep',
    }));

  // Create structure map for hasContent lookup
  const structureMap = new Map(structures.map((s) => [s.id, s]));

  // Filter positions to only include nodes with valid structure (has websitePageId)
  const validPositions = positions.filter((pos) => validStructureIds.has(pos.structureId));

  const nodes = validPositions.map((pos) => {
    const structure = structureMap.get(pos.structureId);
    return {
      id: pos.structureId,
      type: 'page',
      position: { x: pos.x, y: pos.y },
      // Include dynamic width/height from server-calculated positions
      width: pos.width,
      height: pos.height,
      data: {
        label: pos.pageTitle || pos.pageSlug || 'Untitled',
        slug: pos.pageSlug,
        fullPath: pos.fullPath,
        pathDepth: pos.pathDepth,
        status: 'draft',
        hasContent: !!structure?.websitePageId,
        childCount: 0,
        componentCount: 0,
        // Include dimensions in data for component access (React Flow doesn't pass width/height to components)
        _nodeWidth: pos.width,
        _nodeHeight: pos.height,
        _detailLevel: 'skeleton',
        _needsDetailLoad: true,
      },
    };
  });

  const duration = performance.now() - startTime;

  console.info('[SitemapAPI] skeleton response', {
    websiteId,
    nodeCount: nodes.length,
    edgeCount: edges.length,
    durationMs: duration.toFixed(1),
  });

  return NextResponse.json(
    {
      nodes,
      edges,
      websiteId,
      timestamp: new Date().toISOString(),
      meta: {
        totalNodes,
        loadMode: 'skeleton',
        supportsViewportSync: true,
        viewportEndpoint: `/api/studio/sitemap/${websiteId}/viewport`,
        nodeWidth: LAYOUT_CONSTANTS.NODE_WIDTH,
        // Note: nodeHeight is dynamic per level, use node.height from each node
        dynamicHeights: true,
      },
    },
    {
      headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' },
    }
  );
}

/**
 * Full sitemap load for small sites (<=50 pages)
 * Uses batch queries to avoid connection pool exhaustion
 * Positions still come from database for consistency
 */
async function getFullSitemap(websiteId: string, startTime: number, totalNodes: number) {
  // Get tree for hierarchy
  const tree = await siteStructureService.getTree(websiteId);

  // Collect all page IDs and track nodes without page IDs
  const pageIds: string[] = [];
  let nodesWithoutPageId = 0;
  const collectPageIds = (node: any) => {
    if (node.websitePageId) {
      pageIds.push(node.websitePageId);
    } else {
      nodesWithoutPageId++;
    }
    node.children?.forEach(collectPageIds);
  };
  collectPageIds(tree);

  // Diagnostic logging
  console.info('[SitemapAPI] collectPageIds:', {
    websiteId,
    totalNodes,
    nodesWithPageId: pageIds.length,
    nodesWithoutPageId,
    uniquePageIds: new Set(pageIds).size,
  });

  // Batch fetch all pages
  const pages = await prisma.websitePage.findMany({
    where: { id: { in: pageIds } },
    select: { id: true, title: true, status: true, content: true, metadata: true },
  });
  const pageMap = new Map(pages.map((p) => [p.id, p]));

  // Log component statistics
  let totalComponents = 0;
  let pagesWithContent = 0;
  let pagesWithComponents = 0;
  for (const page of pages) {
    const content = page.content as any;
    if (content) pagesWithContent++;
    const componentCount = content?.components?.length || 0;
    if (componentCount > 0) pagesWithComponents++;
    totalComponents += componentCount;
  }

  console.info('[SitemapAPI] page content stats:', {
    websiteId,
    pagesRequested: pageIds.length,
    pagesFound: pages.length,
    pagesMissing: pageIds.length - pages.length,
    pagesWithContent,
    pagesWithComponents,
    totalComponents,
  });

  // Batch fetch shared components
  const sharedIds = new Set<string>();
  for (const page of pages) {
    const content = page.content as any;
    for (const c of content?.components || []) {
      const sid = c?.props?.sharedComponentId || c?.sharedComponentId;
      if (sid) sharedIds.add(sid);
    }
  }

  const shared =
    sharedIds.size > 0
      ? await prisma.websiteSharedComponent.findMany({
          where: { id: { in: Array.from(sharedIds) } },
        })
      : [];
  const sharedMap = new Map(shared.map((s) => [s.id, s]));

  // Get positions from database (single source of truth, includes dynamic heights)
  const positions = await viewportQueryService.getAllPositions(websiteId);
  const positionMap = new Map(
    positions.map((p) => [p.structureId, { x: p.x, y: p.y, width: p.width, height: p.height }])
  );

  // Transform tree to React Flow format with full data
  const nodes: any[] = [];
  const edges: any[] = [];
  const allNodes: any[] = [];

  const collectNodes = (node: any) => {
    allNodes.push(node);
    node.children?.forEach(collectNodes);
  };
  collectNodes(tree);

  // Filter out orphan nodes (structure entries without websitePageId)
  // These are created by ensureStructureChain during import but have no page content
  const orphanNodes = allNodes.filter((n) => !n.websitePageId);
  if (orphanNodes.length > 0) {
    console.warn('[SitemapAPI] Filtering orphan nodes in full mode (no websitePageId):', {
      websiteId,
      orphanCount: orphanNodes.length,
      orphanIds: orphanNodes.map((n: any) => n.id),
    });
  }

  const validNodes = allNodes.filter((n) => n.websitePageId);
  const validNodeIds = new Set(validNodes.map((n) => n.id));

  for (const node of validNodes) {
    // Get position from database - this ensures consistency (includes dynamic heights)
    const pos = positionMap.get(node.id) || { x: 0, y: 0, width: LAYOUT_CONSTANTS.NODE_WIDTH, height: LAYOUT_CONSTANTS.NODE_HEIGHT };
    const page = node.websitePageId ? pageMap.get(node.websitePageId) : null;
    const content = page?.content as any;

    // Enrich components with shared content
    const components = (content?.components || []).map((c: any) => {
      const sid = c?.props?.sharedComponentId || c?.sharedComponentId;
      if (sid) {
        const sharedContentRaw = sharedMap.get(sid)?.content;
        const sharedContent =
          typeof sharedContentRaw === 'object' && sharedContentRaw !== null
            ? sharedContentRaw
            : {};
        const overridesRaw = c?.props?.overrides;
        const overrides =
          typeof overridesRaw === 'object' && overridesRaw !== null ? overridesRaw : {};
        return {
          ...c,
          props: {
            ...c.props,
            _resolvedSharedContent: { ...sharedContent, ...overrides },
          },
          _isShared: true,
          _sharedComponentId: sid,
        };
      }
      return c;
    });

    nodes.push({
      id: node.id,
      type: 'page',
      position: { x: pos.x, y: pos.y },
      // Include dynamic width/height from server-calculated positions
      width: pos.width,
      height: pos.height,
      data: {
        label: page?.title || node.slug || 'Untitled',
        slug: node.slug,
        fullPath: node.fullPath,
        status: page?.status || 'draft',
        hasContent: !!node.websitePageId,
        childCount: (node.children || []).length,
        componentCount: components.length,
        components: components,
        websitePageId: node.websitePageId,
        metadata: page?.metadata,
        // Include dimensions in data for component access (React Flow doesn't pass width/height to components)
        _nodeWidth: pos.width,
        _nodeHeight: pos.height,
        _detailLevel: 'full',
        _needsDetailLoad: false,
      },
    });

    // Only create edge if parent is also a valid node (has websitePageId)
    if (node.parentId && validNodeIds.has(node.parentId)) {
      edges.push({
        id: `${node.parentId}-${node.id}`,
        source: node.parentId,
        target: node.id,
        type: 'smoothstep',
      });
    }
  }

  const duration = performance.now() - startTime;

  console.info('[SitemapAPI] full response', {
    websiteId,
    nodeCount: nodes.length,
    durationMs: duration.toFixed(1),
    dbQueries: 4,
  });

  return NextResponse.json(
    {
      nodes,
      edges,
      websiteId,
      timestamp: new Date().toISOString(),
      meta: {
        totalNodes,
        loadMode: 'full',
        supportsViewportSync: false,
        nodeWidth: LAYOUT_CONSTANTS.NODE_WIDTH,
        // Note: nodeHeight is dynamic per level, use node.height from each node
        dynamicHeights: true,
      },
    },
    {
      headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' },
    }
  );
}
