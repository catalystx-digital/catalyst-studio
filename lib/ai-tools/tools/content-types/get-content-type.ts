import { tool } from 'ai';
import { z } from 'zod';
import { getContentType as getContentTypeService } from '@/lib/services/content-type-service';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getContentType = (tool as any)({
  description: 'Get detailed information about a specific content type',
  inputSchema: z.object({
    id: z.string().describe('The content type ID')
  }),
  execute: async ({ id }) => {
    const startTime = Date.now();
    
    try {
      const contentType = await getContentTypeService(id);
      
      const executionTime = Date.now() - startTime;
      if (executionTime > 2000) {
        console.warn(`get-content-type execution exceeded 2s: ${executionTime}ms`);
      }
      
      if (!contentType) {
        return {
          success: false,
          error: `Content type with ID '${id}' not found`,
          executionTime: `${executionTime}ms`
        };
      }
      
      return {
        success: true,
        contentType: {
          id: contentType.id,
          websiteId: contentType.websiteId,
          name: contentType.name,
          fields: contentType.fields,
          settings: contentType.settings,
          createdAt: contentType.createdAt,
          updatedAt: contentType.updatedAt
        },
        executionTime: `${executionTime}ms`
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error('Error getting content type:', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get content type',
        executionTime: `${executionTime}ms`
      };
    }
  }
});