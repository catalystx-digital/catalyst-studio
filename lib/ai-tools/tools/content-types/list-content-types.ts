import { tool } from 'ai';
import { z } from 'zod';
import { getContentTypes } from '@/lib/services/content-type-service';

const listContentTypesInputSchema = z.object({
  websiteId: z.string().optional().describe('Filter by website ID')
});

type ListContentTypesInput = z.infer<typeof listContentTypesInputSchema>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const listContentTypes = (tool as any)({
  description: 'List all content types with optional filtering by website',
  inputSchema: listContentTypesInputSchema,
  execute: async ({ websiteId }: ListContentTypesInput) => {
    const startTime = Date.now();
    
    try {
      const contentTypes = await getContentTypes(websiteId);
      
      const executionTime = Date.now() - startTime;
      if (executionTime > 2000) {
        console.warn(`list-content-types execution exceeded 2s: ${executionTime}ms`);
      }
      
      return {
        success: true,
        contentTypes: contentTypes.map(ct => ({
          id: ct.id,
          websiteId: ct.websiteId,
          name: ct.name,
          fields: ct.fields,
          settings: ct.settings,
          createdAt: ct.createdAt,
          updatedAt: ct.updatedAt
        })),
        count: contentTypes.length,
        executionTime: `${executionTime}ms`
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error('Error listing content types:', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list content types',
        executionTime: `${executionTime}ms`
      };
    }
  }
});
