/**
 * ViewportQueryService - Efficient spatial queries for viewport-based loading
 * Uses grid-based index for O(log n) performance
 */

import { prisma } from '@/lib/prisma';
import { LAYOUT, calculateGridCell } from '@/lib/studio/constants/layout-constants';

// Alias for backwards compatibility
const LAYOUT_CONSTANTS = LAYOUT;

interface ViewportBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

interface ViewportQueryOptions {
  websiteId: string;
  viewport: ViewportBounds;
  buffer?: number;
  detailLevel?: 'skeleton' | 'minimal' | 'standard' | 'full';
  maxNodes?: number;
}

interface NodeWithPosition {
  id: string;
  structureId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  pageSlug: string;
  fullPath: string;
  pageTitle: string | null;
  pathDepth: number;
  structure?: {
    id: string;
    slug: string;
    fullPath: string;
    parentId: string | null;
    websitePageId: string | null;
    websitePage?: {
      id: string;
      title: string;
      status: string;
      content?: unknown;
      metadata?: unknown;
    } | null;
  };
}

export class ViewportQueryService {
  /**
   * Get nodes within viewport bounds using grid-based spatial query
   * Performance: O(log n) via grid index
   */
  async getNodesInViewport(options: ViewportQueryOptions): Promise<NodeWithPosition[]> {
    const {
      websiteId,
      viewport,
      buffer = 200,
      detailLevel = 'standard',
      maxNodes = 500,
    } = options;

    // Expand viewport with buffer
    const bufferedBounds: ViewportBounds = {
      minX: viewport.minX - buffer,
      maxX: viewport.maxX + buffer,
      minY: viewport.minY - buffer,
      maxY: viewport.maxY + buffer,
    };

    // Calculate grid cell range
    const minCell = calculateGridCell(bufferedBounds.minX, bufferedBounds.minY);
    const maxCell = calculateGridCell(bufferedBounds.maxX, bufferedBounds.maxY);

    // Query using grid index (primary filter)
    const positions = await prisma.nodePosition.findMany({
      where: {
        websiteId,
        gridCellX: { gte: minCell.cellX, lte: maxCell.cellX },
        gridCellY: { gte: minCell.cellY, lte: maxCell.cellY },
      },
      include: {
        structure: {
          include: this.getIncludesForDetailLevel(detailLevel),
        },
      },
      take: maxNodes,
    });

    // Fine-grained filter: remove nodes outside actual bounds
    // (Grid cells at edges may include nodes outside viewport)
    return positions.filter(
      (pos) =>
        pos.x + pos.width >= bufferedBounds.minX &&
        pos.x <= bufferedBounds.maxX &&
        pos.y + pos.height >= bufferedBounds.minY &&
        pos.y <= bufferedBounds.maxY
    ) as NodeWithPosition[];
  }

  /**
   * Get detail level includes for Prisma query
   */
  private getIncludesForDetailLevel(level: string) {
    switch (level) {
      case 'skeleton':
        return {
          websitePage: { select: { id: true, title: true } },
        };
      case 'minimal':
        return {
          websitePage: { select: { id: true, title: true, status: true } },
        };
      case 'standard':
        return {
          websitePage: { select: { id: true, title: true, status: true, metadata: true } },
        };
      case 'full':
        return {
          websitePage: true,
        };
      default:
        return {
          websitePage: { select: { id: true, title: true, status: true } },
        };
    }
  }

  /**
   * Get all positions for skeleton load (no page data, just positions)
   */
  async getAllPositions(
    websiteId: string
  ): Promise<
    Array<{
      id: string;
      structureId: string;
      x: number;
      y: number;
      width: number;
      height: number;
      pageSlug: string;
      fullPath: string;
      pageTitle: string | null;
      pathDepth: number;
    }>
  > {
    return prisma.nodePosition.findMany({
      where: { websiteId },
      select: {
        id: true,
        structureId: true,
        x: true,
        y: true,
        width: true,
        height: true,
        pageSlug: true,
        fullPath: true,
        pageTitle: true,
        pathDepth: true,
      },
      orderBy: [{ pathDepth: 'asc' }, { x: 'asc' }],
    });
  }

  /**
   * Get grid cell statistics for minimap
   */
  async getGridCellStats(
    websiteId: string
  ): Promise<
    Array<{
      gridCellX: number;
      gridCellY: number;
      nodeCount: number;
    }>
  > {
    const result = await prisma.nodePosition.groupBy({
      by: ['gridCellX', 'gridCellY'],
      where: { websiteId },
      _count: true,
    });

    return result.map((r) => ({
      gridCellX: r.gridCellX,
      gridCellY: r.gridCellY,
      nodeCount: r._count,
    }));
  }

  /**
   * Get nodes by IDs with specified detail level
   */
  async getNodesByIds(
    websiteId: string,
    structureIds: string[],
    detailLevel: 'skeleton' | 'minimal' | 'standard' | 'full' = 'standard'
  ): Promise<NodeWithPosition[]> {
    if (structureIds.length === 0) return [];

    const positions = await prisma.nodePosition.findMany({
      where: {
        websiteId,
        structureId: { in: structureIds },
      },
      include: {
        structure: {
          include: this.getIncludesForDetailLevel(detailLevel),
        },
      },
    });

    return positions as NodeWithPosition[];
  }
}

export const viewportQueryService = new ViewportQueryService();
