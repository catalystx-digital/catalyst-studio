/**
 * Batch Update Components Tool
 *
 * Applies multiple component updates atomically across pages.
 * All updates succeed or all roll back (when atomic mode enabled).
 */

import { tool } from 'ai';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { ContentRepository } from '@/lib/services/unified-content-repository';
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
  createComponentUpdatedEvent,
  type AIToolEvent,
} from '@/lib/ai-tools/services/event-publisher';

/**
 * Schema for component query (reused from find-and-update-component)
 */
const componentQuerySchema = z.object({
  type: z.string().optional().describe('Exact component type (e.g., "hero-simple", "cta-simple")'),
  typePattern: z.string().optional().describe('Component type pattern with wildcards (e.g., "hero*")'),
  instanceId: z.string().optional().describe('Direct component instance ID if known'),
  position: z.union([
    z.literal('first'),
    z.literal('last'),
    z.number()
  ]).optional().describe('Position of component: "first", "last", or 0-based index'),
  containsText: z.string().optional().describe('Find component containing this text in any prop'),
  propMatch: z.record(z.any()).optional().describe('Match component by specific prop values')
}).describe('Criteria for finding the component within the page');

/**
 * Schema for update specification
 */
const updateSpecSchema = z.object({
  // Page identification
  pageId: z.string().optional().describe('Direct page ID if known'),
  slug: z.string().optional().describe('Page slug to search for'),
  title: z.string().optional().describe('Page title to search for'),
  fullPath: z.string().optional().describe('Full page path'),

  // Component identification
  componentQuery: componentQuerySchema,

  // Updates to apply
  updates: z.object({
    props: z.record(z.unknown()).optional().describe('Properties to update'),
    styles: z.record(z.unknown()).optional().describe('Styles to update'),
    content: z.record(z.unknown()).optional().describe('Content to update')
  }).describe('Updates to apply to the component')
}).describe('Specification for a single update operation');

/**
 * Main tool schema
 */
const batchUpdateSchema = z.object({
  websiteId: z.string().describe('The website ID'),
  updates: z.array(updateSpecSchema).describe('Array of update specifications to apply'),
  continueOnError: z.boolean().default(false).describe('Continue if one update fails (non-atomic mode)'),
  atomic: z.boolean().default(true).describe('All succeed or all rollback (transactional)')
});

/**
 * Result for a single update operation
 */
interface SingleUpdateResult {
  index: number;
  pageId: string;
  pageTitle: string;
  componentId: string;
  componentType: string;
  success: boolean;
  error?: string;
  skipped?: boolean;
  ambiguous?: {
    type: 'page' | 'component';
    message: string;
    options?: unknown[];
  };
}

/**
 * Overall batch result
 */
interface BatchUpdateResult {
  success: boolean;
  totalUpdates: number;
  successfulUpdates: number;
  failedUpdates: number;
  skippedUpdates: number;
  results: SingleUpdateResult[];
  message: string;
  executionTime: string;
}

