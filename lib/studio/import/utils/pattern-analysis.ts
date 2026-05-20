import { ComponentPattern } from '../services/interfaces/component-type-extractor.interface'

/**
 * Calculate similarity between two component patterns
 * Returns a value between 0 (completely different) and 1 (identical)
 */
export function calculatePatternSimilarity(pattern1: ComponentPattern, pattern2: ComponentPattern): number {
  const weights = {
    structure: 0.4,  // Most important
    category: 0.2,
    type: 0.2,
    frequency: 0.1,
    confidence: 0.1
  }

  let totalSimilarity = 0

  // Structure similarity (most important)
  const structSimilarity = calculateStructureSimilarity(pattern1.structure, pattern2.structure)
  totalSimilarity += structSimilarity * weights.structure

  // Category similarity
  const categorySimilarity = pattern1.category === pattern2.category ? 1 : 0
  totalSimilarity += categorySimilarity * weights.category

  // Type similarity
  const typeSimilarity = pattern1.type === pattern2.type ? 1 : 0.5 // partial match for related types
  totalSimilarity += typeSimilarity * weights.type

  // Frequency similarity (normalized)
  const maxFreq = Math.max(pattern1.frequency, pattern2.frequency)
  const minFreq = Math.min(pattern1.frequency, pattern2.frequency)
  const frequencySimilarity = maxFreq > 0 ? minFreq / maxFreq : 0
  totalSimilarity += frequencySimilarity * weights.frequency

  // Confidence similarity
  const confidenceDiff = Math.abs(pattern1.confidence - pattern2.confidence)
  const confidenceSimilarity = 1 - confidenceDiff
  totalSimilarity += confidenceSimilarity * weights.confidence

  return Math.max(0, Math.min(1, totalSimilarity))
}

/**
 * Calculate similarity between two pattern structures
 */
function calculateStructureSimilarity(
  struct1: ComponentPattern['structure'], 
  struct2: ComponentPattern['structure']
): number {
  const weights = {
    hasText: 0.2,
    hasImage: 0.2,
    hasButton: 0.2,
    hasInput: 0.2,
    childCount: 0.1,
    depth: 0.1
  }

  let similarity = 0

  // Boolean properties (exact match)
  similarity += (struct1.hasText === struct2.hasText ? 1 : 0) * weights.hasText
  similarity += (struct1.hasImage === struct2.hasImage ? 1 : 0) * weights.hasImage
  similarity += (struct1.hasButton === struct2.hasButton ? 1 : 0) * weights.hasButton
  similarity += (struct1.hasInput === struct2.hasInput ? 1 : 0) * weights.hasInput

  // Numeric properties (relative similarity)
  const childCountSimilarity = calculateNumericSimilarity(struct1.childCount, struct2.childCount, 10)
  similarity += childCountSimilarity * weights.childCount

  const depthSimilarity = calculateNumericSimilarity(struct1.depth, struct2.depth, 5)
  similarity += depthSimilarity * weights.depth

  return similarity
}

/**
 * Calculate similarity between two numeric values with a maximum difference threshold
 */
function calculateNumericSimilarity(val1: number, val2: number, maxDiff: number): number {
  const diff = Math.abs(val1 - val2)
  return Math.max(0, 1 - (diff / maxDiff))
}

/**
 * Normalize pattern structure for consistent comparison
 */
export function normalizeStructure(structure: ComponentPattern['structure']): ComponentPattern['structure'] {
  return {
    hasText: Boolean(structure.hasText),
    hasImage: Boolean(structure.hasImage),
    hasButton: Boolean(structure.hasButton),
    hasInput: Boolean(structure.hasInput),
    childCount: Math.max(0, Math.floor(structure.childCount || 0)),
    depth: Math.max(0, Math.floor(structure.depth || 0))
  }
}

/**
 * Generate a unique fingerprint for a pattern structure
 */
export function generateStructureFingerprint(structure: ComponentPattern['structure']): string {
  const normalized = normalizeStructure(structure)
  return [
    normalized.hasText ? 'T' : 'F',
    normalized.hasImage ? 'I' : 'F',
    normalized.hasButton ? 'B' : 'F',
    normalized.hasInput ? 'N' : 'F',
    normalized.childCount.toString().padStart(2, '0'),
    normalized.depth.toString().padStart(2, '0')
  ].join('')
}

/**
 * Cluster patterns by similarity using hierarchical clustering
 */
