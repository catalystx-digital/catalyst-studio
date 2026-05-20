import { TemplateGenerator } from '../template-generator'
import type { 
  ImportPipelineResult,
  ImportDetectionResult,
  DetectedComponent,
  NavigationHierarchy,
  Template,
  DesignTokens
} from '../import-pipeline'

// Mock performance monitor
jest.mock('@/lib/studio/components/cms/_import/performance', () => ({
  performanceMonitor: {
    measure: jest.fn((name, fn) => fn()),
    measureSync: jest.fn((name, fn) => fn())
  }
}))

describe('TemplateGenerator', () => {
  let generator: TemplateGenerator

  beforeEach(() => {
    generator = new TemplateGenerator({
      generatePlaceholders: true,
      minConfidence: 0.6,
      templatePrefix: 'test'
    })
  })

  describe('generateFromPatterns', () => {
    it('should generate templates from successful pipeline result', () => {
      const pipelineResult: ImportPipelineResult = {
        success: true,
        data: {
          detectedComponents: [
            createMockDetectionResult('https://example.com', [
              createMockComponent('hero', 0.9, 'hero'),
              createMockComponent('navigation', 0.8, 'header')
            ])
          ],
          navigation: createMockNavigation(),
          templates: [createMockTemplate()],
          designTokens: createMockDesignTokens()
        },
        errors: []
      }

      const templates = generator.generateFromPatterns(pipelineResult)

      expect(templates).toHaveLength(4) // 1 page template + 2 component templates + 1 folder template
      expect(templates[0].category).toBe('page')
      expect(templates[1].category).toBe('component')
      expect(templates[3].category).toBe('folder')
    })

    it('should throw error for unsuccessful pipeline result', () => {
      const pipelineResult: ImportPipelineResult = {
        success: false,
        errors: ['Error occurred']
      }

      expect(() => generator.generateFromPatterns(pipelineResult)).toThrow('Pipeline result is not successful or missing data')
    })

    it('should filter components by confidence threshold', () => {
      const pipelineResult: ImportPipelineResult = {
        success: true,
        data: {
          detectedComponents: [
            createMockDetectionResult('https://example.com', [
              createMockComponent('hero', 0.9, 'hero'), // High confidence
              createMockComponent('cta', 0.3, 'main') // Low confidence - should be filtered
            ])
          ],
          navigation: createMockNavigation(),
          templates: [],
          designTokens: createMockDesignTokens()
        },
        errors: []
      }

      const templates = generator.generateFromPatterns(pipelineResult)
      const componentTemplates = templates.filter(t => t.category === 'component')
      
      expect(componentTemplates).toHaveLength(1)
      expect(componentTemplates[0].metadata?.patterns).toContain('hero')
      expect(componentTemplates[0].metadata?.patterns).not.toContain('cta')
    })
  })

  describe('createPageTemplate', () => {
    it('should create page template with standard fields', () => {
      const detectionResults = [
        createMockDetectionResult('https://example.com/page1', [
          createMockComponent('hero', 0.8, 'hero', {
            heading: 'Welcome',
            subheading: 'To our site'
          })
        ])
      ]

      const template = generator.createPageTemplate('homepage', detectionResults)

      expect(template).not.toBeNull()
      expect(template?.name).toBe('Homepage Page Template')
      expect(template?.category).toBe('page')
      expect(template?.fields).toContainEqual(
        expect.objectContaining({ name: 'title', type: 'string', required: true })
      )
      expect(template?.fields).toContainEqual(
        expect.objectContaining({ name: 'slug', type: 'string', required: true })
      )
      expect(template?.fields).toContainEqual(
        expect.objectContaining({ name: 'seoMeta', type: 'object' })
      )
    })

    it('should group components by location', () => {
      const detectionResults = [
        createMockDetectionResult('https://example.com', [
          createMockComponent('header', 0.8, 'header'),
          createMockComponent('hero', 0.9, 'hero'),
          createMockComponent('features', 0.7, 'main'),
          createMockComponent('footer', 0.8, 'footer')
        ])
      ]

      const template = generator.createPageTemplate('test', detectionResults)

      expect(template?.fields).toContainEqual(
        expect.objectContaining({ name: 'headerComponents', type: 'array' })
      )
      expect(template?.fields).toContainEqual(
        expect.objectContaining({ name: 'heroComponents', type: 'array' })
      )
      expect(template?.fields).toContainEqual(
        expect.objectContaining({ name: 'mainComponents', type: 'array' })
      )
      expect(template?.fields).toContainEqual(
        expect.objectContaining({ name: 'footerComponents', type: 'array' })
      )
    })

    it('should return null for empty components', () => {
      const detectionResults: ImportDetectionResult[] = []
      const template = generator.createPageTemplate('empty', detectionResults)
      expect(template).toBeNull()
    })
  })

  describe('createComponentComposition', () => {
    it('should create component template from detected components', () => {
      const detectionResults = [
        createMockDetectionResult('https://example.com/page1', [
          createMockComponent('hero', 0.8, 'hero', {
            title: 'Hero Title 1',
            subtitle: 'Hero Subtitle 1',
            backgroundImage: 'image1.jpg'
          })
        ]),
        createMockDetectionResult('https://example.com/page2', [
          createMockComponent('hero', 0.9, 'hero', {
            title: 'Hero Title 2',
            subtitle: 'Hero Subtitle 2',
            backgroundImage: 'image2.jpg'
          })
        ])
      ]

      const template = generator.createComponentComposition('hero', detectionResults)

      expect(template).not.toBeNull()
      expect(template?.name).toBe('Hero Component Template')
      expect(template?.category).toBe('component')
      expect(template?.fields).toContainEqual(
        expect.objectContaining({ name: 'title', type: 'string' })
      )
      expect(template?.fields).toContainEqual(
        expect.objectContaining({ name: 'subtitle', type: 'text' })
      )
      expect(template?.fields).toContainEqual(
        expect.objectContaining({ name: 'backgroundImage', type: 'image' })
      )
    })

    it('should extract content patterns from multiple instances', () => {
      const detectionResults = [
        createMockDetectionResult('https://example.com/page1', [
          createMockComponent('cta', 0.8, 'main', {
            heading: 'Call to Action 1',
            buttonText: 'Click Here',
            buttonUrl: '/contact'
          })
        ]),
        createMockDetectionResult('https://example.com/page2', [
          createMockComponent('cta', 0.7, 'main', {
            heading: 'Call to Action 2',
            buttonText: 'Learn More',
            buttonUrl: '/about'
          })
        ])
      ]

      const template = generator.createComponentComposition('cta', detectionResults)

      expect(template?.fields).toContainEqual(
        expect.objectContaining({ name: 'heading' })
      )
      expect(template?.fields).toContainEqual(
        expect.objectContaining({ name: 'buttonText' })
      )
      expect(template?.fields).toContainEqual(
        expect.objectContaining({ name: 'buttonUrl', type: 'link' })
      )
    })
  })

  describe('generatePlaceholders', () => {
    it('should generate text placeholder', () => {
      const field = { name: 'title', type: 'string', required: true }
      const placeholder = generator.generatePlaceholders(field)

      expect(placeholder.type).toBe('text')
      expect(placeholder.value).toBe('Lorem Ipsum Dolor Sit Amet')
    })

    it('should generate image placeholder with design tokens', () => {
      const field = { name: 'heroImage', type: 'image', required: false }
      const designTokens: DesignTokens = {
        images: ['https://example.com/real-image.jpg'],
        textPatterns: [],
        contentOrganization: [],
        componentUsage: []
      }
      const placeholder = generator.generatePlaceholders(field, designTokens)

      expect(placeholder.type).toBe('image')
      expect(placeholder.value).toBe('https://example.com/real-image.jpg')
    })

    it('should generate object placeholder', () => {
      const field = {
        name: 'seoMeta',
        type: 'object',
        required: false,
        properties: {
          description: { type: 'text' },
          keywords: { type: 'array', itemType: 'string' }
        }
      }
      const placeholder = generator.generatePlaceholders(field)

      expect(placeholder.type).toBe('object')
      expect(placeholder.value).toHaveProperty('description')
      expect(placeholder.value).toHaveProperty('keywords')
    })

    it('should generate array placeholder', () => {
      const field = {
        name: 'features',
        type: 'array',
        required: true,
        properties: {
          title: { type: 'string' },
          description: { type: 'text' }
        }
      }
      const placeholder = generator.generatePlaceholders(field)

      expect(placeholder.type).toBe('array')
      expect(Array.isArray(placeholder.value)).toBe(true)
      expect(placeholder.value).toHaveLength(3) // Default 3 items
      expect(placeholder.value[0]).toHaveProperty('title')
      expect(placeholder.value[0]).toHaveProperty('description')
    })
  })

  describe('Field Type Inference', () => {
    it('should infer field type from content', () => {
      const detectionResults = [
        createMockDetectionResult('https://example.com', [
          createMockComponent('form', 0.8, 'main', {
            fields: [
              { name: 'email', type: 'email' },
              { name: 'message', type: 'textarea' }
            ],
            submitUrl: '/api/submit',
            enabled: true,
            maxSubmissions: 100
          })
        ])
      ]

      const template = generator.createComponentComposition('form', detectionResults)

      expect(template?.fields).toContainEqual(
        expect.objectContaining({ name: 'fields', type: 'array' })
      )
      expect(template?.fields).toContainEqual(
        expect.objectContaining({ name: 'submitUrl', type: 'link' })
      )
      expect(template?.fields).toContainEqual(
        expect.objectContaining({ name: 'enabled', type: 'boolean' })
      )
      expect(template?.fields).toContainEqual(
        expect.objectContaining({ name: 'maxSubmissions', type: 'number' })
      )
    })
  })

  describe('Performance and Caching', () => {
    it('should cache templates for reuse', () => {
      const pipelineResult: ImportPipelineResult = {
        success: true,
        data: {
          detectedComponents: [
            createMockDetectionResult('https://example.com', [
              createMockComponent('hero', 0.9, 'hero')
            ])
          ],
          navigation: createMockNavigation(),
          templates: [createMockTemplate()],
          designTokens: createMockDesignTokens()
        },
        errors: []
      }

      // Generate templates twice
      generator.generateFromPatterns(pipelineResult)
      const stats1 = generator.getCacheStats()
      
      generator.generateFromPatterns(pipelineResult)
      const stats2 = generator.getCacheStats()

      // Cache should be populated after first run
      expect(stats1.templateCacheSize).toBeGreaterThan(0)
      expect(stats2.templateCacheSize).toBe(stats1.templateCacheSize)
    })

    it('should clear cache when requested', () => {
      const pipelineResult: ImportPipelineResult = {
        success: true,
        data: {
          detectedComponents: [
            createMockDetectionResult('https://example.com', [
              createMockComponent('hero', 0.9, 'hero')
            ])
          ],
          navigation: createMockNavigation(),
          templates: [createMockTemplate()],
          designTokens: createMockDesignTokens()
        },
        errors: []
      }

      generator.generateFromPatterns(pipelineResult)
      const statsBefore = generator.getCacheStats()
      expect(statsBefore.templateCacheSize).toBeGreaterThan(0)

      generator.clearCache()
      const statsAfter = generator.getCacheStats()
      expect(statsAfter.templateCacheSize).toBe(0)
      expect(statsAfter.patternCacheSize).toBe(0)
    })

    it('should preload cache with common patterns', () => {
      const commonPatterns = {
        'hero_pattern': { title: 'Hero Title', subtitle: 'Hero Subtitle' },
        'cta_pattern': { heading: 'CTA Heading', button: 'Click Here' }
      }

      generator.preloadCache(commonPatterns)
      const stats = generator.getCacheStats()

      expect(stats.patternCacheSize).toBe(2)
    })

    it('should complete generation within performance target', () => {
      // Create a large dataset
      const largeDetectionResults: ImportDetectionResult[] = []
      for (let i = 0; i < 20; i++) {
        largeDetectionResults.push(
          createMockDetectionResult(`https://example.com/page${i}`, [
            createMockComponent('hero', 0.9, 'hero'),
            createMockComponent('features', 0.8, 'main'),
            createMockComponent('footer', 0.7, 'footer')
          ])
        )
      }

      const pipelineResult: ImportPipelineResult = {
        success: true,
        data: {
          detectedComponents: largeDetectionResults,
          navigation: createMockNavigation(),
          templates: Array.from({ length: 10 }, (_, i) => ({
            ...createMockTemplate(),
            id: `template-${i}`,
            name: `Template ${i}`
          })),
          designTokens: createMockDesignTokens()
        },
        errors: []
      }

      const startTime = Date.now()
      generator.generateFromPatterns(pipelineResult)
      const endTime = Date.now()
      const duration = endTime - startTime

      // Should complete in under 30 seconds (30000ms)
      expect(duration).toBeLessThan(30000)
      // For unit tests, should actually be much faster
      expect(duration).toBeLessThan(1000)
    })
  })

  describe('Template Metadata', () => {
    it('should include confidence scores in metadata', () => {
      const detectionResults = [
        createMockDetectionResult('https://example.com', [
          createMockComponent('hero', 0.95, 'hero'),
          createMockComponent('features', 0.85, 'main')
        ])
      ]

      const template = generator.createPageTemplate('test', detectionResults)

      expect(template?.metadata?.confidence).toBeCloseTo(0.9, 2) // Average of 0.95 and 0.85
    })

    it('should include source pages in metadata', () => {
      const detectionResults = [
        createMockDetectionResult('https://example.com/page1', [
          createMockComponent('hero', 0.8, 'hero')
        ]),
        createMockDetectionResult('https://example.com/page2', [
          createMockComponent('hero', 0.7, 'hero')
        ])
      ]

      const template = generator.createPageTemplate('test', detectionResults)

      expect(template?.metadata?.sourcePages).toContain('https://example.com/page1')
      expect(template?.metadata?.sourcePages).toContain('https://example.com/page2')
    })
  })
})

