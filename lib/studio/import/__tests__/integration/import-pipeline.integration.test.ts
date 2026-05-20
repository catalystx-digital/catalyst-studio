import type { ImportPipelineResult } from '../../import-pipeline'
import OpenAI from 'openai'
import { performanceMonitor } from '@/lib/studio/components/cms/_import/performance'
import type { ComponentPattern } from '@/lib/studio/components/cms/_import/types'

const detectionFixtures = require('./fixtures/bathurst-detection.json') as Record<string, any>

const mockComponents: ComponentPattern[] = [
  {
    type: 'NavBar',
    category: 'navigation',
    keywords: ['navigation', 'menu', 'header'],
    patterns: ['nav', 'menu', 'header'],
    confidence: 0.92,
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
    confidence: 0.9,
    metadata: {
      category: 'heroes',
      properties: ['heading', 'subheading', 'backgroundImage', 'ctaButton'],
      description: 'Hero section with background image',
      keywords: ['hero', 'banner']
    }
  },
  {
    type: 'HeroMinimal',
    category: 'heroes',
    keywords: ['hero', 'minimal'],
    patterns: ['hero'],
    confidence: 0.88,
    metadata: {
      category: 'heroes',
      properties: ['heading', 'subheading', 'eyebrow'],
      description: 'Simple Hero variant',
      keywords: ['hero', 'minimal']
    }
  },
  {
    type: 'TextBlock',
    category: 'content',
    keywords: ['content', 'text'],
    patterns: ['text'],
    confidence: 0.85,
    metadata: {
      category: 'content',
      properties: ['heading', 'body'],
      description: 'Text section',
      keywords: ['text']
    }
  },
  {
    type: 'Footer',
    category: 'navigation',
    keywords: ['footer'],
    patterns: ['footer'],
    confidence: 0.9,
    metadata: {
      category: 'navigation',
      properties: ['links', 'copyright'],
      description: 'Site footer',
      keywords: ['footer']
    }
  },
  {
    type: 'Testimonials',
    category: 'social-proof',
    keywords: ['testimonial', 'quote'],
    patterns: ['testimonial'],
    confidence: 0.84,
    metadata: {
      category: 'social-proof',
      properties: ['items'],
      description: 'Testimonials grid',
      keywords: ['testimonial']
    }
  }
]

