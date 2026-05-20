/**
 * Dynamic Examples Loader
 * Loads and merges static examples with dynamic examples from database
 */

import * as fs from 'fs';
import * as path from 'path';
import { databaseTypeLoader, LoadedContentType } from '../database-type-loader';

export interface TypeExample {
  name: string;
  category: 'page' | 'component';
  purpose: string;
  fields: Array<{
    name: string;
    type: string;
    required: boolean;
    label?: string;
    validation?: Record<string, unknown>;
    helpText?: string;
  }>;
  relationships?: Array<{
    name: string;
    type: string;
    targetType: string;
    required: boolean;
  }>;
  confidence: number;
  source: 'static' | 'dynamic';
  usagePattern?: string;
}

export class DynamicExamplesLoader {
  private staticExamples: TypeExample[] = [];
  private dynamicExamples: TypeExample[] = [];
  private mergedExamples: Map<string, TypeExample> = new Map();

  constructor() {
    this.loadStaticExamples();
  }

  /**
   * Load static examples from JSON file
   */
  private loadStaticExamples(): void {
    try {
      const examplesPath = path.join(
        process.cwd(),
        'lib/services/universal-types/examples/static-examples.json'
      );
      
      if (fs.existsSync(examplesPath)) {
        const content = fs.readFileSync(examplesPath, 'utf-8');
        const data = JSON.parse(content);
        this.staticExamples = data.examples.map((ex: Record<string, unknown>) => ({
          ...ex,
          source: 'static'
        }));
      }
    } catch (error) {
      console.error('Error loading static examples:', error);
    }
  }

  /**
   * Load dynamic examples from database
   */
  async loadDynamicExamples(websiteId: string): Promise<void> {
    try {
      const contentTypes = await databaseTypeLoader.loadContentTypes(websiteId);
      
      this.dynamicExamples = contentTypes.map(ct => this.transformToExample(ct));
    } catch (error) {
      console.error('Error loading dynamic examples:', error);
    }
  }

  /**
   * Transform database content type to example format
   */
  private transformToExample(contentType: LoadedContentType): TypeExample {
    return {
      name: contentType.name,
      category: contentType.category,
      purpose: contentType.purpose || `${contentType.name} content type`,
      fields: contentType.fields,
      relationships: contentType.relationships?.map(rel => ({
        ...rel,
        targetType: rel.targetContentType,
        required: false
      })),
      confidence: this.calculateConfidence(contentType),
      source: 'dynamic',
      usagePattern: this.identifyUsagePattern(contentType)
    };
  }

  /**
   * Calculate confidence score for dynamic example
   */
  private calculateConfidence(contentType: LoadedContentType): number {
    let score = 70; // Base score for dynamic examples
    
    // Add points for completeness
    if (contentType.fields.length > 0) score += 5;
    if (contentType.fields.length > 5) score += 5;
    if (contentType.purpose) score += 5;
    if (contentType.relationships && contentType.relationships.length > 0) score += 5;
    
    // Add points for validation rules
    const hasValidation = contentType.fields.some(f => f.validation);
    if (hasValidation) score += 5;
    
    // Add points for required fields
    const hasRequired = contentType.fields.some(f => f.required);
    if (hasRequired) score += 5;
    
    return Math.min(score, 95); // Cap at 95 for dynamic examples
  }

  /**
   * Identify usage pattern for content type
   */
  private identifyUsagePattern(contentType: LoadedContentType): string {
    const patterns: Record<string, string> = {
      'blog': 'Content publishing',
      'product': 'E-commerce',
      'landing': 'Marketing',
      'article': 'Editorial',
      'page': 'General content',
      'hero': 'Page sections',
      'cta': 'Conversion',
      'navigation': 'Site structure',
      'form': 'User input',
      'card': 'Content display',
      'testimonial': 'Social proof',
      'faq': 'Information'
    };

    const nameLower = contentType.name.toLowerCase();
    
    for (const [key, pattern] of Object.entries(patterns)) {
      if (nameLower.includes(key)) {
        return pattern;
      }
    }
    
    return contentType.category === 'component' ? 'Reusable component' : 'Content page';
  }

  /**
   * Merge static and dynamic examples
   */
  async getMergedExamples(websiteId?: string): Promise<TypeExample[]> {
    this.mergedExamples.clear();
    
    // Add static examples first (higher priority)
    for (const example of this.staticExamples) {
      this.mergedExamples.set(example.name, example);
    }
    
    // Load and merge dynamic examples if websiteId provided
    if (websiteId) {
      await this.loadDynamicExamples(websiteId);
      
      for (const example of this.dynamicExamples) {
        // Only add if not already in static examples
        if (!this.mergedExamples.has(example.name)) {
          this.mergedExamples.set(example.name, example);
        }
      }
    }
    
    return Array.from(this.mergedExamples.values());
  }

  /**
   * Get examples by category
   */
  async getExamplesByCategory(
    category: 'page' | 'component',
    websiteId?: string
  ): Promise<TypeExample[]> {
    const examples = await this.getMergedExamples(websiteId);
    return examples.filter(ex => ex.category === category);
  }

  /**
   * Get examples by usage pattern
   */
  async getExamplesByPattern(
    pattern: string,
    websiteId?: string
  ): Promise<TypeExample[]> {
    const examples = await this.getMergedExamples(websiteId);
    return examples.filter(ex => 
      ex.usagePattern?.toLowerCase().includes(pattern.toLowerCase())
    );
  }

  /**
   * Find similar examples to a given type definition
   */
  findSimilarExamples(
    fields: string[],
    examples?: TypeExample[]
  ): TypeExample[] {
    const examplesPool = examples || Array.from(this.mergedExamples.values());
    const similar: Array<{example: TypeExample; overlap: number}> = [];
    
    for (const example of examplesPool) {
      const exampleFieldNames = example.fields.map(f => f.name.toLowerCase());
      const overlap = fields.filter(
        f => exampleFieldNames.includes(f.toLowerCase())
      ).length;
      
      const overlapPercentage = (overlap / Math.max(fields.length, example.fields.length)) * 100;
      
      if (overlapPercentage >= 40) {
        similar.push({ example, overlap: overlapPercentage });
      }
    }
    
    // Sort by overlap percentage
    return similar
      .sort((a, b) => b.overlap - a.overlap)
      .map(s => s.example);
  }

  /**
   * Format examples for prompt injection
   */
  formatForPrompt(examples?: TypeExample[]): string {
    const examplesPool = examples || Array.from(this.mergedExamples.values());
    
    if (examplesPool.length === 0) {
      return 'No examples available';
    }
    
    return examplesPool
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 10) // Top 10 examples
      .map(ex => {
        const fieldList = ex.fields
          .slice(0, 5) // Show first 5 fields
          .map(f => `${f.name}: ${f.type}`)
          .join(', ');
        
        const moreFields = ex.fields.length > 5 ? ` (+${ex.fields.length - 5} more)` : '';
        
        return `- ${ex.name} (${ex.category}): ${ex.purpose}\n  Fields: ${fieldList}${moreFields}\n  Confidence: ${ex.confidence}%`;
      })
      .join('\n\n');
  }

  /**
   * Get examples as JSON
   */
  getExamplesAsJson(): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    
    this.mergedExamples.forEach((example) => {
      result[example.name] = {
        category: example.category,
        purpose: example.purpose,
        fields: example.fields,
        relationships: example.relationships,
        confidence: example.confidence,
        source: example.source,
        usagePattern: example.usagePattern
      };
    });
    
    return result;
  }
}

// Export singleton instance
export const dynamicExamplesLoader = new DynamicExamplesLoader();