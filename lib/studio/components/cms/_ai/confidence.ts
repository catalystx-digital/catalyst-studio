import { DEFAULT_AI_CONFIDENCE_SCORES } from '../_core/constants';

interface ConfidenceFactors {
  hasKeywords: boolean;
  hasPatterns: boolean;
  hasCommonNames: boolean;
  contextMatch: boolean;
  structureMatch?: boolean;
  intentMatch?: boolean;
}

/**
 * Calculate confidence score for component detection
 * @param baseScore Initial score from pattern matching (0-1)
 * @param factors Additional factors that influence confidence
 * @returns Final confidence score between 0 and 1
 */
export function calculateConfidenceScore(
  baseScore: number,
  factors: ConfidenceFactors
): number {
  let confidence = Math.min(baseScore, 1.0);
  
  // Apply factor multipliers
  const multipliers = {
    hasKeywords: 1.1,
    hasPatterns: 1.15,
    hasCommonNames: 1.1,
    contextMatch: 1.2,
    structureMatch: 1.1,
    intentMatch: 1.25
  };
  
  for (const [factor, isPresent] of Object.entries(factors)) {
    if (isPresent && factor in multipliers) {
      confidence *= multipliers[factor as keyof typeof multipliers];
    }
  }
  
  // Apply penalties for missing critical factors
  if (!factors.hasKeywords && !factors.hasPatterns && !factors.hasCommonNames) {
    confidence *= 0.5; // Significant penalty if no direct matches
  }
  
  // Normalize to 0-1 range
  confidence = Math.min(Math.max(confidence, 0), 1);
  
  // Apply confidence bands
  if (confidence >= 0.9) {
    return DEFAULT_AI_CONFIDENCE_SCORES.HIGH;
  } else if (confidence >= 0.7) {
    return DEFAULT_AI_CONFIDENCE_SCORES.MEDIUM;
  } else if (confidence >= 0.5) {
    return DEFAULT_AI_CONFIDENCE_SCORES.LOW;
  } else {
    return DEFAULT_AI_CONFIDENCE_SCORES.VERY_LOW;
  }
}

/**
 * Adjust confidence based on component complexity
 */
export function adjustConfidenceForComplexity(
  baseConfidence: number,
  complexity: 'simple' | 'moderate' | 'complex'
): number {
  const adjustments = {
    simple: 1.1,
    moderate: 1.0,
    complex: 0.9
  };
  
  return Math.min(baseConfidence * adjustments[complexity], 1.0);
}

/**
 * Calculate aggregate confidence for multiple detection results
 */
export function calculateAggregateConfidence(confidences: number[]): number {
  if (confidences.length === 0) return 0;
  
  // Weight higher confidence scores more heavily
  const weightedSum = confidences.reduce((sum, conf, index) => {
    const weight = Math.pow(0.7, index); // Exponential decay
    return sum + conf * weight;
  }, 0);
  
  const totalWeight = confidences.reduce((sum, _, index) => {
    return sum + Math.pow(0.7, index);
  }, 0);
  
  return weightedSum / totalWeight;
}

/**
 * Determine confidence level description
 */
export function getConfidenceLevel(confidence: number): string {
  if (confidence >= DEFAULT_AI_CONFIDENCE_SCORES.HIGH) {
    return 'Very High';
  } else if (confidence >= DEFAULT_AI_CONFIDENCE_SCORES.MEDIUM) {
    return 'High';
  } else if (confidence >= DEFAULT_AI_CONFIDENCE_SCORES.LOW) {
    return 'Medium';
  } else if (confidence >= DEFAULT_AI_CONFIDENCE_SCORES.VERY_LOW) {
    return 'Low';
  } else {
    return 'Very Low';
  }
}

/**
 * Validate confidence score
 */
export function isValidConfidence(confidence: number): boolean {
  return confidence >= 0 && confidence <= 1;
}