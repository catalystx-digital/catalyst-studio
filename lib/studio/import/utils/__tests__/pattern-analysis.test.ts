import {
  calculatePatternSimilarity,
  normalizeStructure,
  generateStructureFingerprint,
  clusterPatternsBySimilarity,
  mergeClusterPatterns,
  validatePatternQuality,
  generatePatternStatistics
} from '../pattern-analysis'
import { ComponentPattern } from '../../services/interfaces/component-type-extractor.interface'

describe('pattern-analysis utilities', () => {
  describe('calculatePatternSimilarity', () => {
    const basePattern: ComponentPattern = {
      type: 'hero',
      category: 'hero',
      structure: { hasText: true, hasImage: true, hasButton: true, hasInput: false, childCount: 3, depth: 1 },
      instances: [],
      frequency: 5,
      confidence: 0.9,
      defaultConfig: {},
      placeholderData: {}
    }

    it('should return 1.0 for identical patterns', () => {
      const pattern1 = { ...basePattern }
      const pattern2 = { ...basePattern }

      const similarity = calculatePatternSimilarity(pattern1, pattern2)
      expect(similarity).toBeCloseTo(1.0, 2)
    })

    it('should return high similarity for very similar patterns', () => {
      const pattern1 = { ...basePattern }
      const pattern2 = { 
        ...basePattern,
        frequency: 4, // Slightly different frequency
        confidence: 0.85 // Slightly different confidence
      }

      const similarity = calculatePatternSimilarity(pattern1, pattern2)
      expect(similarity).toBeGreaterThan(0.9)
    })

    it('should return low similarity for different patterns', () => {
      const pattern1 = { ...basePattern }
      const pattern2: ComponentPattern = {
        type: 'footer',
        category: 'footer',
        structure: { hasText: false, hasImage: false, hasButton: false, hasInput: true, childCount: 10, depth: 3 },
        instances: [],
        frequency: 2,
        confidence: 0.6,
        defaultConfig: {},
        placeholderData: {}
      }

      const similarity = calculatePatternSimilarity(pattern1, pattern2)
      expect(similarity).toBeLessThan(0.4)
    })

    it('should weight structure similarity most heavily', () => {
      const pattern1 = { ...basePattern }
      const pattern2 = {
        ...basePattern,
        type: 'different-type',
        category: 'different-category',
        // Structure remains the same
      }

      const similarity = calculatePatternSimilarity(pattern1, pattern2)
      expect(similarity).toBeGreaterThan(0.6) // Should still be relatively high due to structure match
    })

    it('should handle edge cases gracefully', () => {
      const pattern1 = { ...basePattern, frequency: 0, confidence: 0 }
      const pattern2 = { ...basePattern, frequency: 0, confidence: 0 }

      const similarity = calculatePatternSimilarity(pattern1, pattern2)
      expect(similarity).toBeGreaterThanOrEqual(0)
      expect(similarity).toBeLessThanOrEqual(1)
    })
  })

  describe('normalizeStructure', () => {
    it('should normalize boolean values', () => {
      const structure = {
        hasText: 1 as any,
        hasImage: 0 as any,
        hasButton: 'true' as any,
        hasInput: null as any,
        childCount: 3.7,
        depth: -1
      }

      const normalized = normalizeStructure(structure)

      expect(normalized.hasText).toBe(true)
      expect(normalized.hasImage).toBe(false)
      expect(normalized.hasButton).toBe(true)
      expect(normalized.hasInput).toBe(false)
    })

    it('should normalize numeric values', () => {
      const structure = {
        hasText: true,
        hasImage: false,
        hasButton: false,
        hasInput: false,
        childCount: 5.9,
        depth: -2.3
      }

      const normalized = normalizeStructure(structure)

      expect(normalized.childCount).toBe(5)
      expect(normalized.depth).toBe(0) // Should clamp negative to 0
    })

    it('should handle undefined/null values', () => {
      const structure = {
        hasText: undefined as any,
        hasImage: null as any,
        hasButton: false,
        hasInput: true,
        childCount: undefined as any,
        depth: null as any
      }

      const normalized = normalizeStructure(structure)

      expect(normalized.hasText).toBe(false)
      expect(normalized.hasImage).toBe(false)
      expect(normalized.childCount).toBe(0)
      expect(normalized.depth).toBe(0)
    })
  })

  describe('generateStructureFingerprint', () => {
    it('should generate consistent fingerprints for same structure', () => {
      const structure = {
        hasText: true,
        hasImage: false,
        hasButton: true,
        hasInput: false,
        childCount: 5,
        depth: 2
      }

      const fingerprint1 = generateStructureFingerprint(structure)
      const fingerprint2 = generateStructureFingerprint(structure)

      expect(fingerprint1).toBe(fingerprint2)
      expect(fingerprint1).toBe('TFBF0502')
    })

    it('should generate different fingerprints for different structures', () => {
      const structure1 = {
        hasText: true,
        hasImage: true,
        hasButton: false,
        hasInput: false,
        childCount: 3,
        depth: 1
      }

      const structure2 = {
        hasText: false,
        hasImage: false,
        hasButton: true,
        hasInput: true,
        childCount: 8,
        depth: 3
      }

      const fingerprint1 = generateStructureFingerprint(structure1)
      const fingerprint2 = generateStructureFingerprint(structure2)

      expect(fingerprint1).not.toBe(fingerprint2)
      expect(fingerprint1).toBe('TIFF0301')
      expect(fingerprint2).toBe('FFBN0803')
    })
  })

  describe('clusterPatternsBySimilarity', () => {
    const createTestPattern = (
      type: string, 
      category: string, 
      frequency: number,
      structure: Partial<ComponentPattern['structure']> = {}
    ): ComponentPattern => ({
      type,
      category,
      structure: {
        hasText: true,
        hasImage: false,
        hasButton: false,
        hasInput: false,
        childCount: 2,
        depth: 1,
        ...structure
      },
      instances: [],
      frequency,
      confidence: 0.8,
      defaultConfig: {},
      placeholderData: {}
    })

    it('should cluster similar patterns together', () => {
      const patterns = [
        createTestPattern('hero-1', 'hero', 5, { hasText: true, hasButton: true }),
        createTestPattern('hero-2', 'hero', 3, { hasText: true, hasButton: true }),
        createTestPattern('card-1', 'content', 4, { hasText: true, hasImage: true }),
        createTestPattern('card-2', 'content', 2, { hasText: true, hasImage: true })
      ]

      const clusters = clusterPatternsBySimilarity(patterns, 0.8)

      expect(clusters).toHaveLength(2)
      
      // Find hero and content clusters
      const heroClusters = clusters.filter(cluster => 
        cluster.some(p => p.category === 'hero')
      )
      const contentClusters = clusters.filter(cluster => 
        cluster.some(p => p.category === 'content')
      )

      expect(heroClusters).toHaveLength(1)
      expect(contentClusters).toHaveLength(1)
      expect(heroClusters[0]).toHaveLength(2)
      expect(contentClusters[0]).toHaveLength(2)
    })

    it('should create separate clusters when similarity is low', () => {
      const patterns = [
        createTestPattern('hero', 'hero', 5, { hasText: true, hasButton: true }),
        createTestPattern('footer', 'footer', 3, { hasText: false, hasInput: true, childCount: 10 })
      ]

      const clusters = clusterPatternsBySimilarity(patterns, 0.8)

      expect(clusters).toHaveLength(2)
      expect(clusters[0]).toHaveLength(1)
      expect(clusters[1]).toHaveLength(1)
    })

    it('should prioritize patterns by frequency', () => {
      const patterns = [
        createTestPattern('low-freq', 'content', 1),
        createTestPattern('high-freq', 'content', 10),
        createTestPattern('medium-freq', 'content', 5)
      ]

      const clusters = clusterPatternsBySimilarity(patterns, 0.8)

      // All should cluster together due to high similarity
      expect(clusters).toHaveLength(1)
      expect(clusters[0]).toHaveLength(3)
      
      // The cluster representative (first pattern) should be the highest frequency
      expect(clusters[0][0].frequency).toBe(10)
    })

    it('should handle empty pattern array', () => {
      const clusters = clusterPatternsBySimilarity([], 0.8)
      expect(clusters).toHaveLength(0)
    })

    it('should handle single pattern', () => {
      const patterns = [createTestPattern('single', 'content', 1)]
      const clusters = clusterPatternsBySimilarity(patterns, 0.8)

      expect(clusters).toHaveLength(1)
      expect(clusters[0]).toHaveLength(1)
    })
  })

  describe('mergeClusterPatterns', () => {
    it('should return single pattern unchanged', () => {
      const pattern = {
        type: 'test',
        category: 'test',
        structure: { hasText: true, hasImage: false, hasButton: false, hasInput: false, childCount: 1, depth: 1 },
        instances: [{ id: '1', type: 'test', bounds: { x: 0, y: 0, width: 100, height: 100 } }],
        frequency: 1,
        confidence: 0.8,
        defaultConfig: {},
        placeholderData: {}
      }

      const merged = mergeClusterPatterns([pattern])
      expect(merged).toEqual(pattern)
    })

    it('should merge multiple patterns correctly', () => {
      const pattern1 = {
        type: 'hero-1',
        category: 'hero',
        structure: { hasText: true, hasImage: false, hasButton: true, hasInput: false, childCount: 2, depth: 1 },
        instances: [
          { id: '1', type: 'hero', bounds: { x: 0, y: 0, width: 800, height: 400 } },
          { id: '2', type: 'hero', bounds: { x: 0, y: 500, width: 800, height: 400 } }
        ],
        frequency: 2,
        confidence: 0.9,
        defaultConfig: {},
        placeholderData: {}
      }

      const pattern2 = {
        type: 'hero-2',
        category: 'hero',
        structure: { hasText: true, hasImage: false, hasButton: true, hasInput: false, childCount: 2, depth: 1 },
        instances: [
          { id: '3', type: 'hero', bounds: { x: 0, y: 1000, width: 800, height: 400 } }
        ],
        frequency: 1,
        confidence: 0.8,
        defaultConfig: {},
        placeholderData: {}
      }

      const merged = mergeClusterPatterns([pattern1, pattern2])

      expect(merged.instances).toHaveLength(3)
      expect(merged.frequency).toBe(3)
      expect(merged.confidence).toBeCloseTo(1.0, 1) // Should be boosted
      expect(merged.type).toBe('hero-1') // Should use the pattern with higher frequency * confidence
    })

    it('should select best representative pattern', () => {
      const lowQualityPattern = {
        type: 'low',
        category: 'test',
        structure: { hasText: true, hasImage: false, hasButton: false, hasInput: false, childCount: 1, depth: 1 },
        instances: [],
        frequency: 1,
        confidence: 0.5,
        defaultConfig: {},
        placeholderData: {}
      }

      const highQualityPattern = {
        type: 'high',
        category: 'test',
        structure: { hasText: true, hasImage: false, hasButton: false, hasInput: false, childCount: 1, depth: 1 },
        instances: [],
        frequency: 5,
        confidence: 0.9,
        defaultConfig: {},
        placeholderData: {}
      }

      const merged = mergeClusterPatterns([lowQualityPattern, highQualityPattern])

      expect(merged.type).toBe('high')
    })
  })

  describe('validatePatternQuality', () => {
    it('should validate high-quality patterns', () => {
      const pattern: ComponentPattern = {
        type: 'hero',
        category: 'hero',
        structure: { hasText: true, hasImage: true, hasButton: true, hasInput: false, childCount: 3, depth: 1 },
        instances: [],
        frequency: 5,
        confidence: 0.9,
        defaultConfig: {},
        placeholderData: {}
      }

      const validation = validatePatternQuality(pattern)

      expect(validation.isValid).toBe(true)
      expect(validation.quality).toBeGreaterThan(0.8)
      expect(validation.issues).toHaveLength(0)
    })

    it('should identify low-frequency patterns', () => {
      const pattern: ComponentPattern = {
        type: 'rare',
        category: 'content',
        structure: { hasText: true, hasImage: false, hasButton: false, hasInput: false, childCount: 1, depth: 1 },
        instances: [],
        frequency: 1,
        confidence: 0.9,
        defaultConfig: {},
        placeholderData: {}
      }

      const validation = validatePatternQuality(pattern)

      expect(validation.issues).toContain('Low frequency (less than 2 instances)')
      expect(validation.quality).toBeLessThan(1.0)
    })

    it('should identify low-confidence patterns', () => {
      const pattern: ComponentPattern = {
        type: 'uncertain',
        category: 'content',
        structure: { hasText: true, hasImage: false, hasButton: false, hasInput: false, childCount: 2, depth: 1 },
        instances: [],
        frequency: 5,
        confidence: 0.2,
        defaultConfig: {},
        placeholderData: {}
      }

      const validation = validatePatternQuality(pattern)

      expect(validation.issues).toContain('Low confidence score')
      expect(validation.quality).toBeLessThan(0.9)
    })

    it('should identify empty structure patterns', () => {
      const pattern: ComponentPattern = {
        type: 'empty',
        category: 'content',
        structure: { hasText: false, hasImage: false, hasButton: false, hasInput: false, childCount: 0, depth: 0 },
        instances: [],
        frequency: 3,
        confidence: 0.8,
        defaultConfig: {},
        placeholderData: {}
      }

      const validation = validatePatternQuality(pattern)

      expect(validation.issues).toContain('Empty structure (no content indicators)')
      expect(validation.issues).toContain('Too simple (no children or depth)')
      expect(validation.quality).toBeLessThan(0.5)
    })

    it('should identify overly complex patterns', () => {
      const pattern: ComponentPattern = {
        type: 'complex',
        category: 'layout',
        structure: { hasText: true, hasImage: true, hasButton: true, hasInput: true, childCount: 25, depth: 1 },
        instances: [],
        frequency: 3,
        confidence: 0.8,
        defaultConfig: {},
        placeholderData: {}
      }

      const validation = validatePatternQuality(pattern)

      expect(validation.issues).toContain('Too complex (too many children)')
    })

    it('should mark invalid patterns correctly', () => {
      const pattern: ComponentPattern = {
        type: 'invalid',
        category: 'content',
        structure: { hasText: false, hasImage: false, hasButton: false, hasInput: false, childCount: 0, depth: 0 },
        instances: [],
        frequency: 1,
        confidence: 0.1,
        defaultConfig: {},
        placeholderData: {}
      }

      const validation = validatePatternQuality(pattern)

      expect(validation.isValid).toBe(false)
      expect(validation.quality).toBeLessThanOrEqual(0.5)
    })
  })

  describe('generatePatternStatistics', () => {
    it('should generate comprehensive statistics', () => {
      const patterns: ComponentPattern[] = [
        {
          type: 'hero',
          category: 'hero',
          structure: { hasText: true, hasImage: true, hasButton: true, hasInput: false, childCount: 2, depth: 1 },
          instances: [],
          frequency: 5,
          confidence: 0.9,
          defaultConfig: {},
          placeholderData: {}
        },
        {
          type: 'card',
          category: 'content',
          structure: { hasText: true, hasImage: true, hasButton: false, hasInput: false, childCount: 1, depth: 1 },
          instances: [],
          frequency: 8,
          confidence: 0.8,
          defaultConfig: {},
          placeholderData: {}
        },
        {
          type: 'section',
          category: 'layout',
          structure: { hasText: true, hasImage: false, hasButton: false, hasInput: false, childCount: 15, depth: 2 },
          instances: [],
          frequency: 3,
          confidence: 0.7,
          defaultConfig: {},
          placeholderData: {}
        }
      ]

      const stats = generatePatternStatistics(patterns)

      expect(stats.total).toBe(3)
      expect(stats.averageFrequency).toBeCloseTo(5.33, 1)
      expect(stats.averageConfidence).toBeCloseTo(0.8, 1)

      expect(stats.typeDistribution).toEqual({
        hero: 1,
        card: 1,
        section: 1
      })

      expect(stats.categoryDistribution).toEqual({
        hero: 1,
        content: 1,
        layout: 1
      })

      expect(stats.structureComplexity.simple).toBe(2) // hero and card have <= 2 children
      expect(stats.structureComplexity.medium).toBe(0)
      expect(stats.structureComplexity.complex).toBe(1) // section has 15 children
    })

    it('should handle empty pattern array', () => {
      const stats = generatePatternStatistics([])

      expect(stats.total).toBe(0)
      expect(stats.averageFrequency).toBe(0)
      expect(stats.averageConfidence).toBe(0)
      expect(Object.keys(stats.typeDistribution)).toHaveLength(0)
      expect(Object.keys(stats.categoryDistribution)).toHaveLength(0)
      expect(stats.structureComplexity.simple).toBe(0)
      expect(stats.structureComplexity.medium).toBe(0)
      expect(stats.structureComplexity.complex).toBe(0)
    })

    it('should correctly categorize complexity levels', () => {
      const patterns: ComponentPattern[] = [
        // Simple: 0 children
        {
          type: 'simple-0',
          category: 'content',
          structure: { hasText: true, hasImage: false, hasButton: false, hasInput: false, childCount: 0, depth: 0 },
          instances: [], frequency: 1, confidence: 0.8, defaultConfig: {}, placeholderData: {}
        },
        // Simple: 2 children
        {
          type: 'simple-2',
          category: 'content',
          structure: { hasText: true, hasImage: false, hasButton: false, hasInput: false, childCount: 2, depth: 1 },
          instances: [], frequency: 1, confidence: 0.8, defaultConfig: {}, placeholderData: {}
        },
        // Medium: 5 children
        {
          type: 'medium-5',
          category: 'layout',
          structure: { hasText: true, hasImage: false, hasButton: false, hasInput: false, childCount: 5, depth: 2 },
          instances: [], frequency: 1, confidence: 0.8, defaultConfig: {}, placeholderData: {}
        },
        // Medium: 8 children
        {
          type: 'medium-8',
          category: 'layout',
          structure: { hasText: true, hasImage: false, hasButton: false, hasInput: false, childCount: 8, depth: 2 },
          instances: [], frequency: 1, confidence: 0.8, defaultConfig: {}, placeholderData: {}
        },
        // Complex: 12 children
        {
          type: 'complex-12',
          category: 'layout',
          structure: { hasText: true, hasImage: false, hasButton: false, hasInput: false, childCount: 12, depth: 3 },
          instances: [], frequency: 1, confidence: 0.8, defaultConfig: {}, placeholderData: {}
        }
      ]

      const stats = generatePatternStatistics(patterns)

      expect(stats.structureComplexity.simple).toBe(2)
      expect(stats.structureComplexity.medium).toBe(2)
      expect(stats.structureComplexity.complex).toBe(1)
    })
  })
})