/**
 * Universal Type Context Builder
 * Aggregates dynamic data for AI prompt injection
 */

import { primitiveTypeLoader } from './primitive-type-loader';
import { databaseTypeLoader } from './database-type-loader';
import { propertyLoader } from './property-loader';
import { dynamicExamplesLoader } from './examples/dynamic-loader';
import { UniversalTypeContext } from '../../prompts/types';
import * as fs from 'fs';
import * as path from 'path';

export interface DynamicContext {
  websiteId: string;
  projectName: string;
  availableTypes: string[];
  existingContentTypes: string;
  reusableComponents: string;
  commonProperties: string;
  types: Array<{
    name: string;
    fields: Array<{ name: string; type: string; required: boolean }>;
  }>;
  components: string[];
  sessionTypes: Array<{ name: string; createdAt: Date }>;
}

export class UniversalTypeContextBuilder {
  private sessionTypes: Array<{ name: string; createdAt: Date }> = [];
  private lastRefresh: Date | null = null;
  private cachedContext: DynamicContext | null = null;

  /**
   * Build complete dynamic context for a website
   */
  async buildContext(websiteId: string, projectName?: string): Promise<DynamicContext> {
    // Load all dynamic data
    const [primitives, contentTypes] = await Promise.all([
      primitiveTypeLoader.loadAllPrimitiveTypes(),
      databaseTypeLoader.loadContentTypes(websiteId),
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      propertyLoader.loadReusableProperties(websiteId),
      // eslint-disable-next-line @typescript-eslint/no-unused-vars  
      dynamicExamplesLoader.getMergedExamples(websiteId)
    ]);

    // Format data for context
    const context: DynamicContext = {
      websiteId,
      projectName: projectName || `Project ${websiteId}`,
      availableTypes: primitives.map(p => p.name),
      existingContentTypes: databaseTypeLoader.formatForPrompt(),
      reusableComponents: databaseTypeLoader.formatComponentsForPrompt(),
      commonProperties: propertyLoader.formatForPrompt(),
      types: contentTypes.map(ct => ({
        name: ct.name,
        fields: ct.fields
      })),
      components: databaseTypeLoader.getReusableComponents().map(c => c.name),
      sessionTypes: this.sessionTypes
    };

    this.cachedContext = context;
    this.lastRefresh = new Date();

    return context;
  }

  /**
   * Populate template with dynamic context
   */
  populateTemplate(template: string, context: DynamicContext): string {
    let populated = template;

    // Replace main placeholders
    populated = populated.replace(/{{availableTypes}}/g, context.availableTypes.join(', '));
    populated = populated.replace(/{{existingContentTypes}}/g, context.existingContentTypes);
    populated = populated.replace(/{{reusableComponents}}/g, context.reusableComponents);
    populated = populated.replace(/{{commonProperties}}/g, context.commonProperties);
    populated = populated.replace(/{{projectContext}}/g, `Project: ${context.projectName}`);
    populated = populated.replace(/{{projectName}}/g, context.projectName);
    populated = populated.replace(/{{websiteId}}/g, context.websiteId);

    // Replace formatted lists
    const formattedTypes = this.formatContentTypes(context.types);
    populated = populated.replace(/{{contentTypesList}}/g, formattedTypes);

    // Replace component arrays
    populated = populated.replace(/{{componentsList}}/g, context.components.join(', '));

    // Add session types if any
    if (context.sessionTypes.length > 0) {
      const sessionTypesList = context.sessionTypes
        .map(st => `${st.name} (created this session)`)
        .join(', ');
      populated = populated.replace(/{{sessionTypes}}/g, sessionTypesList);
    } else {
      populated = populated.replace(/{{sessionTypes}}/g, 'No types created this session');
    }

    return populated;
  }

  /**
   * Format content types for display
   */
  private formatContentTypes(types: DynamicContext['types']): string {
    if (types.length === 0) {
      return 'No existing content types';
    }

    return types.map(type => {
      const fields = type.fields
        .map(f => `${f.name}: ${f.type}${f.required ? ' (required)' : ''}`)
        .join(', ');
      return `- ${type.name}: ${fields}`;
    }).join('\n');
  }

