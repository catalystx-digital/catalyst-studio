/**
 * Confidence Scoring System
 * Calculates confidence scores for generated content types
 */

import { ContentTypeDefinition } from './validator';
import { primitiveTypeLoader } from '../primitive-type-loader';
import { databaseTypeLoader } from '../database-type-loader';

export interface ConfidenceScore {
  total: number;
  breakdown: {
    typeCompatibility: number;
    fieldMapping: number;
    validationCompleteness: number;
    platformSupport: number;
  };
  threshold: ConfidenceThreshold;
  recommendation: string;
}

export type ConfidenceThreshold = 
  | 'automatic' // >90%: Automatic application
  | 'review' // 70-90%: Review recommended
  | 'manual' // 50-70%: Manual intervention required
  | 'rejected'; // <50%: Transformation rejected

export class ConfidenceScorer {
  private primitiveTypes: Set<string> = new Set();
  private platformCapabilities: Map<string, number> = new Map();

  /**
   * Initialize scorer
   */
  async initialize(websiteId?: string): Promise<void> {
    // Load primitive types
    const primitives = await primitiveTypeLoader.loadAllPrimitiveTypes();
    this.primitiveTypes.clear();
    primitives.forEach(p => this.primitiveTypes.add(p.name));
    
    // Initialize platform capabilities (simplified for MVP)
    this.initializePlatformCapabilities();
    
    // Load context if provided
    if (websiteId) {
      await databaseTypeLoader.loadContentTypes(websiteId);
    }
  }

  /**
   * Initialize platform capability scores
   */
  private initializePlatformCapabilities(): void {
    // Basic platform support scores (0-10 points max)
    this.platformCapabilities.set('Text', 10);
    this.platformCapabilities.set('LongText', 10);
    this.platformCapabilities.set('Number', 10);
    this.platformCapabilities.set('Boolean', 10);
    this.platformCapabilities.set('Date', 10);
    this.platformCapabilities.set('Media', 9);
    this.platformCapabilities.set('JSON', 8);
    this.platformCapabilities.set('Decimal', 9);
  }

  /**
   * Calculate confidence score for a content type
   */
  calculateScore(definition: ContentTypeDefinition): ConfidenceScore {
    const breakdown = {
      typeCompatibility: this.scoreTypeCompatibility(definition),
      fieldMapping: this.scoreFieldMapping(definition),
      validationCompleteness: this.scoreValidationCompleteness(definition),
      platformSupport: this.scorePlatformSupport(definition)
    };
    
    const total = Object.values(breakdown).reduce((sum, score) => sum + score, 0);
    const threshold = this.determineThreshold(total);
    const recommendation = this.generateRecommendation(total, threshold, breakdown);
    
    return {
      total,
      breakdown,
      threshold,
      recommendation
    };
  }

  /**
   * Score type compatibility (0-40 points)
   */
  private scoreTypeCompatibility(definition: ContentTypeDefinition): number {
    let score = 0;
    const maxScore = 40;
    
    // Check if all field types are valid primitives (20 points)
    const allFieldsValid = definition.fields.every(f => this.primitiveTypes.has(f.type));
    if (allFieldsValid) {
      score += 20;
    } else {
      // Partial credit based on percentage valid
      const validCount = definition.fields.filter(f => this.primitiveTypes.has(f.type)).length;
      score += Math.floor((validCount / definition.fields.length) * 20);
    }
    
    // Check naming conventions (10 points)
    const hasValidName = /^[A-Z][a-zA-Z0-9]*$/.test(definition.name);
    const fieldsHaveValidNames = definition.fields.every(f => /^[a-z][a-zA-Z0-9]*$/.test(f.name));
    
    if (hasValidName) score += 5;
    if (fieldsHaveValidNames) score += 5;
    
    // Check category validity (5 points)
    if (definition.category === 'page' || definition.category === 'component') {
      score += 5;
    }
    
    // Check for essential fields (5 points)
    const hasTitle = definition.fields.some(f => f.name.toLowerCase() === 'title');
    const hasSlug = definition.fields.some(f => f.name.toLowerCase() === 'slug');
    
    if (hasTitle) score += 3;
    if (hasSlug) score += 2;
    
    return Math.min(score, maxScore);
  }

  /**
   * Score field mapping success (0-30 points)
   */
  private scoreFieldMapping(definition: ContentTypeDefinition): number {
    let score = 0;
    const maxScore = 30;
    
    // Check field count reasonableness (10 points)
    const fieldCount = definition.fields.length;
    if (fieldCount >= 3 && fieldCount <= 15) {
      score += 10;
    } else if (fieldCount >= 2 && fieldCount <= 20) {
      score += 7;
    } else if (fieldCount >= 1 && fieldCount <= 30) {
      score += 4;
    }
    
    // Check field type distribution (10 points)
    const typeDistribution = new Map<string, number>();
    definition.fields.forEach(f => {
      typeDistribution.set(f.type, (typeDistribution.get(f.type) || 0) + 1);
    });
    
    // Good distribution: mix of types
    if (typeDistribution.size >= 3) {
      score += 10;
    } else if (typeDistribution.size >= 2) {
      score += 7;
    } else {
      score += 4;
    }
    
    // Check for required fields (10 points)
    const requiredCount = definition.fields.filter(f => f.required).length;
    const requiredRatio = requiredCount / fieldCount;
    
    if (requiredRatio >= 0.2 && requiredRatio <= 0.6) {
      score += 10; // Good balance
    } else if (requiredRatio > 0 && requiredRatio < 0.8) {
      score += 7;
    } else {
      score += 3;
    }
    
    return Math.min(score, maxScore);
  }

