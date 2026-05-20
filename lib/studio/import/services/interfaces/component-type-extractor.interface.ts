import { WebsiteComponentType } from '@/lib/generated/prisma'

export interface DetectionResult {
  id: string
  type: string
  bounds: {
    x: number
    y: number
    width: number
    height: number
  }
  content?: string | Record<string, unknown>
  styles?: Record<string, unknown>
  children?: DetectionResult[]
  confidence?: number
  metadata?: Record<string, unknown>
}

export interface ComponentPattern {
  type: string
  category: string
  structure: {
    hasText: boolean
    hasImage: boolean
    hasButton: boolean
    hasInput: boolean
    childCount: number
    depth: number
  }
  instances: DetectionResult[]
  frequency: number
  confidence: number
  defaultConfig: Record<string, unknown>
  placeholderData: Record<string, unknown>
}

export type ComponentType = Omit<WebsiteComponentType, 'id' | 'createdAt' | 'updatedAt'> & {
  id?: string
  patterns: ComponentPattern[]
}

export interface IComponentTypeExtractor {
  /**
   * Extract patterns from detection results to identify component types
   */
  extractPatterns(detectionResults: DetectionResult[]): Promise<ComponentPattern[]>

  /**
   * Extract component types from detection results (convenience method for orchestrator).
   */
  extractComponentTypes(params: {
    detectionResults: DetectionResult[]
    websiteId: string
  }): Promise<ComponentPattern[]>

  /**
   * Reduce patterns to unique component types (target: <15 types from 50+ instances)
   */
  reduceToTypes(patterns: ComponentPattern[], websiteId: string): Promise<ComponentType[]>

  /**
   * Generate default configuration for a component pattern
   */
  generateDefaultConfig(pattern: ComponentPattern): Record<string, unknown>

  /**
   * Generate placeholder data for component previews
   */
  generatePlaceholderData(pattern: ComponentPattern): Record<string, unknown>

  /**
   * Calculate similarity between two patterns for deduplication
   */
  calculatePatternSimilarity(pattern1: ComponentPattern, pattern2: ComponentPattern): number

  /**
   * Normalize pattern data for consistent comparison
   */
  normalizePattern(pattern: ComponentPattern): ComponentPattern

  /**
   * Set confidence thresholds for pattern matching
   */
  setConfidenceThreshold(threshold: number): void

  /**
   * Get current confidence threshold
   */
  getConfidenceThreshold(): number
}

