/**
 * Primitive Type Loader
 * Provides primitive type definitions for the universal type system
 */

export interface LoadedPrimitiveType {
  name: string;
  category: string;
  description: string;
  validationRules?: Record<string, unknown>;
  constraints?: {
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    pattern?: string;
  };
  capabilities: string[];
}

/**
 * Hardcoded primitive type definitions
 * These are statically defined to avoid dynamic imports of non-existent modules
 */
const PRIMITIVE_TYPES: LoadedPrimitiveType[] = [
  {
    name: 'Text',
    category: 'primitive',
    description: 'Short text field for titles, names, and brief content',
    constraints: { maxLength: 255 },
    capabilities: ['stores-text', 'searchable', 'sortable']
  },
  {
    name: 'LongText',
    category: 'primitive',
    description: 'Long text field for rich content and descriptions',
    constraints: { maxLength: 65535 },
    capabilities: ['stores-long-text', 'searchable', 'rich-text']
  },
  {
    name: 'Number',
    category: 'primitive',
    description: 'Numeric field for integers and counts',
    constraints: {},
    capabilities: ['stores-number', 'sortable']
  },
  {
    name: 'Decimal',
    category: 'primitive',
    description: 'Decimal field for precise numeric values',
    constraints: {},
    capabilities: ['stores-decimal', 'sortable']
  },
  {
    name: 'Boolean',
    category: 'primitive',
    description: 'Boolean field for true/false values',
    constraints: {},
    capabilities: ['stores-boolean', 'sortable']
  },
  {
    name: 'Date',
    category: 'primitive',
    description: 'Date and time field',
    constraints: {},
    capabilities: ['stores-date', 'sortable']
  },
  {
    name: 'Json',
    category: 'primitive',
    description: 'JSON field for structured data',
    constraints: {},
    capabilities: ['stores-json']
  }
];

export class PrimitiveTypeLoader {
  private loadedTypes: Map<string, LoadedPrimitiveType> = new Map();

  constructor() {
    // Initialize with hardcoded types
    for (const type of PRIMITIVE_TYPES) {
      this.loadedTypes.set(type.name.toLowerCase(), type);
    }
  }

  /**
   * Load all primitive types (returns hardcoded definitions)
   */
  async loadAllPrimitiveTypes(): Promise<LoadedPrimitiveType[]> {
    return PRIMITIVE_TYPES;
  }

  /**
   * Format types for prompt injection
   */
  formatForPrompt(): string {
    const types = Array.from(this.loadedTypes.values());
    
    return types.map(type => {
      let formatted = `- ${type.name}: ${type.description}`;
      
      if (type.constraints) {
        const constraints = [];
        if (type.constraints.minLength) constraints.push(`min length: ${type.constraints.minLength}`);
        if (type.constraints.maxLength) constraints.push(`max length: ${type.constraints.maxLength}`);
        if (type.constraints.min) constraints.push(`min: ${type.constraints.min}`);
        if (type.constraints.max) constraints.push(`max: ${type.constraints.max}`);
        
        if (constraints.length > 0) {
          formatted += ` (${constraints.join(', ')})`;
        }
      }
      
      return formatted;
    }).join('\n');
  }

  /**
   * Get types as JSON for structured prompts
   */
  getTypesAsJson(): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    
    this.loadedTypes.forEach((type) => {
      result[type.name] = {
        description: type.description,
        constraints: type.constraints,
        capabilities: type.capabilities
      };
    });
    
    return result;
  }
}

// Export singleton instance
export const primitiveTypeLoader = new PrimitiveTypeLoader();