export function clusterPatternsBySimilarity(
  patterns: ComponentPattern[], 
  threshold: number = 0.85
): ComponentPattern[][] {
  const clusters: ComponentPattern[][] = []
  const processed = new Set<number>()

  // Sort patterns by frequency (descending) to prioritize common patterns
  const sortedPatterns = patterns
    .map((pattern, index) => ({ pattern, originalIndex: index }))
    .sort((a, b) => b.pattern.frequency - a.pattern.frequency)

  for (let i = 0; i < sortedPatterns.length; i++) {
    const { pattern: currentPattern, originalIndex: currentIndex } = sortedPatterns[i]
    
    if (processed.has(currentIndex)) continue

    const cluster: ComponentPattern[] = [currentPattern]
    processed.add(currentIndex)

    // Find similar patterns
    for (let j = i + 1; j < sortedPatterns.length; j++) {
      const { pattern: comparePattern, originalIndex: compareIndex } = sortedPatterns[j]
      
      if (processed.has(compareIndex)) continue

      const similarity = calculatePatternSimilarity(currentPattern, comparePattern)
      if (similarity >= threshold) {
        cluster.push(comparePattern)
        processed.add(compareIndex)
      }
    }

    clusters.push(cluster)
  }

  return clusters
}

/**
 * Merge similar patterns within a cluster
 */
export function mergeClusterPatterns(cluster: ComponentPattern[]): ComponentPattern {
  if (cluster.length === 1) return cluster[0]

  // Use the pattern with highest frequency * confidence as the base
  const basePattern = cluster.reduce((best, current) => 
    (current.frequency * current.confidence) > (best.frequency * best.confidence) 
      ? current 
      : best
  )

  // Merge instances from all patterns in cluster
  const mergedInstances = cluster.flatMap(pattern => pattern.instances)
  
  // Calculate new frequency and confidence
  const totalFrequency = cluster.reduce((sum, pattern) => sum + pattern.frequency, 0)
  const avgConfidence = cluster.reduce((sum, pattern) => sum + pattern.confidence, 0) / cluster.length

  return {
    ...basePattern,
    instances: mergedInstances,
    frequency: totalFrequency,
    confidence: Math.min(1, avgConfidence + 0.1) // Boost confidence for merged patterns
  }
}

/**
 * Validate pattern quality based on multiple criteria
 */
export function validatePatternQuality(pattern: ComponentPattern): {
  isValid: boolean
  quality: number
  issues: string[]
} {
  const issues: string[] = []
  let quality = 1

  // Check minimum frequency
  if (pattern.frequency < 2) {
    issues.push('Low frequency (less than 2 instances)')
    quality -= 0.3
  }

  // Check confidence
  if (pattern.confidence < 0.3) {
    issues.push('Low confidence score')
    quality -= 0.2
  }

  // Check structure completeness
  const structure = pattern.structure
  if (!structure.hasText && !structure.hasImage && !structure.hasButton && !structure.hasInput) {
    issues.push('Empty structure (no content indicators)')
    quality -= 0.4
  }

  // Check for reasonable complexity
  if (structure.childCount === 0 && structure.depth === 0) {
    issues.push('Too simple (no children or depth)')
    quality -= 0.2
  }

  if (structure.childCount > 20) {
    issues.push('Too complex (too many children)')
    quality -= 0.1
  }

  const isValid = quality > 0.5
  quality = Math.max(0, Math.min(1, quality))

  return {
    isValid,
    quality,
    issues
  }
}

/**
 * Generate pattern statistics for analysis
 */
export function generatePatternStatistics(patterns: ComponentPattern[]): {
  total: number
  averageFrequency: number
  averageConfidence: number
  typeDistribution: Record<string, number>
  categoryDistribution: Record<string, number>
  structureComplexity: {
    simple: number    // 0-2 children
    medium: number    // 3-8 children  
    complex: number   // 9+ children
  }
} {
  const total = patterns.length
  const totalFrequency = patterns.reduce((sum, p) => sum + p.frequency, 0)
  const totalConfidence = patterns.reduce((sum, p) => sum + p.confidence, 0)

  const typeDistribution: Record<string, number> = {}
  const categoryDistribution: Record<string, number> = {}
  
  let simple = 0, medium = 0, complex = 0

  patterns.forEach(pattern => {
    // Type distribution
    typeDistribution[pattern.type] = (typeDistribution[pattern.type] || 0) + 1
    
    // Category distribution
    categoryDistribution[pattern.category] = (categoryDistribution[pattern.category] || 0) + 1
    
    // Complexity distribution
    const childCount = pattern.structure.childCount
    if (childCount <= 2) simple++
    else if (childCount <= 8) medium++
    else complex++
  })

  return {
    total,
    averageFrequency: total > 0 ? totalFrequency / total : 0,
    averageConfidence: total > 0 ? totalConfidence / total : 0,
    typeDistribution,
    categoryDistribution,
    structureComplexity: { simple, medium, complex }
  }
}