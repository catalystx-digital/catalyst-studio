import DataLoader from 'dataloader';
import { prisma } from '@/lib/prisma';

export interface PagePathInfo {
  pageId: string;
  path: string | null;
  title: string | null;
}

/**
 * Create a DataLoader for batched page path resolution
 * Create ONE instance per request (no cross-request caching)
 *
 * Prevents N+1 queries when resolving multiple page references.
 * Batches lookups via WebsiteStructure.fullPath.
 */
export function createPagePathLoader() {
  return new DataLoader<string, PagePathInfo>(
    async (pageIds: readonly string[]) => {
      // Single batched query via WebsiteStructure
      const structures = await prisma.websiteStructure.findMany({
        where: { websitePageId: { in: [...pageIds] } },
        select: {
          websitePageId: true,
          fullPath: true,
          websitePage: {
            select: { title: true }
          }
        }
      });

      // Build lookup map
      const map = new Map<string, PagePathInfo>();
      for (const s of structures) {
        if (s.websitePageId) {
          map.set(s.websitePageId, {
            pageId: s.websitePageId,
            path: s.fullPath,
            title: s.websitePage?.title ?? null
          });
        }
      }

      // Return in same order as input
      return pageIds.map(id => map.get(id) ?? {
        pageId: id,
        path: null,
        title: null
      });
    },
    { maxBatchSize: 100 }
  );
}

export type PagePathLoader = ReturnType<typeof createPagePathLoader>;
