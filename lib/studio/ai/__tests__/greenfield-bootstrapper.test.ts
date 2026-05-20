import { GreenfieldBootstrapper } from '../greenfield-bootstrapper'

jest.mock('@/lib/studio/import/services/template-page-type-seeder', () => ({
  ensureTemplatePageTypes: jest.fn().mockResolvedValue(new Map())
}))

jest.mock('@/lib/services/unified-page-service', () => ({
  unifiedPageService: {
    createPage: jest.fn()
  }
}))

const unifiedPageService = require('@/lib/services/unified-page-service').unifiedPageService as {
  createPage: jest.Mock
}

describe('GreenfieldBootstrapper', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.OPENROUTER_API_KEY = 'test-key'
    process.env.OPENROUTER_MODEL = 'test-model'
  })

  const buildDependencies = () => {
    const contextProvider = {
      loadWebsiteContext: jest.fn().mockResolvedValue({ website: { id: 'site-1' }, contentTypes: [], metadata: { loadTime: 10, pruned: false } })
    }

    const prisma = {
      website: {
        findUnique: jest.fn().mockResolvedValue({ id: 'site-1', accountId: 'acct-1' })
      },
      websitePage: {
        count: jest.fn().mockResolvedValue(2),
        findMany: jest.fn().mockResolvedValue([
          { id: 'page-1', content: { components: [{ type: 'HeroSimple' }] } }
        ])
      },
      contentType: {
        findFirst: jest.fn().mockResolvedValue({ id: 'ct-1' }),
        create: jest.fn()
      }
    }

    const streamTextFn = jest.fn(({ tools }: any) => ({
      warnings: Promise.resolve(undefined),
      usage: Promise.resolve({} as any),
      sources: Promise.resolve([]),
      files: Promise.resolve([]),
      finishReason: Promise.resolve('stop' as any),
      providerMetadata: Promise.resolve(undefined),
      experimental_providerMetadata: Promise.resolve(undefined),
      text: Promise.resolve(''),
      reasoning: Promise.resolve(undefined),
      reasoningDetails: Promise.resolve([]),
      toolCalls: Promise.resolve([]),
      toolResults: Promise.resolve([]),
      steps: Promise.resolve([]),
      request: Promise.resolve({} as any),
      response: Promise.resolve({ messages: [] } as any),
      textStream: {} as any,
      fullStream: {} as any,
      experimental_partialOutputStream: {} as any,
      consumeStream: jest.fn(async () => {
        await tools.createPage.execute({}, {})
      }),
      toDataStream: jest.fn(),
      mergeIntoDataStream: jest.fn(),
      pipeDataStreamToResponse: jest.fn()
    }))

    const toolExecute = jest.fn().mockResolvedValue({ success: true })
    const tools = {
      createPage: {
        description: 'Create a page',
        parameters: {}, // Vercel AI SDK tools don't expose shape - websiteId injection is explicit
        execute: toolExecute
      },
      listContentTypes: {
        description: 'List content types',
        parameters: {},
        execute: jest.fn().mockResolvedValue({ contentTypes: [{ id: 'ct-1', name: 'Page' }] })
      },
      searchImages: {
        description: 'Search images',
        parameters: {},
        execute: jest.fn().mockResolvedValue({ images: [] })
      }
    }

    const openRouterFactory = jest.fn(() => jest.fn(() => ({})))

    return { contextProvider, prisma, streamTextFn, tools, openRouterFactory }
  }

  it('runs AI bootstrap and counts populated pages', async () => {
    const deps = buildDependencies()
    const bootstrapper = new GreenfieldBootstrapper({
      contextProvider: deps.contextProvider as any,
      prismaClient: deps.prisma as any,
      streamTextFn: deps.streamTextFn as any,
      tools: deps.tools as any,
      openRouterFactory: deps.openRouterFactory as any
    })

    const result = await bootstrapper.bootstrapWebsite({
      websiteId: 'site-1',
      accountId: 'acct-1',
      originalPrompt: 'Build a SaaS marketing site',
      processedPrompt: {
        websiteName: 'SaaS Hero',
        description: 'Marketing site for SaaS tools',
        category: 'page',
        suggestedFeatures: ['pricing'],
        technicalRequirements: ['responsive'],
        targetAudience: 'founders'
      }
    })

    expect(deps.streamTextFn).toHaveBeenCalled()
    expect(result.fallbackApplied).toBe(false)
    expect(result.pagesCreated).toBe(2)
    expect(result.populatedPages).toBe(1)
  })

  it('falls back to seeding content when AI fails', async () => {
    const deps = buildDependencies()
    deps.streamTextFn = jest.fn(() => {
      throw new Error('LLM failure')
    })
    deps.prisma.websitePage.findMany = jest.fn().mockResolvedValue([])
    deps.prisma.websitePage.count = jest.fn().mockResolvedValue(0)

    const bootstrapper = new GreenfieldBootstrapper({
      contextProvider: deps.contextProvider as any,
      prismaClient: deps.prisma as any,
      streamTextFn: deps.streamTextFn as any,
      tools: deps.tools as any,
      openRouterFactory: deps.openRouterFactory as any
    })

    const result = await bootstrapper.bootstrapWebsite({
      websiteId: 'site-1',
      accountId: 'acct-1',
      originalPrompt: 'Portfolio',
      processedPrompt: {
        websiteName: 'My Work',
        description: 'Showcase of work',
        category: 'page',
        suggestedFeatures: [],
        technicalRequirements: [],
        targetAudience: 'clients'
      }
    })

    expect(result.fallbackApplied).toBe(true)
    expect(unifiedPageService.createPage).toHaveBeenCalledTimes(4)
    expect(unifiedPageService.createPage).toHaveBeenCalledWith(
      expect.objectContaining({
        slug: 'home'
      }),
      'ai'
    )
  })
})