jest.mock('../../../ai/component-catalog', () => ({
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

jest.mock('../../../ai/page-catalog', () => ({
  getPageCatalogSummary: jest.fn(async () => ({
    generatedAt: new Date().toISOString(),
    total: 2,
    templates: [
      {
        templateKey: 'marketing/home-default',
        name: 'Marketing Home',
        category: 'marketing',
        isHomeEligible: true,
        description: 'Marketing homepage',
        requiredRegions: [{ region: 'hero', allowedComponents: ['HeroWithImage', 'HeroMinimal'] }],
        optionalRegions: [],
        propsMeta: undefined,
        aiMetadata: {
          keywords: ['home'],
          layoutGuidelines: ['Ensure hero leads page'],
          contentGuidelines: [],
          recommendedComponents: ['HeroWithImage'],
          discouragedComponents: [],
          exampleUseCases: [],
          routeHints: ['/', '/home']
        }
      }
    ],
    categories: [
      { category: 'marketing', templates: ['marketing/home-default'] as any }
    ],
    homeEligibleTemplates: ['marketing/home-default']
  })),
  buildPageTemplatePrompt: jest.fn(() => 'page prompt')
}))

jest.mock('@/lib/studio/components/cms/_import/detection-api', () => {
  const mockInstance = {
    detectComponentPatterns: jest.fn(() => mockComponents),
    detectComponentPatternsAsync: jest.fn(async () => mockComponents),
    getRegistryStats: jest.fn(() => ({
      componentCount: mockComponents.length,
      patternCacheEntries: 0,
      catalogCached: true,
      cacheAgeMs: 0,
      initialized: false,
      skipped: false,
      untracked: false
    })),
    warmupCache: jest.fn(),
    clearCache: jest.fn(),
    getComponentPatterns: jest.fn(),
    getAggregatedPatterns: jest.fn(() => ({
      keywords: new Set<string>(),
      patterns: new Set<string>(),
      domSelectors: new Set<string>()
    }))
  }

  return {
    DetectionAPI: jest.fn(() => mockInstance),
    detectionAPI: mockInstance
  }
})

jest.mock('../../../components/cms/_factory/initialize', () => ({
  initializeCMSComponents: jest.fn().mockResolvedValue(undefined)
}))

jest.mock('openai')

describe('ImportPipeline integration (fixture-driven)', () => {
  let pipeline: ImportPipeline
  let mockOpenAI: jest.Mocked<OpenAI>

  beforeEach(() => {
    jest.clearAllMocks()

    const detectionApiModule = require('@/lib/studio/components/cms/_import/detection-api') as { detectionAPI?: any }
    if (detectionApiModule.detectionAPI) {
      jest.spyOn(detectionApiModule.detectionAPI, 'detectComponentPatterns').mockReturnValue(mockComponents)
      jest.spyOn(detectionApiModule.detectionAPI, 'detectComponentPatternsAsync').mockResolvedValue(mockComponents)
      jest.spyOn(detectionApiModule.detectionAPI, 'getRegistryStats').mockReturnValue({
        componentCount: mockComponents.length,
        patternCacheEntries: 0,
        catalogCached: true,
        cacheAgeMs: 0
      })
    }

    jest.spyOn(performanceMonitor, 'measure').mockImplementation(async (_name: string, fn: any) => fn())
    jest.spyOn(performanceMonitor, 'measureSync').mockImplementation((_name: string, fn: any) => fn())
    jest.spyOn(performanceMonitor, 'startTimer').mockImplementation(name => `${name}-timer`)
    jest.spyOn(performanceMonitor, 'endTimer').mockImplementation(() => 16)

    mockOpenAI = {
      chat: {
        completions: {
          create: jest.fn(async ({ messages }) => {
            const lastMessage = messages[messages.length - 1]
            const urlMatch = typeof lastMessage.content === 'string'
              ? lastMessage.content.match(/Extract components from: ([^\s]+)\./)
              : null
            const url = urlMatch?.[1]?.trim()
            if (!url || !detectionFixtures[url]) {
              throw new Error(`No detection fixture for ${url}`)
            }
            const fixture = detectionFixtures[url]
            return {
              choices: [
                {
                  message: {
                    content: JSON.stringify(fixture.llmResponse)
                  },
                  finish_reason: 'stop'
                }
              ],
              usage: fixture.usage
            }
          })
        }
      }
    } as any
    ;(OpenAI as jest.MockedClass<typeof OpenAI>).mockImplementation(() => mockOpenAI)

    const { ImportPipeline } = require('../../import-pipeline') as { ImportPipeline: new () => ImportPipeline }
    pipeline = new ImportPipeline()
  })

  it('executes the import pipeline end-to-end for fixture pages', async () => {
    const urls = ['https://fixture.local/home', 'https://fixture.local/about']

    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined)
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined)

    const result: ImportPipelineResult = await pipeline.execute({
      urls,
      enablePerformanceMonitoring: true,
      onProgress: jest.fn()
    })

    logSpy.mockRestore()
    warnSpy.mockRestore()

    expect(result.success).toBe(true)
    expect(result.data?.detectedComponents).toHaveLength(2)
    expect(result.data?.navigation.pages.map(page => page.url)).toEqual(['/home', '/about'])
    expect(result.data?.designTokens.componentUsage.length).toBeGreaterThan(0)

    expect(result.performance).toBeDefined()
    expect(result.performance?.detectionTime).toBeGreaterThanOrEqual(0)
    expect(performanceMonitor.measure).toHaveBeenCalledWith(
      'web.detect',
      expect.any(Function)
    )

    expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(urls.length)
  })
})


