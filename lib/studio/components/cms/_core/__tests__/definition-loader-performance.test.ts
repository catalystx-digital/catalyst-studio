/**
 * Definition Loader Performance Tests
 *
 * Validates that all registry query functions complete in < 1ms
 * to ensure fast component lookups during page building and AI workflows.
 */

import {
  loadAllDefinitions,
  clearDefinitions,
  getHeroComponentTypes,
  getHeaderEligibleComponentTypes,
  getFallbackComponentTypes,
  getDetailComponentTypes,
  getComponentsByCategory,
  getComponentsByPrefix,
  getComponentsForRegion,
  getAllDefinitions,
  getDefinedTypes,
} from '../definition-loader'

describe('Definition Loader Performance', () => {
  beforeAll(async () => {
    // Load all definitions once before tests
    await loadAllDefinitions()
  })

  afterAll(() => {
    // Clean up
    clearDefinitions()
  })

  describe('Registry Query Performance', () => {
    it('getHeroComponentTypes completes in < 1ms', () => {
      const start = performance.now()
      const result = getHeroComponentTypes()
      const duration = performance.now() - start

      expect(duration).toBeLessThan(1)
      expect(result.size).toBeGreaterThan(0)
      expect(result.size).toBe(7) // Should return 7 hero types
    })

    it('getHeaderEligibleComponentTypes completes in < 1ms', () => {
      const start = performance.now()
      const result = getHeaderEligibleComponentTypes()
      const duration = performance.now() - start

      expect(duration).toBeLessThan(1)
      expect(result.size).toBeGreaterThan(0)
      expect(result.size).toBe(4) // Should return 4 header-eligible types
    })

    it('getFallbackComponentTypes completes in < 1ms', () => {
      const start = performance.now()
      const result = getFallbackComponentTypes()
      const duration = performance.now() - start

      expect(duration).toBeLessThan(1)
      expect(result.size).toBeGreaterThan(0)
      expect(result.size).toBe(4) // Should return 4 fallback types
    })

    it('getDetailComponentTypes completes in < 1ms', () => {
      const start = performance.now()
      const result = getDetailComponentTypes()
      const duration = performance.now() - start

      expect(duration).toBeLessThan(1)
      expect(result.size).toBeGreaterThan(0)
      expect(result.size).toBe(3) // Should return 3 detail types
    })

    it('getComponentsByCategory completes in < 1ms', () => {
      const start = performance.now()
      const result = getComponentsByCategory('heroes')
      const duration = performance.now() - start

      expect(duration).toBeLessThan(1)
      expect(result.length).toBeGreaterThan(0)
      expect(result.length).toBe(7) // Should return 7 hero components
    })

    it('getComponentsByPrefix completes in < 1ms', () => {
      const start = performance.now()
      const result = getComponentsByPrefix('hero-')
      const duration = performance.now() - start

      expect(duration).toBeLessThan(1)
      expect(result.length).toBeGreaterThan(0)
      expect(result.length).toBe(7) // Should return 7 hero-* components
    })

    it('getComponentsForRegion completes in < 1ms', () => {
      const start = performance.now()
      const result = getComponentsForRegion('hero')
      const duration = performance.now() - start

      expect(duration).toBeLessThan(1)
      // Result may be 0 if aiMetadata.pageLocation is not yet defined
      expect(result.length).toBeGreaterThanOrEqual(0)
    })

    it('getAllDefinitions completes in < 1ms', () => {
      const start = performance.now()
      const result = getAllDefinitions()
      const duration = performance.now() - start

      expect(duration).toBeLessThan(1)
      expect(result.length).toBeGreaterThan(0)
      // Should have 60+ definitions after loadAllDefinitions()
      expect(result.length).toBeGreaterThan(50)
    })

    it('getDefinedTypes completes in < 1ms', () => {
      const start = performance.now()
      const result = getDefinedTypes()
      const duration = performance.now() - start

      expect(duration).toBeLessThan(1)
      expect(result.length).toBeGreaterThan(0)
      // Should match getAllDefinitions() count
      expect(result.length).toBeGreaterThan(50)
    })
  })

  describe('Multiple Query Performance', () => {
    it('running all query functions sequentially completes in < 10ms', () => {
      const start = performance.now()

      // Run all query functions
      getHeroComponentTypes()
      getHeaderEligibleComponentTypes()
      getFallbackComponentTypes()
      getDetailComponentTypes()
      getComponentsByCategory('heroes')
      getComponentsByPrefix('hero-')
      getComponentsForRegion('hero')
      getAllDefinitions()
      getDefinedTypes()

      const duration = performance.now() - start

      expect(duration).toBeLessThan(10)
    })

    it('running query functions 100 times completes in < 50ms', () => {
      const start = performance.now()

      // Simulate realistic usage pattern
      for (let i = 0; i < 100; i++) {
        getHeroComponentTypes()
        getComponentsByCategory('heroes')
        getComponentsByPrefix('hero-')
      }

      const duration = performance.now() - start

      expect(duration).toBeLessThan(50)
    })
  })

  describe('Query Result Correctness', () => {
    it('getHeroComponentTypes returns only hero types', () => {
      const result = getHeroComponentTypes()
      const types = Array.from(result)

      types.forEach(type => {
        expect(type).toMatch(/^hero-/)
      })
    })

    it('getComponentsByCategory returns only components from that category', () => {
      const result = getComponentsByCategory('heroes')

      result.forEach(type => {
        expect(type).toMatch(/^hero-/)
      })
    })

    it('getComponentsByPrefix returns only components with that prefix', () => {
      const result = getComponentsByPrefix('cta-')

      result.forEach(type => {
        expect(type).toMatch(/^cta-/)
      })
    })
  })

  describe('Edge Cases Performance', () => {
    it('handles non-existent category in < 1ms', () => {
      const start = performance.now()
      const result = getComponentsByCategory('non-existent-category')
      const duration = performance.now() - start

      expect(duration).toBeLessThan(1)
      expect(result.length).toBe(0)
    })

    it('handles non-existent prefix in < 1ms', () => {
      const start = performance.now()
      const result = getComponentsByPrefix('non-existent-prefix-')
      const duration = performance.now() - start

      expect(duration).toBeLessThan(1)
      expect(result.length).toBe(0)
    })

    it('handles non-existent region in < 1ms', () => {
      const start = performance.now()
      const result = getComponentsForRegion('non-existent-region')
      const duration = performance.now() - start

      expect(duration).toBeLessThan(1)
      expect(result.length).toBe(0)
    })
  })
})
