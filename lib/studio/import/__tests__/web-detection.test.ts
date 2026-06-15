
/**
 * Tests for Web-Based Component Detection Service
*/

import { DetectionService } from '../web-detection'
import { DetectionAPI } from '@/lib/studio/components/cms/_import/detection-api'
import { DetectionConfig, ModelConfig } from '../config'
import { GlobalSectionArtifactCache } from '../detection/global-section-cache'
import OpenAI from 'openai'
import type { ComponentPattern } from '@/lib/studio/components/cms/_import/types'

import { getComponentCatalogSummary } from '@/lib/studio/ai/component-catalog'

const mockComponents: ComponentPattern[] = [
  {
    type: 'navbar',
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
    type: 'hero-with-image',
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
    type: 'card-grid',
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
  },
  {
    type: 'video-embed',
    category: 'content',
    keywords: ['video', 'youtube', 'embed'],
    patterns: ['video', 'iframe', 'youtube'],
    confidence: 0.86,
    metadata: {
      category: 'content',
      properties: ['provider', 'url', 'title'],
      description: 'External video embed',
      keywords: ['video', 'youtube']
    }
  },
  {
    type: 'logo-cloud',
    category: 'social-proof',
    keywords: ['logos', 'clients', 'partners'],
    patterns: ['logos', 'clients', 'partners'],
    confidence: 0.82,
    metadata: {
      category: 'social-proof',
      properties: ['logos', 'title'],
      description: 'Logo cloud',
      keywords: ['logos', 'clients']
    }
  }
]

const mockOutline = {
  handle: 'handle-1',
  finalUrl: 'https://example.com',
  status: 200,
  headMeta: { title: 'Example', meta: [{ name: 'description', content: 'Example page' }] },
  sections: [{ key: 'main:0-99', approxBytes: 500, hash: 'abc', nodeCount: 6 }],
  resourcesSummary: { anchors: [], images: [], videos: [], forms: [], links: [] }
}

const mockWebTools = {
  fetchOutline: jest.fn(async () => mockOutline),
  getSection: jest.fn(async () => ({
    handle: 'handle-1',
    key: 'main:0-99',
    slice: [
      { tag: 'nav', pathId: 'n000001', text: 'Home' },
      { tag: 'h1', pathId: 'n000002', text: 'Welcome to Our Site' },
      { tag: 'img', pathId: 'n000003', attrs: { src: '/images/hero-bg.jpg', alt: 'Hero background' } },
      { tag: 'h2', pathId: 'n000004', text: 'Features' }
    ],
    stats: { nodeCount: 4, approxBytes: 500 }
  })),
  release: jest.fn(),
  getCacheStats: jest.fn(() => ({ entries: 1 })),
  getLastFetchOutline: jest.fn(() => mockOutline)
}

jest.mock('../services/web-tools', () => ({
  getWebFetchTools: jest.fn(() => mockWebTools)
}))

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
        requiredRegions: [{ region: 'main', allowedComponents: ['text-block', 'navbar', 'hero-with-image', 'card-grid'] as any[] }],
        optionalRegions: [
          { region: 'header', allowedComponents: ['navbar'] as any[] },
          { region: 'hero', allowedComponents: ['hero-with-image'] as any[] }
        ],
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
  sectionKey: 'main:0-99',
  components: [
    { component: 'navbar', confidence: 0.95, content: { menuItems: [{ label: 'Home', href: { type: 'internal', pageId: 'home', path: '/' } }] } },
    {
      component: 'hero-with-image',
      confidence: 0.9,
      content: {
        heading: 'Welcome to Our Site',
        image: {
          src: { mediaId: 'detected:hero-bg', mediaType: 'image', url: 'https://example.com/images/hero-bg.jpg' },
          alt: 'Hero background'
        }
      }
    },
    { component: 'card-grid', confidence: 0.85, content: { cards: [{ type: 'card-item', title: 'Feature 1', description: 'Feature description' }] } }
  ],
  pageMetadata: { title: 'Example' }
})

