import { tool } from 'ai';
import { z } from 'zod';
import { getClient } from '@/lib/db/client';
import { businessRules } from '@/lib/ai-tools/business-rules';
import { getContentType } from '@/lib/services/content-type-service';

const updateContentItemInputSchema = z.object({
  id: z.string().describe('The ID of the content item to update'),
  title: z.string().optional().describe('Updated title for the content item'),
  data: z.record(z.any()).optional().describe('Updated content data (will be merged with existing)'),
  status: z.enum(['draft', 'published', 'archived']).optional().describe('Updated publication status')
});

type UpdateContentItemInput = z.infer<typeof updateContentItemInputSchema>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const updateContentItem = (tool as any)({
  description: 'Update page-level metadata (title, status) or custom content data fields. DO NOT use this for updating component properties like text, colors, or images - use updateComponentProperty instead for component-level changes.',
  inputSchema: updateContentItemInputSchema,
  execute: async ({ id, title, data, status }: UpdateContentItemInput) => {
    const startTime = Date.now();
    
    try {
      const prisma = getClient();
      
      // Try to find the item in WebsitePage first, then WebsiteCustomContentData
      let existingItem: any = await prisma.websitePage.findUnique({
        where: { id },
        include: {
          contentType: true,
          website: true,
        }
      });
      
      let modelType: 'page' | 'customContent' = 'page';
      
      // If not found in pages, try custom content
      if (!existingItem) {
        existingItem = await prisma.websiteCustomContentData.findUnique({
          where: { id },
          include: {
            contentType: true,
            website: true,
          }
        });
        modelType = 'customContent';
      }
      
      if (!existingItem) {
        throw new Error(`Content item with ID '${id}' not found in either pages or custom content`);
      }
      
      // Fetch content type to validate fields
      const contentType = await getContentType(existingItem.contentTypeId);
      if (!contentType) {
        throw new Error(`Content type with ID '${existingItem.contentTypeId}' not found`);
      }
      
      // Get existing data based on model type
      const dataField = modelType === 'page' ? 'content' : 'data';
      const existingData = (typeof existingItem[dataField] === 'object' && existingItem[dataField] !== null && !Array.isArray(existingItem[dataField])) 
        ? existingItem[dataField] as Record<string, any> 
        : {};
      
      // Merge data if provided
      const mergedData = data ? { ...existingData, ...data } : existingData;
      
      // Validate merged data against content type field definitions
      const contentTypeFieldDefs = contentType.fields?.fields || [];
      const validationErrors: Array<{ field: string; message: string }> = [];
      
      // Check required fields in merged data
      for (const fieldDef of contentTypeFieldDefs) {
        if (fieldDef.required && !(fieldDef.name in mergedData)) {
          validationErrors.push({
            field: fieldDef.name,
            message: `Required field '${fieldDef.label || fieldDef.name}' is missing`
          });
        }
        
        // Validate field type if present in the update
        if (data && fieldDef.name in data) {
          const value = data[fieldDef.name];
          const fieldType = fieldDef.type;
          
          // Basic type validation
          switch (fieldType) {
            case 'text':
            case 'textarea':
            case 'richtext':
              if (typeof value !== 'string') {
                validationErrors.push({
                  field: fieldDef.name,
                  message: `Field '${fieldDef.name}' must be a string`
                });
              }
              break;
            case 'number':
              if (typeof value !== 'number') {
                validationErrors.push({
                  field: fieldDef.name,
                  message: `Field '${fieldDef.name}' must be a number`
                });
              }
              break;
            case 'boolean':
              if (typeof value !== 'boolean') {
                validationErrors.push({
                  field: fieldDef.name,
                  message: `Field '${fieldDef.name}' must be a boolean`
                });
              }
              break;
            case 'date':
            case 'datetime':
              if (typeof value !== 'string' || isNaN(Date.parse(value))) {
                validationErrors.push({
                  field: fieldDef.name,
                  message: `Field '${fieldDef.name}' must be a valid date string`
                });
              }
              break;
            case 'select':
            case 'radio':
              if (fieldDef.options) {
                const validValues = fieldDef.options.map(opt => opt.value);
                if (!validValues.includes(value)) {
                  validationErrors.push({
                    field: fieldDef.name,
                    message: `Field '${fieldDef.name}' must be one of: ${validValues.join(', ')}`
                  });
                }
              }
              break;
            case 'multiselect':
            case 'checkbox':
              if (!Array.isArray(value)) {
                validationErrors.push({
                  field: fieldDef.name,
                  message: `Field '${fieldDef.name}' must be an array`
                });
              } else if (fieldDef.options) {
                const validValues = fieldDef.options.map(opt => opt.value);
                const invalidValues = value.filter((v: unknown) => !validValues.includes(v as string | number | boolean));
                if (invalidValues.length > 0) {
                  validationErrors.push({
                    field: fieldDef.name,
                    message: `Field '${fieldDef.name}' contains invalid values: ${invalidValues.join(', ')}`
                  });
                }
              }
              break;
            case 'json':
              // JSON fields accept any valid JSON structure
              if (value === null || value === undefined) {
                validationErrors.push({
                  field: fieldDef.name,
                  message: `Field '${fieldDef.name}' cannot be null or undefined`
                });
              }
              break;
          }
          
          // Apply field-specific validation rules
          if (fieldDef.validation) {
            const validation = fieldDef.validation;
            
            if (validation.minLength && typeof value === 'string' && value.length < Number(validation.minLength)) {
              validationErrors.push({
                field: fieldDef.name,
                message: `Field '${fieldDef.name}' must be at least ${validation.minLength} characters`
              });
            }
            
            if (validation.maxLength && typeof value === 'string' && value.length > Number(validation.maxLength)) {
              validationErrors.push({
                field: fieldDef.name,
                message: `Field '${fieldDef.name}' must not exceed ${validation.maxLength} characters`
              });
            }
            
            if (validation.min && typeof value === 'number' && value < Number(validation.min)) {
              validationErrors.push({
                field: fieldDef.name,
                message: `Field '${fieldDef.name}' must be at least ${validation.min}`
              });
            }
            
            if (validation.max && typeof value === 'number' && value > Number(validation.max)) {
              validationErrors.push({
                field: fieldDef.name,
                message: `Field '${fieldDef.name}' must not exceed ${validation.max}`
              });
            }
            
            if (validation.pattern && typeof value === 'string') {
              const regex = new RegExp(String(validation.pattern));
              if (!regex.test(value)) {
                validationErrors.push({
                  field: fieldDef.name,
                  message: `Field '${fieldDef.name}' does not match the required pattern`
                });
              }
            }
          }
        }
      }
      
      // Business rules validation - currently returns valid for all data
      if (data && existingItem.website.category) {
        const businessValidation = await businessRules.validateForCategory(mergedData, existingItem.website.category);
        if (!businessValidation.valid && businessValidation.errors) {
          // Only add errors for fields that are being updated
          const updatedFieldErrors = businessValidation.errors.filter(err => err.field in data);
          validationErrors.push(...updatedFieldErrors);
        }
      }
      
      // If there are validation errors, return them
      if (validationErrors.length > 0) {
        return {
          success: false,
          error: 'Validation failed',
          validationErrors,
          executionTime: `${Date.now() - startTime}ms`
        };
      }
      
      // Update content item in a transaction based on model type
      const updatedItem = await prisma.$transaction(async (tx) => {
        const updateData: Record<string, unknown> = {};
        
        if (title !== undefined) updateData.title = title;
        if (status !== undefined) updateData.status = status;
        
        // Set the appropriate data field based on model type
        if (data !== undefined) {
          if (modelType === 'page') {
            updateData.content = mergedData;
          } else {
            updateData.data = mergedData;
          }
        }
        
        // Update the appropriate model
        const updated = modelType === 'page'
          ? await tx.websitePage.update({
              where: { id },
              data: updateData,
              include: {
                contentType: true,
                website: true,
              }
            })
          : await tx.websiteCustomContentData.update({
              where: { id },
              data: updateData,
              include: {
                contentType: true,
                website: true,
              }
            });
        
        return updated;
      });
      
      const executionTime = Date.now() - startTime;
      if (executionTime > 2000) {
        console.warn(`update-content-item execution exceeded 2s: ${executionTime}ms`);
      }
      
      // Transform response
      const contentTypeFields = updatedItem.contentType.fields || {};
      const contentData = modelType === 'page' 
        ? (updatedItem as any).content || {}
        : (updatedItem as any).data || {};
      
      return {
        success: true,
        item: {
          id: updatedItem.id,
          title: updatedItem.title,
          websiteId: updatedItem.websiteId,
          contentTypeId: updatedItem.contentTypeId,
          status: updatedItem.status,
          content: contentData,
          modelType,
          createdAt: updatedItem.createdAt,
          updatedAt: updatedItem.updatedAt,
          contentType: {
            id: updatedItem.contentType.id,
            name: updatedItem.contentType.name,
            fields: contentTypeFields,
            category: updatedItem.contentType.category
          },
          website: {
            id: updatedItem.website.id,
            name: updatedItem.website.name,
            category: updatedItem.website.category
          }
        },
        executionTime: `${executionTime}ms`
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error('Error updating content item:', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update content item',
        executionTime: `${executionTime}ms`
      };
    }
  }
});
