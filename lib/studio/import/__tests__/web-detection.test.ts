
/**
 * Tests for Web-Based Component Detection Service
*/

import { DetectionService } from '../web-detection'
import { DetectionAPI } from '@/lib/studio/components/cms/_import/detection-api'
import { ModelConfig } from '../config'
import OpenAI from 'openai'
import type { ComponentPattern } from '@/lib/studio/components/cms/_import/types'

import { getComponentCatalogSummary } from '@/lib/studio/ai/component-catalog'

const mockComponents: ComponentPattern[] = [
  {
    type: 'NavBar',
    category: 'navigation',
    keywords: ['navigation', 'menu', 'header'],
    patterns: ['nav', 'menu', 'header'],
    confidence: 0.9,
    metadata: {
      category: 'navigation',
      properties: ['logo', 'menuItems', 'searchPlaceholder'],
      description: 'Main navigation bar',
      keywords: ['nav', 'menu']
    }
  },
  {
    type: 'HeroWithImage',
    category: 'heroes',
    keywords: ['hero', 'banner', 'image'],
    patterns: ['hero', 'banner'],
    confidence: 0.85,
    metadata: {
      category: 'heroes',
      properties: ['heading', 'subheading', 'backgroundImage', 'ctaButton'],
      description: 'Hero section with background image',
      keywords: ['hero', 'banner']
    }
  },
  {
    type: 'CardGrid',
    category: 'content',
    keywords: ['cards', 'grid', 'tiles'],
    patterns: ['card', 'grid'],
    confidence: 0.8,
    metadata: {
      category: 'content',
      properties: ['cards', 'columns', 'gap'],
      description: 'Grid of content cards',
      keywords: ['card', 'grid']
    }
  }
]

jest.mock('@/lib/studio/ai/component-catalog', () => ({
  getComponentCatalogSummary: jest.fn(async () => ({
    total: mockComponents.length,
    generatedAt: new Date().toISOString(),
    components: mockComponents as any,
    categories: [
      {
        name: 'mock',
        components: mockComponents as any
      }
    ],
    topLevelTypes: mockComponents.map(component => component.type),
    subComponentTypes: [] as string[],
    subComponents: [],
    warnings: []
  })),
  buildDetectionPrompt: jest.fn(() => 'component prompt')
}))