describe('DetectionService (web-based)', () => {
  let service: DetectionService
  let mockDetectionAPI: jest.Mocked<DetectionAPI>
  let mockOpenAI: jest.Mocked<OpenAI>

  beforeEach(() => {
    jest.clearAllMocks()
    ;(DetectionConfig as any).detectionHarness = 'section'
    ;(DetectionConfig as any).fillBatchConcurrency = 1
    mockWebTools.fetchOutline.mockResolvedValue(mockOutline)
    mockWebTools.getLastFetchOutline.mockReturnValue(mockOutline)
    mockWebTools.getSection.mockResolvedValue({
      handle: 'handle-1',
      key: 'main:0-99',
      slice: [
        { tag: 'nav', pathId: 'n000001', text: 'Home' },
        { tag: 'h1', pathId: 'n000002', text: 'Welcome to Our Site' },
        { tag: 'img', pathId: 'n000003', attrs: { src: '/images/hero-bg.jpg', alt: 'Hero background' } },
        { tag: 'h2', pathId: 'n000004', text: 'Features' }
      ],
      stats: { nodeCount: 4, approxBytes: 500 }
    })

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
      expect(result.timingBreakdown).toEqual(expect.objectContaining({
        totalDurationMs: expect.any(Number),
        phaseTotals: expect.arrayContaining([
          expect.objectContaining({ phase: 'fetch', count: 1 }),
          expect.objectContaining({ phase: 'section_extract', count: 1 })
        ]),
        sectionTimings: [
          expect.objectContaining({
            sectionKey: 'main:0-99',
            sectionOrder: 0,
            requestCount: 1,
            componentCount: 3
          })
        ]
      }))
    })

    it('loads catalog summary for detection', async () => {
      const summaryMock = getComponentCatalogSummary as jest.Mock
      summaryMock.mockClear()
      await service.detectComponentsFromUrl(mockPageUrl)
      expect(summaryMock).toHaveBeenCalledTimes(1)
    })

    it('reuses validated same-origin global header sections across pages', async () => {
      const globalSectionCache = new GlobalSectionArtifactCache()
      const headerOutline = {
        ...mockOutline,
        sections: [{ key: 'header:0-10', approxBytes: 300, hash: 'header-hash', nodeCount: 2 }]
      }
      mockWebTools.fetchOutline
        .mockResolvedValueOnce({ ...headerOutline, finalUrl: 'https://example.com/' })
        .mockResolvedValueOnce({ ...headerOutline, finalUrl: 'https://example.com/about' })
      mockWebTools.getSection.mockResolvedValue({
        handle: 'handle-1',
        key: 'header:0-10',
        slice: [
          { tag: 'nav', className: 'site-nav active', text: 'Home About' },
          { tag: 'a', attrs: { href: '/', 'aria-current': 'page' }, text: 'Home' },
          { tag: 'a', attrs: { href: '/about' }, text: 'About' }
        ],
        stats: { nodeCount: 3, approxBytes: 300 }
      })
      mockOpenAI.chat.completions.create = jest.fn().mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              sectionKey: 'header:0-10',
              components: [
                { component: 'navbar', confidence: 0.95, content: { menuItems: [{ label: 'Home', href: { type: 'internal', pageId: 'home', path: '/' } }] } }
              ]
            })
          },
          finish_reason: 'stop'
        }],
        usage: { total_tokens: 800, prompt_tokens: 500, completion_tokens: 300, total_cost: 0.01 }
      })

      const first = await service.detectComponentsFromUrl('https://example.com/', { globalSectionCache })
      const second = await service.detectComponentsFromUrl('https://example.com/about', { globalSectionCache })

      expect(first.components).toHaveLength(1)
      expect(second.components).toHaveLength(1)
      expect(second.components[0]?.type).toBe('navbar')
      expect(second.timingBreakdown?.sectionTimings).toEqual([
        expect.objectContaining({
          sectionKey: 'header:0-10',
          extractionMode: 'reused',
          cacheHit: true,
          requestCount: 0
        })
      ])
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(1)
    })

    it('processes sections concurrently while preserving component order', async () => {
      const originalConcurrency = DetectionConfig.sectionConcurrency
      ;(DetectionConfig as any).sectionConcurrency = 2
      mockWebTools.fetchOutline.mockResolvedValue({
        ...mockOutline,
        sections: [
          { key: 'main:0-50', approxBytes: 300, hash: 'one', nodeCount: 2 },
          { key: 'main:51-99', approxBytes: 300, hash: 'two', nodeCount: 2 }
        ]
      })
      mockWebTools.getSection.mockImplementation(async ({ key }: { key: string }) => ({
        handle: 'handle-1',
        key,
        slice: [{ tag: 'section', text: key }],
        stats: { nodeCount: 1, approxBytes: 300 }
      }))

      let inFlight = 0
      let maxInFlight = 0
      mockOpenAI.chat.completions.create = jest.fn(async (payload: any) => {
        inFlight++
        maxInFlight = Math.max(maxInFlight, inFlight)
        const content = payload.messages[payload.messages.length - 1].content as string
        const sectionKey = content.includes('main:0-50') ? 'main:0-50' : 'main:51-99'
        await new Promise(resolve => setTimeout(resolve, sectionKey === 'main:0-50' ? 20 : 1))
        inFlight--
        return {
          choices: [{
            message: {
              content: JSON.stringify({
                sectionKey,
                components: [
                  {
                    component: sectionKey === 'main:0-50' ? 'hero-with-image' : 'card-grid',
                    confidence: 0.9,
                    content: sectionKey === 'main:0-50'
                      ? { heading: 'First' }
                      : { cards: [{ type: 'card-item', title: 'Second' }] }
                  }
                ]
              })
            },
            finish_reason: 'stop'
          }],
          usage: { total_tokens: 10, prompt_tokens: 6, completion_tokens: 4 }
        } as any
      })

      try {
        const result = await service.detectComponentsFromUrl(mockPageUrl)

        expect(maxInFlight).toBe(2)
        expect(result.components.map(component => component.type)).toEqual(['hero-with-image', 'card-grid'])
        expect(result.timingBreakdown?.sectionTimings.map(section => section.sectionKey)).toEqual(['main:0-50', 'main:51-99'])
        expect(result.tokenUsage).toBe(20)
        expect(result.promptTokens).toBe(12)
        expect(result.completionTokens).toBe(8)
      } finally {
        ;(DetectionConfig as any).sectionConcurrency = originalConcurrency
      }
    })

    it('uses the page-map plan/fill harness when explicitly enabled', async () => {
      ;(DetectionConfig as any).detectionHarness = 'page-map'
      mockOpenAI.chat.completions.create = jest.fn()
        .mockResolvedValueOnce({
          choices: [{
            message: {
              content: JSON.stringify({
                sections: [
                  {
                    sectionKey: 'main:0-99',
                    plannedComponents: [
                      {
                        plannedComponentId: 'main:0-99:0',
                        component: 'hero-with-image',
                        confidence: 0.9,
                        evidenceRefs: ['s0#1']
                      }
                    ]
                  }
                ]
              })
            },
            finish_reason: 'stop'
          }],
          usage: { total_tokens: 100, prompt_tokens: 80, completion_tokens: 20 }
        })
        .mockResolvedValueOnce({
          choices: [{
            message: {
              content: JSON.stringify({
                sections: [
                  {
                    sectionKey: 'main:0-99',
                    components: [
                      {
                        plannedComponentId: 'main:0-99:0',
                        component: 'hero-with-image',
                        confidence: 0.9,
                        content: { heading: 'Welcome to Our Site' }
                      }
                    ]
                  }
                ]
              })
            },
            finish_reason: 'stop'
          }],
          usage: { total_tokens: 120, prompt_tokens: 90, completion_tokens: 30 }
        })

      const result = await service.detectComponentsFromUrl(mockPageUrl)

      expect(result.components).toHaveLength(1)
      expect(result.components[0].type).toBe('hero-with-image')
      expect(result.tokenUsage).toBe(220)
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(2)
      expect(result.timingBreakdown?.phaseTotals).toEqual(expect.arrayContaining([
        expect.objectContaining({ phase: 'page_map' }),
        expect.objectContaining({ phase: 'component_plan' }),
        expect.objectContaining({ phase: 'fill_batch' })
      ]))
    })

    it('sums page-map fill repair token usage and records fill telemetry metadata', async () => {
      ;(DetectionConfig as any).detectionHarness = 'page-map'
      const fillMetadata: Record<string, unknown>[] = []
      performanceMonitorMocks.endTimer.mockImplementation((operation: string, metadata?: Record<string, unknown>) => {
        if (operation === 'web.detect.fill_batch' && metadata) {
          fillMetadata.push(metadata)
        }
        return 12
      })
      mockOpenAI.chat.completions.create = jest.fn()
        .mockResolvedValueOnce({
          choices: [{
            message: {
              content: JSON.stringify({
                sections: [
                  {
                    sectionKey: 'main:0-99',
                    plannedComponents: [
                      {
                        plannedComponentId: 'main:0-99:0',
                        component: 'hero-with-image',
                        confidence: 0.9,
                        evidenceRefs: ['s0#1']
                      }
                    ]
                  }
                ]
              })
            },
            finish_reason: 'stop'
          }],
          usage: { total_tokens: 100, prompt_tokens: 80, completion_tokens: 20 }
        })
        .mockResolvedValueOnce({
          choices: [{
            message: {
              content: JSON.stringify({
                sections: [
                  {
                    sectionKey: 'main:0-99',
                    components: [
                      {
                        plannedComponentId: 'main:0-99:0',
                        component: 'card-grid',
                        confidence: 0.9,
                        content: { cards: [] }
                      }
                    ]
                  }
                ]
              })
            },
            finish_reason: 'stop'
          }],
          usage: { total_tokens: 120, prompt_tokens: 90, completion_tokens: 30 }
        })
        .mockResolvedValueOnce({
          choices: [{
            message: {
              content: JSON.stringify({
                sections: [
                  {
                    sectionKey: 'main:0-99',
                    components: [
                      {
                        plannedComponentId: 'main:0-99:0',
                        component: 'hero-with-image',
                        confidence: 0.9,
                        content: { heading: 'Welcome to Our Site' }
                      }
                    ]
                  }
                ]
              })
            },
            finish_reason: 'stop'
          }],
          usage: { total_tokens: 130, prompt_tokens: 100, completion_tokens: 30 }
        })

      const result = await service.detectComponentsFromUrl(mockPageUrl)

      expect(result.components).toHaveLength(1)
      expect(result.tokenUsage).toBe(350)
      expect(result.promptTokens).toBe(270)
      expect(result.completionTokens).toBe(80)
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(3)
      expect(fillMetadata).toEqual(expect.arrayContaining([
        expect.objectContaining({
          groupKey: 'fill:0',
          requestCount: 2,
          repairCount: 1,
          totalTokens: 250,
          promptTokens: 190,
          completionTokens: 60,
          fillBatchConcurrency: 1,
          candidateTypeCount: 1
        })
      ]))
    })

    it('reports page-map fill failures with the failed batch key', async () => {
      ;(DetectionConfig as any).detectionHarness = 'page-map'
      mockOpenAI.chat.completions.create = jest.fn()
        .mockResolvedValueOnce({
          choices: [{
            message: {
              content: JSON.stringify({
                sections: [
                  {
                    sectionKey: 'main:0-99',
                    plannedComponents: [
                      {
                        plannedComponentId: 'main:0-99:0',
                        component: 'hero-with-image',
                        confidence: 0.9,
                        evidenceRefs: ['s0#1']
                      }
                    ]
                  }
                ]
              })
            },
            finish_reason: 'stop'
          }],
          usage: { total_tokens: 100, prompt_tokens: 80, completion_tokens: 20 }
        })
        .mockResolvedValue({
          choices: [{
            message: {
              content: JSON.stringify({
                sections: [
                  {
                    sectionKey: 'main:0-99',
                    components: [
                      {
                        plannedComponentId: 'main:0-99:0',
                        component: 'card-grid',
                        confidence: 0.9,
                        content: { cards: [] }
                      }
                    ]
                  }
                ]
              })
            },
            finish_reason: 'stop'
          }],
          usage: { total_tokens: 120, prompt_tokens: 90, completion_tokens: 30 }
        })

      await expect(service.detectComponentsFromUrl(mockPageUrl)).rejects.toThrow('Page-map fill failed for fill:0')
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
              sectionKey: 'main:0-99',
              components: [
                { component: 'navbar', confidence: 0.8, content: { menuItems: [] } },
                { component: 'hero-with-image', confidence: 0.2, content: { heading: 'Low confidence' } }
              ]
            })
          }
        }],
        usage: { total_tokens: 1000 }
      })
      const result = await service.detectComponentsFromUrl(mockPageUrl, { confidenceThreshold: 0.25 })
      expect(result.components.some(component => component.confidence < 0.25)).toBe(false)
      const hero = result.components.find(component => component.component === 'hero-with-image')
      expect(hero).toBeUndefined()
      const nav = result.components.find(component => component.component === 'navbar' || component.type === 'navbar')
      expect(nav).toBeDefined()
    })

    it('rejects missing sectionKey in section harness without parser injection', async () => {
      mockOpenAI.chat.completions.create = jest.fn().mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              components: [
                { component: 'navbar', confidence: 0.95, content: { menuItems: [] } }
              ]
            })
          },
          finish_reason: 'stop'
        }],
        usage: { total_tokens: 1000 }
      })

      await expect(service.detectComponentsFromUrl(mockPageUrl)).rejects.toThrow('sectionKey must be "main:0-99"')
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(1)
    })

    it('still rejects explicitly wrong section keys in section harness', async () => {
      mockOpenAI.chat.completions.create = jest.fn().mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              sectionKey: 'footer',
              components: [
                { component: 'navbar', confidence: 0.95, content: { menuItems: [] } }
              ]
            })
          },
          finish_reason: 'stop'
        }],
        usage: { total_tokens: 1000 }
      })

      await expect(service.detectComponentsFromUrl(mockPageUrl)).rejects.toThrow('sectionKey must be "main:0-99"')
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(1)
    })

    it('rejects invalid component content after repair without dropping it silently', async () => {
      mockOpenAI.chat.completions.create = jest.fn().mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              sectionKey: 'main:0-99',
              components: [
                { component: 'navbar', confidence: 0.95, content: { menuItems: [] } },
                { component: 'logo-cloud', confidence: 0.95, content: null }
              ]
            })
          },
          finish_reason: 'stop'
        }],
        usage: { total_tokens: 1000 }
      })

      await expect(service.detectComponentsFromUrl(mockPageUrl)).rejects.toThrow(
        'Section main:0-99 produced 1 invalid component after repair'
      )
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(3)
    })

    it('uses a surgical repair pass to remove invalid empty components while preserving valid siblings', async () => {
      mockOpenAI.chat.completions.create = jest.fn()
        .mockResolvedValueOnce({
          choices: [{
            message: {
              content: JSON.stringify({
                sectionKey: 'main:0-99',
                components: [
                  { component: 'navbar', confidence: 0.95, content: { menuItems: [] } },
                  { component: 'logo-cloud', confidence: 0.95, content: null }
                ]
              })
            },
            finish_reason: 'stop'
          }],
          usage: { total_tokens: 1000 }
        })
        .mockResolvedValueOnce({
          choices: [{
            message: {
              content: JSON.stringify({
                sectionKey: 'main:0-99',
                components: [
                  { component: 'navbar', confidence: 0.95, content: { menuItems: [] } },
                  { component: 'logo-cloud', confidence: 0.95, content: null }
                ]
              })
            },
            finish_reason: 'stop'
          }],
          usage: { total_tokens: 1000 }
        })
        .mockResolvedValueOnce({
          choices: [{
            message: {
              content: JSON.stringify({
                sectionKey: 'main:0-99',
                components: [
                  { component: 'navbar', confidence: 0.95, content: { menuItems: [] } }
                ]
              })
            },
            finish_reason: 'stop'
          }],
          usage: { total_tokens: 1000 }
        })

      const result = await service.detectComponentsFromUrl(mockPageUrl)

      expect(result.components.map(component => component.type)).toEqual(['navbar'])
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(3)
      expect(mockOpenAI.chat.completions.create.mock.calls[2][0].messages.at(-1).content).toContain(
        'Do not return empty required arrays such as card-grid.cards: [].'
      )
    })

    it('fails required nonempty sections when all repaired components are invalid', async () => {
      mockOpenAI.chat.completions.create = jest.fn().mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              sectionKey: 'main:0-99',
              components: [
                { component: 'logo-cloud', confidence: 0.95, content: null }
              ]
            })
          },
          finish_reason: 'stop'
        }],
        usage: { total_tokens: 1000 }
      })

      await expect(service.detectComponentsFromUrl(mockPageUrl)).rejects.toThrow(
        'Section main:0-99 produced 1 invalid component after repair'
      )
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(2)
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

    it('rejects unknown component keys', async () => {
      mockOpenAI.chat.completions.create = jest.fn().mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              sectionKey: 'main:0-99',
              components: [
                { component: 'unknown-component', confidence: 0.95, content: {} }
              ],
              pageMetadata: {}
            })
          }
        }],
        usage: { total_tokens: 900 }
      })

      await expect(service.detectComponentsFromUrl('https://example.com/blog/how-to-scale')).rejects.toThrow('is not registered')
    })

    it('fails non-success source responses before LLM detection', async () => {
      mockWebTools.fetchOutline.mockResolvedValue({
        ...mockOutline,
        status: 404,
        finalUrl: 'https://example.com/missing'
      })

      await expect(service.detectComponentsFromUrl('https://example.com/missing')).rejects.toThrow(
        'Source returned HTTP 404 for https://example.com/missing'
      )
      expect(mockOpenAI.chat.completions.create).not.toHaveBeenCalled()
    })

    it('classifies retriable fetch outline failures before section validation', async () => {
      mockWebTools.fetchOutline.mockResolvedValue({
        handle: '',
        error: true,
        code: 0,
        message: 'browser context closed',
        retriable: true,
        sections: []
      })

      await expect(service.detectComponentsFromUrl(mockPageUrl)).rejects.toMatchObject({
        message: expect.stringContaining('Source fetch failed'),
        debug: expect.objectContaining({
          stage: 'fetch',
          validationPath: 'source.fetchOutline'
        })
      })

      expect(mockOpenAI.chat.completions.create).not.toHaveBeenCalled()
    })

    it('adds video-embed when section evidence contains an embedded video', async () => {
      mockWebTools.getSection.mockResolvedValue({
        handle: 'handle-1',
        key: 'main:0-99',
        slice: [
          { tag: 'section', pathId: 'n000001', class: 'video-section' },
          {
            tag: 'iframe',
            pathId: 'n000002',
            attrs: { src: 'https://www.youtube.com/embed/wGxC3_9GZJ4', title: 'YouTube video player' }
          }
        ],
        stats: { nodeCount: 2, approxBytes: 300 }
      })
      mockOpenAI.chat.completions.create = jest.fn().mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              sectionKey: 'main:0-99',
              components: [
                {
                  component: 'video-embed',
                  confidence: 0.95,
                  content: {
                    provider: 'youtube',
                    url: 'https://www.youtube.com/embed/wGxC3_9GZJ4',
                    title: 'YouTube video player'
                  }
                }
              ]
            })
          }
        }],
        usage: { total_tokens: 1000 }
      })

      const result = await service.detectComponentsFromUrl(mockPageUrl)

      expect(result.components).toHaveLength(1)
      expect(result.components[0].type).toBe('video-embed')
    })

    it('fails pages when all optional content sections return no components', async () => {
      mockOpenAI.chat.completions.create = jest.fn().mockResolvedValue({
        choices: [{ message: { content: JSON.stringify({ sectionKey: 'main:0-99', components: [] }) } }],
        usage: { total_tokens: 100 }
      })

      await expect(service.detectComponentsFromUrl(mockPageUrl)).rejects.toThrow('Section harness produced no components')
    })

    it('selects a route-matched template for non-home pages', async () => {
      const result = await service.detectComponentsFromUrl('https://example.com/blog/how-to-scale')

      expect(result.pageTemplate.templateKey).toBe('blog/post-standard')
    })

    it('selects the blog post template for article detail routes without explicit route hints', async () => {
      const result = await service.detectComponentsFromUrl('https://example.com/articles/how-to-scale')

      expect(result.pageTemplate.templateKey).toBe('blog/post-standard')
    })

    it('selects the blog index template for article index routes without explicit route hints', async () => {
      const result = await service.detectComponentsFromUrl('https://example.com/articles')

      expect(result.pageTemplate.templateKey).toBe('blog/index-standard')
    })

    it('does not select a home-eligible template for non-home landing pages', async () => {
      const result = await service.detectComponentsFromUrl('https://example.com/a-guide-to-digital-product-design-lp')

      expect(result.pageTemplate.templateKey).toBe('core/generic-default')
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
      const navBar = result.components.find(c => c.type === 'navbar')
      expect(navBar).toBeDefined()
      expect(navBar?.metadata).toBeDefined()
    })
  })

  // prompt building remains covered implicitly in web flow
})
