/**
 * AI Tool for Page Deletion
 *
 * Uses UnifiedPageService to ensure proper deletion:
 * - Deletes both WebsitePage (ContentItem) and WebsiteStructure atomically
 * - Handles child pages with cascade option
 * - Safety checks to prevent accidental data loss
 */

import { tool } from 'ai';
import { z } from 'zod';
import { unifiedPageService } from '@/lib/services/unified-page-service';
import { prisma } from '@/lib/prisma';
import {
  createPageDeletedEvent,
  withEvents,
  type AIToolEvent
} from '@/lib/ai-tools/services/event-publisher';

const deletePageInputSchema = z.object({
  pageId: z.string().optional().describe('The page ID to delete (provide either pageId or slug)'),
  slug: z.string().optional().describe('The page slug to delete (provide either pageId or slug)'),
  deleteChildren: z.boolean().default(false).describe('Delete child pages recursively (default: false)'),
  websiteId: z.string().optional().describe('The website ID (required when using slug)')
});

type DeletePageInput = z.infer<typeof deletePageInputSchema>;

/**
 * Delete a page and its associated content
 * - Deletes both WebsitePage and WebsiteStructure
 * - Can optionally delete child pages recursively
 * - Includes safety checks
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const deletePage = (tool as any)({
  description: `Delete a page and its associated content from the website.

⚠️ CRITICAL: This is a destructive operation that cannot be undone.

Features:
- Deletes both WebsitePage (ContentItem) and WebsiteStructure atomically
- Can delete child pages recursively if deleteChildren=true
- Safety checks prevent deletion of pages with children unless explicitly allowed
- Cannot delete root/home pages (pages with path "/")

Safety Guidelines:
- Always check for child pages before deleting
- Use deleteChildren=false (default) to prevent accidental cascade deletion
- Only set deleteChildren=true when user explicitly confirms

Example scenarios:
- "delete the about page" → delete single page (fails if has children)
- "delete the blog section and all blog posts" → deleteChildren=true
- "remove the contact page" → delete single page`,
  inputSchema: deletePageInputSchema,
  execute: async (params: DeletePageInput) => {
    const startTime = Date.now();

    try {
      // Validate: must provide either pageId or slug
      if (!params.pageId && !params.slug) {
        return {
          success: false,
          error: 'Must provide either pageId or slug',
          executionTime: `${Date.now() - startTime}ms`
        };
      }

      // If slug provided, websiteId is required
      if (params.slug && !params.websiteId) {
        return {
          success: false,
          error: 'websiteId is required when using slug',
          executionTime: `${Date.now() - startTime}ms`
        };
      }

      // Find the page
      let pageId = params.pageId;
      let page;
      let siteStructure;

      if (params.slug && params.websiteId) {
        // Find by slug
        siteStructure = await prisma.websiteStructure.findFirst({
          where: {
            websiteId: params.websiteId,
            slug: params.slug
          },
          include: {
            websitePage: true
          }
        });

        if (!siteStructure) {
          return {
            success: false,
            error: `Page with slug "${params.slug}" not found`,
            executionTime: `${Date.now() - startTime}ms`
          };
        }

        pageId = siteStructure.websitePageId || '';
        page = siteStructure.websitePage;
      } else if (pageId) {
        // Find by ID
        page = await prisma.websitePage.findUnique({
          where: { id: pageId }
        });

        if (!page) {
          return {
            success: false,
            error: `Page with ID "${pageId}" not found`,
            executionTime: `${Date.now() - startTime}ms`
          };
        }

        // Find associated structure
        siteStructure = await prisma.websiteStructure.findFirst({
          where: { websitePageId: pageId }
        });
      }

      if (!page || !pageId) {
        return {
          success: false,
          error: 'Page not found',
          executionTime: `${Date.now() - startTime}ms`
        };
      }

      // Safety check: prevent deletion of root/home page
      if (siteStructure && (siteStructure.fullPath === '/' || siteStructure.fullPath === '')) {
        return {
          success: false,
          error: 'Cannot delete the root/home page',
          executionTime: `${Date.now() - startTime}ms`
        };
      }

      // Check for child pages
      let childPages: Array<{ id: string; slug: string; fullPath: string }> = [];
      if (siteStructure) {
        const children = await prisma.websiteStructure.findMany({
          where: {
            parentId: siteStructure.id
          },
          select: {
            id: true,
            slug: true,
            fullPath: true
          }
        });
        childPages = children;
      }

      // If has children and deleteChildren=false, return error with child list
      if (childPages.length > 0 && !params.deleteChildren) {
        return {
          success: false,
          error: `Cannot delete page with ${childPages.length} child page(s). Set deleteChildren=true to delete all child pages, or delete children first.`,
          hasChildren: true,
          childCount: childPages.length,
          children: childPages.map(child => ({
            id: child.id,
            slug: child.slug,
            fullPath: child.fullPath
          })),
          executionTime: `${Date.now() - startTime}ms`
        };
      }

      // Collect all page IDs that will be deleted (for response)
      const deletedChildPageIds: string[] = [];
      if (params.deleteChildren && childPages.length > 0) {
        // Find all descendant pages recursively
        const descendants = await prisma.websiteStructure.findMany({
          where: {
            fullPath: {
              startsWith: siteStructure!.fullPath + '/'
            }
          },
          select: {
            websitePageId: true
          }
        });
        deletedChildPageIds.push(...descendants.map(d => d.websitePageId).filter(Boolean) as string[]);
      }

      // Delete using UnifiedPageService
      const deleteResponse = await unifiedPageService.deletePage(
        pageId,
        { cascade: params.deleteChildren },
        'ai'
      );

      if (!deleteResponse.success) {
        return {
          success: false,
          error: deleteResponse.errors[0]?.message || 'Failed to delete page',
          errors: deleteResponse.errors,
          executionTime: `${Date.now() - startTime}ms`
        };
      }

      // Success response
      const result: Record<string, unknown> = {
        success: true,
        deletedPageId: pageId,
        slug: siteStructure?.slug || page.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        message: `Successfully deleted page "${page.title}"`,
        executionTime: `${Date.now() - startTime}ms`
      };

      // Add child deletion info if applicable
      if (deletedChildPageIds.length > 0) {
        result.deletedChildPageIds = deletedChildPageIds;
        result.deletedChildCount = deletedChildPageIds.length;
        result.message = `Successfully deleted page "${page.title}" and ${deletedChildPageIds.length} child page(s)`;
      }

      // Create page deleted events
      const events: AIToolEvent[] = [
        createPageDeletedEvent(page.websiteId, pageId, page.title)
      ];

      // Add events for child pages
      if (deletedChildPageIds.length > 0) {
        for (const childId of deletedChildPageIds) {
          events.push(createPageDeletedEvent(page.websiteId, childId));
        }
      }

      return withEvents(result, events);
    } catch (error) {
      console.error('Error deleting page:', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete page',
        executionTime: `${Date.now() - startTime}ms`
      };
    }
  }
});
