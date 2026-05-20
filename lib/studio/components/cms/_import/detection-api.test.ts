import { detectionAPI, DetectionAPI } from './detection-api'
import { ComponentType, ComponentCategory } from '../_core/types'
import { CMSComponentFactory } from '../_factory/factory'

jest.mock('../_factory/factory')

describe('DetectionAPI', () => {
  let api: DetectionAPI
  let mockFactory: any

  beforeEach(() => {
    mockFactory = {
      getRegistry: jest.fn(),
      getComponentCatalog: jest.fn(),
      getDetectionPatterns: jest.fn()
    }
    
    // Mock the factory getInstance before creating the API
    jest.spyOn(CMSComponentFactory, 'getInstance').mockReturnValue(mockFactory)
    
    // Now create the API instance with the mocked factory
    api = new DetectionAPI()
  })

  afterEach(() => {
    jest.clearAllMocks()
    api.clearCache()
  })

  describe('detectComponentPatterns', () => {
    it('should detect component patterns without filter', () => {
      const mockRegistry = new Map([
        [ComponentType.HeroMinimal, {
          component: jest.fn(),
          metadata: {
            keywords: ['hero', 'banner'],
            patterns: ['hero-section'],
            confidence: 0.9
          }
        }],
        [ComponentType.PricingTable, {
          component: jest.fn(),
          metadata: {
            keywords: ['pricing', 'plans'],
            patterns: ['pricing-table'],
            confidence: 0.85
          }
        }]
      ])

      mockFactory.getRegistry.mockReturnValue(mockRegistry)

      const patterns = api.detectComponentPatterns()

      expect(patterns).toHaveLength(2)
      expect(patterns[0].confidence).toBe(0.9) // Should be sorted by confidence
      expect(patterns[0].type).toBe(ComponentType.HeroMinimal)
      expect(patterns[1].confidence).toBe(0.85)
      expect(patterns[1].type).toBe(ComponentType.PricingTable)
    })

    it('should filter patterns by category', () => {
      const mockRegistry = new Map([
        [ComponentType.HeroMinimal, {
          component: jest.fn(),
          metadata: {
            keywords: ['hero'],
            confidence: 0.9
          }
        }],
        [ComponentType.PricingTable, {
          component: jest.fn(),
          metadata: {
            keywords: ['pricing'],
            confidence: 0.85
          }
        }]
      ])

      mockFactory.getRegistry.mockReturnValue(mockRegistry)

      const patterns = api.detectComponentPatterns({ category: ComponentCategory.Heroes })

      expect(patterns).toHaveLength(1)
      expect(patterns[0].type).toBe(ComponentType.HeroMinimal)
    })

    it('should filter patterns by minimum confidence', () => {
      const mockRegistry = new Map([
        [ComponentType.HeroMinimal, {
          component: jest.fn(),
          metadata: {
            keywords: ['hero'],
            confidence: 0.9
          }
        }],
        [ComponentType.PricingTable, {
          component: jest.fn(),
          metadata: {
            keywords: ['pricing'],
            confidence: 0.7
          }
        }]
      ])

      mockFactory.getRegistry.mockReturnValue(mockRegistry)

      const patterns = api.detectComponentPatterns({ minConfidence: 0.8 })

      expect(patterns).toHaveLength(1)
      expect(patterns[0].type).toBe(ComponentType.HeroMinimal)
    })

    it('should use cache for repeated calls', () => {
      const mockRegistry = new Map([
        [ComponentType.HeroMinimal, {
          component: jest.fn(),
          metadata: {
            keywords: ['hero'],
            confidence: 0.9
          }
        }]
      ])

      mockFactory.getRegistry.mockReturnValue(mockRegistry)

      // First call
      const patterns1 = api.detectComponentPatterns()
      // Second call should use cache
      const patterns2 = api.detectComponentPatterns()

      expect(patterns1).toBe(patterns2)
      expect(mockFactory.getRegistry).toHaveBeenCalledTimes(1) // Only called once due to caching
    })
  })

  describe('getPatternsByCategory', () => {
    it('should group patterns by category', () => {
      const mockRegistry = new Map([
        [ComponentType.HeroMinimal, {
          component: jest.fn(),
          metadata: { keywords: ['hero'], confidence: 0.9 }
        }],
        [ComponentType.HeroSplit, {
          component: jest.fn(),
          metadata: { keywords: ['hero', 'split'], confidence: 0.85 }
        }],
        [ComponentType.PricingTable, {
          component: jest.fn(),
          metadata: { keywords: ['pricing'], confidence: 0.8 }
        }]
      ])

      mockFactory.getRegistry.mockReturnValue(mockRegistry)

      const patternsByCategory = api.getPatternsByCategory()

      expect(patternsByCategory.size).toBeGreaterThan(0)
      
      const heroPatterns = patternsByCategory.get(ComponentCategory.Heroes)
      expect(heroPatterns).toBeDefined()
      expect(heroPatterns?.length).toBe(2)
      
      const pricingPatterns = patternsByCategory.get(ComponentCategory.Pricing)
      expect(pricingPatterns).toBeDefined()
      expect(pricingPatterns?.length).toBe(1)
    })
  })

  describe('getComponentPatterns', () => {
    it('should return patterns for specific component type', () => {
      const mockRegistry = new Map([
        [ComponentType.HeroMinimal, {
          component: jest.fn(),
          metadata: {
            keywords: ['hero', 'minimal'],
            patterns: ['hero-minimal'],
            confidence: 0.9
          }
        }]
      ])

      mockFactory.getRegistry.mockReturnValue(mockRegistry)

      const pattern = api.getComponentPatterns(ComponentType.HeroMinimal)

      expect(pattern).toBeDefined()
      expect(pattern?.type).toBe(ComponentType.HeroMinimal)
      expect(pattern?.confidence).toBe(0.9)
    })

    it('should return null for non-existent component type', () => {
      mockFactory.getRegistry.mockReturnValue(new Map())

      const pattern = api.getComponentPatterns(ComponentType.HeroMinimal)

      expect(pattern).toBeNull()
    })
  })

  describe('getAggregatedPatterns', () => {
    it('should aggregate keywords and patterns from all components', () => {
      const mockRegistry = new Map([
        [ComponentType.HeroMinimal, {
          component: jest.fn(),
          metadata: {
            keywords: ['hero', 'banner'],
            patterns: ['hero-section'],
            domPatterns: ['.hero', '[class*="hero"]']
          }
        }],
        [ComponentType.PricingTable, {
          component: jest.fn(),
          metadata: {
            keywords: ['pricing', 'plans'],
            patterns: ['pricing-table'],
            domPatterns: ['.pricing', 'table.pricing']
          }
        }]
      ])

      mockFactory.getRegistry.mockReturnValue(mockRegistry)

      const aggregated = api.getAggregatedPatterns()

      expect(aggregated.keywords.has('hero')).toBe(true)
      expect(aggregated.keywords.has('pricing')).toBe(true)
      expect(aggregated.patterns.has('hero-section')).toBe(true)
      expect(aggregated.patterns.has('pricing-table')).toBe(true)
      expect(aggregated.domSelectors.has('.hero')).toBe(true)
      expect(aggregated.domSelectors.has('.pricing')).toBe(true)
    })
  })

  describe('caching', () => {
    it('should clear cache when clearCache is called', () => {
      const mockRegistry = new Map([
        [ComponentType.HeroMinimal, {
          component: jest.fn(),
          metadata: { keywords: ['hero'], confidence: 0.9 }
        }]
      ])

      mockFactory.getRegistry.mockReturnValue(mockRegistry)

      // First call - loads data
      api.detectComponentPatterns()
      expect(mockFactory.getRegistry).toHaveBeenCalledTimes(1)

      // Clear cache
      api.clearCache()

      // Second call - should reload data
      api.detectComponentPatterns()
      expect(mockFactory.getRegistry).toHaveBeenCalledTimes(2)
    })

    it('should warm up cache for all categories', async () => {
      const mockRegistry = new Map()
      mockFactory.getRegistry.mockReturnValue(mockRegistry)

      await api.warmupCache()

      // Should have called detectComponentPatterns for unfiltered and each category
      expect(mockFactory.getRegistry).toHaveBeenCalled()
    })
  })
})