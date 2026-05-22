import { tool } from 'ai';
import { z } from 'zod';
import { businessRules } from '../../business-rules';
import { WebsiteService } from '@/lib/services/website-service';

const validateContentInputSchema = z.object({
  websiteId: z.string().describe('The ID of the website to validate content for'),
  contentType: z.string().describe('Type of content being validated (e.g., article, product, project)'),
  content: z.record(z.any()).describe('The content object to validate'),
  strictMode: z.boolean().optional().default(false).describe('If true, treat warnings as errors'),
});

type ValidateContentInput = z.infer<typeof validateContentInputSchema>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const validateContent = (tool as any)({
  description: 'Validates content against website business requirements and category rules',
  inputSchema: validateContentInputSchema,
  execute: async ({ websiteId, contentType, content, strictMode }: ValidateContentInput) => {
    const startTime = Date.now();
    
    try {
      const websiteService = new WebsiteService();
      
      // Retrieve website to get its category and custom rules
      const website = await websiteService.getWebsite(websiteId);
      
      if (!website) {
        return {
          success: false,
          error: `Website with ID ${websiteId} not found`,
        };
      }

      const category = website.category || 'general';
      
      // Parse metadata for custom rules
      const metadata = website.metadata ? JSON.parse(String(website.metadata)) : {};
      
      // Validate against category-specific rules
      const categoryValidation = await businessRules.validateForCategory(content, category);
      
      // Get required fields for this category and content type
      const requiredFields = businessRules.getRequiredFields(category, contentType);
      
      // Check for missing required fields
      const missingFields = requiredFields.filter(field => !(field in content));
      
      // Get suggested fields for improvement
      const suggestedFields = businessRules.suggestFields(category, 'general');
      const missingSuggested = suggestedFields.filter(field => !(field in content));
      
      // Apply custom validation rules if any
      const customErrors: Array<{ field: string; message: string }> = [];
      const customWarnings: Array<{ field: string; message: string }> = [];
      
      if (metadata.customRules && Array.isArray(metadata.customRules)) {
        for (const rule of metadata.customRules) {
          try {
            // Simple evaluation of custom rules
            // In production, this would use a safe expression evaluator
            const conditionMet = evaluateCondition(rule.condition, content);
            
            if (conditionMet) {
              if (rule.action.startsWith('error:')) {
                customErrors.push({
                  field: rule.name,
                  message: rule.action.replace('error:', '').trim(),
                });
              } else if (rule.action.startsWith('warning:')) {
                customWarnings.push({
                  field: rule.name,
                  message: rule.action.replace('warning:', '').trim(),
                });
              }
            }
          } catch (err) {
            console.warn(`Failed to evaluate custom rule ${rule.name}:`, err);
          }
        }
      }
      
      // Combine all validation results
      const allErrors = [
        ...(categoryValidation.errors || []),
        ...missingFields.map(field => ({
          field,
          message: `Required field '${field}' is missing`,
        })),
        ...customErrors,
      ];
      
      const allWarnings = [
        ...(categoryValidation.warnings || []),
        ...missingSuggested.map(field => ({
          field,
          message: `Consider adding '${field}' for better content quality`,
        })),
        ...customWarnings,
      ];
      
      // In strict mode, treat warnings as errors
      if (strictMode && allWarnings.length > 0) {
        allErrors.push(...allWarnings);
        allWarnings.length = 0;
      }
      
      const isValid = allErrors.length === 0;
      
      // Calculate execution time
      const executionTime = Date.now() - startTime;
      
      // Log performance for monitoring
      if (executionTime > 2000) {
        console.warn(`validate-content took ${executionTime}ms (exceeded 2s limit)`);
      } else {
        console.log(`validate-content completed in ${executionTime}ms`);
      }

      return {
        success: true,
        data: {
          valid: isValid,
          category,
          contentType,
          errors: allErrors,
          warnings: allWarnings,
          suggestions: {
            requiredFields: requiredFields.filter(f => !(f in content)),
            recommendedFields: missingSuggested,
            fieldDescriptions: getFieldDescriptions(category, contentType),
          },
          summary: {
            totalErrors: allErrors.length,
            totalWarnings: allWarnings.length,
            completeness: Math.round((Object.keys(content).length / requiredFields.length) * 100) || 0,
          },
          executionTime: `${executionTime}ms`,
        },
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error('Error in validate-content:', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        executionTime: `${executionTime}ms`,
      };
    }
  },
});

// Helper function to evaluate simple conditions
// In production, use a proper expression evaluator for safety
function evaluateCondition(condition: string, content: any): boolean {
  try {
    // Very basic condition evaluation
    // Examples: "field === 'value'", "field > 10", "field exists"
    
    if (condition.includes('exists')) {
      const field = condition.replace('exists', '').trim();
      return field in content && content[field] !== null && content[field] !== undefined;
    }
    
    if (condition.includes('===')) {
      const [field, value] = condition.split('===').map(s => s.trim());
      return content[field] === JSON.parse(value);
    }
    
    if (condition.includes('>')) {
      const [field, value] = condition.split('>').map(s => s.trim());
      return content[field] > parseFloat(value);
    }
    
    if (condition.includes('<')) {
      const [field, value] = condition.split('<').map(s => s.trim());
      return content[field] < parseFloat(value);
    }
    
    return false;
  } catch {
    return false;
  }
}

// Helper function to get field descriptions
function getFieldDescriptions(category: string, contentType: string): Record<string, string> {
  const descriptions: Record<string, Record<string, Record<string, string>>> = {
    blog: {
      article: {
        title: 'The main title of the article',
        content: 'The body content of the article',
        author: 'The name of the article author',
        publishDate: 'The date when the article should be published',
        tags: 'Tags for categorization and discovery',
        metaDescription: 'SEO meta description (150-160 characters)',
        featuredImage: 'URL of the featured image',
      },
    },
    ecommerce: {
      product: {
        title: 'The product name',
        price: 'The selling price',
        sku: 'Stock Keeping Unit identifier',
        inventory: 'Current stock quantity',
        productImages: 'Array of product image URLs',
        description: 'Detailed product description',
        shippingInfo: 'Shipping weight and dimensions',
      },
    },
    portfolio: {
      project: {
        projectTitle: 'The name of the project',
        description: 'Detailed project description',
        technologies: 'Technologies and tools used',
        images: 'Project screenshots or images',
        links: 'Links to live site, GitHub, demo, etc.',
      },
    },
  };
  
  return descriptions[category]?.[contentType] || {};
}
