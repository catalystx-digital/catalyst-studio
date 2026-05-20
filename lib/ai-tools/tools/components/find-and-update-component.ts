/**
 * Find and Update Component Tool
 *
 * A unified tool that combines fuzzy page/component search with property updates.
 * Handles ambiguity by returning structured options for the AI to present to users.
 */

import { tool } from 'ai';
import { z } from 'zod';
import { ContentRepository } from '@/lib/services/unified-content-repository';
import {
  resolvePage,
  formatPageDescription,
  type PageMatch
} from '@/lib/ai-tools/services/page-resolver';
import {
  resolveComponent,
  formatComponentDescription,
  type ComponentMatch
} from '@/lib/ai-tools/services/component-resolver';
import {
  createComponentUpdatedEvent,
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
 * Schema for update options
 */
const optionsSchema = z.object({
  dryRun: z.boolean().optional().describe('If true, return what would be updated without applying changes'),
  allowMultiple: z.boolean().optional().describe('If true, update all matching components (default: false)')
}).optional();

/**
 * Main tool implementation
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const findAndUpdateComponent = (tool as any)({
  description: `PREFERRED TOOL for modifying existing page content. Use this tool whenever users ask to update, change, edit, or modify any component content (headings, text, buttons, images, colors, etc).

This tool:
1. Searches for the target page by title, slug, or path (human-readable, no IDs needed)
2. Finds the component by type, position, or content
3. Updates the specified properties and persists to database
4. Returns disambiguation options if multiple matches are found

WHEN TO USE:
- "Change the hero heading" → USE THIS TOOL
- "Update the button text" → USE THIS TOOL
- "Modify the footer content" → USE THIS TOOL
- "Edit the about section" → USE THIS TOOL

DO NOT use createPage for content modifications - use this tool instead.

Examples:
- "Change the hero heading on the homepage" → pageSearch: {title: "Home"}, componentSearch: {typePattern: "hero*"}, properties: {heading: "New Title"}
- "Update the CTA button text" → componentSearch: {typePattern: "cta*"}, properties: {buttonText: "Click Here"}
- "Change the 'Get Started' button" → componentSearch: {containsText: "Get Started"}, properties: {label: "New Label"}`,

  inputSchema: z.object({
    websiteId: z.string().describe('The website ID'),
    pageSearch: pageSearchSchema,
    componentSearch: componentSearchSchema,
    properties: z.record(z.any()).describe('Properties to update (e.g., { "heading": "New Title", "buttonText": "Click Here" })'),
    options: optionsSchema
  }),

  execute: async ({
    websiteId,
    pageSearch,
    componentSearch,
    properties,
    options
  }: {
    websiteId: string;
    pageSearch: z.infer<typeof pageSearchSchema>;
    componentSearch: z.infer<typeof componentSearchSchema>;
    properties: Record<string, unknown>;
    options?: z.infer<typeof optionsSchema>;
  }) => {
    const startTime = Date.now();

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
            suggestion: buildPageSuggestion(pageSearch)
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
              message: `Found ${pageResult.matches.length} pages matching your criteria. Please specify which one to update.`,
              options: pageResult.matches.slice(0, 5).map(m => ({
                id: m.pageId,
                displayName: m.title,
                description: formatPageDescription(m),
                confidence: Math.round(m.confidence * 100) / 100
              })),
              suggestedChoice: topMatch.pageId,
              hint: 'You can use the pageId in pageSearch to select a specific page'
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

      // Check for component ambiguity
      if (componentResult.matches.length > 1 && !componentResult.exactMatch && !options?.allowMultiple) {
        const topMatch = componentResult.matches[0];
        const secondMatch = componentResult.matches[1];
        const confidenceGap = topMatch.confidence - secondMatch.confidence;

        // If confidence gap is small, return disambiguation options
        if (confidenceGap < 0.25) {
          return {
            success: false,
            ambiguous: {
              type: 'component',
              message: `Found ${componentResult.matches.length} components matching your criteria on "${selectedPage.title}". Please specify which one to update.`,
              pageInfo: {
                pageId: selectedPage.pageId,
                pageTitle: selectedPage.title,
                pagePath: selectedPage.fullPath
              },
              options: componentResult.matches.slice(0, 5).map(m => ({
                id: m.instanceId,
                displayName: m.type,
                description: formatComponentDescription(m),
                confidence: Math.round(m.confidence * 100) / 100,
                position: m.index
              })),
              suggestedChoice: topMatch.instanceId,
              hint: 'You can use position: "first", position: 0, or instanceId to select a specific component'
            },
            executionTime: `${Date.now() - startTime}ms`
          };
        }
      }

      // Use the best matching component (or all if allowMultiple)
      const componentsToUpdate = options?.allowMultiple
        ? componentResult.matches
        : [componentResult.matches[0]];

      // Step 3: Dry run check
      if (options?.dryRun) {
        return {
          success: true,
          dryRun: true,
          wouldUpdate: componentsToUpdate.map(comp => ({
            pageId: selectedPage.pageId,
            pageTitle: selectedPage.title,
            pagePath: selectedPage.fullPath,
            componentId: comp.instanceId,
            componentType: comp.type,
            position: comp.index,
            propertiesToUpdate: Object.keys(properties),
            currentValues: extractCurrentValues(comp.props, Object.keys(properties))
          })),
          executionTime: `${Date.now() - startTime}ms`
        };
      }

      // Step 4: Execute the updates
      const updateResults: Array<{
        componentId: string;
        componentType: string;
        success: boolean;
        error?: string;
      }> = [];

      for (const comp of componentsToUpdate) {
        try {
          await ContentRepository.savePageOverrides(
            selectedPage.pageId,
            comp.instanceId,
            properties
          );

          updateResults.push({
            componentId: comp.instanceId,
            componentType: comp.type,
            success: true
          });
        } catch (err) {
          updateResults.push({
            componentId: comp.instanceId,
            componentType: comp.type,
            success: false,
            error: err instanceof Error ? err.message : 'Unknown error'
          });
        }
      }

      const allSucceeded = updateResults.every(r => r.success);
      const executionTime = Date.now() - startTime;

      if (executionTime > 2000) {
        console.warn(`findAndUpdateComponent execution exceeded 2s: ${executionTime}ms`);
      }

      // Create events for successful updates
      const events: AIToolEvent[] = updateResults
        .filter(r => r.success)
        .map(r => createComponentUpdatedEvent(
          websiteId,
          r.componentId,
          r.componentType,
          selectedPage.pageId,
          selectedPage.title,
          properties
        ));

      const result = {
        success: allSucceeded,
        updated: {
          pageId: selectedPage.pageId,
          pageTitle: selectedPage.title,
          pagePath: selectedPage.fullPath,
          components: updateResults.map(r => ({
            componentId: r.componentId,
            componentType: r.componentType,
            success: r.success,
            error: r.error
          })),
          updatedProperties: Object.keys(properties),
          totalUpdated: updateResults.filter(r => r.success).length
        },
        message: allSucceeded
          ? `Successfully updated ${updateResults.length} component(s) on "${selectedPage.title}"`
          : `Partial update: ${updateResults.filter(r => r.success).length}/${updateResults.length} succeeded`,
        executionTime: `${executionTime}ms`
      };

      // Attach events for client-side processing
      return withEvents(result, events);

    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error('Error in findAndUpdateComponent:', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to find and update component',
        executionTime: `${executionTime}ms`
      };
    }
  }
});

/**
 * Build suggestion message for page not found
 */
function buildPageSuggestion(search: z.infer<typeof pageSearchSchema>): string {
  const criteria: string[] = [];
  if (search.title) criteria.push(`title "${search.title}"`);
  if (search.slug) criteria.push(`slug "${search.slug}"`);
  if (search.fullPath) criteria.push(`path "${search.fullPath}"`);

  return `No page found with ${criteria.join(' or ')}. Try using listContentItems to see available pages.`;
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

  return [...new Set(types)];
}

/**
 * Extract current values for specified property keys
 */
function extractCurrentValues(
  props: Record<string, unknown>,
  keys: string[]
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of keys) {
    if (key in props) {
      result[key] = props[key];
    }
  }
  return result;
}