jest.mock('@/lib/studio/ai/page-catalog', () => ({
  getPageCatalogSummary: jest.fn(async () => {
    const templates = [
      {
        templateKey: 'core/generic-default',
        name: 'Generic Page',
        category: 'core',
        isHomeEligible: false,
        description: 'Generic fallback template',
        requiredRegions: [{ region: 'main', allowedComponents: ['text-block'] as any[] }],
        optionalRegions: [],
        propsMeta: undefined,
        aiMetadata: {
          keywords: ['generic'],
          layoutGuidelines: ['Fallback when no other template applies'],
          contentGuidelines: [],
          recommendedComponents: [],
          discouragedComponents: [],
          exampleUseCases: [],
          routeHints: ['/generic']
        }
      },
      {
        templateKey: 'marketing/home-default',
        name: 'Marketing Home',
        category: 'marketing',
        isHomeEligible: true,
        description: 'Home template',
        requiredRegions: [{ region: 'header', allowedComponents: ['navbar'] as any[] }],
        optionalRegions: [],
        propsMeta: undefined,
        aiMetadata: {
          keywords: ['home'],
          layoutGuidelines: ['Ensure hero leads page'],
          contentGuidelines: [],
          recommendedComponents: [],
          discouragedComponents: [],
          exampleUseCases: [],
          routeHints: ['/', '/home']
        }
      },
      {
        templateKey: 'blog/index-standard',
        name: 'Blog Index',
        category: 'blog',
        isHomeEligible: false,
        description: 'Blog listing',
        requiredRegions: [{ region: 'main', allowedComponents: ['blog-list'] as any[] }],
        optionalRegions: [],
        propsMeta: undefined,
        aiMetadata: {
          keywords: ['blog'],
          layoutGuidelines: ['List articles'],
          contentGuidelines: [],
          recommendedComponents: [],
          discouragedComponents: [],
          exampleUseCases: [],
          routeHints: ['/blog']
        }
      },
      {
        templateKey: 'blog/post-standard',
        name: 'Blog Post',
        category: 'blog',
        isHomeEligible: false,
        description: 'Article template',
        requiredRegions: [{ region: 'main', allowedComponents: ['blog-post'] as any[] }],
        optionalRegions: [],
        propsMeta: undefined,
        aiMetadata: {
          keywords: ['post'],
          layoutGuidelines: ['Show article content'],
          contentGuidelines: [],
          recommendedComponents: [],
          discouragedComponents: [],
          exampleUseCases: [],
          routeHints: ['/blog/']
        }
      },
      {
        templateKey: 'commerce/product-detail',
        name: 'Product Detail',
        category: 'commerce',
        isHomeEligible: false,
        description: 'Product detail page',
        requiredRegions: [{ region: 'main', allowedComponents: ['feature-grid'] as any[] }],
        optionalRegions: [],
        propsMeta: undefined,
        aiMetadata: {
          keywords: ['product'],
          layoutGuidelines: ['Show product info'],
          contentGuidelines: [],
          recommendedComponents: [],
          discouragedComponents: [],
          exampleUseCases: [],
          routeHints: ['/product', '/products']
        }
      }
    ]

    return {
      total: templates.length,
      generatedAt: new Date().toISOString(),
      templates,
      categories: [
        { category: 'core', templates: [templates[0]] },
        { category: 'marketing', templates: [templates[1]] },
        { category: 'blog', templates: [templates[2], templates[3]] },
        { category: 'commerce', templates: [templates[4]] }
      ],
      homeEligibleTemplates: ['marketing/home-default']
    }
  }),
  buildPageTemplatePrompt: jest.fn(() => 'page prompt')
}))

// Mock dependencies
jest.mock('@/lib/studio/components/cms/_import/detection-api', () => {
  const mockInstance = {
    detectComponentPatterns: jest.fn(() => mockComponents),
    detectComponentPatternsAsync: jest.fn(async () => mockComponents),
    getRegistryStats: jest.fn(() => ({
      componentCount: mockComponents.length,
      patternCacheEntries: 0,
      catalogCached: true,
      cacheAgeMs: 0
    }))
  }
  return {
    DetectionAPI: jest.fn().mockImplementation(() => mockInstance),
    detectionAPI: mockInstance,
    __mockDetectionAPI: mockInstance
  }
})

const { __mockDetectionAPI: detectionApiMockInstance } = jest.requireMock('@/lib/studio/components/cms/_import/detection-api') as {
  __mockDetectionAPI: jest.Mocked<DetectionAPI>
}
jest.mock('@/lib/studio/components/cms/_import/performance', () => {
  const mocks = {
    measure: jest.fn(async (_name: string, fn: any) => fn()),
    measureSync: jest.fn((_name: string, fn: any) => fn()),
    startTimer: jest.fn(() => 'timer-1'),
    endTimer: jest.fn(() => 10)
  }
  return {
    performanceMonitor: mocks,
    __mock: mocks
  }
})

const { __mock: performanceMonitorMocks } = jest.requireMock('@/lib/studio/components/cms/_import/performance') as {
  __mock: {
    measure: jest.Mock
    measureSync: jest.Mock
    startTimer: jest.Mock
    endTimer: jest.Mock
  }
}
jest.mock('openai')

// Avoid initializing CMS components (ESM build not supported in Jest)
jest.mock('@/lib/studio/components/cms/_factory/initialize', () => ({
  initializeCMSComponents: jest.fn().mockResolvedValue(undefined)
}))

