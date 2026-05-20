/**
 * PageSearchService - Search across pages with position lookup
 * Returns positions for "jump to node" functionality
 */

import { prisma } from '@/lib/prisma';

interface SearchResult {
  structureId: string;
  pageTitle: string | null;
  pageSlug: string;
  fullPath: string;
  position: { x: number; y: number };
  relevanceScore: number;
}

interface AutocompleteResult {
  label: string;
  structureId: string;
  position: { x: number; y: number };
}

export class PageSearchService {
  /**
   * Search across pages by title, slug, or path
   * Uses case-insensitive matching with relevance scoring
   */
  async searchPages(
    websiteId: string,
    query: string,
    options: { limit?: number } = {}
  ): Promise<SearchResult[]> {
    const { limit = 20 } = options;

    // Sanitize query
    const sanitizedQuery = query.replace(/[^\w\s-]/g, '').trim().toLowerCase();
    if (!sanitizedQuery || sanitizedQuery.length < 2) {
      return [];
    }

    try {
      // Search using Prisma's built-in filtering
      // We'll do relevance scoring in application code
      const results = await prisma.nodePosition.findMany({
        where: {
          websiteId,
          OR: [
            { pageTitle: { contains: sanitizedQuery, mode: 'insensitive' } },
            { pageSlug: { contains: sanitizedQuery, mode: 'insensitive' } },
            { fullPath: { contains: sanitizedQuery, mode: 'insensitive' } },
          ],
        },
        select: {
          structureId: true,
          pageTitle: true,
          pageSlug: true,
          fullPath: true,
          x: true,
          y: true,
        },
        take: limit * 2, // Fetch extra for scoring/reranking
      });

      // Calculate relevance scores and sort
      const scored = results.map((r) => ({
        structureId: r.structureId,
        pageTitle: r.pageTitle,
        pageSlug: r.pageSlug,
        fullPath: r.fullPath,
        position: { x: r.x, y: r.y },
        relevanceScore: this.calculateRelevance(r, sanitizedQuery),
      }));

      // Sort by relevance and take limit
      return scored
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, limit);
    } catch (error) {
      console.error('[PageSearchService] Search error:', error);
      return [];
    }
  }

  /**
   * Calculate relevance score for a result
   */
  private calculateRelevance(
    result: {
      pageTitle: string | null;
      pageSlug: string;
      fullPath: string;
    },
    query: string
  ): number {
    let score = 0;
    const lowerQuery = query.toLowerCase();

    // Title exact match (highest priority)
    if (result.pageTitle?.toLowerCase() === lowerQuery) {
      score += 100;
    }
    // Title starts with query
    else if (result.pageTitle?.toLowerCase().startsWith(lowerQuery)) {
      score += 80;
    }
    // Title contains query
    else if (result.pageTitle?.toLowerCase().includes(lowerQuery)) {
      score += 50;
    }

    // Slug exact match
    if (result.pageSlug.toLowerCase() === lowerQuery) {
      score += 90;
    }
    // Slug starts with query
    else if (result.pageSlug.toLowerCase().startsWith(lowerQuery)) {
      score += 60;
    }
    // Slug contains query
    else if (result.pageSlug.toLowerCase().includes(lowerQuery)) {
      score += 30;
    }

    // Path contains query (lower priority)
    if (result.fullPath.toLowerCase().includes(lowerQuery)) {
      score += 10;
    }

    // Boost home page
    if (
      result.pageSlug === '' ||
      result.pageSlug === '/' ||
      result.pageSlug.toLowerCase() === 'home'
    ) {
      score += 5;
    }

    return score;
  }

  /**
   * Autocomplete suggestions as user types
   */
  async autocomplete(
    websiteId: string,
    prefix: string,
    limit: number = 10
  ): Promise<AutocompleteResult[]> {
    const sanitizedPrefix = prefix.replace(/[^\w\s-]/g, '').trim().toLowerCase();
    if (sanitizedPrefix.length < 2) return [];

    const results = await prisma.nodePosition.findMany({
      where: {
        websiteId,
        OR: [
          { pageTitle: { startsWith: prefix, mode: 'insensitive' } },
          { pageSlug: { startsWith: prefix, mode: 'insensitive' } },
        ],
      },
      select: {
        structureId: true,
        pageTitle: true,
        pageSlug: true,
        x: true,
        y: true,
      },
      orderBy: { pageTitle: 'asc' },
      take: limit,
    });

    return results.map((r) => ({
      label: r.pageTitle || r.pageSlug,
      structureId: r.structureId,
      position: { x: r.x, y: r.y },
    }));
  }

  /**
   * Get position for a specific node (for jump-to-node)
   */
  async getNodePosition(
    websiteId: string,
    structureId: string
  ): Promise<{ x: number; y: number } | null> {
    const result = await prisma.nodePosition.findUnique({
      where: { structureId },
      select: { x: true, y: true, websiteId: true },
    });

    if (!result || result.websiteId !== websiteId) {
      return null;
    }

    return { x: result.x, y: result.y };
  }

  /**
   * Find home page position
   */
  async findHomePosition(websiteId: string): Promise<{
    structureId: string;
    position: { x: number; y: number };
  } | null> {
    // Try to find home by common patterns
    const homeResult = await prisma.nodePosition.findFirst({
      where: {
        websiteId,
        OR: [
          { pageSlug: '' },
          { pageSlug: '/' },
          { pageSlug: { equals: 'home', mode: 'insensitive' } },
          { fullPath: '/' },
        ],
      },
      select: {
        structureId: true,
        x: true,
        y: true,
      },
    });

    if (homeResult) {
      return {
        structureId: homeResult.structureId,
        position: { x: homeResult.x, y: homeResult.y },
      };
    }

    // Fallback: return first root node (pathDepth = 0)
    const rootResult = await prisma.nodePosition.findFirst({
      where: { websiteId, pathDepth: 0 },
      select: {
        structureId: true,
        x: true,
        y: true,
      },
      orderBy: { x: 'asc' },
    });

    if (rootResult) {
      return {
        structureId: rootResult.structureId,
        position: { x: rootResult.x, y: rootResult.y },
      };
    }

    return null;
  }
}

export const pageSearchService = new PageSearchService();
