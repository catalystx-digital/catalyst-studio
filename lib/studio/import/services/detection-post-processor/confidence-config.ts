/**
 * Confidence Threshold Configuration
 *
 * Controls when processors should skip modifications based on LLM confidence.
 * This prevents processors from overriding high-confidence LLM detections.
 *
 * Key Principle: If the LLM is confident about a component type, trust it.
 *
 * @module confidence-config
 */

import type { DetectedComponent } from '@/lib/studio/import/detection/types'

/**
 * Threshold configuration for processor decisions
 */
export interface ConfidenceThresholds {
  /**
   * If component confidence > this threshold, skip post-processor modifications.
   * Default: 0.85 (85% confidence = trust LLM)
   */
  skipProcessingThreshold: number

  /**
   * If component confidence < this threshold, flag for manual review.
   * Post-processors won't auto-correct uncertain detections.
   * Default: 0.50 (50% confidence = too uncertain to auto-correct)
   */
  flagForReviewThreshold: number
}

/**
 * Default confidence thresholds applied to all processors
 */
export const DEFAULT_CONFIDENCE_THRESHOLDS: ConfidenceThresholds = {
  skipProcessingThreshold: 0.85, // Trust LLM when very confident
  flagForReviewThreshold: 0.50  // Don't auto-correct when LLM is uncertain
}

/**
 * Per-processor threshold overrides
 *
 * Some processors are more reliable or have different risk profiles:
 * - Region assignment: Reliable, use defaults
 * - Navigation: Can be risky, higher skip threshold
 * - Content tagging: Additive (doesn't change types), always run
 * - Type-changing: Should respect LLM confidence
 */
export const PROCESSOR_THRESHOLDS: Record<string, Partial<ConfidenceThresholds>> = {
  // Region assignment is reliable and additive, use defaults
  headerRegions: {},
  heroRegions: {},

  // Navigation processing can be risky (merges components), higher skip threshold
  navigationNormalize: { skipProcessingThreshold: 0.90 },

  // Content tagging is additive (doesn't change types), always run
  // skipProcessingThreshold: 1.0 means "never skip" (confidence can't exceed 1.0)
  tagPageComponents: { skipProcessingThreshold: 1.0 },
  tagListingComponents: { skipProcessingThreshold: 1.0 },

  // JSON unwrapping is structural (doesn't change types), always run
  jsonUnwrap: { skipProcessingThreshold: 1.0 },

  // Hero background promotion is additive, always run
  heroBackground: { skipProcessingThreshold: 1.0 },

  // Image enrichment is additive (adds missing images), always run
  imageEnrichment: { skipProcessingThreshold: 1.0 },

  // CTA cleanup removes duplicates (safe), always run
  ctaCleanup: { skipProcessingThreshold: 1.0 },

  // Type-changing processors should respect LLM confidence more strictly
  heroCTAMerger: { skipProcessingThreshold: 0.80 },
  heroCtaMerge: { skipProcessingThreshold: 0.80 }, // Alias for telemetry name
  promoteContentFeeds: { skipProcessingThreshold: 0.80 },
  contentFeedPromotion: { skipProcessingThreshold: 0.80 }, // Alias for telemetry name
  contentFeedFromAnchors: { skipProcessingThreshold: 0.80 }
}

/**
 * Determines if a processor should be skipped based on average component confidence.
 *
 * @param processorName - Name of the processor (matches telemetry names)
 * @param components - Components to process (average confidence is calculated)
 * @returns true if processor should be skipped
 */
export function shouldSkipProcessor(
  processorName: string,
  components: DetectedComponent[]
): boolean {
  if (components.length === 0) {
    return false
  }

  const avgConfidence = calculateAverageConfidence(components)
  const threshold = getThresholdForProcessor(processorName)

  return avgConfidence > threshold
}

/**
 * Determines if a processor should skip a specific component.
 *
 * @param processorName - Name of the processor
 * @param componentConfidence - Confidence score of the component (0-1)
 * @returns true if component should be skipped
 */
export function shouldSkipComponent(
  processorName: string,
  componentConfidence: number
): boolean {
  const threshold = getThresholdForProcessor(processorName)
  return componentConfidence > threshold
}

/**
 * Determines if components should be flagged for manual review
 * instead of being auto-corrected.
 *
 * @param components - Components to check
 * @returns true if components should be flagged for review
 */
export function shouldFlagForReview(
  components: DetectedComponent[]
): boolean {
  if (components.length === 0) {
    return false
  }

  const avgConfidence = calculateAverageConfidence(components)
  return avgConfidence < DEFAULT_CONFIDENCE_THRESHOLDS.flagForReviewThreshold
}

/**
 * Gets the skip threshold for a specific processor.
 *
 * @param processorName - Name of the processor
 * @returns Skip threshold (0-1)
 */
export function getThresholdForProcessor(processorName: string): number {
  return PROCESSOR_THRESHOLDS[processorName]?.skipProcessingThreshold
    ?? DEFAULT_CONFIDENCE_THRESHOLDS.skipProcessingThreshold
}

/**
 * Calculates the average confidence across components.
 *
 * @param components - Components to calculate average for
 * @returns Average confidence (0-1)
 */
export function calculateAverageConfidence(
  components: DetectedComponent[]
): number {
  if (components.length === 0) {
    return 0
  }

  const totalConfidence = components.reduce(
    (sum, c) => sum + (c.confidence || 0),
    0
  )

  return totalConfidence / components.length
}

/**
 * Result of confidence-based skip check with logging info
 */
export interface SkipCheckResult {
  shouldSkip: boolean
  avgConfidence: number
  threshold: number
  reason: string
}

/**
 * Checks if processor should be skipped and returns detailed info for logging.
 *
 * @param processorName - Name of the processor
 * @param components - Components to process
 * @returns Detailed skip check result
 */
export function checkProcessorSkip(
  processorName: string,
  components: DetectedComponent[]
): SkipCheckResult {
  const avgConfidence = calculateAverageConfidence(components)
  const threshold = getThresholdForProcessor(processorName)
  const shouldSkip = avgConfidence > threshold

  const reason = shouldSkip
    ? `Skipping: avg confidence ${avgConfidence.toFixed(2)} > threshold ${threshold}`
    : `Running: avg confidence ${avgConfidence.toFixed(2)} <= threshold ${threshold}`

  return {
    shouldSkip,
    avgConfidence,
    threshold,
    reason
  }
}
