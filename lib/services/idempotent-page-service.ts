/**
 * Idempotent Page Service
 *
 * Provides getOrCreatePage function that ensures page creation is idempotent
 * using URL-based lookup via metadata.importSource.
 *
 * Pattern: Follows PageBuilderService.upsertPage at lib/studio/import/services/page-builder-service.ts:476-484
 */

import { prisma } from '@/lib/prisma';
import { unifiedPageService } from '@/lib/services/unified-page-service';

export interface GetOrCreatePageParams {
  websiteId: string;
  sourceUrl: string;  // Used as idempotency key in metadata.importSource
  contentTypeId: string;
  title: string;
  slug: string;
  content: Record<string, unknown>;
  parentId?: string;
  metadata?: Record<string, unknown>;
  status?: 'draft' | 'published';
}

export interface PageResult {
  id: string;
  title: string;
  slug: string;
  fullPath: string;
  wasExisting: boolean;  // True if found existing, false if newly created
  siteStructureId: string | null;  // The SiteStructure ID - needed for parentId in child pages
}

/**
 * Get an existing page by sourceUrl or create a new one if not found.
 * Uses metadata.importSource as the idempotency key.
 *
 * @param params - Page creation parameters including sourceUrl as idempotency key
 * @returns PageResult with wasExisting flag indicating if page was found or created
 */
export async function getOrCreatePage(params: GetOrCreatePageParams): Promise<PageResult> {
  const {
    websiteId,
    sourceUrl,
    contentTypeId,
    title,
    slug,
    content,
    parentId,
    metadata = {},
    status = 'draft'
  } = params;

  // 1. Check for existing page by sourceUrl in metadata.importSource
  // Pattern from PageBuilderService.upsertPage (page-builder-service.ts:476-484)
  const existingPage = await prisma.websitePage.findFirst({
    where: {
      websiteId,
      metadata: {
        path: ['importSource'],
        equals: sourceUrl
      }
    },
    include: {
      structures: true
    }
  });

  // 2. If found, return formatted existing page with wasExisting=true
  if (existingPage) {
    console.log(`[IdempotentPageService] Found existing page for sourceUrl: ${sourceUrl}`, {
      pageId: existingPage.id,
      title: existingPage.title
    });

    // Get fullPath from websiteStructure if available
    const fullPath = existingPage.structures[0]?.fullPath
      || `/${existingPage.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

    return {
      id: existingPage.id,
      title: existingPage.title,
      slug: existingPage.structures[0]?.slug || slug,
      fullPath,
      wasExisting: true,
      siteStructureId: existingPage.structures[0]?.id || null
    };
  }

  // 3. If not found, create new page using unifiedPageService with metadata.importSource set
  console.log(`[IdempotentPageService] Creating new page for sourceUrl: ${sourceUrl}`, {
    title,
    slug
  });

  const response = await unifiedPageService.createPage(
    {
      websiteId,
      contentTypeId,
      title,
      slug,
      content,
      parentId,
      metadata: {
        ...metadata,
        importSource: sourceUrl
      },
      status
    },
    'ai' // Source is AI for greenfield workflow
  );

  if (!response.success || !response.data) {
    const errorMsg = response.errors?.[0]?.message || 'Failed to create page';
    throw new Error(`[IdempotentPageService] ${errorMsg}`);
  }

  // 4. Return new page with wasExisting=false
  return {
    id: response.data.contentItem.id,
    title: response.data.contentItem.title,
    slug: response.data.siteStructure?.slug || slug,
    fullPath: response.data.url || `/${slug}`,
    wasExisting: false,
    siteStructureId: response.data.siteStructure?.id || null
  };
}

/**
 * Check if a page exists for the given source URL
 * @param websiteId - The website ID
 * @param sourceUrl - The source URL to check
 * @returns The existing page ID if found, null otherwise
 */
export async function findPageBySourceUrl(
  websiteId: string,
  sourceUrl: string
): Promise<string | null> {
  const existing = await prisma.websitePage.findFirst({
    where: {
      websiteId,
      metadata: {
        path: ['importSource'],
        equals: sourceUrl
      }
    },
    select: { id: true }
  });

  return existing?.id || null;
}

// Export service object for consistency with other services
export const idempotentPageService = {
  getOrCreatePage,
  findPageBySourceUrl
};
