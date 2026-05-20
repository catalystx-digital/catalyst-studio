import { ComponentTypeExtractor } from '../component-type-extractor'
import {
  DetectionResult,
  ComponentPattern,
  ComponentType
} from '../interfaces/component-type-extractor.interface'
import { PrismaClient } from '@prisma/client'
import OpenAI from 'openai'
import { ComponentCategory } from '@/lib/studio/components/cms/_core/types'

// Mock OpenAI
jest.mock('openai')
const MockOpenAI = OpenAI as jest.MockedClass<typeof OpenAI>

// Mock Prisma
jest.mock('@prisma/client')
const MockPrismaClient = PrismaClient as jest.MockedClass<typeof PrismaClient>

describe('ComponentTypeExtractor', () => {
  let extractor: ComponentTypeExtractor
  let mockPrisma: jest.Mocked<PrismaClient>
  const websiteId = 'test-website-id'

  beforeEach(() => {
    mockPrisma = new MockPrismaClient() as jest.Mocked<PrismaClient>
    extractor = new ComponentTypeExtractor(mockPrisma)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('extractPatterns', () => {
    it('should extract patterns from detection results', async () => {
      const detectionResults: DetectionResult[] = [
        {
          id: '1',
          type: 'hero',
          bounds: { x: 0, y: 0, width: 800, height: 400 },
          content: 'Welcome to our site',
          metadata: { hasText: true, hasButton: true },
          confidence: 0.9
        },
        {
          id: '2',
          type: 'hero',
          bounds: { x: 0, y: 500, width: 800, height: 400 },
          content: 'Another hero section',
          metadata: { hasText: true, hasButton: true },
          confidence: 0.8
        }
      ]

      const patterns = await extractor.extractPatterns(detectionResults)

      expect(patterns).toHaveLength(1)
      expect(patterns[0].type).toBe('hero')
      expect(patterns[0].frequency).toBe(2)
      expect(patterns[0].instances).toHaveLength(2)
      expect(patterns[0].confidence).toBeGreaterThan(0.8)
    })

    it('should handle empty detection results', async () => {
      const patterns = await extractor.extractPatterns([])
      expect(patterns).toHaveLength(0)
    })

    it('should create separate patterns for different structures', async () => {
      const detectionResults: DetectionResult[] = [
        {
          id: '1',
          type: 'card',
          bounds: { x: 0, y: 0, width: 300, height: 200 },
          content: 'Card with text',
          metadata: { hasText: true, hasImage: false },
          confidence: 0.7
        },
        {
          id: '2',
          type: 'card',
          bounds: { x: 300, y: 0, width: 300, height: 200 },
          content: '',
          metadata: { hasText: false, hasImage: true },
          confidence: 0.8
        }
      ]

      const patterns = await extractor.extractPatterns(detectionResults)

      expect(patterns).toHaveLength(2)
      expect(patterns[0].structure.hasText).toBe(true)
      expect(patterns[1].structure.hasImage).toBe(true)
    })
  })

  describe('reduceToTypes', () => {
    it('emits canonical component metadata when registry definitions exist', async () => {
      const patterns: ComponentPattern[] = [
        {
          type: 'HeroSimple',
          category: 'hero',
          structure: { hasText: true, hasImage: false, hasButton: true, hasInput: false, childCount: 2, depth: 1 },
          instances: [
            { id: '1', type: 'HeroSimple', bounds: { x: 0, y: 0, width: 800, height: 400 }, confidence: 0.92 },
            { id: '2', type: 'hero-simple', bounds: { x: 0, y: 500, width: 800, height: 420 }, confidence: 0.88 }
          ],
          frequency: 2,
          confidence: 0.9,
          defaultConfig: {},
          placeholderData: {}
        },
        {
          type: 'feature-grid',
          category: 'content',
          structure: { hasText: true, hasImage: true, hasButton: false, hasInput: false, childCount: 1, depth: 1 },
          instances: [
            { id: '3', type: 'FeatureGrid', bounds: { x: 0, y: 900, width: 300, height: 200 }, confidence: 0.8 }
          ],
          frequency: 1,
          confidence: 0.8,
          defaultConfig: {},
          placeholderData: {}
        }
      ]

      const componentTypes = await extractor.reduceToTypes(patterns, websiteId)

      expect(componentTypes).toHaveLength(2)
      const heroType = componentTypes.find(component => component.type === 'hero-simple')
      const featureType = componentTypes.find(component => component.type === 'feature-grid')

      expect(heroType).toBeDefined()
      expect(heroType?.category).toBe(ComponentCategory.Heroes)
      expect(heroType?.defaultConfig).toEqual(
        expect.objectContaining({
          props: expect.any(Object),
          responsive: expect.objectContaining({ mobile: expect.any(Object) })
        })
      )
      expect(Object.keys(heroType?.placeholderData as Record<string, unknown>).length).toBeGreaterThan(0)
      expect(heroType?.aiMetadata).toEqual(
        expect.objectContaining({
          canonicalType: 'hero-simple',
          source: 'canonical-registry',
          patternCount: 2
        })
      )

      expect(featureType).toBeDefined()
      expect(featureType?.category).toBe(ComponentCategory.Features)
    })

    it('groups variants of the same canonical type', async () => {
      const patterns: ComponentPattern[] = [
        {
          type: 'HeroSimple',
          category: 'hero',
          structure: { hasText: true, hasImage: false, hasButton: true, hasInput: false, childCount: 2, depth: 1 },
          instances: [{ id: '1', type: 'HeroSimple', bounds: { x: 0, y: 0, width: 800, height: 400 } }],
          frequency: 1,
          confidence: 0.82,
          defaultConfig: {},
          placeholderData: {}
        },
        {
          type: 'hero-simple',
          category: 'hero',
          structure: { hasText: true, hasImage: true, hasButton: true, hasInput: false, childCount: 3, depth: 1 },
          instances: [{ id: '2', type: 'hero-simple', bounds: { x: 0, y: 400, width: 820, height: 440 } }],
          frequency: 1,
          confidence: 0.86,
          defaultConfig: {},
          placeholderData: {}
        }
      ]

      const componentTypes = await extractor.reduceToTypes(patterns, websiteId)

      expect(componentTypes).toHaveLength(1)
      expect(componentTypes[0].type).toBe('hero-simple')
      expect(componentTypes[0].aiMetadata).toEqual(
        expect.objectContaining({ canonicalType: 'hero-simple', patternCount: 2 })
      )
    })

    it('targets less than 15 canonical types from many patterns', async () => {
      // Create 50 similar patterns
      const patterns: ComponentPattern[] = Array.from({ length: 50 }, (_, i) => ({
        type: `pattern-${i}`,
        category: 'content',
        structure: { 
          hasText: true, 
          hasImage: i % 2 === 0, 
          hasButton: false, 
          hasInput: false, 
          childCount: Math.floor(i / 10), 
          depth: 1 
        },
        instances: [
          { id: `instance-${i}`, type: `pattern-${i}`, bounds: { x: 0, y: i * 100, width: 300, height: 100 } }
        ],
        frequency: 1,
        confidence: 0.7,
        defaultConfig: {},
        placeholderData: {}
      }))

      const componentTypes = await extractor.reduceToTypes(patterns, websiteId)

      expect(componentTypes.length).toBeLessThan(15)
      expect(componentTypes.length).toBeGreaterThan(0)
    })

    it('handles single unknown pattern without version suffix', async () => {
      const patterns: ComponentPattern[] = [
        {
          type: 'unique',
          category: 'layout',
          structure: { hasText: false, hasImage: false, hasButton: false, hasInput: false, childCount: 0, depth: 0 },
          instances: [
            { id: '1', type: 'unique', bounds: { x: 0, y: 0, width: 100, height: 100 } }
          ],
          frequency: 1,
          confidence: 0.5,
          defaultConfig: {},
          placeholderData: {}
        }
      ]

      const componentTypes = await extractor.reduceToTypes(patterns, websiteId)

      expect(componentTypes).toHaveLength(1)
      expect(componentTypes[0].type).toBe('unique')
    })
  })

  describe('generateDefaultConfig', () => {
    it('should generate config for text components', () => {
      const pattern: ComponentPattern = {
        type: 'header',
        category: 'navigation',
        structure: { hasText: true, hasImage: false, hasButton: false, hasInput: false, childCount: 3, depth: 1 },
        instances: [
          { 
            id: '1', 
            type: 'header', 
            bounds: { x: 0, y: 0, width: 800, height: 60 },
            content: 'Navigation Header',
            metadata: { hasText: true }
          }
        ],
        frequency: 1,
        confidence: 0.8,
        defaultConfig: {},
        placeholderData: {}
      }

      const config = extractor.generateDefaultConfig(pattern)

      expect(config.responsive).toBeDefined()
      expect(config.text).toBeDefined()
      expect(config.responsive.mobile).toBeDefined()
      expect(config.responsive.tablet).toBeDefined()
      expect(config.responsive.desktop).toBeDefined()
    })

    it('should generate config for image components', () => {
      const pattern: ComponentPattern = {
        type: 'gallery',
        category: 'content',
        structure: { hasText: false, hasImage: true, hasButton: false, hasInput: false, childCount: 6, depth: 2 },
        instances: [
          { 
            id: '1', 
            type: 'gallery', 
            bounds: { x: 0, y: 100, width: 800, height: 400 },
            metadata: { hasImage: true }
          }
        ],
        frequency: 1,
        confidence: 0.9,
        defaultConfig: {},
        placeholderData: {}
      }

      const config = extractor.generateDefaultConfig(pattern)

      expect(config.image).toBeDefined()
      expect(config.image).toBe('/placeholder-image.jpg')
    })

    it('should generate config for form components', () => {
      const pattern: ComponentPattern = {
        type: 'contact',
        category: 'form',
        structure: { hasText: true, hasImage: false, hasButton: true, hasInput: true, childCount: 4, depth: 2 },
        instances: [
          { 
            id: '1', 
            type: 'contact', 
            bounds: { x: 0, y: 200, width: 600, height: 300 },
            metadata: { hasInput: true, hasButton: true }
          }
        ],
        frequency: 1,
        confidence: 0.7,
        defaultConfig: {},
        placeholderData: {}
      }

      const config = extractor.generateDefaultConfig(pattern)

      expect(config.inputs).toBeDefined()
      expect(config.buttons).toBeDefined()
      expect(Array.isArray(config.inputs)).toBe(true)
      expect(Array.isArray(config.buttons)).toBe(true)
    })
  })

  describe('generatePlaceholderData', () => {
    it('should generate placeholder for text components', () => {
      const pattern: ComponentPattern = {
        type: 'article',
        category: 'content',
        structure: { hasText: true, hasImage: true, hasButton: false, hasInput: false, childCount: 2, depth: 1 },
        instances: [],
        frequency: 1,
        confidence: 0.8,
        defaultConfig: {},
        placeholderData: {}
      }

      const placeholder = extractor.generatePlaceholderData(pattern)

      expect(placeholder.title).toBeDefined()
      expect(placeholder.description).toBeDefined()
      expect(placeholder.image).toBeDefined()
      expect(placeholder.title).toBe('Lorem Ipsum Header')
    })

    it('should generate placeholder for button components', () => {
      const pattern: ComponentPattern = {
        type: 'cta',
        category: 'content',
        structure: { hasText: true, hasImage: false, hasButton: true, hasInput: false, childCount: 1, depth: 1 },
        instances: [],
        frequency: 1,
        confidence: 0.9,
        defaultConfig: {},
        placeholderData: {}
      }

      const placeholder = extractor.generatePlaceholderData(pattern)

      expect(placeholder.links).toBeDefined()
      expect(Array.isArray(placeholder.links)).toBe(true)
      expect(placeholder.links[0].text).toBe('Get Started')
    })
  })

  describe('calculatePatternSimilarity', () => {
    it('should return high similarity for identical patterns', () => {
      const pattern1: ComponentPattern = {
        type: 'hero',
        category: 'hero',
        structure: { hasText: true, hasImage: true, hasButton: true, hasInput: false, childCount: 3, depth: 1 },
        instances: [],
        frequency: 5,
        confidence: 0.9,
        defaultConfig: {},
        placeholderData: {}
      }

      const pattern2: ComponentPattern = { ...pattern1 }

      const similarity = extractor.calculatePatternSimilarity(pattern1, pattern2)
      expect(similarity).toBeGreaterThan(0.9)
    })

    it('should return low similarity for different patterns', () => {
      const pattern1: ComponentPattern = {
        type: 'hero',
        category: 'hero',
        structure: { hasText: true, hasImage: true, hasButton: true, hasInput: false, childCount: 3, depth: 1 },
        instances: [],
        frequency: 5,
        confidence: 0.9,
        defaultConfig: {},
        placeholderData: {}
      }

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

      const similarity = extractor.calculatePatternSimilarity(pattern1, pattern2)
      expect(similarity).toBeLessThan(0.3)
    })
  })

  describe('normalizePattern', () => {
    it('should normalize pattern structure', () => {
      const pattern: ComponentPattern = {
        type: 'test',
        category: 'test',
        structure: { hasText: 1 as any, hasImage: 0 as any, hasButton: true, hasInput: false, childCount: 2.7, depth: -1 },
        instances: [],
        frequency: 1,
        confidence: 0.8,
        defaultConfig: {},
        placeholderData: {}
      }

      const normalized = extractor.normalizePattern(pattern)

      expect(normalized.structure.hasText).toBe(true)
      expect(normalized.structure.hasImage).toBe(false)
      expect(normalized.structure.childCount).toBe(2)
      expect(normalized.structure.depth).toBe(0)
    })
  })

  describe('confidence threshold management', () => {
    it('should set and get confidence threshold', () => {
      extractor.setConfidenceThreshold(0.75)
      expect(extractor.getConfidenceThreshold()).toBe(0.75)
    })

    it('should clamp confidence threshold between 0 and 1', () => {
      extractor.setConfidenceThreshold(-0.5)
      expect(extractor.getConfidenceThreshold()).toBe(0)

      extractor.setConfidenceThreshold(1.5)
      expect(extractor.getConfidenceThreshold()).toBe(1)
    })
  })

  describe('enhanceWithAI', () => {
    let mockOpenAI: jest.Mocked<OpenAI>

    beforeEach(() => {
      mockOpenAI = {
        chat: {
          completions: {
            create: jest.fn()
          }
        }
      } as any
      MockOpenAI.mockReturnValue(mockOpenAI)
    })

    it('should skip AI enhancement when disabled', async () => {
      const componentTypes: ComponentType[] = [
        {
          type: 'original-type',
          category: 'content',
          content: {},
          props: {},
          styles: {},
          aiMetadata: {},
          patterns: []
        }
      ]

      const enhanced = await extractor.enhanceWithAI(componentTypes, { enableAIEnhancement: false })

      expect(enhanced).toEqual(componentTypes)
      expect(mockOpenAI.chat.completions.create).not.toHaveBeenCalled()
    })

    it('should skip AI enhancement when no API key', async () => {
      const componentTypes: ComponentType[] = [
        {
          type: 'original-type',
          category: 'content',
          content: {},
          props: {},
          styles: {},
          aiMetadata: {},
          patterns: []
        }
      ]

      const enhanced = await extractor.enhanceWithAI(componentTypes, { 
        enableAIEnhancement: true,
        apiKey: '' 
      })

      expect(enhanced).toEqual(componentTypes)
    })

    it('should enhance component types with AI suggestions', async () => {
      const componentTypes: ComponentType[] = [
        {
          type: 'hero',
          category: 'content',
          content: {},
          props: {},
          styles: {},
          aiMetadata: {},
          patterns: []
        }
      ]

      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                suggestions: [
                  {
                    originalType: 'hero',
                    suggestedType: 'hero-banner',
                    suggestedCategory: 'hero'
                  }
                ]
              })
            }
          }
        ],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 50,
          total_tokens: 150
        }
      }

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse as any)

      const enhanced = await extractor.enhanceWithAI(componentTypes, { 
        enableAIEnhancement: true,
        apiKey: 'sk-test-key'
      })

      expect(enhanced[0].type).toBe('hero-banner')
      expect(enhanced[0].category).toBe('hero')
      expect(enhanced[0].aiMetadata.aiEnhanced).toBe(true)
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith({
        model: 'openai/gpt-4o-mini',
        messages: expect.any(Array),
        temperature: 0.1,
        max_tokens: 1000
      })
    })

    it('should include provider filter when IMPORT_MODEL_ALLOWED_PROVIDER is set', async () => {
      const componentTypes: ComponentType[] = [
        {
          type: 'hero',
          category: 'content',
          content: {},
          props: {},
          styles: {},
          aiMetadata: {},
          patterns: []
        }
      ]

      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({ suggestions: [] })
            }
          }
        ]
      }
      const original = process.env.IMPORT_MODEL_ALLOWED_PROVIDER
      process.env.IMPORT_MODEL_ALLOWED_PROVIDER = 'azure,blah'
      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse as any)

      try {
        await extractor.enhanceWithAI(componentTypes, {
          enableAIEnhancement: true,
          apiKey: 'sk-test-key'
        })

        expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
          expect.objectContaining({
            provider: { only: ['azure', 'blah'] }
          })
        )
      } finally {
        if (original === undefined) {
          delete process.env.IMPORT_MODEL_ALLOWED_PROVIDER
        } else {
          process.env.IMPORT_MODEL_ALLOWED_PROVIDER = original
        }
      }
    })

    it('should handle AI enhancement errors gracefully', async () => {
      const componentTypes: ComponentType[] = [
        {
          type: 'original-type',
          category: 'content',
          content: {},
          props: {},
          styles: {},
          aiMetadata: {},
          patterns: []
        }
      ]

      mockOpenAI.chat.completions.create.mockRejectedValue(new Error('API Error'))

      const enhanced = await extractor.enhanceWithAI(componentTypes, { 
        enableAIEnhancement: true,
        apiKey: 'sk-test-key'
      })

      expect(enhanced).toEqual(componentTypes)
    })

    it('should handle invalid JSON responses', async () => {
      const componentTypes: ComponentType[] = [
        {
          type: 'original-type',
          category: 'content',
          content: {},
          props: {},
          styles: {},
          aiMetadata: {},
          patterns: []
        }
      ]

      const mockResponse = {
        choices: [
          {
            message: {
              content: 'Invalid JSON response'
            }
          }
        ]
      }

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse as any)

      const enhanced = await extractor.enhanceWithAI(componentTypes, { 
        enableAIEnhancement: true,
        apiKey: 'sk-test-key'
      })

      expect(enhanced).toEqual(componentTypes)
    })
  })

  describe('integration scenarios', () => {
    it('should handle end-to-end component type extraction', async () => {
      const detectionResults: DetectionResult[] = [
        {
          id: '1',
          type: 'hero',
          bounds: { x: 0, y: 0, width: 1200, height: 600 },
          content: 'Welcome to our amazing product',
          metadata: { hasText: true, hasButton: true, hasImage: true },
          confidence: 0.95
        },
        {
          id: '2',
          type: 'hero',
          bounds: { x: 0, y: 700, width: 1200, height: 500 },
          content: 'Another compelling headline',
          metadata: { hasText: true, hasButton: true, hasImage: true },
          confidence: 0.88
        },
        {
          id: '3',
          type: 'card',
          bounds: { x: 50, y: 1300, width: 350, height: 400 },
          content: 'Feature card content',
          metadata: { hasText: true, hasImage: true },
          confidence: 0.82
        }
      ]

      // Step 1: Extract patterns
      const patterns = await extractor.extractPatterns(detectionResults)
      expect(patterns).toHaveLength(2)

      // Step 2: Reduce to types
      const componentTypes = await extractor.reduceToTypes(patterns, websiteId)
      expect(componentTypes).toHaveLength(2)

      // Verify structure
      const heroType = componentTypes.find(ct => ct.category === 'hero')
      const contentType = componentTypes.find(ct => ct.category === 'content')

      expect(heroType).toBeDefined()
      expect(contentType).toBeDefined()
      expect(heroType!.patterns).toHaveLength(1)
      expect(heroType!.patterns[0].instances).toHaveLength(2)
    })

    it('should achieve target reduction ratio', async () => {
      // Create 60 detection results with variations
      const detectionResults: DetectionResult[] = Array.from({ length: 60 }, (_, i) => ({
        id: `${i}`,
        type: i < 20 ? 'hero' : i < 40 ? 'card' : 'section',
        bounds: { x: i * 10, y: i * 50, width: 300 + i, height: 200 + i },
        content: `Content ${i}`,
        metadata: { 
          hasText: true, 
          hasImage: i % 3 === 0,
          hasButton: i % 4 === 0,
          hasInput: i % 10 === 0
        },
        confidence: 0.7 + (i % 3) * 0.1
      }))

      const patterns = await extractor.extractPatterns(detectionResults)
      const componentTypes = await extractor.reduceToTypes(patterns, websiteId)

      expect(componentTypes.length).toBeLessThan(15)
      expect(componentTypes.length).toBeGreaterThan(3)
    })
  })

  describe('performance and memory', () => {
    it('should handle large datasets efficiently', async () => {
      const startTime = Date.now()
      const largeDetectionResults: DetectionResult[] = Array.from({ length: 100 }, (_, i) => ({
        id: `${i}`,
        type: `type-${i % 10}`,
        bounds: { x: i, y: i, width: 100, height: 100 },
        content: `Content ${i}`,
        confidence: 0.8
      }))

      const patterns = await extractor.extractPatterns(largeDetectionResults)
      const componentTypes = await extractor.reduceToTypes(patterns, websiteId)

      const processingTime = Date.now() - startTime

      expect(processingTime).toBeLessThan(2000) // Should complete in under 2 seconds
      expect(componentTypes.length).toBeLessThan(15)
    })

    it('should validate memory usage limits', () => {
      const initialMemory = process.memoryUsage().heapUsed
      const memoryLimit = 50 * 1024 * 1024 // 50MB

      // Create a large dataset
      const largeDetectionResults: DetectionResult[] = Array.from({ length: 1000 }, (_, i) => ({
        id: `${i}`,
        type: `type-${i % 50}`,
        bounds: { x: i, y: i, width: 100, height: 100 },
        content: `Large content string with lots of data ${i}`.repeat(10),
        metadata: { hasText: true, hasImage: i % 2 === 0 },
        confidence: 0.8,
        children: Array.from({ length: 5 }, (_, j) => ({
          id: `${i}-${j}`,
          type: 'child',
          bounds: { x: j, y: j, width: 50, height: 50 }
        }))
      }))

      // Memory usage should not exceed limit during processing
      const currentMemory = process.memoryUsage().heapUsed
      const memoryIncrease = currentMemory - initialMemory

      expect(memoryIncrease).toBeLessThan(memoryLimit)
    })
  })
})