  /**
   * Score validation completeness (0-20 points)
   */
  private scoreValidationCompleteness(definition: ContentTypeDefinition): number {
    let score = 0;
    const maxScore = 20;
    
    // Check validation rules presence (10 points)
    const fieldsWithValidation = definition.fields.filter(f => f.validation && Object.keys(f.validation).length > 0);
    const validationRatio = fieldsWithValidation.length / definition.fields.length;
    
    score += Math.floor(validationRatio * 10);
    
    // Check validation rule quality (10 points)
    for (const field of fieldsWithValidation) {
      if (!field.validation) continue;
      
      // Check for appropriate validation based on type
      if (field.type === 'Text' && (field.validation.maxLength || field.validation.pattern)) {
        score += 2;
      } else if (field.type === 'Number' && (field.validation.min !== undefined || field.validation.max !== undefined)) {
        score += 2;
      } else if (field.validation.required !== undefined) {
        score += 1;
      }
      
      // Cap at 10 points for this section
      if (score >= maxScore - 10) break;
    }
    
    return Math.min(score, maxScore);
  }

  /**
   * Score platform feature support (0-10 points)
   */
  private scorePlatformSupport(definition: ContentTypeDefinition): number {
    let score = 0;
    const maxScore = 10;
    
    // Calculate average platform support for all field types
    let totalSupport = 0;
    let fieldCount = 0;
    
    for (const field of definition.fields) {
      const support = this.platformCapabilities.get(field.type) || 5;
      totalSupport += support;
      fieldCount++;
    }
    
    if (fieldCount > 0) {
      score = Math.floor(totalSupport / fieldCount);
    }
    
    // Bonus for relationships if well-defined
    if (definition.relationships && definition.relationships.length > 0) {
      const validRelationships = definition.relationships.every(r => 
        ['oneToOne', 'oneToMany', 'manyToOne', 'manyToMany'].includes(r.type)
      );
      if (validRelationships) {
        score = Math.min(score + 1, maxScore);
      }
    }
    
    return Math.min(score, maxScore);
  }

  /**
   * Determine confidence threshold
   */
  private determineThreshold(score: number): ConfidenceThreshold {
    if (score > 90) return 'automatic';
    if (score >= 70) return 'review';
    if (score >= 50) return 'manual';
    return 'rejected';
  }

  /**
   * Generate recommendation based on score
   */
  private generateRecommendation(
    total: number,
    threshold: ConfidenceThreshold,
    breakdown: ConfidenceScore['breakdown']
  ): string {
    switch (threshold) {
      case 'automatic':
        return 'High confidence - Type can be automatically applied';
      
      case 'review':
        return this.generateReviewRecommendation(breakdown);
      
      case 'manual':
        return this.generateManualRecommendation(breakdown);
      
      case 'rejected':
        return 'Low confidence - Type definition needs significant revision';
      
      default:
        return 'Unable to determine recommendation';
    }
  }

  /**
   * Generate review recommendation
   */
  private generateReviewRecommendation(breakdown: ConfidenceScore['breakdown']): string {
    const issues: string[] = [];
    
    if (breakdown.typeCompatibility < 30) {
      issues.push('type compatibility issues');
    }
    if (breakdown.fieldMapping < 20) {
      issues.push('field mapping concerns');
    }
    if (breakdown.validationCompleteness < 15) {
      issues.push('incomplete validation rules');
    }
    if (breakdown.platformSupport < 7) {
      issues.push('platform support limitations');
    }
    
    if (issues.length > 0) {
      return `Review recommended - Check ${issues.join(', ')}`;
    }
    
    return 'Review recommended - Minor adjustments may improve confidence';
  }

  /**
   * Generate manual recommendation
   */
  private generateManualRecommendation(breakdown: ConfidenceScore['breakdown']): string {
    const critical: string[] = [];
    
    if (breakdown.typeCompatibility < 20) {
      critical.push('Fix type compatibility');
    }
    if (breakdown.fieldMapping < 15) {
      critical.push('Improve field structure');
    }
    if (breakdown.validationCompleteness < 10) {
      critical.push('Add validation rules');
    }
    if (breakdown.platformSupport < 5) {
      critical.push('Check platform support');
    }
    
    return `Manual intervention required - ${critical.join(', ')}`;
  }

  /**
   * Generate detailed report
   */
  generateDetailedReport(score: ConfidenceScore): string {
    const lines: string[] = [
      '## Confidence Score Report',
      '',
      `**Total Score**: ${score.total}/100`,
      `**Threshold**: ${score.threshold}`,
      `**Recommendation**: ${score.recommendation}`,
      '',
      '### Score Breakdown:',
      `- Type Compatibility: ${score.breakdown.typeCompatibility}/40`,
      `- Field Mapping: ${score.breakdown.fieldMapping}/30`,
      `- Validation Completeness: ${score.breakdown.validationCompleteness}/20`,
      `- Platform Support: ${score.breakdown.platformSupport}/10`,
      '',
      '### Threshold Guidelines:',
      '- **90-100**: Automatic application',
      '- **70-89**: Review recommended',
      '- **50-69**: Manual intervention required',
      '- **0-49**: Transformation rejected'
    ];
    
    return lines.join('\n');
  }
}

// Export singleton instance
export const confidenceScorer = new ConfidenceScorer();