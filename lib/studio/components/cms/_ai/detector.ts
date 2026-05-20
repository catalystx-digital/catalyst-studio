import { ComponentType, AIComponentMetadata } from '../_core/types';
import { componentPatterns } from './patterns';
import { calculateConfidenceScore } from './confidence';

export interface DetectionResult {
  componentType: ComponentType;
  confidence: number;
  metadata: AIComponentMetadata;
  reasoning: string[];
}

export class ComponentDetector {
  private patterns = componentPatterns;
  
  /**
   * Detect component type based on content analysis
   */
  detectComponentType(content: string, context?: {
    pageSection?: string;
    surroundingContent?: string;
    userIntent?: string;
  }): DetectionResult[] {
    const results: DetectionResult[] = [];
    const contentLower = content.toLowerCase();
    
    for (const [componentType, pattern] of Object.entries(this.patterns)) {
      const matchReasons: string[] = [];
      let baseScore = 0;
      
      // Check keywords
      const keywordMatches = pattern.keywords.filter(keyword => 
        contentLower.includes(keyword.toLowerCase())
      );
      if (keywordMatches.length > 0) {
        baseScore += keywordMatches.length * 0.2;
        matchReasons.push(`Matched keywords: ${keywordMatches.join(', ')}`);
      }
      
      // Check patterns
      const patternMatches = pattern.patterns.filter(p => {
        try {
          const regex = new RegExp(p, 'i');
          return regex.test(content);
        } catch {
          return false;
        }
      });
      if (patternMatches.length > 0) {
        baseScore += patternMatches.length * 0.3;
        matchReasons.push(`Matched patterns: ${patternMatches.length}`);
      }
      
      // Check common names
      const nameMatches = pattern.commonNames.filter(name =>
        contentLower.includes(name.toLowerCase())
      );
      if (nameMatches.length > 0) {
        baseScore += nameMatches.length * 0.25;
        matchReasons.push(`Matched common names: ${nameMatches.join(', ')}`);
      }
      
      // Context bonus
      if (context?.pageSection && pattern.pageLocation.includes(context.pageSection as any)) {
        baseScore += 0.15;
        matchReasons.push(`Matches expected page location: ${context.pageSection}`);
      }
      
      // Calculate final confidence
      const confidence = calculateConfidenceScore(baseScore, {
        hasKeywords: keywordMatches.length > 0,
        hasPatterns: patternMatches.length > 0,
        hasCommonNames: nameMatches.length > 0,
        contextMatch: !!context?.pageSection && pattern.pageLocation.includes(context.pageSection as any)
      });
      
      if (confidence > 0.3) { // Minimum threshold
        results.push({
          componentType: componentType as ComponentType,
          confidence,
          metadata: pattern,
          reasoning: matchReasons
        });
      }
    }
    
    // Sort by confidence
    return results.sort((a, b) => b.confidence - a.confidence);
  }
  
  /**
   * Analyze content structure to determine component requirements
   */
  analyzeContentStructure(content: any): {
    hasHeading: boolean;
    hasBody: boolean;
    hasImage: boolean;
    hasLinks: boolean;
    hasList: boolean;
    hasForm: boolean;
    complexity: 'simple' | 'moderate' | 'complex';
  } {
    const structure = {
      hasHeading: false,
      hasBody: false,
      hasImage: false,
      hasLinks: false,
      hasList: false,
      hasForm: false,
      complexity: 'simple' as 'simple' | 'moderate' | 'complex'
    };
    
    if (typeof content === 'string') {
      structure.hasBody = content.length > 0;
      structure.hasLinks = /https?:\/\//.test(content);
      structure.hasList = /<ul>|<ol>|<li>|\n[-*]|\n\d+\./.test(content);
      structure.hasForm = /<form|<input|<textarea|<select/.test(content);
    } else if (typeof content === 'object' && content !== null) {
      structure.hasHeading = !!(content.heading || content.title || content.headline);
      structure.hasBody = !!((content.bodyHtml || content.body || content.description || content.text || content.content));
      structure.hasImage = !!(content.image || content.images || content.media || content.thumbnail);
      structure.hasLinks = !!(content.link || content.links || content.url || content.href);
      structure.hasList = !!(content.items || content.list || Array.isArray(content.features));
      structure.hasForm = !!(content.form || content.fields || content.inputs);
    }
    
    // Determine complexity
    const features = Object.values(structure).filter(v => v === true).length;
    if (features <= 2) {
      structure.complexity = 'simple';
    } else if (features <= 4) {
      structure.complexity = 'moderate';
    } else {
      structure.complexity = 'complex';
    }
    
    return structure;
  }
  
  /**
   * Get suggested component type based on intent
   */
  getSuggestedComponent(intent: string): ComponentType | null {
    const intentLower = intent.toLowerCase();
    
    const intentMappings: Record<string, ComponentType> = {
      'navigation': ComponentType.NavBar,
      'menu': ComponentType.NavBar,
      'hero': ComponentType.HeroSimple,
      'banner': ComponentType.HeroSimple,
      'feature': ComponentType.FeatureGrid,
      'features': ComponentType.FeatureGrid,
      'testimonial': ComponentType.Testimonials,
      'review': ComponentType.Reviews,
      'contact': ComponentType.ContactForm,
      'form': ComponentType.ContactForm,
      'pricing': ComponentType.PricingTable,
      'blog': ComponentType.BlogList,
      'team': ComponentType.TeamGrid,
      'footer': ComponentType.NavBar,
      'cta': ComponentType.CTASimple,
      'call to action': ComponentType.CTASimple
    };
    
    for (const [key, value] of Object.entries(intentMappings)) {
      if (intentLower.includes(key)) {
        return value;
      }
    }
    
    return null;
  }
}
