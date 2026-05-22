import { tool } from 'ai';
import { z } from 'zod';
import { getContentType, updateContentType as updateContentTypeService } from '@/lib/services/content-type-service';
import { businessRules } from '@/lib/ai-tools/business-rules';
import { 
  confidenceScorer,
  type ContentTypeDefinition 
} from '@/lib/services/universal-types/validation';
import type { ContentTypeFields, ContentTypeSettings } from '@/lib/services/content-type-service';
import type { UpdateContentTypeRequest } from '@/lib/api/validation/content-type';

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

const updateContentTypeInputSchema = z.object({
  id: z.string().describe('The content type ID to update'),
  name: z.string().optional().describe('New name for the content type'),
  category: z.enum(['page', 'component']).optional()
    .describe('Update category - page for routable content, component for reusable blocks'),
  fields: z.array(fieldSchema).optional()
    .describe('Updated fields array (replaces existing fields)'),
  addFields: z.array(fieldSchema).optional()
    .describe('Fields to add to existing fields'),
  removeFields: z.array(z.string()).optional()
    .describe('Field names to remove'),
  settings: z.record(z.any()).optional()
    .describe('Updated settings object')
});

type ContentTypeFieldInput = z.infer<typeof fieldSchema>;
type ExistingContentTypeField = NonNullable<ContentTypeFields['fields']>[number];
type MutableContentTypeField = ExistingContentTypeField | ContentTypeFieldInput;
type UpdateContentTypeInput = z.infer<typeof updateContentTypeInputSchema>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const updateContentType = (tool as any)({
  description: 'Update an existing content type with safe field modifications',
  inputSchema: updateContentTypeInputSchema,
  execute: async ({ id, name, category, fields, addFields, removeFields, settings }: UpdateContentTypeInput) => {
    const startTime = Date.now();
    
    try {
      // Get existing content type
      const existing = await getContentType(id);
      
      if (!existing) {
        return {
          success: false,
          error: `Content type with ID '${id}' not found`,
          executionTime: `${Date.now() - startTime}ms`
        };
      }
      
      // Get current fields from the existing content type
      const currentFields: MutableContentTypeField[] = Array.isArray(existing.fields)
        ? existing.fields
        : (existing.fields?.fields || []);
      
      // Prepare updated fields
      let updatedFields: MutableContentTypeField[] = [...currentFields];
      
      // If replacing all fields
      if (fields !== undefined) {
        // Warn about potential data loss when replacing all fields
        console.warn(`Removing fields from content type with existing content items may cause data loss. Fields being removed: ${currentFields.map((f) => f.name).join(', ')}`);
        updatedFields = fields;
      } else {
        // Add new fields
        if (addFields) {
          addFields.forEach(newField => {
            // Check if field already exists
            const existingIndex = updatedFields.findIndex((f) => f.name === newField.name);
            if (existingIndex >= 0) {
              // Update existing field
              updatedFields[existingIndex] = { ...updatedFields[existingIndex], ...newField };
            } else {
              // Add new field
              updatedFields.push(newField);
            }
          });
        }
        
        // Remove fields
        if (removeFields) {
          // Check if there might be existing content (warn regardless for safety)
          if (removeFields.length > 0) {
            console.warn(`Removing fields from content type with existing content items may cause data loss. Fields being removed: ${removeFields.join(', ')}`);
          }
          updatedFields = updatedFields.filter((f) => !removeFields.includes(f.name));
        }
      }
      
      // Calculate confidence score for AI-modified type
      const typeDefinition: ContentTypeDefinition = {
        name: name || existing.name,
        category: category || (existing.category as 'page' | 'component') || 'page',
        fields: updatedFields.map((f) => ({
          name: f.name,
          type: f.type,
          required: f.required || false,
          validation: f.validation
        }))
      };
      
      const confidenceScore = confidenceScorer.calculateScore(typeDefinition);
      console.log(`AI-modified type confidence: ${confidenceScore.total}% (${confidenceScore.threshold})`);
      
      // Log if manual review is recommended
      if (confidenceScore.threshold === 'review' || confidenceScore.threshold === 'manual') {
        console.warn(`Manual review recommended for updated type: ${confidenceScore.recommendation}`);
      }
      
      // Prepare fields with proper IDs and order
      const preparedFields = updatedFields.map((field, index) => ({
        ...field,
        id: field.id || `field_${field.name}_${Date.now()}_${index}`,
        order: field.order || index + 1
      }));
      
      // Prepare update data
      const updateData: UpdateContentTypeRequest = {
        ...(name && { name }),
        ...(category && { category }),
        fields: preparedFields as unknown as UpdateContentTypeRequest['fields'],
        relationships: existing.fields?.relationships || []
      };
      
      // Merge settings
      if (settings) {
        const currentSettings: ContentTypeSettings = typeof existing.settings === 'object'
          ? existing.settings
          : {};
        
        updateData.pluralName = settings?.pluralName || currentSettings.pluralName;
        updateData.icon = settings?.icon || currentSettings.icon;
        updateData.description = settings?.description || currentSettings.description;
        
        updateData.settings = {
          ...currentSettings,
          ...settings
        };
      }
      
      // Update content type using the service (with AI source)
      const result = await updateContentTypeService(id, updateData, 'AI');
      
      const executionTime = Date.now() - startTime;
      if (executionTime > 2000) {
        console.warn(`update-content-type execution exceeded 2s: ${executionTime}ms`);
      }
      
      return {
        success: true,
        contentType: {
          id: result.id,
          websiteId: result.websiteId,
          name: result.name,
          fields: result.fields,
          settings: result.settings,
          createdAt: result.createdAt,
          updatedAt: result.updatedAt
        },
        fieldsModified: {
          added: addFields?.length || 0,
          removed: removeFields?.length || 0,
          total: preparedFields.length
        },
        executionTime: `${executionTime}ms`
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error('Error updating content type:', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update content type',
        executionTime: `${executionTime}ms`
      };
    }
  }
});
