/**
 * AI Tool for Content Creation (Pages and Components)
 *
 * Uses UnifiedPageService to ensure proper creation:
 * - Pages: Atomic creation of both ContentItem and SiteStructure
 * - Components: Creates only ContentItem (no routing needed)
 *
 * Replaces the old create-content-item tool.
 */

import { tool } from 'ai';
import { z } from 'zod';
import { unifiedPageService } from '@/lib/services/unified-page-service';
import { getOrCreatePage } from '@/lib/services/idempotent-page-service';
import { ErrorCode, PageResult } from '@/lib/types/unified-response.types';
import {
  createPageAddedEvent,
  withEvents
} from '@/lib/ai-tools/services/event-publisher';

const createPageInputSchema = z.object({
  websiteId: z.string().describe('The website ID for the page'),
  contentTypeId: z.string().describe('The content type ID that defines the structure'),
  title: z.string().describe('The page title'),
  content: z.record(z.any()).describe('The content data matching the content type fields'),
  parentId: z.string().optional().describe('The parent page ID for hierarchy (null for root pages)'),
  slug: z.string().optional().describe('URL slug (auto-generated from title if not provided)'),
  metadata: z.record(z.any()).optional().describe('Additional metadata for the page'),
  status: z.enum(['draft', 'published']).default('draft').describe('Publication status'),
  sourceUrl: z.string().optional().describe('URL used as idempotency key - if provided, will reuse existing page with this sourceUrl instead of creating duplicate')
});

type CreatePageInput = z.infer<typeof createPageInputSchema>;

/**
 * Validates and sanitizes components array.
 * - Filters out invalid components (non-objects, missing type)
 * - Ensures all valid components have unique IDs
 *
 * AI-generated content can sometimes have malformed components due to JSON parsing issues.
 * This prevents corrupted data from being saved to the database.
 */
function sanitizeAndEnsureComponentIds(content: Record<string, any>): Record<string, any> {
  if (!content || typeof content !== 'object') {
    return content;
  }

  // Check for components array (standard page content structure)
  if (Array.isArray(content.components)) {
    const timestamp = Date.now();
    let validIndex = 0;

    // Filter out invalid components and ensure IDs on valid ones
    content.components = content.components
      .filter((comp: any) => {
        // Must be an object with a string type property
        const isValid = comp && typeof comp === 'object' && typeof comp.type === 'string';
        if (!isValid) {
          console.warn('[createPage] Filtering out invalid component:',
            typeof comp === 'string' ? comp.substring(0, 50) : typeof comp
          );
        }
        return isValid;
      })
      .map((comp: any) => {
        // Generate ID if missing
        if (!comp.id) {
          return {
            ...comp,
            id: `${comp.type.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${timestamp}-${validIndex++}`
          };
        }
        validIndex++;
        return comp;
      });
  }

  return content;
}

/**
 * Helper function to format the response from UnifiedPageService
 */
function formatPageResponse(
  data: PageResult,
  startTime: number,
  retryUsed = false,
  alternativeSlug?: string
) {
  const result: Record<string, unknown> = {
    success: true,
    page: {
      id: data.contentItem.id,
      title: data.contentItem.title,
      slug: data.contentItem.slug,
      url: data.url,
      websiteId: data.contentItem.websiteId,
      contentTypeId: data.contentItem.contentTypeId,
      parentId: data.siteStructure?.parentId || null,
      status: data.contentItem.status,
      createdAt: data.contentItem.createdAt,
      updatedAt: data.contentItem.updatedAt
    },
    executionTime: `${Date.now() - startTime}ms`
  };

  if (retryUsed && alternativeSlug) {
    result.retryUsed = true;
    result.alternativeSlug = alternativeSlug;
  }

  // Only add siteStructure if it exists (pages have it, components don't)
  if (data.siteStructure) {
    result.siteStructure = {
      id: data.siteStructure.id,
      fullPath: data.siteStructure.fullPath,
      pathDepth: data.siteStructure.pathDepth,
      position: data.siteStructure.position
    };
  }

  // Create page added event
  const event = createPageAddedEvent(
    data.contentItem.websiteId,
    data.contentItem.id,
    data.contentItem.title,
    data.contentItem.slug,
    data.url
  );

  return withEvents(result, [event]);
}

