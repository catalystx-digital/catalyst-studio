import { tool } from 'ai';
import { z } from 'zod';
import { getClient } from '@/lib/db/client';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const updateBusinessRequirements = (tool as any)({
  description: 'Updates website business requirements and validation rules',
  inputSchema: z.object({
    websiteId: z.string().describe('The ID of the website to update'),
    category: z.string().optional().describe('Website category (blog, ecommerce, portfolio, etc.)'),
    contentTypes: z.array(z.string()).optional().describe('Supported content types for the website'),
    requiredFields: z.record(z.array(z.string())).optional().describe('Required fields per content type'),
    validationRules: z.record(z.any()).optional().describe('Custom validation rules'),
    seoRequirements: z.object({
      titleMinLength: z.number().optional(),
      titleMaxLength: z.number().optional(),
      descriptionMinLength: z.number().optional(),
      descriptionMaxLength: z.number().optional(),
      requireOgImage: z.boolean().optional(),
      requireCanonicalUrl: z.boolean().optional(),
    }).optional().describe('SEO-specific requirements'),
    customRules: z.array(z.object({
      name: z.string(),
      description: z.string(),
      condition: z.string(),
      action: z.string(),
    })).optional().describe('Custom business rules'),
  }),
  execute: async ({
    websiteId,
    category,
    contentTypes,
    requiredFields,
    validationRules,
    seoRequirements,
    customRules,
  }) => {
    const startTime = Date.now();
    
    try {
      const prisma = getClient();
      
      // Use transaction for atomic updates
      const result = await prisma.$transaction(async (tx) => {
        // First, verify the website exists using transaction context
        const existingWebsite = await tx.website.findUnique({
          where: { id: websiteId }
        });
        
        if (!existingWebsite) {
          throw new Error(`Website with ID ${websiteId} not found`);
        }

        // Parse existing metadata (handle both string and object)
        const existingMetadata = existingWebsite.metadata 
          ? (typeof existingWebsite.metadata === 'string' 
              ? JSON.parse(existingWebsite.metadata) 
              : existingWebsite.metadata)
          : {};
        
        // Prepare the metadata update
        const updatedMetadata = { ...existingMetadata };
        
        if (contentTypes !== undefined) {
          updatedMetadata.contentTypes = contentTypes;
        }

        if (requiredFields !== undefined) {
          updatedMetadata.requiredFields = requiredFields;
        }

        if (validationRules !== undefined) {
          updatedMetadata.validationRules = validationRules;
        }

        if (seoRequirements !== undefined) {
          updatedMetadata.seoRequirements = {
            ...(existingMetadata.seoRequirements || {}),
            ...seoRequirements,
          };
        }

        if (customRules !== undefined) {
          updatedMetadata.customRules = customRules;
        }
        
        // Prepare the update data
        const updateData: any = {
          updatedAt: new Date(),
          metadata: JSON.stringify(updatedMetadata),
        };

        if (category !== undefined) {
          updateData.category = category;
        }

        // Update the website directly using transaction context
        const updatedWebsite = await tx.website.update({
          where: { id: websiteId },
          data: updateData
        });
        
        return updatedWebsite;
      });

      // Calculate execution time
      const executionTime = Date.now() - startTime;
      
      // Log performance for monitoring
      if (executionTime > 2000) {
        console.warn(`update-business-requirements took ${executionTime}ms (exceeded 2s limit)`);
      } else {
        console.log(`update-business-requirements completed in ${executionTime}ms`);
      }

      // Parse the updated metadata from result
      const resultMetadata = result.metadata ? JSON.parse(String(result.metadata)) : {};
      
      return {
        success: true,
        data: {
          websiteId: result.id,
          updated: {
            category: result.category,
            contentTypes: resultMetadata.contentTypes,
            requiredFields: resultMetadata.requiredFields,
            validationRules: resultMetadata.validationRules,
            seoRequirements: resultMetadata.seoRequirements,
            customRules: resultMetadata.customRules,
          },
          executionTime: `${executionTime}ms`,
        },
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error('Error in update-business-requirements:', error);
      
      // Transaction automatically rolls back on error
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        executionTime: `${executionTime}ms`,
      };
    }
  },
});