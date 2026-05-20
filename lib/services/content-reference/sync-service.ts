import { prisma } from '@/lib/prisma';
import { extractReferences } from './extract-references';

export class ContentReferenceSyncService {
  /**
   * Sync references for a single page
   * Called on page save
   */
  async syncPageReferences(
    pageId: string,
    content: unknown,
    websiteId: string
  ): Promise<{ added: number; removed: number }> {
    const refs = extractReferences(content);

    // Transaction: delete old + insert new
    const result = await prisma.$transaction(async (tx) => {
      // Delete existing references from this page
      const deleted = await tx.contentReference.deleteMany({
        where: { sourceId: pageId, sourceType: 'page' }
      });

      // Insert new references
      if (refs.length > 0) {
        await tx.contentReference.createMany({
          data: refs.map(ref => ({
            sourceType: 'page' as const,
            sourceId: pageId,
            sourcePath: ref.sourcePath,
            targetType: ref.targetType,
            targetId: ref.targetId,
            websiteId
          })),
          skipDuplicates: true
        });
      }

      return { removed: deleted.count, added: refs.length };
    });

    return result;
  }

  /**
   * Bulk sync for all pages in a website
   * Used for initial backfill or repair
   *
   * Uses smaller batch sizes and individual transactions per page
   * to avoid Prisma transaction timeouts (P2028 errors).
   */
  async syncAllPagesInWebsite(websiteId: string): Promise<{
    pagesProcessed: number;
    referencesCreated: number;
  }> {
    const BATCH_SIZE = 10; // Smaller batches to avoid timeout
    let pagesProcessed = 0;
    let referencesCreated = 0;

    // Get all pages
    const pages = await prisma.websitePage.findMany({
      where: { websiteId },
      select: { id: true, content: true }
    });

    // Process in smaller batches, each page in its own transaction
    for (let i = 0; i < pages.length; i += BATCH_SIZE) {
      const batch = pages.slice(i, i + BATCH_SIZE);

      // Process each page in parallel within the batch
      const results = await Promise.all(
        batch.map(async (page) => {
          const refs = extractReferences(page.content);

          // Each page gets its own short transaction
          await prisma.$transaction(async (tx) => {
            // Delete existing
            await tx.contentReference.deleteMany({
              where: { sourceId: page.id, sourceType: 'page' }
            });

            // Insert new
            if (refs.length > 0) {
              await tx.contentReference.createMany({
                data: refs.map(ref => ({
                  sourceType: 'page' as const,
                  sourceId: page.id,
                  sourcePath: ref.sourcePath,
                  targetType: ref.targetType,
                  targetId: ref.targetId,
                  websiteId
                })),
                skipDuplicates: true
              });
            }
          });

          return refs.length;
        })
      );

      referencesCreated += results.reduce((sum, count) => sum + count, 0);
      pagesProcessed += batch.length;
      console.log(`Synced ${pagesProcessed}/${pages.length} pages`);
    }

    return { pagesProcessed, referencesCreated };
  }
}

export const contentReferenceSyncService = new ContentReferenceSyncService();