/**
 * Create content (page or component) with proper structure
 * - Pages: Creates both ContentItem and SiteStructure atomically
 * - Components: Creates only ContentItem (no routing needed)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const createPage = (tool as any)({
  description: `Create a NEW page or component from scratch. Pages get both ContentItem and SiteStructure. Components only get ContentItem.

⚠️ CRITICAL: This tool is ONLY for creating NEW content that doesn't exist yet.

DO NOT USE THIS TOOL when the user wants to:
- "change" something → use findAndUpdateComponent instead
- "update" something → use findAndUpdateComponent instead
- "edit" something → use findAndUpdateComponent instead
- "modify" something → use findAndUpdateComponent instead
- "fix" something → use findAndUpdateComponent instead
- "replace" text → use findAndUpdateComponent instead
- "set" a value → use findAndUpdateComponent instead

USE THIS TOOL ONLY when the user explicitly wants to:
- "create" a new page
- "add" a new section/page
- "build" new content
- "make" a new page
- "generate" new content

If the user says "change the hero heading" - that's a MODIFICATION, use findAndUpdateComponent.
If the user says "create a new about page" - that's CREATION, use this tool.`,
  inputSchema: createPageInputSchema,
  execute: async (params: CreatePageInput) => {
    const startTime = Date.now();

    try {
      // Ensure all components have IDs before saving
      // AI-generated content often lacks IDs which causes rendering issues in site-builder
      const processedContent = sanitizeAndEnsureComponentIds(params.content);

      // If sourceUrl is provided, use idempotent page service
      // This allows workflow retries to reuse existing pages instead of creating duplicates
      if (params.sourceUrl) {
        const pageResult = await getOrCreatePage({
          websiteId: params.websiteId,
          sourceUrl: params.sourceUrl,
          contentTypeId: params.contentTypeId,
          title: params.title,
          slug: params.slug || params.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          content: processedContent,
          parentId: params.parentId,
          metadata: params.metadata,
          status: params.status
        });

        // Create page added event
        const event = createPageAddedEvent(
          params.websiteId,
          pageResult.id,
          pageResult.title,
          pageResult.slug,
          pageResult.fullPath
        );

        return withEvents({
          success: true,
          page: {
            id: pageResult.id,
            title: pageResult.title,
            slug: pageResult.slug,
            url: pageResult.fullPath,
            websiteId: params.websiteId,
            wasExisting: pageResult.wasExisting
          },
          // Include siteStructure so AI can use siteStructure.id as parentId for child pages
          siteStructure: pageResult.siteStructureId ? {
            id: pageResult.siteStructureId,
            fullPath: pageResult.fullPath
          } : null,
          executionTime: `${Date.now() - startTime}ms`
        }, [event]);
      }

      // Use UnifiedPageService for atomic creation (original behavior when no sourceUrl)
      const response = await unifiedPageService.createPage(
        {
          websiteId: params.websiteId,
          contentTypeId: params.contentTypeId,
          title: params.title,
          content: processedContent,
          parentId: params.parentId || undefined,
          slug: params.slug || undefined,
          metadata: params.metadata,
          status: params.status
        },
        'ai' // Source is AI
      );

      // Handle slug conflicts with automatic retry
      if (!response.success && response.errors.length > 0) {
        const slugError = response.errors.find(e => e.code === ErrorCode.SLUG_CONFLICT);
        
        if (slugError && slugError.recovery?.alternativeValues?.length) {
          // Try with first alternative slug
          const alternativeSlug = slugError.recovery.alternativeValues[0];
          console.log(`Slug conflict detected. Retrying with alternative: ${alternativeSlug}`);

          const retryResponse = await unifiedPageService.createPage(
            {
              websiteId: params.websiteId,
              contentTypeId: params.contentTypeId,
              title: params.title,
              content: processedContent,
              parentId: params.parentId || undefined,
              slug: alternativeSlug,
              metadata: params.metadata,
              status: params.status
            },
            'ai'
          );

          if (retryResponse.success && retryResponse.data) {
            return formatPageResponse(retryResponse.data, startTime, true, alternativeSlug);
          }
        }

        // Return error response with recovery suggestions
        return {
          success: false,
          error: response.errors[0].message,
          errors: response.errors,
          warnings: response.warnings,
          executionTime: `${Date.now() - startTime}ms`,
          recovery: response.errors[0].recovery
        };
      }

      // Success response
      if (response.success && response.data) {
        return formatPageResponse(response.data, startTime);
      }

      // Unexpected response format
      return {
        success: false,
        error: 'Unexpected response format from UnifiedPageService',
        executionTime: `${Date.now() - startTime}ms`
      };
    } catch (error) {
      console.error('Error creating page:', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create page',
        executionTime: `${Date.now() - startTime}ms`
      };
    }
  }
});
