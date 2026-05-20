/**
 * Validation Rules Engine
 * Validates content type definitions against rules and existing types
 */

import { databaseTypeLoader, LoadedContentType } from '../database-type-loader';
import { primitiveTypeLoader } from '../primitive-type-loader';
import { dynamicExamplesLoader } from '../examples/dynamic-loader';
import { sanitizeTypeName, sanitizeFieldName } from '../utils/input-sanitizer';

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  suggestions: ValidationSuggestion[];
  duplicateCheck: DuplicateCheckResult;
}

export interface ValidationError {
  field: string;
  message: string;
  severity: 'critical' | 'high' | 'medium';
}

export interface ValidationWarning {
  field: string;
  message: string;
}

export interface ValidationSuggestion {
  type: 'reuse' | 'extend' | 'rename' | 'optimize';
  message: string;
  existingType?: string;
  confidence: number;
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  matchType?: string;
  overlapPercentage: number;
  recommendation: 'use_existing' | 'extend_existing' | 'create_new';
}

export interface ContentTypeDefinition {
  name: string;
  category: 'page' | 'component' | 'folder';
  fields: Array<{
    name: string;
    type: string;
    required?: boolean;
    validation?: Record<string, unknown>;
  }>;
  relationships?: Array<{
    name: string;
    type: string;
    targetType: string;
  }>;
}

export class ContentTypeValidator {
  private primitiveTypes: Set<string> = new Set();
  private existingTypes: Map<string, LoadedContentType> = new Map();
  private websiteId: string | null = null;

  /**
   * Initialize validator with website context
   */
  async initialize(websiteId: string): Promise<void> {
    this.websiteId = websiteId;
    
    // Load primitive types
    const primitives = await primitiveTypeLoader.loadAllPrimitiveTypes();
    this.primitiveTypes.clear();
    primitives.forEach(p => this.primitiveTypes.add(p.name));
    
    // Load existing content types
    const existingTypes = await databaseTypeLoader.loadContentTypes(websiteId);
    this.existingTypes.clear();
    existingTypes.forEach(t => this.existingTypes.set(t.name.toLowerCase(), t));
  }

  /**
   * Validate a content type definition
   */
  async validate(definition: ContentTypeDefinition): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const suggestions: ValidationSuggestion[] = [];
    
