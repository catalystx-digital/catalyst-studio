
/**
 * Tests for Web-Based Component Detection Service
*/

import { DetectionService } from '../web-detection'
import { DetectionAPI } from '@/lib/studio/components/cms/_import/detection-api'
import { DetectionConfig, ModelConfig } from '../config'
import OpenAI from 'openai'
import type { ComponentPattern } from '@/lib/studio/components/cms/_import/types'
import { createFakeDecisionClient, setDecisionClient } from '@/lib/studio/decisions'
import { getPageCatalogSummary } from '@/lib/studio/ai/page-catalog'

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
    type: 'blog-list',
    category: 'blog',
    keywords: ['blog', 'news', 'articles'],
    patterns: ['blog', 'news', 'article'],
    confidence: 0.86,
    metadata: {
      category: 'blog',
      properties: ['posts', 'title'],
      description: 'Blog listing',
      keywords: ['blog', 'news']
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
          keywords: ['blog', 'resources'],
          layoutGuidelines: ['List articles'],
          contentGuidelines: [],
          recommendedComponents: [],
          discouragedComponents: [],
          exampleUseCases: [],
          routeHints: ['/blog', '/resources']
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
jest.mock('../detection/blocks/block-harness', () => ({
  runBlockHarness: jest.fn(async ({ client, tasks }: any) => {
    const response = await client.chat.completions.create({})
    const parsed = JSON.parse(response.choices[0].message.content)
    tasks.push({ sectionKey: 'block:0', sectionOrder: 0, role: 'main', required: false, candidateTypes: [] })
    return [{
      artifact: { sectionKey: 'block:0', sectionOrder: 0, components: parsed.components.map((component: any) => ({ ...component, type: component.component, metadata: {} })), pageMetadata: parsed.pageMetadata },
      usage: response.usage, requestCount: 1,
      reuse: { freshSections: 1, reusedSections: 0, cacheHits: 0, cacheMisses: 0 }
    }]
  })
}))

jest.mock('openai')
jest.mock('@/lib/studio/design-system/dom-probe/launch-headless-chromium', () => ({ launchHeadlessChromium: jest.fn() }))

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

const mockBlogIndexResponse = JSON.stringify({
  sectionKey: 'main:0-99',
  components: [
    { component: 'navbar', confidence: 0.95, content: { menuItems: [{ label: 'Home', href: { type: 'internal', pageId: 'home', path: '/' } }] } },
    {
      component: 'blog-list',
      confidence: 0.9,
      content: {
        title: 'News',
        posts: [
          {
            title: 'News item',
            excerpt: 'Short update'
          }
        ]
      }
    }
  ],
  pageMetadata: { title: 'News' }
})

describe('DetectionService (web-based)', () => {
  const originalEnv = process.env
  beforeEach(() => { process.env = { ...originalEnv } })
  afterEach(() => { process.env = originalEnv; setDecisionClient(null) })
  let service: DetectionService
  let mockDetectionAPI: jest.Mocked<DetectionAPI>
  let mockOpenAI: jest.Mocked<OpenAI>

  beforeEach(() => {
    jest.clearAllMocks()
    mockWebTools.fetchOutline.mockResolvedValue(mockOutline)
    mockWebTools.getLastFetchOutline.mockReturnValue(mockOutline)
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

    process.env.DECISION_MODEL_ENABLED = 'true'
    process.env.DECISION_MODEL_SHADOW = 'false'
    // isDecisionModelEnabledFor also requires a key. Without this the suite
    // passes only on a machine that happens to have a real OPENROUTER_API_KEY
    // in its environment, and fails everywhere else.
    process.env.DECISION_MODEL_API_KEY = 'fake'
    process.env.DECISION_MODEL_WEBSITE_ALLOWLIST = ''
    setDecisionClient(createFakeDecisionClient({}))
    service = new DetectionService()
  })

  describe('model template route eligibility', () => {
    const originalEnv = process.env

    beforeEach(() => {
      process.env = {
        ...originalEnv,
        DECISION_MODEL_ENABLED: 'true',
        DECISION_MODEL_SHADOW: 'false',
        DECISION_MODEL_API_KEY: 'fake',
        DECISION_MODEL_QUESTIONS: 'page.type',
        DECISION_MODEL_WEBSITE_ALLOWLIST: '',
        DECISION_MODEL_LOG_DIR: ''
      }
    })

    afterEach(() => {
      setDecisionClient(null)
      process.env = originalEnv
    })

    it.each([
      ['/about', 'marketing/home-default', false],
      ['/', 'marketing/home-default', true],
      ['/about', 'blog/post-standard', true]
    ] as const)('checks %s eligibility for model template %s', async (path, templateKey, accepted) => {
      const summary = await getPageCatalogSummary()
      // Keep the root's deterministic choice distinct so model acceptance is exercised.
      summary.homeEligibleTemplates = []
      const url = `https://example.com${path}`
      const deterministic = service['selectPageTemplate'](summary, url, [])
      expect(deterministic.templateKey).toBe('core/generic-default')
      const client = createFakeDecisionClient({ 'page.type': { value: templateKey, probability: 0.9 } })
      const askSpy = jest.spyOn(client, 'askRaw')
      setDecisionClient(client)

      const result = await service['selectPageTemplateWithModel'](summary, url, [], { title: 'Example' })

      expect(askSpy).toHaveBeenCalledTimes(1)
      if (accepted) {
        expect(result).toMatchObject({ templateKey, source: 'model', confidence: 0.9 })
      } else {
        expect(result).toEqual(deterministic)
      }
    })
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
      expect(result.detectionHarness).toBe('blocks')
      expect(require('../detection/blocks/block-harness').runBlockHarness).toHaveBeenCalledTimes(1)
    })

    it('loads catalog summary for detection', async () => {
      const summaryMock = getComponentCatalogSummary as jest.Mock
      summaryMock.mockClear()
      await service.detectComponentsFromUrl(mockPageUrl)
      expect(summaryMock).toHaveBeenCalledTimes(1)
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

    it('selects a route-matched template for non-home pages', async () => {
      const result = await service.detectComponentsFromUrl('https://example.com/blog/how-to-scale')

      expect(result.pageTemplate.templateKey).toBe('blog/post-standard')
    })

    it('selects the blog post template for article detail routes without explicit route hints', async () => {
      const result = await service.detectComponentsFromUrl('https://example.com/articles/how-to-scale')

      expect(result.pageTemplate.templateKey).toBe('blog/post-standard')
    })

    it('selects the blog index template for article index routes without explicit route hints', async () => {
      mockOpenAI.chat.completions.create = jest.fn().mockResolvedValue({
        choices: [{ message: { content: mockBlogIndexResponse } }],
        usage: { total_tokens: 1000 }
      })
      const result = await service.detectComponentsFromUrl('https://example.com/articles')

      expect(result.pageTemplate.templateKey).toBe('blog/index-standard')
    })

    it('selects the blog index template for paginated editorial listing routes', async () => {
      mockOpenAI.chat.completions.create = jest.fn().mockResolvedValue({
        choices: [{ message: { content: mockBlogIndexResponse } }],
        usage: { total_tokens: 1000 }
      })
      const result = await service.detectComponentsFromUrl('https://example.com/news/page/3')

      expect(result.pageTemplate.templateKey).toBe('blog/index-standard')
    })

    it('selects the blog index template for paginated article archive routes', async () => {
      mockOpenAI.chat.completions.create = jest.fn().mockResolvedValue({
        choices: [{ message: { content: mockBlogIndexResponse } }],
        usage: { total_tokens: 1000 }
      })
      const result = await service.detectComponentsFromUrl('https://example.com/articles/page/2/')

      expect(result.pageTemplate.templateKey).toBe('blog/index-standard')
    })

    it('does not select the blog index template for resource grids without article posts', async () => {
      const result = await service.detectComponentsFromUrl('https://example.com/resources')

      expect(result.components.map(component => component.type)).toEqual(['navbar', 'hero-with-image', 'card-grid'])
      expect(result.pageTemplate.templateKey).toBe('core/generic-default')
    })

    it('keeps article slug routes on the blog post template', async () => {
      const result = await service.detectComponentsFromUrl('https://example.com/news/some-slug')

      expect(result.pageTemplate.templateKey).toBe('blog/post-standard')
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
