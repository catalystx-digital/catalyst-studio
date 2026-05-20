/**
 * Delete Component Tool
 *
 * Deletes components from pages by ID or query.
 * Handles recursive deletion of child components.
 */

import { tool } from 'ai';
import { z } from 'zod';
import { getClient } from '@/lib/db/client';
import {
  resolvePage,
  type PageMatch
} from '@/lib/ai-tools/services/page-resolver';
import {
  resolveComponent,
  type ComponentMatch
} from '@/lib/ai-tools/services/component-resolver';
import {
  createComponentDeletedEvent,
  withEvents,
  type AIToolEvent
} from '@/lib/ai-tools/services/event-publisher';

/**
 * Schema for page search criteria
 */
const pageSearchSchema = z.object({
  title: z.string().optional().describe('Page title to search for (e.g., "Home", "About Us")'),
  slug: z.string().optional().describe('Page slug to search for (e.g., "home", "about-us")'),
  fullPath: z.string().optional().describe('Full page path (e.g., "/", "/about", "/en/contact")'),
  pageId: z.string().optional().describe('Direct page ID if known (bypasses search)')
}).describe('Criteria for finding the page. At least one field should be provided.');

/**
 * Schema for component search criteria
 */
const componentSearchSchema = z.object({
  type: z.string().optional().describe('Exact component type (e.g., "hero-simple", "cta-simple")'),
  typePattern: z.string().optional().describe('Component type pattern with wildcards (e.g., "hero*" matches hero-simple, hero-centered)'),
  position: z.union([
    z.literal('first'),
    z.literal('last'),
    z.number()
  ]).optional().describe('Position of component: "first", "last", or 0-based index'),
  instanceId: z.string().optional().describe('Direct component instance ID if known'),
  containsText: z.string().optional().describe('Find component containing this text in any prop'),
  propMatch: z.record(z.any()).optional().describe('Match component by specific prop values (e.g., { "heading": "Welcome" })')
}).describe('Criteria for finding the component within the page. At least one field should be provided.');

/**
 * Schema for delete options
 */
const optionsSchema = z.object({
  recursive: z.boolean().default(true).describe('Delete child components too (default: true)'),
  requireConfirmation: z.boolean().default(false).describe('Ask for confirmation before delete (default: false)')
}).optional();

/**
 * Interface for component instance from page content
 */
interface ComponentInstance {
  id: string;
  type: string;
  parentId?: string | null;
  props?: Record<string, unknown>;
}

