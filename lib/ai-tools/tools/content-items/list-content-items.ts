import { tool } from 'ai';
import { z } from 'zod';
import { getClient } from '@/lib/db/client';
import { getPageCatalogSummary } from '@/lib/studio/pages/catalog';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const listContentItems = (tool as any)({
  description: 'List page content items with filtering options',
  inputSchema: z.object({
    websiteId: z.string().optional().describe('Filter by website ID'),
    contentTypeId: z.string().optional().describe('Filter by content type ID'),
    status: z.enum(['draft', 'published', 'archived']).optional().describe('Filter by status'),
    limit: z.number().min(1).max(20).default(20).describe('Maximum number of items to return (max 20)'),
    page: z.number().min(1).default(1).describe('Page number for pagination'),
    sortBy: z.enum(['createdAt', 'updatedAt']).default('updatedAt').describe('Field to sort by'),
    sortOrder: z.enum(['asc', 'desc']).default('desc').describe('Sort order')
  }),
  execute: async ({ websiteId, contentTypeId, status, limit = 20, page = 1, sortBy = 'updatedAt', sortOrder = 'desc' }: { websiteId?: string; contentTypeId?: string; status?: string; limit?: number; page?: number; sortBy?: string; sortOrder?: string }) => {
    const startTime = Date.now();

    // Ensure defaults are applied (Zod defaults may not be passed through by AI SDK)
    const safeLimit = limit ?? 20;
    const safePage = page ?? 1;
    const safeSortBy = sortBy ?? 'updatedAt';
    const safeSortOrder = sortOrder ?? 'desc';

    try {
      const prisma = getClient();

      // Build where clause
      const where: Record<string, unknown> = {};
      if (websiteId) where.websiteId = websiteId;
      if (contentTypeId) where.contentTypeId = contentTypeId;
      if (status) where.status = status;

      // Calculate pagination
      const skip = (safePage - 1) * safeLimit;

      const [pages, pagesCount, templateSummary] = await Promise.all([
        prisma.websitePage.findMany({
          where,
          skip,
          take: safeLimit,
          orderBy: { [safeSortBy]: safeSortOrder },
          include: {
            contentType: true,
            website: true
          }
        }),
        prisma.websitePage.count({ where }),
        getPageCatalogSummary()
      ]);

      const total = pagesCount;

      // Transform items to include parsed field values
      const transformedItems = pages.map(item => {
        const contentData = (item as any).content || {};
        const contentTypeFields = item.contentType.fields || {};

        return {
          id: item.id,
          title: item.title,
          websiteId: item.websiteId,
          contentTypeId: item.contentTypeId,
          status: item.status,
          content: contentData,
          modelType: 'page',
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
          contentType: {
            id: item.contentType.id,
            name: item.contentType.name,
            fields: contentTypeFields,
            category: item.contentType.category
          },
          website: {
            id: item.website.id,
            name: item.website.name,
            category: item.website.category
          }
        };
      });

      const executionTime = Date.now() - startTime;
      if (executionTime > 2000) {
        console.warn(`list-content-items execution exceeded 2s: ${executionTime}ms`);
      }

      const totalPages = Math.ceil(total / safeLimit);

      return {
        success: true,
        items: transformedItems,
        templates: templateSummary,
        pagination: {
          page: safePage,
          limit: safeLimit,
          total,
          totalPages,
          hasNext: safePage < totalPages,
          hasPrev: safePage > 1
        },
        executionTime: `${executionTime}ms`
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error('Error listing content items:', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list content items',
        templates: null,
        executionTime: `${executionTime}ms`
      };
    }
  }
});
