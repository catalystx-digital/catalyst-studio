/**
 * UnifiedLayoutService - Single source of truth for all layout calculations
 *
 * CRITICAL: All position calculations MUST use this service.
 * DO NOT calculate positions anywhere else.
 *
 * Uses Dagre for consistent server-side layout that matches client expectations.
 * Home node is centered at (0, 0) for predictable viewport positioning.
 */

import dagre from 'dagre';
import { prisma } from '@/lib/prisma';
import { LAYOUT, DAGRE_CONFIG, calculateGridCell, calculateLevelHeight } from '@/lib/studio/constants/layout-constants';

// Re-export constants for backwards compatibility
export { LAYOUT as LAYOUT_CONSTANTS, calculateGridCell } from '@/lib/studio/constants/layout-constants';

interface StructureNode {
  id: string;
  parentId: string | null;
  position: number;
  pathDepth: number;
  slug: string;
  fullPath: string;
  websitePageId: string | null;
  pageTitle?: string | null;
}

interface CalculatedPosition {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  gridCellX: number;
  gridCellY: number;
  slug: string;
  fullPath: string;
  pathDepth: number;
  pageTitle: string | null;
}

export class UnifiedLayoutService {
  // Lock to prevent concurrent layout calculations for same website
  private layoutCalculationLocks = new Map<string, Promise<CalculatedPosition[]>>();

  /**
   * Calculate and persist positions for entire website
   * Call this after any tree structure change
   */
  async calculateAndPersistLayout(websiteId: string): Promise<CalculatedPosition[]> {
    // Check if already calculating for this website
    const existingLock = this.layoutCalculationLocks.get(websiteId);
    if (existingLock) {
      console.log(`[UnifiedLayoutService] Layout calculation already in progress for ${websiteId}, waiting...`);
      return existingLock;
    }

    // Create new calculation promise
    const calculationPromise = this.performLayoutCalculation(websiteId);
    this.layoutCalculationLocks.set(websiteId, calculationPromise);

    try {
      const result = await calculationPromise;
      return result;
    } finally {
      // Remove lock when done
      this.layoutCalculationLocks.delete(websiteId);
    }
  }

  /**
   * Internal method that performs the actual layout calculation
   */
  private async performLayoutCalculation(websiteId: string): Promise<CalculatedPosition[]> {
    // 1. Get level max component counts FIRST (for dynamic heights)
    const levelMaxCounts = await this.getLevelMaxComponentCounts(websiteId);

    // 2. Pre-calculate height for each level
    const levelHeights = new Map<number, number>();
    for (const [level, maxCount] of levelMaxCounts) {
      levelHeights.set(level, calculateLevelHeight(maxCount));
    }

    // 3. Fetch all structures with page titles
    const structures = await prisma.websiteStructure.findMany({
      where: { websiteId },
      include: {
        websitePage: { select: { title: true } },
      },
      orderBy: [{ pathDepth: 'asc' }, { position: 'asc' }],
    });

    if (structures.length === 0) {
      return [];
    }

    // 4. Build tree and calculate positions using Dagre with dynamic heights
    const positions = this.calculateTreeLayout(
      structures.map((s) => ({
        id: s.id,
        parentId: s.parentId,
        position: s.position,
        pathDepth: s.pathDepth,
        slug: s.slug,
        fullPath: s.fullPath,
        websitePageId: s.websitePageId,
        // Type assertion needed because Prisma's include inference doesn't work well with TypeScript
        pageTitle: (s as any).websitePage?.title || null,
      })),
      levelHeights
    );

    // 3. Generate layout hash for cache invalidation
    const layoutHash = this.generateLayoutHash(structures);

    // 4. Deduplicate positions by structureId (defensive measure)
    const uniquePositions = Array.from(
      new Map(positions.map(pos => [pos.id, pos])).values()
    );

    if (uniquePositions.length !== positions.length) {
      console.warn(`[UnifiedLayoutService] Deduplicated ${positions.length - uniquePositions.length} duplicate positions for ${websiteId}`);
    }

    // 5. Persist in transaction
    await prisma.$transaction(async (tx) => {
      // Delete existing positions
      await tx.nodePosition.deleteMany({ where: { websiteId } });

      // Create new positions (skipDuplicates handles race conditions in serverless)
      if (uniquePositions.length > 0) {
        await tx.nodePosition.createMany({
          data: uniquePositions.map((pos) => ({
            websiteId,
            structureId: pos.id,
            x: pos.x,
            y: pos.y,
            width: pos.width,
            height: pos.height,
            gridCellX: pos.gridCellX,
            gridCellY: pos.gridCellY,
            pageTitle: pos.pageTitle,
            pageSlug: pos.slug,
            fullPath: pos.fullPath,
            pathDepth: pos.pathDepth,
            layoutVersion: '2.0', // Bumped version for Dagre layout
            layoutHash,
          })),
          skipDuplicates: true, // Idempotent: if another request already inserted, skip
        });
      }
    });

    return uniquePositions;
  }