/**
 * Main tool implementation
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const deleteComponent = (tool as any)({
  description: `Delete components from pages. Use this tool when users ask to remove, delete, or clear components.

This tool:
1. Searches for the target page by title, slug, or path
2. Finds the component by type, position, or content
3. Optionally deletes child components (recursive mode)
4. Removes components from page content and persists to database

WHEN TO USE:
- "Delete the hero section" → USE THIS TOOL
- "Remove the footer" → USE THIS TOOL
- "Clear all CTAs" → USE THIS TOOL
- "Get rid of the about section" → USE THIS TOOL

Examples:
- "Delete the hero on the homepage" → pageSearch: {title: "Home"}, componentSearch: {typePattern: "hero*"}
- "Remove the first CTA" → componentSearch: {typePattern: "cta*", position: "first"}
- "Delete component with id xyz" → componentSearch: {instanceId: "xyz"}`,

  inputSchema: z.object({
    websiteId: z.string().describe('The website ID'),
    pageSearch: pageSearchSchema,
    componentSearch: componentSearchSchema,
    options: optionsSchema
  }),

  execute: async ({
    websiteId,
    pageSearch,
    componentSearch,
    options
  }: {
    websiteId: string;
    pageSearch: z.infer<typeof pageSearchSchema>;
    componentSearch: z.infer<typeof componentSearchSchema>;
    options?: z.infer<typeof optionsSchema>;
  }) => {
    const startTime = Date.now();
    const recursive = options?.recursive ?? true;

    try {
      // Step 1: Resolve the page
      const pageResult = await resolvePage(websiteId, pageSearch);

      if (pageResult.matches.length === 0) {
        return {
          success: false,
          notFound: {
            type: 'page',
            searchCriteria: pageSearch,
            message: 'No pages found matching your criteria',
            suggestion: 'Try using listContentItems to see available pages.'
          },
          executionTime: `${Date.now() - startTime}ms`
        };
      }

      // Check for page ambiguity
      if (pageResult.matches.length > 1 && !pageResult.exactMatch) {
        const topMatch = pageResult.matches[0];
        const secondMatch = pageResult.matches[1];
        const confidenceGap = topMatch.confidence - secondMatch.confidence;

        // If confidence gap is small, return disambiguation options
        if (confidenceGap < 0.3) {
          return {
            success: false,
            ambiguous: {
              type: 'page',
              message: `Found ${pageResult.matches.length} pages matching your criteria. Please specify which one.`,
              options: pageResult.matches.slice(0, 5).map(m => ({
                id: m.pageId,
                displayName: m.title,
                confidence: Math.round(m.confidence * 100) / 100
              })),
              hint: 'Use pageId in pageSearch to select a specific page'
            },
            executionTime: `${Date.now() - startTime}ms`
          };
        }
      }

      // Use the best matching page
      const selectedPage = pageResult.matches[0];

      // Step 2: Resolve the component within the page
      const componentResult = resolveComponent(selectedPage.content, componentSearch);

      if (componentResult.matches.length === 0) {
        return {
          success: false,
          notFound: {
            type: 'component',
            searchCriteria: componentSearch,
            pageInfo: {
              pageId: selectedPage.pageId,
              pageTitle: selectedPage.title,
              pagePath: selectedPage.fullPath
            },
            message: `No components found matching your criteria on page "${selectedPage.title}"`,
            suggestion: buildComponentSuggestion(componentSearch, selectedPage.content)
          },
          executionTime: `${Date.now() - startTime}ms`
        };
      }

      // Check for component ambiguity (only when instanceId not specified)
      if (componentResult.matches.length > 1 && !componentResult.exactMatch && !componentSearch.instanceId) {
        const topMatch = componentResult.matches[0];
        const secondMatch = componentResult.matches[1];
        const confidenceGap = topMatch.confidence - secondMatch.confidence;

        // If confidence gap is small, return disambiguation options
        if (confidenceGap < 0.25) {
          return {
            success: false,
            ambiguous: {
              type: 'component',
              message: `Found ${componentResult.matches.length} components matching your criteria on "${selectedPage.title}". Please specify which one to delete.`,
              pageInfo: {
                pageId: selectedPage.pageId,
                pageTitle: selectedPage.title,
                pagePath: selectedPage.fullPath
              },
              options: componentResult.matches.slice(0, 5).map(m => ({
                id: m.instanceId,
                displayName: m.type,
                position: m.index,
                confidence: Math.round(m.confidence * 100) / 100
              })),
              hint: 'Use position: "first", position: 0, or instanceId to select a specific component'
            },
            executionTime: `${Date.now() - startTime}ms`
          };
        }
      }

      // Use the best matching component
      const targetComponent = componentResult.matches[0];

      // Step 3: Determine components to delete
      const componentsToDelete: string[] = [targetComponent.instanceId];

      if (recursive) {
        // Find all child components recursively
        const children = findChildComponents(
          extractComponents(selectedPage.content),
          targetComponent.instanceId
        );
        componentsToDelete.push(...children.map(c => c.id));
      }

      // Step 4: Execute deletion
      const deletedComponents = await deleteComponentsFromPage(
        selectedPage.pageId,
        componentsToDelete
      );

      const executionTime = Date.now() - startTime;

      // Create component deleted events
      const events: AIToolEvent[] = deletedComponents.map(componentId =>
        createComponentDeletedEvent(
          websiteId,
          componentId,
          targetComponent.type, // Use the target type (children inherit for simplicity)
          selectedPage.pageId,
          selectedPage.title
        )
      );

      const result = {
        success: true,
        deleted: {
          pageId: selectedPage.pageId,
          pageTitle: selectedPage.title,
          pagePath: selectedPage.fullPath,
          deletedComponentIds: deletedComponents,
          deletedCount: deletedComponents.length,
          recursive
        },
        message: recursive
          ? `Successfully deleted ${deletedComponents.length} component(s) (including ${deletedComponents.length - 1} children) from "${selectedPage.title}"`
          : `Successfully deleted component from "${selectedPage.title}"`,
        executionTime: `${executionTime}ms`
      };

      return withEvents(result, events);

    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error('Error in deleteComponent:', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete component',
        executionTime: `${executionTime}ms`
      };
    }
  }
});

/**
 * Extract components array from page content
 */
