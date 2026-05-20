import { ComponentTypeExtractor } from '../component-type-extractor'
import { PrismaClient } from '@prisma/client'
import { DetectionResult } from '../interfaces/component-type-extractor.interface'

// Mock Prisma
jest.mock('@prisma/client')
const MockPrismaClient = PrismaClient as jest.MockedClass<typeof PrismaClient>

describe('ComponentTypeExtractor Integration Tests', () => {
  let extractor: ComponentTypeExtractor
  let mockPrisma: jest.Mocked<PrismaClient>
  const websiteId = 'integration-site'

  beforeEach(() => {
    mockPrisma = new MockPrismaClient() as jest.Mocked<PrismaClient>
    extractor = new ComponentTypeExtractor(mockPrisma)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('Real-world website import scenarios', () => {
    it('should handle a typical e-commerce website import', async () => {
      // Simulate detection results from a real e-commerce site
      const ecommerceDetectionResults: DetectionResult[] = [
        // Header/Navigation
        {
          id: 'header-1',
          type: 'navigation',
          bounds: { x: 0, y: 0, width: 1200, height: 80 },
          content: 'Home | Products | About | Contact',
          metadata: { hasText: true, hasButton: false, hasImage: true },
          confidence: 0.95,
          children: [
            { id: 'nav-logo', type: 'logo', bounds: { x: 20, y: 20, width: 100, height: 40 } },
            { id: 'nav-menu', type: 'menu', bounds: { x: 200, y: 30, width: 400, height: 20 } }
          ]
        },
        
        // Hero sections on different pages
        {
          id: 'hero-homepage',
          type: 'hero',
          bounds: { x: 0, y: 80, width: 1200, height: 500 },
          content: 'Welcome to our amazing store - Shop the latest trends',
          metadata: { hasText: true, hasButton: true, hasImage: true },
          confidence: 0.92,
          children: [
            { id: 'hero-title', type: 'heading', bounds: { x: 100, y: 200, width: 800, height: 80 } },
            { id: 'hero-cta', type: 'button', bounds: { x: 100, y: 320, width: 200, height: 50 } }
          ]
        },
        {
          id: 'hero-products',
          type: 'hero',
          bounds: { x: 0, y: 80, width: 1200, height: 400 },
          content: 'Discover our products - Quality guaranteed',
          metadata: { hasText: true, hasButton: true, hasImage: true },
          confidence: 0.88,
          children: [
            { id: 'product-hero-title', type: 'heading', bounds: { x: 100, y: 180, width: 800, height: 60 } },
            { id: 'product-hero-cta', type: 'button', bounds: { x: 100, y: 280, width: 180, height: 45 } }
          ]
        },

        // Product cards (multiple instances)
        {
          id: 'card-1',
          type: 'product',
          bounds: { x: 50, y: 600, width: 280, height: 350 },
          content: 'Studio Widget - $29.99',
          metadata: { hasText: true, hasButton: true, hasImage: true },
          confidence: 0.91,
          children: [
            { id: 'card-1-image', type: 'image', bounds: { x: 60, y: 620, width: 260, height: 200 } },
            { id: 'card-1-title', type: 'heading', bounds: { x: 60, y: 830, width: 260, height: 30 } },
            { id: 'card-1-price', type: 'text', bounds: { x: 60, y: 870, width: 100, height: 20 } },
            { id: 'card-1-button', type: 'button', bounds: { x: 60, y: 900, width: 120, height: 35 } }
          ]
        },
        {
          id: 'card-2',
          type: 'product',
          bounds: { x: 350, y: 600, width: 280, height: 350 },
          content: 'Deluxe Gadget - $49.99',
          metadata: { hasText: true, hasButton: true, hasImage: true },
          confidence: 0.89,
          children: [
            { id: 'card-2-image', type: 'image', bounds: { x: 360, y: 620, width: 260, height: 200 } },
            { id: 'card-2-title', type: 'heading', bounds: { x: 360, y: 830, width: 260, height: 30 } },
            { id: 'card-2-price', type: 'text', bounds: { x: 360, y: 870, width: 100, height: 20 } },
            { id: 'card-2-button', type: 'button', bounds: { x: 360, y: 900, width: 120, height: 35 } }
          ]
        },
        {
          id: 'card-3',
          type: 'product',
          bounds: { x: 650, y: 600, width: 280, height: 350 },
          content: 'Standard Tool - $19.99',
          metadata: { hasText: true, hasButton: true, hasImage: true },
          confidence: 0.87,
          children: [
            { id: 'card-3-image', type: 'image', bounds: { x: 660, y: 620, width: 260, height: 200 } },
            { id: 'card-3-title', type: 'heading', bounds: { x: 660, y: 830, width: 260, height: 30 } },
            { id: 'card-3-price', type: 'text', bounds: { x: 660, y: 870, width: 100, height: 20 } },
            { id: 'card-3-button', type: 'button', bounds: { x: 660, y: 900, width: 120, height: 35 } }
          ]
        },

        // Contact form
        {
          id: 'contact-form',
          type: 'form',
          bounds: { x: 200, y: 1000, width: 600, height: 400 },
          content: 'Contact us for more information',
          metadata: { hasText: true, hasButton: true, hasInput: true, hasImage: false },
          confidence: 0.94,
          children: [
            { id: 'form-title', type: 'heading', bounds: { x: 220, y: 1020, width: 560, height: 40 } },
            { id: 'form-name', type: 'input', bounds: { x: 220, y: 1080, width: 260, height: 35 } },
            { id: 'form-email', type: 'input', bounds: { x: 520, y: 1080, width: 260, height: 35 } },
            { id: 'form-message', type: 'textarea', bounds: { x: 220, y: 1130, width: 560, height: 120 } },
            { id: 'form-submit', type: 'button', bounds: { x: 220, y: 1270, width: 150, height: 40 } }
          ]
        },

        // Footer
        {
          id: 'footer',
          type: 'footer',
          bounds: { x: 0, y: 1500, width: 1200, height: 200 },
          content: 'Copyright 2024 | Privacy Policy | Terms of Service',
          metadata: { hasText: true, hasButton: false, hasImage: false, hasInput: false },
          confidence: 0.96,
          children: Array.from({ length: 8 }, (_, i) => ({
            id: `footer-link-${i}`,
            type: 'link',
            bounds: { x: 100 + i * 120, y: 1550, width: 100, height: 20 }
          }))
        }
      ]

      // Step 1: Extract patterns
      const patterns = await extractor.extractPatterns(ecommerceDetectionResults)
      
      // Should identify distinct patterns
      expect(patterns.length).toBeGreaterThan(3)
      expect(patterns.length).toBeLessThan(8)

      // Verify pattern types
      const patternTypes = patterns.map(p => p.type)
      expect(patternTypes).toContain('hero')
      expect(patternTypes).toContain('product')
      expect(patternTypes).toContain('navigation')

      // Step 2: Reduce to component types
      const componentTypes = await extractor.reduceToTypes(patterns, websiteId)

      // Should achieve the target reduction
      expect(componentTypes.length).toBeLessThan(6)
      expect(componentTypes.length).toBeGreaterThan(3)

      // Verify component type quality
      componentTypes.forEach(componentType => {
        expect(componentType.type).toBeDefined()
        expect(componentType.category).toBeDefined()
        expect(componentType.props).toBeDefined()
        expect(componentType.aiMetadata).toBeDefined()
        expect(componentType.aiMetadata.confidence).toBeGreaterThan(0.5)
      })

      // Verify patterns are preserved
      const totalInstances = componentTypes.reduce((sum, ct) => 
        sum + ct.patterns.reduce((patternSum, pattern) => 
          patternSum + pattern.instances.length, 0), 0)
      expect(totalInstances).toBe(ecommerceDetectionResults.length)
    })

    it('should handle a blog/content website import', async () => {
      const blogDetectionResults: DetectionResult[] = [
        // Blog header
        {
          id: 'blog-header',
          type: 'header',
          bounds: { x: 0, y: 0, width: 1000, height: 120 },
          content: 'Tech Blog | Latest Articles',
          metadata: { hasText: true, hasImage: true, hasButton: false },
          confidence: 0.93
        },

        // Article cards (blog posts)
        ...Array.from({ length: 12 }, (_, i) => ({
          id: `article-${i}`,
          type: 'article',
          bounds: { x: (i % 3) * 300 + 50, y: Math.floor(i / 3) * 250 + 150, width: 280, height: 220 },
          content: `Article ${i + 1} - An interesting blog post about technology`,
          metadata: { hasText: true, hasImage: true, hasButton: false },
          confidence: 0.85 + Math.random() * 0.1,
          children: [
            { id: `article-${i}-image`, type: 'image', bounds: { x: (i % 3) * 300 + 60, y: Math.floor(i / 3) * 250 + 160, width: 260, height: 140 } },
            { id: `article-${i}-title`, type: 'heading', bounds: { x: (i % 3) * 300 + 60, y: Math.floor(i / 3) * 250 + 310, width: 260, height: 30 } },
            { id: `article-${i}-excerpt`, type: 'text', bounds: { x: (i % 3) * 300 + 60, y: Math.floor(i / 3) * 250 + 340, width: 260, height: 20 } }
          ]
        })),

        // Sidebar components
        {
          id: 'sidebar-search',
          type: 'search',
          bounds: { x: 1050, y: 150, width: 200, height: 60 },
          content: 'Search articles',
          metadata: { hasText: true, hasInput: true, hasButton: true },
          confidence: 0.91,
          children: [
            { id: 'search-input', type: 'input', bounds: { x: 1060, y: 160, width: 140, height: 30 } },
            { id: 'search-button', type: 'button', bounds: { x: 1210, y: 160, width: 30, height: 30 } }
          ]
        },
        {
          id: 'sidebar-categories',
          type: 'menu',
          bounds: { x: 1050, y: 230, width: 200, height: 300 },
          content: 'Categories: Tech, Design, Business',
          metadata: { hasText: true, hasButton: false },
          confidence: 0.88,
          children: Array.from({ length: 6 }, (_, i) => ({
            id: `category-${i}`,
            type: 'link',
            bounds: { x: 1060, y: 250 + i * 40, width: 180, height: 25 }
          }))
        }
      ]

      // Extract patterns
      const patterns = await extractor.extractPatterns(blogDetectionResults)

      // Should consolidate similar article cards into one pattern
      const articlePattern = patterns.find(p => p.type === 'article')
      expect(articlePattern).toBeDefined()
      expect(articlePattern!.instances.length).toBe(12)
      expect(articlePattern!.frequency).toBe(12)

      // Should identify other unique patterns
      expect(patterns.length).toBeGreaterThan(3)
      expect(patterns.length).toBeLessThan(8)

      // Reduce to component types
      const componentTypes = await extractor.reduceToTypes(patterns, websiteId)
      expect(componentTypes.length).toBeLessThan(6)

      // Verify article component type
      const articleComponentType = componentTypes.find(ct => 
        ct.patterns.some(p => p.type === 'article')
      )
      expect(articleComponentType).toBeDefined()
      expect(articleComponentType!.props.text).toBeDefined()
      expect(articleComponentType!.props.image).toBeDefined()
    })

    it('should handle performance constraints with large datasets', async () => {
      const startMemory = process.memoryUsage().heapUsed
      const startTime = Date.now()

      // Generate a large dataset (100 components across 10 pages)
      const largeDetectionResults: DetectionResult[] = Array.from({ length: 100 }, (_, i) => ({
        id: `component-${i}`,
        type: ['hero', 'card', 'section', 'form', 'navigation'][i % 5],
        bounds: { 
          x: (i % 10) * 100, 
          y: Math.floor(i / 10) * 200, 
          width: 200 + (i % 50), 
          height: 150 + (i % 30) 
        },
        content: `Content for component ${i} with some text that varies in length`,
        metadata: {
          hasText: true,
          hasImage: i % 3 === 0,
          hasButton: i % 4 === 0,
          hasInput: i % 8 === 0
        },
        confidence: 0.7 + (Math.random() * 0.3),
        children: Array.from({ length: i % 5 }, (_, j) => ({
          id: `component-${i}-child-${j}`,
          type: 'element',
          bounds: { x: 0, y: 0, width: 50, height: 25 }
        }))
      }))

      // Process the large dataset
      const patterns = await extractor.extractPatterns(largeDetectionResults)
      const componentTypes = await extractor.reduceToTypes(patterns, websiteId)

      const processingTime = Date.now() - startTime
      const memoryIncrease = process.memoryUsage().heapUsed - startMemory

      // Performance assertions
      expect(processingTime).toBeLessThan(2000) // Less than 2 seconds
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024) // Less than 50MB

      // Quality assertions
      expect(componentTypes.length).toBeLessThan(15)
      expect(componentTypes.length).toBeGreaterThan(3)

      // Each component type should have meaningful patterns
      componentTypes.forEach(ct => {
        expect(ct.patterns.length).toBeGreaterThan(0)
        const totalInstances = ct.patterns.reduce((sum, p) => sum + p.instances.length, 0)
        expect(totalInstances).toBeGreaterThan(0)
      })
    })

    it('should maintain pattern fidelity during reduction', async () => {
      // Create a set of detection results with known patterns
      const knownPatternResults: DetectionResult[] = [
        // Three very similar hero sections (should merge)
        {
          id: 'hero-1',
          type: 'hero',
          bounds: { x: 0, y: 0, width: 1200, height: 500 },
          content: 'Hero section 1',
          metadata: { hasText: true, hasButton: true, hasImage: true },
          confidence: 0.9
        },
        {
          id: 'hero-2', 
          type: 'hero',
          bounds: { x: 0, y: 0, width: 1200, height: 480 },
          content: 'Hero section 2',
          metadata: { hasText: true, hasButton: true, hasImage: true },
          confidence: 0.88
        },
        {
          id: 'hero-3',
          type: 'hero', 
          bounds: { x: 0, y: 0, width: 1200, height: 520 },
          content: 'Hero section 3',
          metadata: { hasText: true, hasButton: true, hasImage: true },
          confidence: 0.91
        },

        // Two different card types (should NOT merge)
        {
          id: 'product-card',
          type: 'card',
          bounds: { x: 0, y: 600, width: 300, height: 400 },
          content: 'Product card with price',
          metadata: { hasText: true, hasButton: true, hasImage: true },
          confidence: 0.85
        },
        {
          id: 'info-card',
          type: 'card',
          bounds: { x: 350, y: 600, width: 300, height: 200 },
          content: 'Info card without button',
          metadata: { hasText: true, hasButton: false, hasImage: true },
          confidence: 0.83
        }
      ]

      const patterns = await extractor.extractPatterns(knownPatternResults)
      
      // Should identify some patterns
      expect(patterns.length).toBeGreaterThan(0)
      
      // Verify all input instances are preserved somewhere
      const totalInstances = patterns.reduce((sum, p) => sum + p.instances.length, 0)
      expect(totalInstances).toBe(knownPatternResults.length)
      
      // Should have hero patterns
      const heroPatterns = patterns.filter(p => p.type === 'hero')
      expect(heroPatterns.length).toBeGreaterThan(0)
      
      // Should have card patterns  
      const cardPatterns = patterns.filter(p => p.type === 'card')
      expect(cardPatterns.length).toBeGreaterThan(0)

      // Reduce to component types
      const componentTypes = await extractor.reduceToTypes(patterns, websiteId)
      
      // Should create reasonable number of component types
      expect(componentTypes.length).toBeGreaterThan(0)
      expect(componentTypes.length).toBeLessThanOrEqual(patterns.length)

      // Verify component types are properly formed
      componentTypes.forEach(ct => {
        expect(ct.type).toBeDefined()
        expect(ct.category).toBeDefined()
        expect(ct.patterns.length).toBeGreaterThan(0)
        expect(ct.aiMetadata).toBeDefined()
      })

      // Verify all instances are preserved in component types
      const totalInstancesInTypes = componentTypes.reduce((sum, ct) => 
        sum + ct.patterns.reduce((patternSum, pattern) => 
          patternSum + pattern.instances.length, 0), 0)
      expect(totalInstancesInTypes).toBe(knownPatternResults.length)
    })
  })

  describe('Edge cases and error handling', () => {
    it('should handle malformed detection results gracefully', async () => {
      const malformedResults: DetectionResult[] = [
        {
          id: 'valid',
          type: 'hero',
          bounds: { x: 0, y: 0, width: 800, height: 400 },
          confidence: 0.9
        },
        // Missing required fields
        {
          id: 'missing-bounds',
          type: 'card'
        } as DetectionResult,
        // Invalid bounds
        {
          id: 'invalid-bounds',
          type: 'section',
          bounds: { x: -100, y: -50, width: -200, height: -100 },
          confidence: 0.5
        },
        // Extremely nested structure
        {
          id: 'deeply-nested',
          type: 'complex',
          bounds: { x: 0, y: 0, width: 1000, height: 800 },
          confidence: 0.8,
          children: Array.from({ length: 3 }, (_, i) => ({
            id: `level1-${i}`,
            type: 'container',
            bounds: { x: i * 300, y: 0, width: 300, height: 800 },
            children: Array.from({ length: 3 }, (_, j) => ({
              id: `level2-${i}-${j}`,
              type: 'section',
              bounds: { x: 0, y: j * 250, width: 300, height: 250 },
              children: Array.from({ length: 5 }, (_, k) => ({
                id: `level3-${i}-${j}-${k}`,
                type: 'element',
                bounds: { x: k * 50, y: 0, width: 50, height: 50 }
              }))
            }))
          }))
        }
      ]

      // Should handle malformed data without throwing
      const patterns = await extractor.extractPatterns(malformedResults)
      expect(patterns).toBeInstanceOf(Array)

      const componentTypes = await extractor.reduceToTypes(patterns, websiteId)
      expect(componentTypes).toBeInstanceOf(Array)

      // Should filter out invalid results and process valid ones
      expect(patterns.length).toBeGreaterThan(0)
    })

    it('should handle empty and minimal datasets', async () => {
      // Empty dataset
      let patterns = await extractor.extractPatterns([])
      let componentTypes = await extractor.reduceToTypes(patterns, websiteId)
      
      expect(patterns).toHaveLength(0)
      expect(componentTypes).toHaveLength(0)

      // Single component
      const singleComponent: DetectionResult[] = [{
        id: 'single',
        type: 'hero',
        bounds: { x: 0, y: 0, width: 800, height: 400 },
        content: 'Single hero component',
        confidence: 0.9
      }]

      patterns = await extractor.extractPatterns(singleComponent)
      componentTypes = await extractor.reduceToTypes(patterns, websiteId)

      expect(patterns).toHaveLength(1)
      expect(componentTypes).toHaveLength(1)
      expect(componentTypes[0].patterns[0].instances).toHaveLength(1)
    })
  })

  describe('Configuration and placeholder generation', () => {
    it('should generate appropriate configurations for different component types', async () => {
      const diverseComponents: DetectionResult[] = [
        // Navigation with links
        {
          id: 'nav',
          type: 'navigation',
          bounds: { x: 0, y: 0, width: 1200, height: 60 },
          content: 'Home | Products | About | Contact',
          metadata: { hasText: true, hasButton: false, hasImage: true },
          confidence: 0.95
        },
        // Form with inputs
        {
          id: 'contact-form',
          type: 'form',
          bounds: { x: 200, y: 400, width: 600, height: 300 },
          content: 'Contact Form',
          metadata: { hasText: true, hasButton: true, hasInput: true },
          confidence: 0.92
        },
        // Media gallery
        {
          id: 'gallery',
          type: 'gallery',
          bounds: { x: 0, y: 800, width: 1200, height: 400 },
          content: 'Photo Gallery',
          metadata: { hasText: false, hasButton: false, hasImage: true },
          confidence: 0.89
        }
      ]

      const patterns = await extractor.extractPatterns(diverseComponents)
      const componentTypes = await extractor.reduceToTypes(patterns, websiteId)

      componentTypes.forEach(componentType => {
        const pattern = componentType.patterns[0]
        
        // Test configuration generation
        const config = extractor.generateDefaultConfig(pattern)
        expect(config.responsive).toBeDefined()
        
        if (pattern.structure.hasText) {
          expect(config.text).toBeDefined()
        }
        
        if (pattern.structure.hasImage) {
          expect(config.image).toBeDefined()
        }
        
        if (pattern.structure.hasInput) {
          expect(config.inputs).toBeDefined()
          expect(Array.isArray(config.inputs)).toBe(true)
        }
        
        if (pattern.structure.hasButton) {
          expect(config.buttons).toBeDefined()
          expect(Array.isArray(config.buttons)).toBe(true)
        }

        // Test placeholder generation
        const placeholder = extractor.generatePlaceholderData(pattern)
        expect(placeholder).toBeDefined()
        
        if (pattern.structure.hasText) {
          expect(placeholder.title || placeholder.description).toBeDefined()
        }
        
        if (pattern.structure.hasImage) {
          expect(placeholder.image).toBeDefined()
        }
        
        if (pattern.structure.hasButton) {
          expect(placeholder.links).toBeDefined()
          expect(Array.isArray(placeholder.links)).toBe(true)
        }
      })
    })
  })
})