const mockWebResponse = JSON.stringify({
  pageTemplate: {
    templateKey: 'marketing/home-default',
    confidence: 0.92,
    reason: 'Hero with marketing content and footer detected'
  },
  components: [
    { component: 'NavBar', confidence: 0.95, content: { logo: 'Company Logo', links: [{ label: 'Home', url: '/' }] } },
    { component: 'HeroWithImage', confidence: 0.9, content: { heading: 'Welcome to Our Site', backgroundImage: '/images/hero-bg.jpg' } },
    { component: 'CardGrid', confidence: 0.85, content: { cards: [{ title: 'Feature 1' }] } }
  ],
  pageMetadata: { title: 'Example' }
})

describe('DetectionService (web-based)', () => {
  let service: DetectionService
  let mockDetectionAPI: jest.Mocked<DetectionAPI>
  let mockOpenAI: jest.Mocked<OpenAI>

  beforeEach(() => {
    jest.clearAllMocks()

    mockDetectionAPI = detectionApiMockInstance as jest.Mocked<DetectionAPI>
    mockDetectionAPI.detectComponentPatterns.mockReturnValue(mockComponents)
    mockDetectionAPI.detectComponentPatternsAsync.mockResolvedValue(mockComponents)
    mockDetectionAPI.getRegistryStats.mockReturnValue({
      componentCount: mockComponents.length,
      patternCacheEntries: 0,
      catalogCached: true,
      cacheAgeMs: 0
    })
    const detectionApiModule = jest.requireMock('@/lib/studio/components/cms/_import/detection-api') as {
      DetectionAPI: jest.Mock
      detectionAPI: typeof mockDetectionAPI
    }
    detectionApiModule.DetectionAPI.mockImplementation(() => mockDetectionAPI)
    detectionApiModule.detectionAPI = mockDetectionAPI as any

    performanceMonitorMocks.measure.mockImplementation(async (_name: string, fn: any) => fn())
    performanceMonitorMocks.measureSync.mockImplementation((_name: string, fn: any) => fn())
    performanceMonitorMocks.startTimer.mockImplementation(() => 'timer-1')
    performanceMonitorMocks.endTimer.mockImplementation(() => 12)

    mockOpenAI = {
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [{ message: { content: mockWebResponse } }],
            usage: { total_tokens: 1500, total_cost: 0.02 }
          })
        }
      }
    } as any
    ;(OpenAI as jest.MockedClass<typeof OpenAI>).mockImplementation(() => mockOpenAI)

    service = new DetectionService()
  })


  describe('detectComponentsFromUrl', () => {
    const mockPageUrl = 'https://example.com'

    it('detects components from URL successfully', async () => {
      const result = await service.detectComponentsFromUrl(mockPageUrl)
      expect(result).toBeDefined()
      expect(result.components).toHaveLength(3)
      expect(result.pageTemplate.templateKey).toBe('marketing/home-default')
      expect(result.pageUrl).toBe(mockPageUrl)
      expect(result.modelUsed).toBeDefined()
      expect(result.tokenUsage).toBe(1500)
      expect(result.cost).toBe(0.02)
    })

    it('loads catalog summary for detection', async () => {
      const summaryMock = getComponentCatalogSummary as jest.Mock
      summaryMock.mockClear()
      await service.detectComponentsFromUrl(mockPageUrl)
      expect(summaryMock).toHaveBeenCalledTimes(1)
    })

    it('attaches provider filter when IMPORT_MODEL_ALLOWED_PROVIDER is set', async () => {
      const original = process.env.IMPORT_MODEL_ALLOWED_PROVIDER
      const originalModelConfigProvider = ModelConfig.allowedProvider
      process.env.IMPORT_MODEL_ALLOWED_PROVIDER = 'azure,blah'
      ModelConfig.allowedProvider = 'azure,blah'
      try {
        await service.detectComponentsFromUrl(mockPageUrl)
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
        ModelConfig.allowedProvider = originalModelConfigProvider
      }
    })

    it('filters by confidence threshold', async () => {
      mockOpenAI.chat.completions.create = jest.fn().mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              pageTemplate: { templateKey: 'marketing/home-default' },
              components: [
                { component: 'NavBar', confidence: 0.2, content: {} },
                { component: 'HeroWithImage', confidence: 0.8, content: {} }
              ]
            })
          }
        }],
        usage: { total_tokens: 1000 }
      })
      const result = await service.detectComponentsFromUrl(mockPageUrl, { confidenceThreshold: 0.25 })
      expect(result.components.some(component => component.confidence < 0.25)).toBe(false)
      const hero = result.components.find(component => component.component === 'HeroWithImage')
      expect(hero).toBeDefined()
      const nav = result.components.find(component => component.component === 'NavBar' || component.type === 'navbar')
      expect(nav).toBeUndefined()
    })

    it('handles API errors gracefully', async () => {
      mockOpenAI.chat.completions.create = jest.fn().mockRejectedValue(new Error('API error'))
      await expect(service.detectComponentsFromUrl(mockPageUrl)).rejects.toThrow('Web detection failed: API error')
    })

    it('rejects malformed JSON', async () => {
      mockOpenAI.chat.completions.create = jest.fn().mockResolvedValue({
        choices: [{ message: { content: 'Invalid JSON' } }],
        usage: { total_tokens: 100 }
      })
      await expect(service.detectComponentsFromUrl(mockPageUrl)).rejects.toThrow('Web detection failed')
    })

    it('rejects unknown page template keys', async () => {
      mockOpenAI.chat.completions.create = jest.fn().mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              pageTemplate: { templateKey: 'unknown-template', confidence: 0.6 },
              components: [
                { component: 'NavBar', confidence: 0.95, content: { logo: 'Company Logo' } },
                { component: 'HeroWithImage', confidence: 0.9, content: { heading: 'Example' } }
              ],
              pageMetadata: {}
            })
          }
        }],
        usage: { total_tokens: 900 }
      })

      await expect(service.detectComponentsFromUrl('https://example.com/blog/how-to-scale')).rejects.toThrow('is not registered')
    })

    it('emits detection telemetry summary', async () => {
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined)
      try {
        await service.detectComponentsFromUrl(mockPageUrl)
        expect(logSpy).toHaveBeenCalledWith(
          '[DETECTION][Summary]',
          expect.objectContaining({
            url: expect.stringContaining('https://example.com'),
            phaseCount: expect.any(Number),
            totalDurationMs: expect.any(Number)
          })
        )
      } finally {
        logSpy.mockRestore()
      }
    })

    it('warns when a phase exceeds its threshold', async () => {
      performanceMonitorMocks.endTimer.mockImplementation((operation: string) =>
        operation.endsWith('llm_call') ? 9000 : 12
      )
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
      try {
        await service.detectComponentsFromUrl(mockPageUrl)
        const warnCalls = warnSpy.mock.calls.filter(call => call[0] === '[DETECTION][PhaseThreshold]')
        expect(warnCalls.length).toBeGreaterThan(0)
        expect(warnCalls[warnCalls.length - 1][1]).toEqual(
          expect.objectContaining({ phase: 'llm_call', durationMs: 9000 })
        )
      } finally {
        warnSpy.mockRestore()
        performanceMonitorMocks.endTimer.mockImplementation(() => 12)
      }
    })
  })

  describe('component mapping', () => {
    it('maps component types and metadata', async () => {
      const result = await service.detectComponentsFromUrl('https://example.com')
      expect(result.pageTemplate.templateKey).toBeDefined()
      const navBar = result.components.find(c => c.type === 'NavBar')
      expect(navBar).toBeDefined()
      expect(navBar?.metadata).toBeDefined()
    })
  })

  // prompt building remains covered implicitly in web flow
})
