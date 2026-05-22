import { tool } from 'ai';
import { z } from 'zod';
import { createContentType as createContentTypeService } from '@/lib/services/content-type-service';
import { businessRules } from '@/lib/ai-tools/business-rules';
import { 
  confidenceScorer,
  type ContentTypeDefinition 
} from '@/lib/services/universal-types/validation';
import type { CreateContentTypeRequest } from '@/lib/api/validation/content-type';

type FieldType = 'text' | 'textarea' | 'richtext' | 'number' | 'boolean' | 'date' | 'image' | 'richText' | 'reference' | 'select' | 'gallery' | 'tags' | 'json' | 'url';

const fieldSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  label: z.string(),
  type: z.enum(['text', 'textarea', 'richtext', 'number', 'boolean', 'date', 'image', 'richText', 'reference', 'select', 'gallery', 'tags', 'json', 'url']),
  required: z.boolean().optional().default(false),
  placeholder: z.string().optional(),
  defaultValue: z.any().optional(),
  validation: z.record(z.any()).optional(),
  helpText: z.string().optional(),
  options: z.array(z.object({
    label: z.string(),
    value: z.union([z.string(), z.number(), z.boolean()]),
    description: z.string().optional()
  })).optional(),
  order: z.number().optional()
});

const createContentTypeInputSchema = z.object({
  websiteId: z.string().describe('The website ID'),
  name: z.string().describe('The content type name'),
  category: z.enum(['page', 'component', 'folder']).describe('Content type category - page for routable content, component for reusable blocks, folder for organizational structure'),
  fields: z.array(fieldSchema).optional()
    .describe('Custom fields (category-specific fields will be added automatically)'),
  settings: z.record(z.any()).optional()
    .describe('Additional settings for the content type')
});

type ContentTypeFieldInput = z.infer<typeof fieldSchema>;
type CreateContentTypeInput = z.infer<typeof createContentTypeInputSchema>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const createContentType = (tool as any)({
  description: 'Create a new content type with automatic field inference based on category',
  inputSchema: createContentTypeInputSchema,
  execute: async ({ websiteId, name, category, fields = [], settings = {} }: CreateContentTypeInput) => {
    const startTime = Date.now();
    
    try {
      let inferredFields: ContentTypeFieldInput[] = [...fields];
      
      // Apply category-specific default fields
      if (category === 'page' && inferredFields.length === 0) {
        // Add default page fields if no fields provided
        const pageFields: ContentTypeFieldInput[] = [
          { name: 'title', type: 'text' as FieldType, required: true, label: 'Title', order: 1 },
          { name: 'slug', type: 'text' as FieldType, required: true, label: 'URL Slug', order: 2 },
          { name: 'content', type: 'richtext' as FieldType, required: true, label: 'Content', order: 3 }
        ];
        
        inferredFields = pageFields;
      } else if (category === 'component' && inferredFields.length === 0) {
        // Add default component fields if no fields provided
        const componentFields: ContentTypeFieldInput[] = [
          { name: 'title', type: 'text' as FieldType, required: true, label: 'Title', order: 1 },
          { name: 'content', type: 'richtext' as FieldType, required: false, label: 'Content', order: 2 }
        ];
        
        inferredFields = componentFields;
      }
      
      // Create definition for confidence scoring
      const typeDefinition: ContentTypeDefinition = {
        name,
        category,
        fields: inferredFields.map(f => ({
          name: f.name,
          type: f.type,
          required: f.required || false,
          validation: f.validation
        }))
      };
      
      // Calculate confidence score for AI-generated type
      const confidenceScore = confidenceScorer.calculateScore(typeDefinition);
      console.log(`AI-generated type confidence: ${confidenceScore.total}% (${confidenceScore.threshold})`);
      
      // Prepare fields with proper IDs and type validation
      const preparedFields = inferredFields.map((field, index) => ({
        ...field,
        id: field.id || `field_${field.name}_${Date.now()}_${index}`,
        type: field.type as 'text' | 'textarea' | 'richtext' | 'number' | 'boolean' | 'date' | 'image' | 'richText' | 'reference' | 'select' | 'gallery' | 'tags' | 'json' | 'url',
        order: field.order || index + 1
      }));
      
      // Create content type using the service (with AI source)
      const result = await createContentTypeService({
        websiteId,
        name,
        pluralName: (settings.pluralName as string) || `${name}s`,
        icon: (settings.icon as string) || '📋',
        description: (settings.description as string) || '',
        category,
        fields: preparedFields as unknown as CreateContentTypeRequest['fields'],
        relationships: []
      }, 'AI');
      
      const executionTime = Date.now() - startTime;
      if (executionTime > 2000) {
        console.warn(`create-content-type execution exceeded 2s: ${executionTime}ms`);
      }
      
      return {
        success: true,
        contentType: {
          id: result.id,
          websiteId: result.websiteId,
          name: result.name,
          fields: result.fields,
          settings: result.settings,
          category,
          createdAt: result.createdAt,
          updatedAt: result.updatedAt
        },
        inferredFieldsCount: preparedFields.length,
        executionTime: `${executionTime}ms`
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error('Error creating content type:', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create content type',
        executionTime: `${executionTime}ms`
      };
    }
  }
});