  /**
   * Calculate tree layout using Dagre
   * This produces positions matching what React Flow renders on the client.
   * Home node is centered at (0, 0) for predictable viewport positioning.
   *
   * @param structures - The tree structure nodes
   * @param levelHeights - Optional map of pathDepth -> height for dynamic node heights
   */
  private calculateTreeLayout(
    structures: StructureNode[],
    levelHeights?: Map<number, number>
  ): CalculatedPosition[] {
    if (structures.length === 0) return [];

    // Create a new Dagre graph
    const g = new dagre.graphlib.Graph();
    g.setGraph(DAGRE_CONFIG);
    g.setDefaultEdgeLabel(() => ({}));

    // Add all nodes to the graph with DYNAMIC heights per level
    for (const node of structures) {
      const height = levelHeights?.get(node.pathDepth) ?? LAYOUT.NODE_HEIGHT;
      g.setNode(node.id, {
        width: LAYOUT.NODE_WIDTH,
        height, // Use level-based height if available
      });
    }

    // Add edges (parent -> child)
    for (const node of structures) {
      if (node.parentId) {
        // Only add edge if parent exists in the graph
        if (g.hasNode(node.parentId)) {
          g.setEdge(node.parentId, node.id);
        }
      }
    }

    // Run Dagre layout algorithm
    dagre.layout(g);

    // Find home node (root with fullPath '/' or slug 'home' or '')
    const homeNode = structures.find(
      (s) => s.fullPath === '/' || s.slug === 'home' || (s.slug === '' && s.parentId === null)
    );

    // If no home found, use first root node
    const rootNode = homeNode || structures.find((s) => s.parentId === null) || structures[0];

    // Get home position for centering
    const homePosition = rootNode ? g.node(rootNode.id) : null;
    const offsetX = homePosition ? homePosition.x : 0;
    const offsetY = homePosition ? homePosition.y : 0;

    // Extract positions and center on home
    const positions: CalculatedPosition[] = [];

    for (const node of structures) {
      const dagreNode = g.node(node.id);
      if (!dagreNode) {
        console.warn(`[UnifiedLayoutService] Node ${node.id} not found in Dagre graph`);
        continue;
      }

      // Get the actual height used for this node's level
      const nodeHeight = levelHeights?.get(node.pathDepth) ?? LAYOUT.NODE_HEIGHT;

      // Center so home is at (0, 0)
      // Dagre returns center coordinates, adjust to top-left for React Flow
      const x = dagreNode.x - offsetX - LAYOUT.NODE_WIDTH / 2;
      const y = dagreNode.y - offsetY - nodeHeight / 2;

      const gridCell = calculateGridCell(x, y);

      positions.push({
        id: node.id,
        x,
        y,
        width: LAYOUT.NODE_WIDTH,
        height: nodeHeight, // Store actual level height
        gridCellX: gridCell.cellX,
        gridCellY: gridCell.cellY,
        slug: node.slug,
        fullPath: node.fullPath,
        pathDepth: node.pathDepth,
        pageTitle: node.pageTitle || null,
      });
    }

    return positions;
  }

  /**
   * Generate hash of tree structure for cache invalidation
   */
  private generateLayoutHash(
    structures: { id: string; parentId: string | null; position: number }[]
  ): string {
    const sortedIds = structures
      .map((s) => `${s.id}:${s.parentId || 'null'}:${s.position}`)
      .sort()
      .join('|');

    // Simple hash function
    let hash = 0;
    for (let i = 0; i < sortedIds.length; i++) {
      const char = sortedIds.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return `v2_${Math.abs(hash).toString(36)}`;
  }

  /**
   * Get maximum component count per tree level (pathDepth)
   * Used to calculate level-based heights for preventing node overlap
   *
   * @param websiteId - The website to query
   * @returns Map of pathDepth -> max component count at that level
   */
  private async getLevelMaxComponentCounts(websiteId: string): Promise<Map<number, number>> {
    const results = await prisma.$queryRaw<Array<{ pathDepth: number; maxComponents: bigint }>>`
      SELECT
        ws."pathDepth",
        COALESCE(
          MAX(
            CASE
              WHEN wp.content IS NOT NULL AND wp.content::jsonb ? 'components'
              THEN jsonb_array_length(wp.content::jsonb -> 'components')
              ELSE 0
            END
          ),
          0
        ) as "maxComponents"
      FROM "WebsiteStructure" ws
      LEFT JOIN "WebsitePage" wp ON ws."websitePageId" = wp.id
      WHERE ws."websiteId" = ${websiteId}
      GROUP BY ws."pathDepth"
      ORDER BY ws."pathDepth"
    `;

    const levelMaxMap = new Map<number, number>();
    for (const row of results) {
      // Convert BigInt to number (safe since component counts are small)
      levelMaxMap.set(row.pathDepth, Number(row.maxComponents));
    }

    return levelMaxMap;
  }

  /**
   * Ensure positions exist for a website, calculate if missing
   */
  async ensurePositionsExist(websiteId: string): Promise<boolean> {
    const positionCount = await prisma.nodePosition.count({ where: { websiteId } });
    const structureCount = await prisma.websiteStructure.count({ where: { websiteId } });

    if (positionCount !== structureCount || positionCount === 0) {
      await this.calculateAndPersistLayout(websiteId);
      return true; // Positions were calculated
    }

    return false; // Positions already existed
  }

  /**
   * Invalidate positions for a website (call after structure changes)
   */
  async invalidatePositions(websiteId: string): Promise<void> {
    await prisma.nodePosition.deleteMany({ where: { websiteId } });
  }

  /**
   * Get bounding box of entire tree
   */
  async getBoundingBox(
    websiteId: string
  ): Promise<{
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    totalNodes: number;
  } | null> {
    const result = await prisma.nodePosition.aggregate({
      where: { websiteId },
      _min: { x: true, y: true },
      _max: { x: true, y: true },
      _count: true,
    });

    if (result._count === 0) return null;

    return {
      minX: result._min.x || 0,
      minY: result._min.y || 0,
      maxX: (result._max.x || 0) + LAYOUT.NODE_WIDTH,
      maxY: (result._max.y || 0) + LAYOUT.NODE_HEIGHT,
      totalNodes: result._count,
    };
  }
}

// Singleton instance
export const unifiedLayoutService = new UnifiedLayoutService();
