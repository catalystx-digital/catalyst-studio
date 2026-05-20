import { prisma } from '@/lib/prisma';

export interface WhereUsedResult {
  sourceId: string;
  sourceType: string;
  sourcePath: string;
  pageTitle?: string | null;
}

export interface DeletionCheck {
  canDelete: boolean;
  usageCount: number;
  usages: WhereUsedResult[];
}

export class ContentReferenceIntegrityService {
  /**
   * Find all content that references a specific target
   * Instant query thanks to targetId index
   */
  async whereUsed(
    targetId: string,
    targetType: 'page' | 'media'
  ): Promise<WhereUsedResult[]> {
    const refs = await prisma.contentReference.findMany({
      where: { targetId, targetType },
      select: {
        sourceId: true,
        sourceType: true,
        sourcePath: true
      }
    });

    // Enrich with page titles for display
    if (refs.length > 0) {
      const pageIds = refs
        .filter(r => r.sourceType === 'page')
        .map(r => r.sourceId);

      if (pageIds.length > 0) {
        const pages = await prisma.websitePage.findMany({
          where: { id: { in: pageIds } },
          select: { id: true, title: true }
        });

        const titleMap = new Map(pages.map(p => [p.id, p.title]));

        return refs.map(r => ({
          ...r,
          pageTitle: r.sourceType === 'page' ? titleMap.get(r.sourceId) : undefined
        }));
      }
    }

    return refs;
  }

  /**
   * Check if content can be safely deleted
   */
  async canDelete(
    targetId: string,
    targetType: 'page' | 'media'
  ): Promise<DeletionCheck> {
    const usages = await this.whereUsed(targetId, targetType);

    return {
      canDelete: usages.length === 0,
      usageCount: usages.length,
      usages: usages.slice(0, 10)  // Limit for UI display
    };
  }

  /**
   * Find orphaned media (media not referenced by any content)
   */
  async findOrphanedMedia(websiteId: string): Promise<string[]> {
    // Get all media IDs
    const allMedia = await prisma.websiteMedia.findMany({
      where: { websiteId },
      select: { id: true }
    });

    if (allMedia.length === 0) return [];

    // Get all referenced media IDs
    const referencedMedia = await prisma.contentReference.findMany({
      where: {
        websiteId,
        targetType: 'media'
      },
      select: { targetId: true },
      distinct: ['targetId']
    });

    const referencedSet = new Set(referencedMedia.map(r => r.targetId));

    // Find media not in referenced set
    return allMedia
      .filter(m => !referencedSet.has(m.id))
      .map(m => m.id);
  }

  /**
   * Find broken references (refs pointing to non-existent content)
   */
  async findBrokenReferences(websiteId: string): Promise<{
    brokenPageRefs: string[];
    brokenMediaRefs: string[];
  }> {
    // Get all page references
    const pageRefs = await prisma.contentReference.findMany({
      where: { websiteId, targetType: 'page' },
      select: { id: true, targetId: true }
    });

    // Get all existing pages
    const existingPages = await prisma.websitePage.findMany({
      where: { websiteId },
      select: { id: true }
    });
    const pageIdSet = new Set(existingPages.map(p => p.id));

    // Find broken page refs
    const brokenPageRefs = pageRefs
      .filter(r => !pageIdSet.has(r.targetId))
      .map(r => r.id);

    // Get all media references
    const mediaRefs = await prisma.contentReference.findMany({
      where: { websiteId, targetType: 'media' },
      select: { id: true, targetId: true }
    });

    // Get all existing media
    const existingMedia = await prisma.websiteMedia.findMany({
      where: { websiteId },
      select: { id: true }
    });
    const mediaIdSet = new Set(existingMedia.map(m => m.id));

    // Find broken media refs
    const brokenMediaRefs = mediaRefs
      .filter(r => !mediaIdSet.has(r.targetId))
      .map(r => r.id);

    return { brokenPageRefs, brokenMediaRefs };
  }
}

export const integrityService = new ContentReferenceIntegrityService();