    // Sanitize type name first for security
    try {
      definition.name = sanitizeTypeName(definition.name);
    } catch (error: unknown) {
      errors.push({
        field: 'name',
        message: `Invalid type name: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'critical'
      });
    }
    
    // Sanitize field names
    definition.fields.forEach(field => {
      try {
        field.name = sanitizeFieldName(field.name);
      } catch (error: unknown) {
        errors.push({
          field: `fields.${field.name}`,
          message: `Invalid field name: ${error instanceof Error ? error.message : 'Unknown error'}`,
          severity: 'high'
        });
      }
    });
    
    // Check duplicate
    const duplicateCheck = await this.checkDuplicate(definition);
    
    // Validate type name
    this.validateTypeName(definition.name, errors, warnings);
    
    // Validate fields
    this.validateFields(definition.fields, errors, warnings);
    
    // Validate category-specific requirements
    this.validateCategoryRequirements(definition, errors, warnings);
    
    // Validate relationships
    if (definition.relationships) {
      this.validateRelationships(definition.relationships, errors, warnings);
    }
    
    // Generate suggestions
    await this.generateSuggestions(definition, duplicateCheck, suggestions);
    
    // Validate against primitives
    this.validatePrimitiveUsage(definition.fields, errors);
    
    // Check for component reuse opportunities
    this.checkComponentReuse(definition, suggestions);
    
    return {
      isValid: errors.length === 0 && !duplicateCheck.isDuplicate,
      errors,
      warnings,
      suggestions,
      duplicateCheck
    };
  }

  /**
   * Check for duplicate types
   */
  private async checkDuplicate(definition: ContentTypeDefinition): Promise<DuplicateCheckResult> {
    const nameLower = definition.name.toLowerCase();
    
    // Exact name match
    if (this.existingTypes.has(nameLower)) {
      return {
        isDuplicate: true,
        matchType: definition.name,
        overlapPercentage: 100,
        recommendation: 'use_existing'
      };
    }
    
    // Semantic similarity check
    const semanticMatch = this.findSemanticMatch(definition.name);
    if (semanticMatch) {
      return {
        isDuplicate: true,
        matchType: semanticMatch,
        overlapPercentage: 90,
        recommendation: 'use_existing'
      };
    }
    
    // Field overlap analysis
    const fieldOverlap = this.analyzeFieldOverlap(definition);
    
    if (fieldOverlap.percentage >= 80) {
      return {
        isDuplicate: true,
        matchType: fieldOverlap.matchType || undefined,
        overlapPercentage: fieldOverlap.percentage,
        recommendation: 'use_existing'
      };
    } else if (fieldOverlap.percentage >= 50) {
      return {
        isDuplicate: false,
        matchType: fieldOverlap.matchType || undefined,
        overlapPercentage: fieldOverlap.percentage,
        recommendation: 'extend_existing'
      };
    }
    
    return {
      isDuplicate: false,
      matchType: fieldOverlap.matchType || undefined,
      overlapPercentage: fieldOverlap.percentage,
      recommendation: 'create_new'
    };
  }

  /**
   * Find semantic matches
   */
  private findSemanticMatch(typeName: string): string | null {
    const semanticGroups = [
      ['BlogPost', 'ArticlePage', 'NewsItem', 'Post'],
      ['ProductPage', 'ItemPage', 'CatalogItem', 'Product'],
      ['LandingPage', 'MarketingPage', 'CampaignPage'],
      ['HeroSection', 'HeroBanner', 'HeroComponent'],
      ['CTASection', 'CTAComponent', 'CallToAction']
    ];
    
    const nameLower = typeName.toLowerCase();
    
    for (const group of semanticGroups) {
      const groupLower = group.map(g => g.toLowerCase());
      if (groupLower.includes(nameLower)) {
        // Find if any from this group exists
        for (const existing of this.existingTypes.keys()) {
          if (groupLower.includes(existing)) {
            const list = Array.from(this.existingTypes.values());
            const match = list.find((t: any) => String(t.name).toLowerCase() === existing);
            return (match?.name as string) || null;
          }
        }
      }
    }
    
    return null;
  }

  /**
   * Analyze field overlap with existing types
   */
  private analyzeFieldOverlap(definition: ContentTypeDefinition): {
    percentage: number;
    matchType: string | null;
  } {
    let bestMatch = { percentage: 0, matchType: null as string | null };
    
    const defFieldNames = definition.fields.map(f => f.name.toLowerCase());
    
    for (const existing of this.existingTypes.values()) {
      if (!existing.fields) continue;
      
      const existingFieldNames = existing.fields.map(f => f.name.toLowerCase());
      const overlap = defFieldNames.filter(f => existingFieldNames.includes(f)).length;
      const percentage = (overlap / Math.max(defFieldNames.length, existingFieldNames.length)) * 100;
      
      if (percentage > bestMatch.percentage) {
        bestMatch = { percentage, matchType: existing.name };
      }
    }
    
    return bestMatch;
  }

  /**
   * Validate type name
   */
  private validateTypeName(name: string, errors: ValidationError[], warnings: ValidationWarning[]): void {
    // Check if empty
    if (!name || name.trim() === '') {
      errors.push({
        field: 'name',
        message: 'Type name is required',
        severity: 'critical'
      });
      return;
    }
    
    // Check naming convention (PascalCase)
    if (!/^[A-Z][a-zA-Z0-9]*$/.test(name)) {
      errors.push({
        field: 'name',
        message: 'Type name must be in PascalCase (e.g., BlogPost)',
        severity: 'medium'
      });
    }
    
    // Check length
    if (name.length > 50) {
      warnings.push({
        field: 'name',
        message: 'Type name is very long, consider a shorter name'
      });
    }
  }

  /**
   * Validate category-specific requirements
   */
  private validateCategoryRequirements(definition: ContentTypeDefinition, errors: ValidationError[], warnings: ValidationWarning[]): void {
    if (definition.category === 'page') {
      // Pages should have slug and title for routing
      const hasSlug = definition.fields.some(f => f.name.toLowerCase() === 'slug');
      if (!hasSlug) {
        warnings.push({
          field: 'fields',
          message: 'Page types should include a "slug" field for URL routing'
        });
      }
      
      // Pages should not have URL field since they are routable themselves
      const hasUrl = definition.fields.some(f => f.name.toLowerCase() === 'url');
      if (hasUrl) {
        warnings.push({
          field: 'fields',
          message: 'Page types should not have URL fields - they are routable by default'
        });
      }
    } else if (definition.category === 'component') {
      // Components should be reusable and focused
      if (definition.fields.length > 8) {
        warnings.push({
          field: 'fields',
          message: 'Components should be focused - consider splitting complex components into smaller ones'
        });
      }
      
      // Components should not have SEO-specific fields
      const seoFields = ['metaTitle', 'metaDescription', 'slug'];
      const hasSeoFields = definition.fields.some(f => seoFields.includes(f.name.toLowerCase()));
      if (hasSeoFields) {
        warnings.push({
          field: 'fields',
          message: 'Component types should not include SEO fields - those belong to page types'
        });
      }
    }
  }

  /**
   * Validate fields
   */
  private validateFields(fields: ContentTypeDefinition['fields'], errors: ValidationError[], warnings: ValidationWarning[]): void {
    if (!fields || fields.length === 0) {
      errors.push({
        field: 'fields',
        message: 'At least one field is required',
        severity: 'high'
      });
      return;
    }
    
    const fieldNames = new Set<string>();
    
    for (const field of fields) {
      // Check duplicate field names
      if (fieldNames.has(field.name.toLowerCase())) {
        errors.push({
          field: `fields.${field.name}`,
          message: `Duplicate field name: ${field.name}`,
          severity: 'high'
        });
      }
      fieldNames.add(field.name.toLowerCase());
      
      // Check field naming (camelCase)
      if (!/^[a-z][a-zA-Z0-9]*$/.test(field.name)) {
        errors.push({
          field: `fields.${field.name}`,
          message: 'Field names must be in camelCase',
          severity: 'medium'
        });
      }
    }
    
    // Check for required title field on pages
    const hasTitle = fields.some(f => f.name.toLowerCase() === 'title');
    if (!hasTitle) {
      warnings.push({
        field: 'fields',
        message: 'Consider adding a "title" field for better usability'
      });
    }
  }

  /**
   * Validate primitive type usage
   */
  private validatePrimitiveUsage(fields: ContentTypeDefinition['fields'], errors: ValidationError[]): void {
    for (const field of fields) {
      if (!this.primitiveTypes.has(field.type)) {
        errors.push({
          field: `fields.${field.name}.type`,
          message: `Invalid type "${field.type}". Must be one of: ${Array.from(this.primitiveTypes).join(', ')}`,
          severity: 'critical'
        });
      }
    }
  }

  /**
   * Validate relationships
   */
  private validateRelationships(relationships: NonNullable<ContentTypeDefinition['relationships']>, errors: ValidationError[], warnings: ValidationWarning[]): void {
    for (const rel of relationships) {
      // Check relationship type
      const validTypes = ['oneToOne', 'oneToMany', 'manyToOne', 'manyToMany'];
      if (!validTypes.includes(rel.type)) {
        errors.push({
          field: `relationships.${rel.name}.type`,
          message: `Invalid relationship type. Must be one of: ${validTypes.join(', ')}`,
          severity: 'high'
        });
      }
      
      // Check target type exists
      if (!this.existingTypes.has(rel.targetType.toLowerCase())) {
        warnings.push({
          field: `relationships.${rel.name}.targetType`,
          message: `Target type "${rel.targetType}" does not exist yet`
        });
      }
    }
  }

  /**
   * Generate suggestions
   */
  private async generateSuggestions(
    definition: ContentTypeDefinition,
    duplicateCheck: DuplicateCheckResult,
    suggestions: ValidationSuggestion[]
  ): Promise<void> {
    // Suggest reuse if duplicate found
    if (duplicateCheck.isDuplicate && duplicateCheck.matchType) {
      suggestions.push({
        type: 'reuse',
        message: `Consider using existing "${duplicateCheck.matchType}" instead`,
        existingType: duplicateCheck.matchType,
        confidence: duplicateCheck.overlapPercentage
      });
    }
    
    // Suggest extension if partial overlap
    if (!duplicateCheck.isDuplicate && duplicateCheck.overlapPercentage >= 50 && duplicateCheck.matchType) {
      suggestions.push({
        type: 'extend',
        message: `Consider extending "${duplicateCheck.matchType}" instead of creating new type`,
        existingType: duplicateCheck.matchType,
        confidence: duplicateCheck.overlapPercentage
      });
    }
    
    // Find similar examples
    const fieldNames = definition.fields.map(f => f.name);
    const similarExamples = dynamicExamplesLoader.findSimilarExamples(fieldNames);
    
    if (similarExamples.length > 0) {
      const topExample = similarExamples[0];
      if (topExample.name !== definition.name) {
        suggestions.push({
          type: 'reuse',
          message: `Similar to example "${topExample.name}" - consider using as template`,
          existingType: topExample.name,
          confidence: topExample.confidence
        });
      }
    }
  }

  /**
   * Check for component reuse opportunities
   */
  private checkComponentReuse(definition: ContentTypeDefinition, suggestions: ValidationSuggestion[]): void {
    const components = databaseTypeLoader.getReusableComponents();
    
    for (const field of definition.fields) {
      // Check if field could be replaced with component
      if (field.type === 'JSON' || field.type === 'LongText') {
        const fieldNameLower = field.name.toLowerCase();
        
        // Check for ContentArea opportunity
        if (fieldNameLower.includes('content') || fieldNameLower.includes('body')) {
          const contentArea = components.find(c => c.name.includes('ContentArea'));
          if (contentArea) {
            suggestions.push({
              type: 'optimize',
              message: `Consider using "${contentArea.name}" component for "${field.name}" field`,
              existingType: contentArea.name,
              confidence: 75
            });
          }
        }
        
        // Check for CTA opportunity
        if (fieldNameLower.includes('cta') || fieldNameLower.includes('action')) {
          const cta = components.find(c => c.name.includes('CTA'));
          if (cta) {
            suggestions.push({
              type: 'optimize',
              message: `Consider using "${cta.name}" component for "${field.name}" field`,
              existingType: cta.name,
              confidence: 80
            });
          }
        }
      }
    }
  }
}

// Export singleton instance
export const contentTypeValidator = new ContentTypeValidator();
