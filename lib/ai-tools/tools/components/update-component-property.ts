import { tool } from 'ai';
import { z } from 'zod';
import { ContentRepository } from '@/lib/services/unified-content-repository';

/**
 * Update a specific component's properties on a page
 * Uses the component overrides mechanism to persist changes
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const updateComponentProperty = (tool as any)({
  description: 'PREFERRED: Update properties of a specific component instance on a page (for visual/content changes to components like heading, text, colors, images, buttons, etc.). Always use this when modifying component properties. For page title/status changes, use updateContentItem instead.',
  inputSchema: z.object({
    pageId: z.string().describe('The ID of the page containing the component'),
    componentInstanceId: z.string().describe('The instance ID of the component to update'),
    properties: z.record(z.any()).describe('The properties to update (e.g., { text: "New text", color: "blue" })')
  }),
  execute: async ({ pageId, componentInstanceId, properties }) => {
    const startTime = Date.now();

    try {
      // Use ContentRepository directly to save component overrides
      await ContentRepository.savePageOverrides(pageId, componentInstanceId, properties);

      const executionTime = Date.now() - startTime;

      if (executionTime > 2000) {
        console.warn(`update-component-property execution exceeded 2s: ${executionTime}ms`);
      }

      return {
        success: true,
        message: `Component ${componentInstanceId} updated successfully`,
        pageId,
        componentInstanceId,
        updatedProperties: Object.keys(properties),
        executionTime: `${executionTime}ms`
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error('Error updating component property:', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update component property',
        executionTime: `${executionTime}ms`
      };
    }
  }
});
