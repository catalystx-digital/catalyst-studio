/**
 * Database Content Type Loader
 * Loads existing content types from database filtered by current website/project
 */

import prisma from '@/lib/db/prisma';
import type { ContentType } from '@/lib/generated/prisma';
import { ContentTypeFields } from '@/lib/services/content-type-service';
import { DatabaseError, ErrorLogger } from './utils/errors';

// Proper TypeScript interface to replace 'any' usage
export interface DatabaseContentType {
  id: string;
  name: string;
  websiteId: string;
  fields: ContentTypeFields;
  createdAt: Date;
  updatedAt: Date;
  category?: string;
  purpose?: string;
}

export interface LoadedContentType {
  id: string;
  name: string;
  websiteId: string;
  fields: Array<{
    name: string;
    type: string;
    required: boolean;
    label?: string;
    validation?: Record<string, unknown>;
  }>;
  relationships?: Array<{
    name: string;
    type: string;
    targetContentType: string;
  }>;
  category: 'page' | 'component';
  purpose?: string;
}

export class DatabaseTypeLoader {
  private currentWebsiteId: string | null = null;
  private loadedTypes: Map<string, LoadedContentType> = new Map();

  /**
   * Set the current website/project context
   */
  setWebsiteContext(websiteId: string): void {
    this.currentWebsiteId = websiteId;
    this.loadedTypes.clear(); // Clear cache when context changes
  }

  /**
   * Load all content types for current website
   */
  async loadContentTypes(websiteId?: string): Promise<LoadedContentType[]> {
    const contextId = websiteId || this.currentWebsiteId;
    
    if (!contextId) {
      console.warn('No website context set for DatabaseTypeLoader');
      return [];
    }

    try {
      const contentTypes = await prisma.contentType.findMany({
        where: { websiteId: contextId },
        orderBy: { name: 'asc' }
      });

      this.loadedTypes.clear();

      for (const ct of contentTypes) {
        const loaded = this.transformContentType(ct);
        this.loadedTypes.set(ct.id, loaded);
      }

      return Array.from(this.loadedTypes.values());
    } catch (error) {
      ErrorLogger.log(error as Error, { 
        context: 'loadContentTypes',
        websiteId: contextId 
      });
      // Return cached types if available
      if (this.loadedTypes.size > 0) {
        return Array.from(this.loadedTypes.values());
      }
      throw new DatabaseError('Failed to load content types from database', error as Error);
    }
  }

  /**
   * Transform database content type to loaded format
   */
  private transformContentType(ct: ContentType): LoadedContentType {
    const fields = ct.fields as ContentTypeFields;
    
    return {
      id: ct.id,
      name: ct.name,
      websiteId: ct.websiteId,
      fields: this.extractFields(fields),
      relationships: this.extractRelationships(fields),
      category: (ct.category as 'page' | 'component') || 'page',
      purpose: this.extractPurpose(ct.name, fields)
    };
  }

  /**
   * Extract field definitions
   */
  private extractFields(fields: ContentTypeFields): LoadedContentType['fields'] {
    if (!fields?.fields) return [];

    return fields.fields.map(field => ({
      name: field.name,
      type: field.type,
      required: field.required || false,
      label: field.label,
      validation: field.validation
    }));
  }

  /**
   * Extract relationships
   */
  private extractRelationships(fields: ContentTypeFields): LoadedContentType['relationships'] {
    if (!fields?.relationships) return [];

    return fields.relationships.map(rel => ({
      name: rel.name,
      type: rel.type,
      targetContentType: rel.targetContentTypeId
    }));
  }


  /**
   * Extract purpose from type name and structure
   */
  private extractPurpose(name: string, _fields: ContentTypeFields): string {
    const purposes: Record<string, string> = {
      'BlogPost': 'Blog article with content and metadata',
      'ProductPage': 'Product showcase with details and media',
      'LandingPage': 'Marketing page with conversion focus',
      'HeroSection': 'Hero banner with media and CTA',
      'CTAComponent': 'Call-to-action component',
      'NavigationMenu': 'Site navigation component',
      'ContentArea': 'Flexible content container'
    };

    return purposes[name] || `${name} content type`;
  }

  /**
   * Check for duplicate type
   */
  isDuplicateType(typeName: string): boolean {
    return Array.from(this.loadedTypes.values()).some(
      type => type.name.toLowerCase() === typeName.toLowerCase()
    );
  }

  /**
   * Find similar types (for reuse suggestions)
   */
  findSimilarTypes(requestedFields: string[]): LoadedContentType[] {
    const similar: LoadedContentType[] = [];
    
    for (const type of this.loadedTypes.values()) {
      const typeFieldNames = type.fields.map(f => f.name.toLowerCase());
      const overlap = requestedFields.filter(
        f => typeFieldNames.includes(f.toLowerCase())
      );
      
      // If 60% or more fields overlap, consider it similar
      if (overlap.length >= requestedFields.length * 0.6) {
        similar.push(type);
      }
    }
    
    return similar;
  }

  /**
   * Get components available for reuse
   */
  getReusableComponents(): LoadedContentType[] {
    return Array.from(this.loadedTypes.values()).filter(
      type => type.category === 'component'
    );
  }

  /**
   * Format types for prompt injection
   */
  formatForPrompt(): string {
    const types = Array.from(this.loadedTypes.values());
    
    if (types.length === 0) {
      return 'No existing content types in current project';
    }

    return types.map(type => {
      const fieldList = type.fields
        .map(f => `${f.name}: ${f.type}${f.required ? ' (required)' : ''}`)
        .join(', ');
      
      return `- ${type.name} (${type.category}): ${fieldList}`;
    }).join('\n');
  }

  /**
   * Format components for prompt injection
   */
  formatComponentsForPrompt(): string {
    const components = this.getReusableComponents();
    
    if (components.length === 0) {
      return 'No reusable components in current project';
    }

    return components.map(comp => `- ${comp.name}: ${comp.purpose}`).join('\n');
  }

  /**
   * Get types as JSON for structured prompts
   */
  getTypesAsJson(): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    
    this.loadedTypes.forEach((type) => {
      result[type.name] = {
        category: type.category,
        fields: type.fields,
        relationships: type.relationships,
        purpose: type.purpose
      };
    });
    
    return result;
  }
}

// Export singleton instance
export const databaseTypeLoader = new DatabaseTypeLoader();