/**
 * Dynamic Property Loader
 * Identifies reusable properties and components within current project scope
 */

import { databaseTypeLoader, LoadedContentType } from './database-type-loader';

export interface ReusableProperty {
  name: string;
  type: string;
  description: string;
  usageCount: number;
  examples: string[];
  capabilities: string[];
  validationRules?: Record<string, unknown>;
}

export class PropertyLoader {
  private reusableProperties: Map<string, ReusableProperty> = new Map();
  private commonPatterns: Map<string, string> = new Map([
    ['ContentArea', 'Flexible content container for rich media and text'],
    ['CTAComponent', 'Call-to-action component with button and text'],
    ['MediaGallery', 'Gallery component for multiple images/videos'],
    ['RelatedContent', 'Component for linking related items'],
    ['MetaTags', 'SEO metadata properties'],
    ['Author', 'Author information component'],
    ['Categories', 'Categorization and tagging system'],
    ['PublishSettings', 'Publishing date and visibility controls']
  ]);

  /**
   * Load and identify reusable properties for current project
   */
  async loadReusableProperties(websiteId: string): Promise<ReusableProperty[]> {
    this.reusableProperties.clear();

    // Load content types from database
    const contentTypes = await databaseTypeLoader.loadContentTypes(websiteId);
    
    // Analyze properties across all types
    this.analyzeProperties(contentTypes);
    
    // Identify common components
    this.identifyComponents(contentTypes);
    
    return Array.from(this.reusableProperties.values());
  }

  /**
   * Analyze properties across content types
   */
  private analyzeProperties(contentTypes: LoadedContentType[]): void {
    const propertyUsage: Map<string, {
      type: string;
      count: number;
      inTypes: string[];
    }> = new Map();

    // Count property usage across types
    for (const contentType of contentTypes) {
      if (!contentType.fields) continue;

      for (const field of contentType.fields) {
        const key = `${field.name}:${field.type}`;
        const usage = propertyUsage.get(key) || {
          type: field.type,
          count: 0,
          inTypes: [] as string[]
        };
        
        usage.count++;
        usage.inTypes.push(contentType.name as string);
        propertyUsage.set(key, usage);
      }
    }

    // Identify reusable properties (used in 2+ types)
    propertyUsage.forEach((usage, key) => {
      if (usage.count >= 2) {
        const [name] = key.split(':');
        this.addReusableProperty(name, usage.type, usage.inTypes);
      }
    });
  }

  /**
   * Identify component patterns
   */
  private identifyComponents(contentTypes: LoadedContentType[]): void {
    for (const contentType of contentTypes) {
      if (contentType.category === 'component') {
        // Check if it matches common patterns
        const pattern = this.matchesCommonPattern(contentType.name);
        
        this.addReusableProperty(
          contentType.name,
          'component',
          [contentType.name],
          pattern || contentType.purpose
        );
      }

      // Check for ContentArea-like fields
      if (contentType.fields) {
        for (const field of contentType.fields) {
          if (this.isContentAreaLike(field)) {
            this.addReusableProperty(
              field.name,
              'content-area',
              [contentType.name],
              'Rich content area for flexible content'
            );
          }
        }
      }
    }
  }

  /**
   * Check if property name matches common pattern
   */
  private matchesCommonPattern(name: string): string | null {
    for (const [pattern, description] of this.commonPatterns) {
      if (name.toLowerCase().includes(pattern.toLowerCase())) {
        return description;
      }
    }
    return null;
  }

  /**
   * Check if field is ContentArea-like
   */
  private isContentAreaLike(field: { name: string; type: string }): boolean {
    const contentAreaIndicators = [
      'content', 'body', 'richtext', 'blocks', 
      'sections', 'modules', 'components'
    ];
    
    const nameCheck = contentAreaIndicators.some(
      indicator => field.name.toLowerCase().includes(indicator)
    );
    
    const typeCheck = field.type === 'LongText' || 
                     field.type === 'JSON' || 
                     field.type === 'Array';
    
    return nameCheck && typeCheck;
  }

  /**
   * Add a reusable property
   */
  private addReusableProperty(
    name: string, 
    type: string, 
    examples: string[],
    description?: string
  ): void {
    const existing = this.reusableProperties.get(name);
    
    if (existing) {
      existing.usageCount++;
      existing.examples = [...new Set([...existing.examples, ...examples])];
    } else {
      this.reusableProperties.set(name, {
        name,
        type,
        description: description || this.generateDescription(name, type),
        usageCount: examples.length,
        examples,
        capabilities: this.extractCapabilities(name, type),
        validationRules: this.extractValidationRules(name, type)
      });
    }
  }

  /**
   * Generate description for property
   */
  private generateDescription(name: string, type: string): string {
    const descriptions: Record<string, string> = {
      'title': 'Page or content title',
      'description': 'Brief description or summary',
      'content': 'Main content area',
      'image': 'Image or media asset',
      'url': 'Link or URL reference',
      'date': 'Date field',
      'author': 'Author information',
      'tags': 'Tags or categories',
      'metadata': 'Additional metadata',
      'settings': 'Configuration settings'
    };

    const lowerName = name.toLowerCase();
    for (const [key, desc] of Object.entries(descriptions)) {
      if (lowerName.includes(key)) {
        return desc;
      }
    }

    return `${name} property of type ${type}`;
  }

  /**
   * Extract capabilities for property
   */
  private extractCapabilities(name: string, type: string): string[] {
    const capabilities: string[] = [];
    
    if (type === 'component') {
      capabilities.push('reusable-component');
    }
    
    if (type === 'content-area') {
      capabilities.push('flexible-content', 'rich-media');
    }
    
    if (name.toLowerCase().includes('seo')) {
      capabilities.push('seo-optimized');
    }
    
    if (name.toLowerCase().includes('media') || name.toLowerCase().includes('image')) {
      capabilities.push('media-handling');
    }
    
    return capabilities;
  }

  /**
   * Extract validation rules
   */
  private extractValidationRules(name: string, _type: string): Record<string, unknown> {
    const rules: Record<string, unknown> = {};
    
    // Common validation patterns
    if (name.toLowerCase().includes('email')) {
      rules.pattern = '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$';
    }
    
    if (name.toLowerCase().includes('url')) {
      rules.pattern = '^https?://';
    }
    
    if (name.toLowerCase().includes('title')) {
      rules.maxLength = 255;
      rules.required = true;
    }
    
    return rules;
  }

  /**
   * Format properties for prompt injection
   */
  formatForPrompt(): string {
    const properties = Array.from(this.reusableProperties.values());
    
    if (properties.length === 0) {
      return 'No reusable properties identified in current project';
    }

    return properties
      .sort((a, b) => b.usageCount - a.usageCount)
      .map(prop => {
        const usage = prop.usageCount > 1 
          ? ` (used ${prop.usageCount} times)` 
          : '';
        return `- ${prop.name}: ${prop.description}${usage}`;
      })
      .join('\n');
  }

  /**
   * Get properties as JSON
   */
  getPropertiesAsJson(): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    
    this.reusableProperties.forEach((prop) => {
      result[prop.name] = {
        type: prop.type,
        description: prop.description,
        usageCount: prop.usageCount,
        capabilities: prop.capabilities,
        validationRules: prop.validationRules
      };
    });
    
    return result;
  }
}

// Export singleton instance
export const propertyLoader = new PropertyLoader();