// Helper functions to create mock data
function createMockComponent(
  type: string,
  confidence: number,
  location?: 'header' | 'hero' | 'main' | 'footer',
  content?: Record<string, any>
): DetectedComponent {
  return {
    component: type,
    type: type as any,
    confidence,
    location,
    content: content || {}
  }
}

function createMockDetectionResult(
  pageUrl: string,
  components: DetectedComponent[]
): ImportDetectionResult {
  return {
    components,
    processingTime: 100,
    modelUsed: 'test-model',
    pageUrl,
    accuracy: 0.85
  }
}

function createMockNavigation(): NavigationHierarchy {
  return {
    pages: [
      {
        title: 'Home',
        url: '/',
        children: []
      },
      {
        title: 'About',
        url: '/about',
        children: []
      }
    ],
    sections: []
  }
}

function createMockTemplate(): Template {
  return {
    id: 'template-1',
    name: 'Template 1',
    pages: ['https://example.com'],
    regions: {
      header: ['navigation'],
      hero: ['hero'],
      main: ['features'],
      footer: ['footer']
    },
    similarity: 1.0
  }
}

function createMockDesignTokens(): DesignTokens {
  return {
    images: ['https://example.com/image1.jpg'],
    textPatterns: ['heading', 'body'],
    contentOrganization: [],
    componentUsage: [
      {
        type: 'hero',
        frequency: 0.8,
        instances: 4
      }
    ]
  }
}