  /**
   * Load template from file with security validation
   */
  async loadTemplate(templatePath: string): Promise<string> {
    // Sanitize and validate path to prevent directory traversal
    const sanitized = path.normalize(templatePath);
    const basePath = path.join(process.cwd(), 'prompts/universal-types/templates');
    const fullPath = path.join(basePath, sanitized);
    
    // Ensure path is within allowed directory - CRITICAL SECURITY CHECK
    if (!fullPath.startsWith(basePath)) {
      throw new Error('Security Error: Invalid template path - attempted directory traversal');
    }
    
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Template not found: ${templatePath}`);
    }

    return fs.promises.readFile(fullPath, 'utf-8');
  }

  /**
   * Add newly created type to session
   */
  addSessionType(typeName: string): void {
    this.sessionTypes.push({
      name: typeName,
      createdAt: new Date()
    });

    // Update cached context if exists
    if (this.cachedContext) {
      this.cachedContext.sessionTypes = this.sessionTypes;
    }
  }

  /**
   * Refresh context with new type (real-time update)
   * Auto-refreshes context after each new type generation
   * Tracks newly created types in current session
   * Appends new types to existing context without full reload
   */
  async refreshWithNewType(websiteId: string, typeName: string, typeDefinition?: { name?: string; fields?: Array<{ name: string; type: string; required: boolean }>; category?: string }): Promise<DynamicContext> {
    // Track newly created type in session
    this.addSessionType(typeName);
    
    // If we have the type definition, add it to cached context immediately
    if (this.cachedContext && typeDefinition) {
      // Add to existing types array without full reload
      const existingTypeIndex = this.cachedContext.types.findIndex(t => t.name === typeName);
      if (existingTypeIndex === -1) {
        this.cachedContext.types.push({
          name: typeDefinition.name || typeName,
          fields: typeDefinition.fields || []
        });
        
        // Update formatted strings
        this.cachedContext.existingContentTypes = this.formatContentTypesForPrompt(this.cachedContext.types);
        
        // If it's a component, add to components list
        if (typeDefinition.category === 'component') {
          this.cachedContext.components.push(typeName);
          this.cachedContext.reusableComponents = this.cachedContext.components.join(', ');
        }
      }
    }
    
    // Only refresh if context is stale (older than 1 minute)
    const now = new Date();
    if (this.cachedContext && this.lastRefresh) {
      const ageMs = now.getTime() - this.lastRefresh.getTime();
      if (ageMs < 60000) {
        // Context is fresh, just return with updated session types
        return this.cachedContext;
      }
    }

    // Full refresh needed
    return this.buildContext(websiteId);
  }

  /**
   * Format content types for prompt injection
   */
  private formatContentTypesForPrompt(types: DynamicContext['types']): string {
    return types.map(type => {
      const fields = type.fields
        .map(f => `${f.name}: ${f.type}${f.required ? '*' : ''}`)
        .join(', ');
      return `${type.name} (${fields})`;
    }).join('; ');
  }

  /**
   * Build context for prompt injection
   */
  async buildPromptContext(websiteId: string): Promise<UniversalTypeContext> {
    const context = await this.buildContext(websiteId);

    return {
      websiteId: context.websiteId,
      availableTypes: context.availableTypes,
      existingContentTypes: context.types.map(t => ({
        name: t.name,
        category: 'page' as const, // Simplified for MVP
        fields: t.fields
      })),
      reusableComponents: context.components,
      commonProperties: context.types
        .flatMap(t => t.fields)
        .reduce((acc, field) => {
          const existing = acc.find(p => p.name === field.name);
          if (existing) {
            existing.usage++;
          } else {
            acc.push({ name: field.name, type: field.type, usage: 1 });
          }
          return acc;
        }, [] as Array<{ name: string; type: string; usage: number }>)
        .filter(p => p.usage > 1),
      sessionTypes: context.sessionTypes
    };
  }

  /**
   * Generate prompt with context
   */
  async generatePromptWithContext(
    websiteId: string,
    templatePath: string,
    additionalContext?: Record<string, string>
  ): Promise<string> {
    // Load template
    const template = await this.loadTemplate(templatePath);
    
    // Build context
    const context = await this.buildContext(websiteId);
    
    // Populate template
    let populated = this.populateTemplate(template, context);
    
    // Add any additional context
    if (additionalContext) {
      for (const [key, value] of Object.entries(additionalContext)) {
        const placeholder = `{{${key}}}`;
        populated = populated.replace(new RegExp(placeholder, 'g'), value);
      }
    }
    
    return populated;
  }

  /**
   * Clear session data
   */
  clearSession(): void {
    this.sessionTypes = [];
    this.cachedContext = null;
    this.lastRefresh = null;
  }
}

// Export singleton instance
export const universalTypeContextBuilder = new UniversalTypeContextBuilder();