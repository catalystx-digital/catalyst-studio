/**
 * Batch Delete Components Tool
 *
 * Deletes multiple components in a single atomic operation.
 * Handles child component deletion and position recalculation.
 */

import { tool } from 'ai';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@/lib/generated/prisma';
import {
  resolvePage,
  type PageMatch
} from '@/lib/ai-tools/services/page-resolver';
import {
  resolveComponent,
  type ComponentMatch
} from '@/lib/ai-tools/services/component-resolver';
import {
  withEvents,
  createComponentDeletedEvent,
  type AIToolEvent,
} from '@/lib/ai-tools/services/event-publisher';

/**
 * Schema for page identification
 */
const pageSearchSchema = z.object({
  pageId: z.string().optional().describe('Direct page ID if known'),
  slug: z.string().optional().describe('Page slug (e.g., "home")'),
  title: z.string().optional().describe('Page title (e.g., "Home")'),
  fullPath: z.string().optional().describe('Full page path (e.g., "/", "/about")')
}).describe('Criteria for finding the page. At least one field should be provided.');

/**
 * Schema for component query
 */
const componentQuerySchema = z.object({
  type: z.string().optional().describe('Exact component type'),
  typePattern: z.string().optional().describe('Component type pattern with wildcards (e.g., "hero*")'),
  position: z.union([
    z.literal('first'),
    z.literal('last'),
    z.number()
  ]).optional().describe('Position: "first", "last", or 0-based index'),
  containsText: z.string().optional().describe('Text contained in component props'),
  propMatch: z.record(z.unknown()).optional().describe('Match by specific prop values')
}).describe('Query to find components');

/**
 * Schema for batch delete options
 */
const optionsSchema = z.object({
  recursive: z.boolean().default(true).describe('Delete child components too'),
  atomic: z.boolean().default(true).describe('All-or-nothing operation')
}).optional();

/**
 * Result interface
 */
interface BatchDeleteResult {
  success: boolean;
  pageId: string;
  deletedComponentIds: string[];
  deletedCount: number;
  childrenDeletedCount: number;
  message: string;
  error?: string;
}

/**
 * Component instance interface
 */
interface ComponentInstance {
  id: string;
  type: string;
  parentId?: string | null;
  position?: number;
  props?: Record<string, unknown>;
}

