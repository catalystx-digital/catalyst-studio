import { prisma } from '@/lib/prisma';

/**
 * Reference validation status
 * - 'active': Target exists and is accessible
 * - 'broken': Target no longer exists (page deleted, media missing)
 * - 'pending': Awaiting validation
 */
export type ReferenceStatus = 'active' | 'broken' | 'pending';

export interface ValidationResult {
  totalReferences: number;
  activeCount: number;
  brokenCount: number;
  validatedAt: Date;
}

export interface BrokenReference {
  id: string;
  sourceId: string;
  sourceType: string;
  sourcePath: string;
  targetId: string;
  targetType: string;
  pageTitle?: string;
}

/**
 * Service for validating content reference health.
 * Checks if referenced targets (pages, media) still exist and marks broken references.
 */
export class ContentReferenceValidationService {
  /**
   * Validate all references for a website.
   * Checks if each target (page or media) exists and updates status accordingly.
   */
  async validateReferences(websiteId: string): Promise<ValidationResult> {
    const now = new Date();

    // Get all references for the website
    const references = await prisma.contentReference.findMany({
      where: { websiteId },
      select: {
        id: true,
        targetId: true,
        targetType: true
      }
    });

    if (references.length === 0) {
      return {
        totalReferences: 0,
        activeCount: 0,
        brokenCount: 0,
        validatedAt: now
      };
    }

    // Separate by target type for efficient lookup
    const pageRefIds = references
      .filter(r => r.targetType === 'page')
      .map(r => r.targetId);
    const mediaRefIds = references
      .filter(r => r.targetType === 'media')
      .map(r => r.targetId);

    // Get existing pages and media in single queries
    const [existingPages, existingMedia] = await Promise.all([
      pageRefIds.length > 0
        ? prisma.websitePage.findMany({
            where: { id: { in: pageRefIds }, websiteId },
            select: { id: true }
          })
        : Promise.resolve([]),
      mediaRefIds.length > 0
        ? prisma.websiteMedia.findMany({
            where: { id: { in: mediaRefIds }, websiteId },
            select: { id: true }
          })
        : Promise.resolve([])
    ]);

    const existingPageIds = new Set(existingPages.map(p => p.id));
    const existingMediaIds = new Set(existingMedia.map(m => m.id));

    // Categorize references
    const brokenIds: string[] = [];
    const activeIds: string[] = [];

    for (const ref of references) {
      const exists = ref.targetType === 'page'
        ? existingPageIds.has(ref.targetId)
        : existingMediaIds.has(ref.targetId);

      if (exists) {
        activeIds.push(ref.id);
      } else {
        brokenIds.push(ref.id);
      }
    }

    // Batch update statuses
    await Promise.all([
      brokenIds.length > 0
        ? prisma.contentReference.updateMany({
            where: { id: { in: brokenIds } },
            data: {
              status: 'broken',
              lastValidatedAt: now
            }
          })
        : Promise.resolve(),
      activeIds.length > 0
        ? prisma.contentReference.updateMany({
            where: { id: { in: activeIds } },
            data: {
              status: 'active',
              lastValidatedAt: now
            }
          })
        : Promise.resolve()
    ]);

    return {
      totalReferences: references.length,
      activeCount: activeIds.length,
      brokenCount: brokenIds.length,
      validatedAt: now
    };
  }

  /**
   * Get all broken references for a website with source page context.
   */
  async getBrokenReferences(websiteId: string): Promise<BrokenReference[]> {
    const brokenRefs = await prisma.contentReference.findMany({
      where: {
        websiteId,
        status: 'broken'
      },
      select: {
        id: true,
        sourceId: true,
        sourceType: true,
        sourcePath: true,
        targetId: true,
        targetType: true
      }
    });

    if (brokenRefs.length === 0) {
      return [];
    }

    // Enrich with page titles for better context
    const pageSourceIds = brokenRefs
      .filter(r => r.sourceType === 'page')
      .map(r => r.sourceId);

    if (pageSourceIds.length > 0) {
      const pages = await prisma.websitePage.findMany({
        where: { id: { in: pageSourceIds } },
        select: { id: true, title: true }
      });

      const titleMap = new Map(pages.map(p => [p.id, p.title]));

      return brokenRefs.map(ref => ({
        ...ref,
        pageTitle: ref.sourceType === 'page' ? titleMap.get(ref.sourceId) : undefined
      }));
    }

    return brokenRefs;
  }

  /**
   * Mark a specific reference as broken (e.g., when target is deleted).
   * Called by deletion handlers to immediately mark references without full validation.
   */
  async markBroken(targetId: string, targetType: 'page' | 'media'): Promise<number> {
    const result = await prisma.contentReference.updateMany({
      where: {
        targetId,
        targetType
      },
      data: {
        status: 'broken',
        lastValidatedAt: new Date()
      }
    });

    return result.count;
  }

  /**
   * Clean up broken references (remove them from the database).
   * Use with caution - this permanently removes reference tracking.
   */
  async cleanupBrokenReferences(websiteId: string): Promise<number> {
    const result = await prisma.contentReference.deleteMany({
      where: {
        websiteId,
        status: 'broken'
      }
    });

    return result.count;
  }
}

export const validationService = new ContentReferenceValidationService();