function extractComponents(content: Record<string, unknown> | null): ComponentInstance[] {
  if (!content) return [];

  // Try direct components array
  if (Array.isArray(content.components)) {
    return content.components as ComponentInstance[];
  }

  // Try content.components (nested structure)
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
 * Find all child components recursively (bottom-up for safe deletion)
 */
function findChildComponents(
  components: ComponentInstance[],
  parentId: string
): ComponentInstance[] {
  const children: ComponentInstance[] = [];

  // Find direct children
  const directChildren = components.filter(c => c.parentId === parentId);

  // Recursively find children of children (depth-first)
  for (const child of directChildren) {
    const grandChildren = findChildComponents(components, child.id);
    children.push(...grandChildren);
    children.push(child);
  }

  return children;
}

/**
 * Delete components from page content
 */
async function deleteComponentsFromPage(
  pageId: string,
  componentIds: string[]
): Promise<string[]> {
  const prisma = getClient();

  // Fetch current page
  const page = await prisma.websitePage.findUnique({
    where: { id: pageId }
  });

  if (!page) {
    throw new Error('Page not found');
  }

  const content = (page.content || {}) as Record<string, unknown>;
  const components = extractComponents(content);

  // Filter out components to delete
  const remainingComponents = components.filter(c => !componentIds.includes(c.id));
  const deletedIds = components
    .filter(c => componentIds.includes(c.id))
    .map(c => c.id);

  // Update page content
  const updatedContent = {
    ...content,
    components: remainingComponents
  };

  await prisma.websitePage.update({
    where: { id: pageId },
    data: {
      content: updatedContent as any
    }
  });

  return deletedIds;
}

/**
 * Build suggestion message for component not found
 */
function buildComponentSuggestion(
  search: z.infer<typeof componentSearchSchema>,
  pageContent: Record<string, unknown> | null
): string {
  const criteria: string[] = [];
  if (search.type) criteria.push(`type "${search.type}"`);
  if (search.typePattern) criteria.push(`pattern "${search.typePattern}"`);
  if (search.containsText) criteria.push(`containing "${search.containsText}"`);

  // Try to list available component types on the page
  let availableTypes = '';
  if (pageContent) {
    const components = extractComponentTypes(pageContent);
    if (components.length > 0) {
      availableTypes = ` Available components: ${components.join(', ')}`;
    }
  }

  return `No component found with ${criteria.join(' or ')}.${availableTypes}`;
}

/**
 * Extract component types from page content
 */
function extractComponentTypes(content: Record<string, unknown>): string[] {
  const types: string[] = [];

  const extractFromArray = (arr: unknown[]) => {
    for (const item of arr) {
      if (item && typeof item === 'object' && 'type' in item) {
        types.push(String((item as { type: string }).type));
      }
    }
  };

  if (Array.isArray(content.components)) {
    extractFromArray(content.components);
  }
  if (content.content && typeof content.content === 'object') {
    const inner = content.content as Record<string, unknown>;
    if (Array.isArray(inner.components)) {
      extractFromArray(inner.components);
    }
  }

  return Array.from(new Set(types));
}
