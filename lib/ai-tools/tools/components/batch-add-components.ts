import { tool } from 'ai';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@/lib/generated/prisma';
import {
  withEvents,
  createComponentAddedEvent,
  type AIToolEvent,
} from '@/lib/ai-tools/services/event-publisher';
import { resolvePage } from '@/lib/ai-tools/services/page-resolver';

/**
 * Generate a unique component ID
 */
function generateComponentId(): string {
  return `comp_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
}

/**
 * Recursively generate IDs for component tree
 */
function ensureComponentIds(
  component: ComponentInput,
  idMap: Map<string, string> = new Map()
): ComponentWithId {
  // Generate or reuse ID
  const id = component.id || generateComponentId();
  if (component.id) {
    idMap.set(component.id, id);
  }

  // Process children recursively
  const children = component.children?.map(child => ensureComponentIds(child, idMap)) || [];

  return {
    id,
    type: component.type,
    position: component.position ?? 0,
    parentId: component.parentId,
    props: component.props || {},
    styles: component.styles,
    children
  };
}

/**
 * Flatten component tree into array (depth-first)
 */
function flattenComponentTree(
  component: ComponentWithId,
  parentId: string | null = null,
  result: FlatComponent[] = []
): FlatComponent[] {
  // Add current component
  result.push({
    id: component.id,
    type: component.type,
    position: component.position,
    parentId: parentId,
    props: component.props,
    styles: component.styles
  });

  // Add children recursively
  if (component.children && component.children.length > 0) {
    component.children.forEach(child => {
      flattenComponentTree(child, component.id, result);
    });
  }

  return result;
}

/**
 * Input component schema (recursive)
 */
type ComponentInput = {
  id?: string;
  type: string;
  position?: number;
  parentId?: string;
  props?: Record<string, unknown>;
  styles?: Record<string, unknown>;
  children?: ComponentInput[];
};

/**
 * Component with guaranteed ID
 */
type ComponentWithId = {
  id: string;
  type: string;
  position: number;
  parentId?: string;
  props: Record<string, unknown>;
  styles?: Record<string, unknown>;
  children?: ComponentWithId[];
};

/**
 * Flattened component for storage
 */
type FlatComponent = {
  id: string;
  type: string;
  position: number;
  parentId: string | null;
  props: Record<string, unknown>;
  styles?: Record<string, unknown>;
};

/**
 * Recursive component schema for Zod
 */
const componentInputSchema: z.ZodType<ComponentInput> = z.lazy(() =>
  z.object({
    id: z.string().optional().describe('Optional component ID (auto-generated if not provided)'),
    type: z.string().describe('Component type from library'),
    position: z.number().optional().describe('Order position (optional, defaults to 0)'),
    parentId: z.string().optional().describe('Parent component ID for nesting'),
    props: z.record(z.unknown()).optional().describe('Component properties'),
    styles: z.record(z.unknown()).optional().describe('Component styles'),
    children: z.array(componentInputSchema).optional().describe('Nested children components')
  })
);

/**
 * Batch Add Components Tool
 *
 * Adds multiple components to a page in a single operation.
 * Supports nested component hierarchies via children array.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const batchAddComponents = (tool as any)({
  description: `Add multiple components to a page in a single operation. Supports nested component hierarchies.

Use this tool when:
- Adding multiple components at once
- Creating a component hierarchy (parent-child relationships)
- Building a complex layout from scratch
- Importing a component structure

For single component additions, consider using the regular component creation flow.`,

  inputSchema: z.object({
    websiteId: z.string().describe('The website ID'),
    pageId: z.string().optional().describe('The ID of the page to add components to'),
    slug: z.string().optional().describe('The slug of the page (alternative to pageId)'),
    title: z.string().optional().describe('The title of the page (alternative to pageId)'),
    fullPath: z.string().optional().describe('The full path of the page (alternative to pageId)'),

    components: z.array(componentInputSchema).describe('Array of components to add (supports nesting via children)'),

    insertAt: z.enum(['start', 'end', 'position']).default('end').describe('Where to insert components'),
    insertPosition: z.number().optional().describe('Specific position index when insertAt is "position"'),
    insertAfter: z.string().optional().describe('Insert after this component ID')
  }),

  execute: async (params: {
    websiteId: string;
    pageId?: string;
    slug?: string;
    title?: string;
    fullPath?: string;
    components: ComponentInput[];
    insertAt: 'start' | 'end' | 'position';
    insertPosition?: number;
    insertAfter?: string;
  }) => {
    const startTime = Date.now();

    try {
      // Validate that at least one page identifier is provided
      if (!params.pageId && !params.slug && !params.title && !params.fullPath) {
        return {
          success: false,
          error: 'At least one of pageId, slug, title, or fullPath must be provided',
          executionTime: `${Date.now() - startTime}ms`
        };
      }

      // Use resolvePage service to find the page (handles slug through WebsiteStructure)
      const pageResult = await resolvePage(params.websiteId, {
        pageId: params.pageId,
        slug: params.slug,
        title: params.title,
        fullPath: params.fullPath
      });

      if (pageResult.matches.length === 0) {
        return {
          success: false,
          error: 'Page not found',
          executionTime: `${Date.now() - startTime}ms`
        };
      }

      const selectedPage = pageResult.matches[0];

      // Fetch the full page data
      const page = await prisma.websitePage.findUnique({
        where: { id: selectedPage.pageId }
      });

      if (!page) {
        return {
          success: false,
          error: 'Page not found',
          executionTime: `${Date.now() - startTime}ms`
        };
      }

      // Get current page content
      const content = (page.content || {}) as { components?: Array<Record<string, unknown>> };
      const existingComponents = Array.isArray(content.components) ? content.components : [];

      // Process input components (generate IDs, handle nesting)
      const processedComponents: ComponentWithId[] = params.components.map(comp =>
        ensureComponentIds(comp)
      );

      // Flatten component trees
      const flatComponents: FlatComponent[] = [];
      processedComponents.forEach(comp => {
        flattenComponentTree(comp, null, flatComponents);
      });

      // Calculate insertion point
      let insertIndex: number;

      if (params.insertAfter) {
        const afterIndex = existingComponents.findIndex(
          c => (c.id as string) === params.insertAfter
        );
        if (afterIndex === -1) {
          return {
            success: false,
            error: `Component with ID "${params.insertAfter}" not found`,
            executionTime: `${Date.now() - startTime}ms`
          };
        }
        insertIndex = afterIndex + 1;
      } else if (params.insertAt === 'start') {
        insertIndex = 0;
      } else if (params.insertAt === 'position' && params.insertPosition !== undefined) {
        insertIndex = Math.max(0, Math.min(params.insertPosition, existingComponents.length));
      } else {
        // Default: end
        insertIndex = existingComponents.length;
      }

      // Insert components at calculated position
      const newComponents = [
        ...existingComponents.slice(0, insertIndex),
        ...flatComponents.map((comp, idx) => ({
          id: comp.id,
          type: comp.type,
          position: insertIndex + idx,
          parentId: comp.parentId,
          props: comp.props,
          ...(comp.styles ? { styles: comp.styles } : {})
        })),
        ...existingComponents.slice(insertIndex)
      ];

      // Update positions for all components after insertion point
      const finalComponents = newComponents.map((comp, idx) => ({
        ...comp,
        position: idx
      }));

      // Save updated content
      await prisma.websitePage.update({
        where: { id: page.id },
        data: {
          content: {
            ...content,
            components: finalComponents
          } as unknown as Prisma.InputJsonValue
        }
      });

      const executionTime = Date.now() - startTime;

      // Create events for canvas sync
      const events: AIToolEvent[] = flatComponents.map((comp) =>
        createComponentAddedEvent(
          page.websiteId,
          comp.id,
          comp.type,
          page.id,
          page.title || undefined
        )
      );

      const result = {
        success: true,
        pageId: page.id,
        addedComponents: flatComponents.map((comp, idx) => ({
          id: comp.id,
          type: comp.type,
          position: insertIndex + idx,
          parentId: comp.parentId || undefined
        })),
        addedCount: flatComponents.length,
        totalComponents: finalComponents.length,
        message: `Successfully added ${flatComponents.length} component(s) to page`,
        executionTime: `${executionTime}ms`
      };

      // Return result with events for client-side canvas sync
      return withEvents(result, events);
    } catch (error) {
      console.error('Error in batch add components:', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add components',
        executionTime: `${Date.now() - startTime}ms`
      };
    }
  }
});