/**
 * Main tool implementation
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const batchUpdateComponents = (tool as any)({
  description: `Batch update multiple components across pages atomically.

This tool:
1. Accepts an array of component updates to apply
2. Resolves pages and components for each update
3. Applies all updates in a transaction (when atomic=true)
4. Returns detailed results for each update

WHEN TO USE:
- "Update all hero headings" → USE THIS TOOL
- "Change button colors across pages" → USE THIS TOOL
- "Apply bulk content updates" → USE THIS TOOL

Examples:
- Update hero heading on homepage and about page
- Change CTA button text across multiple pages
- Bulk update component properties site-wide`,

  inputSchema: batchUpdateSchema,

  execute: async ({
    websiteId,
    updates,
    continueOnError,
    atomic
  }: z.infer<typeof batchUpdateSchema>): Promise<BatchUpdateResult> => {
    const startTime = Date.now();
    const results: SingleUpdateResult[] = [];

    try {
      // Step 1: Validate all updates have required fields
      for (let i = 0; i < updates.length; i++) {
        const update = updates[i];
        const hasPageIdentifier = update.pageId || update.slug || update.title || update.fullPath;
        const hasComponentQuery = Object.keys(update.componentQuery).length > 0;
        const hasUpdates = update.updates.props || update.updates.styles || update.updates.content;

        if (!hasPageIdentifier) {
          results.push({
            index: i,
            pageId: '',
            pageTitle: '',
            componentId: '',
            componentType: '',
            success: false,
            error: 'No page identifier provided (pageId, slug, title, or fullPath required)'
          });
        } else if (!hasComponentQuery) {
          results.push({
            index: i,
            pageId: update.pageId || '',
            pageTitle: '',
            componentId: '',
            componentType: '',
            success: false,
            error: 'No component query provided'
          });
        } else if (!hasUpdates) {
          results.push({
            index: i,
            pageId: update.pageId || '',
            pageTitle: '',
            componentId: '',
            componentType: '',
            success: false,
            error: 'No updates provided (props, styles, or content required)'
          });
        }
      }

      // If any validation failed and atomic mode, return early
      if (atomic && results.some(r => !r.success)) {
        return {
          success: false,
          totalUpdates: updates.length,
          successfulUpdates: 0,
          failedUpdates: results.length,
          skippedUpdates: 0,
          results,
          message: 'Validation failed. No updates applied (atomic mode).',
          executionTime: `${Date.now() - startTime}ms`
        };
      }

      // Step 2: Resolve all pages and components
      interface ResolvedUpdate {
        index: number;
        page: PageMatch;
        component: ComponentMatch;
        updates: z.infer<typeof updateSpecSchema>['updates'];
      }

      const resolvedUpdates: ResolvedUpdate[] = [];

      for (let i = 0; i < updates.length; i++) {
        // Skip if already failed validation
        if (results[i] && !results[i].success) {
          continue;
        }

        const update = updates[i];

        // Resolve page
        const pageSearch = {
          pageId: update.pageId,
          slug: update.slug,
          title: update.title,
          fullPath: update.fullPath
        };

        const pageResult = await resolvePage(websiteId, pageSearch);

        if (pageResult.matches.length === 0) {
          results.push({
            index: i,
            pageId: update.pageId || '',
            pageTitle: '',
            componentId: '',
            componentType: '',
            success: false,
            error: 'Page not found'
          });
          continue;
        }

        // Check for page ambiguity
        if (pageResult.matches.length > 1 && !pageResult.exactMatch) {
          const topMatch = pageResult.matches[0];
          const secondMatch = pageResult.matches[1];
          const confidenceGap = topMatch.confidence - secondMatch.confidence;

          if (confidenceGap < 0.3) {
            results.push({
              index: i,
              pageId: '',
              pageTitle: '',
              componentId: '',
              componentType: '',
              success: false,
              ambiguous: {
                type: 'page',
                message: `Found ${pageResult.matches.length} pages matching criteria`,
                options: pageResult.matches.slice(0, 5).map(m => ({
                  pageId: m.pageId,
                  title: m.title,
                  confidence: m.confidence
                }))
              }
            });
            continue;
          }
        }

        const selectedPage = pageResult.matches[0];

        // Resolve component
        const componentResult = resolveComponent(selectedPage.content, update.componentQuery);

        if (componentResult.matches.length === 0) {
          results.push({
            index: i,
            pageId: selectedPage.pageId,
            pageTitle: selectedPage.title,
            componentId: '',
            componentType: '',
            success: false,
            error: 'Component not found'
          });
          continue;
        }

        // Check for component ambiguity
        if (componentResult.matches.length > 1 && !componentResult.exactMatch) {
          const topMatch = componentResult.matches[0];
          const secondMatch = componentResult.matches[1];
          const confidenceGap = topMatch.confidence - secondMatch.confidence;

          if (confidenceGap < 0.25) {
            results.push({
              index: i,
              pageId: selectedPage.pageId,
              pageTitle: selectedPage.title,
              componentId: '',
              componentType: '',
              success: false,
              ambiguous: {
                type: 'component',
                message: `Found ${componentResult.matches.length} components matching criteria`,
                options: componentResult.matches.slice(0, 5).map(m => ({
                  instanceId: m.instanceId,
                  type: m.type,
                  confidence: m.confidence
                }))
              }
            });
            continue;
          }
        }

        const selectedComponent = componentResult.matches[0];

        // Store resolved update
        resolvedUpdates.push({
          index: i,
          page: selectedPage,
          component: selectedComponent,
          updates: update.updates
        });
      }

      // If any resolution failed and atomic mode, return early
      if (atomic && results.some(r => !r.success)) {
        return {
          success: false,
          totalUpdates: updates.length,
          successfulUpdates: 0,
          failedUpdates: results.filter(r => !r.success).length,
          skippedUpdates: 0,
          results,
          message: 'Resolution failed. No updates applied (atomic mode).',
          executionTime: `${Date.now() - startTime}ms`
        };
      }

      // Step 3: Apply updates (atomic or non-atomic)
      if (atomic) {
        // Atomic mode: Use transaction
        await prisma.$transaction(async (tx) => {
          for (const resolved of resolvedUpdates) {
            // Merge all update types into properties
            const mergedProperties = {
              ...resolved.updates.props,
              ...resolved.updates.styles,
              ...resolved.updates.content
            };

            // Apply update
            await ContentRepository.savePageOverrides(
              resolved.page.pageId,
              resolved.component.instanceId,
              mergedProperties
            );

            results.push({
              index: resolved.index,
              pageId: resolved.page.pageId,
              pageTitle: resolved.page.title,
              componentId: resolved.component.instanceId,
              componentType: resolved.component.type,
              success: true
            });
          }
        });
      } else {
        // Non-atomic mode: Apply individually
        for (const resolved of resolvedUpdates) {
          try {
            const mergedProperties = {
              ...resolved.updates.props,
              ...resolved.updates.styles,
              ...resolved.updates.content
            };

            await ContentRepository.savePageOverrides(
              resolved.page.pageId,
              resolved.component.instanceId,
              mergedProperties
            );

            results.push({
              index: resolved.index,
              pageId: resolved.page.pageId,
              pageTitle: resolved.page.title,
              componentId: resolved.component.instanceId,
              componentType: resolved.component.type,
              success: true
            });
          } catch (err) {
            results.push({
              index: resolved.index,
              pageId: resolved.page.pageId,
              pageTitle: resolved.page.title,
              componentId: resolved.component.instanceId,
              componentType: resolved.component.type,
              success: false,
              error: err instanceof Error ? err.message : 'Unknown error'
            });

            // If not continuing on error, stop here
            if (!continueOnError) {
              break;
            }
          }
        }
      }

      // Step 4: Calculate final results
      const successfulUpdates = results.filter(r => r.success).length;
      const failedUpdates = results.filter(r => !r.success && !r.skipped).length;
      const skippedUpdates = results.filter(r => r.skipped).length;
      const allSucceeded = successfulUpdates === updates.length;

      const executionTime = Date.now() - startTime;

      if (executionTime > 5000) {
        console.warn(`batchUpdateComponents execution exceeded 5s: ${executionTime}ms`);
      }

      // Create events for canvas sync (only for successful updates)
      const events: AIToolEvent[] = results
        .filter(r => r.success)
        .map(r => {
          // Find the corresponding resolved update to get properties
          const resolved = resolvedUpdates.find(ru => ru.index === r.index);
          const properties = resolved ? {
            ...resolved.updates.props,
            ...resolved.updates.styles,
            ...resolved.updates.content
          } : undefined;

          return createComponentUpdatedEvent(
            websiteId,
            r.componentId,
            r.componentType,
            r.pageId,
            r.pageTitle,
            properties
          );
        });

      const result = {
        success: allSucceeded,
        totalUpdates: updates.length,
        successfulUpdates,
        failedUpdates,
        skippedUpdates,
        results: results.sort((a, b) => a.index - b.index),
        message: allSucceeded
          ? `Successfully updated ${successfulUpdates} component(s)`
          : `Partial update: ${successfulUpdates}/${updates.length} succeeded, ${failedUpdates} failed`,
        executionTime: `${executionTime}ms`
      };

      // Return result with events for client-side canvas sync
      return withEvents(result, events);

    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error('Error in batchUpdateComponents:', error);

      return {
        success: false,
        totalUpdates: updates.length,
        successfulUpdates: 0,
        failedUpdates: updates.length,
        skippedUpdates: 0,
        results,
        message: error instanceof Error ? error.message : 'Failed to batch update components',
        executionTime: `${executionTime}ms`
      };
    }
  }
});