/**
 * Main tool implementation
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const batchDeleteComponents = (tool as any)({
  description: `Delete multiple components from a page in a single atomic operation.

Use this tool when users want to:
- Delete multiple components at once
- Remove all components of a certain type
- Clean up components matching specific criteria

The tool:
1. Finds the target page
2. Identifies components to delete (by IDs or queries)
3. Optionally finds and deletes child components
4. Updates positions of remaining components
5. Saves changes atomically

Examples:
- "Delete all hero components" → componentQueries: [{typePattern: "hero*"}]
- "Remove the first two sections" → componentIds: ["id1", "id2"]
- "Delete all CTAs containing 'Subscribe'" → componentQueries: [{typePattern: "cta*", containsText: "Subscribe"}]`,

  inputSchema: z.object({
    websiteId: z.string().describe('The website ID'),
    pageSearch: pageSearchSchema,
    componentIds: z.array(z.string()).optional().describe('Array of component IDs to delete'),
    componentQueries: z.array(componentQuerySchema).optional().describe('Array of queries to find components'),
    options: optionsSchema
  }),

  execute: async ({
    websiteId,
    pageSearch,
    componentIds,
    componentQueries,
    options
  }: {
    websiteId: string;
    pageSearch: z.infer<typeof pageSearchSchema>;
    componentIds?: string[];
    componentQueries?: z.infer<typeof componentQuerySchema>[];
    options?: z.infer<typeof optionsSchema>;
  }): Promise<BatchDeleteResult> => {
    const startTime = Date.now();
    const recursive = options?.recursive ?? true;
    const atomic = options?.atomic ?? true;

    try {
      // Validation: Must provide either componentIds or componentQueries
      if (!componentIds && !componentQueries) {
        return {
          success: false,
          pageId: '',
          deletedComponentIds: [],
          deletedCount: 0,
          childrenDeletedCount: 0,
          message: 'Must provide either componentIds or componentQueries',
          error: 'Missing deletion criteria'
        };
      }

      // Step 1: Resolve the page
      const pageResult = await resolvePage(websiteId, pageSearch);

      if (pageResult.matches.length === 0) {
        return {
          success: false,
          pageId: '',
          deletedComponentIds: [],
          deletedCount: 0,
          childrenDeletedCount: 0,
          message: 'Page not found',
          error: `No pages found matching criteria: ${JSON.stringify(pageSearch)}`
        };
      }

      const selectedPage = pageResult.matches[0];

      // Step 2: Extract components from page content
      const pageContent = selectedPage.content as Record<string, unknown> | null;
      if (!pageContent) {
        return {
          success: false,
          pageId: selectedPage.pageId,
          deletedComponentIds: [],
          deletedCount: 0,
          childrenDeletedCount: 0,
          message: 'Page has no content',
          error: 'Page content is null or empty'
        };
      }

      const components = extractComponents(pageContent);
      if (components.length === 0) {
        return {
          success: false,
          pageId: selectedPage.pageId,
          deletedComponentIds: [],
          deletedCount: 0,
          childrenDeletedCount: 0,
          message: 'Page has no components',
          error: 'No components found in page content'
        };
      }

      // Step 3: Collect component IDs to delete
      const idsToDelete = new Set<string>();

      // Add directly specified IDs
      if (componentIds && componentIds.length > 0) {
        componentIds.forEach(id => idsToDelete.add(id));
      }

      // Add IDs from queries
      if (componentQueries && componentQueries.length > 0) {
        for (const query of componentQueries) {
          const componentResult = resolveComponent(pageContent, query);
          componentResult.matches.forEach(match => idsToDelete.add(match.instanceId));
        }
      }

      if (idsToDelete.size === 0) {
        return {
          success: false,
          pageId: selectedPage.pageId,
          deletedComponentIds: [],
          deletedCount: 0,
          childrenDeletedCount: 0,
          message: 'No components matched the deletion criteria',
          error: 'No components found to delete'
        };
      }

      // Step 4: Find children if recursive
      let childrenCount = 0;
      if (recursive) {
        const allIdsIncludingChildren = new Set(idsToDelete);
        for (const parentId of idsToDelete) {
          const children = findAllChildren(components, parentId);
          children.forEach(childId => {
            if (!allIdsIncludingChildren.has(childId)) {
              childrenCount++;
            }
            allIdsIncludingChildren.add(childId);
          });
        }
        // Update idsToDelete to include children
        idsToDelete.clear();
        allIdsIncludingChildren.forEach(id => idsToDelete.add(id));
      }

      // Step 5: Validate all components exist
      const missingIds = Array.from(idsToDelete).filter(
        id => !components.some(c => c.id === id)
      );
      if (missingIds.length > 0 && atomic) {
        return {
          success: false,
          pageId: selectedPage.pageId,
          deletedComponentIds: [],
          deletedCount: 0,
          childrenDeletedCount: 0,
          message: 'Some components not found',
          error: `Components not found: ${missingIds.join(', ')}`
        };
      }

      // Step 6: Remove components and update positions
      const remainingComponents = components
        .filter(c => !idsToDelete.has(c.id))
        .map((comp, index) => ({
          ...comp,
          position: index
        }));

      // Step 7: Update page content
      const updatedContent = {
        ...pageContent,
        components: remainingComponents
      };

      await prisma.websitePage.update({
        where: { id: selectedPage.pageId },
        data: {
          content: updatedContent as unknown as Prisma.InputJsonValue
        }
      });

      const deletedIds = Array.from(idsToDelete);
      const executionTime = Date.now() - startTime;

      // Create events for canvas sync
      // We need to get component types from the original components list
      const events: AIToolEvent[] = deletedIds.map(id => {
        const component = components.find(c => c.id === id);
        return createComponentDeletedEvent(
          websiteId,
          id,
          component?.type || 'unknown',
          selectedPage.pageId,
          selectedPage.title
        );
      });

      const result = {
        success: true,
        pageId: selectedPage.pageId,
        deletedComponentIds: deletedIds,
        deletedCount: deletedIds.length,
        childrenDeletedCount: childrenCount,
        message: `Successfully deleted ${deletedIds.length} component(s)${childrenCount > 0 ? ` (including ${childrenCount} children)` : ''} from "${selectedPage.title}" in ${executionTime}ms`
      };

      // Return result with events for client-side canvas sync
      return withEvents(result, events);

    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error('Error in batchDeleteComponents:', error);

      return {
        success: false,
        pageId: '',
        deletedComponentIds: [],
        deletedCount: 0,
        childrenDeletedCount: 0,
        message: 'Failed to delete components',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
});

/**
 * Extract components array from page content
 */
function extractComponents(content: Record<string, unknown>): ComponentInstance[] {
  // Try direct components array
  if (Array.isArray(content.components)) {
    return content.components as ComponentInstance[];
  }

  // Try nested content.components
  if (content.content && typeof content.content === 'object') {
    const innerContent = content.content as Record<string, unknown>;
    if (Array.isArray(innerContent.components)) {
      return innerContent.components as ComponentInstance[];
    }
  }

  // Try blocks array (alternative structure)
  if (Array.isArray(content.blocks)) {
    return content.blocks as ComponentInstance[];
  }

  return [];
}

/**
 * Recursively find all children of a component
 */
function findAllChildren(components: ComponentInstance[], parentId: string): string[] {
  const children: string[] = [];

  for (const comp of components) {
    if (comp.parentId === parentId) {
      children.push(comp.id);
      // Recursively find children of this child
      const grandChildren = findAllChildren(components, comp.id);
      children.push(...grandChildren);
    }
  }

  return children;
}
