import { GreenfieldBootstrapper, type ProcessedPromptSnapshot } from '../greenfield-bootstrapper'
import { getComponentCatalogSummary, buildChatPrompt } from '@/lib/studio/ai/component-catalog'
import { generateDesignSystemFromPrompt } from '@/lib/studio/design-system/prompt-design-system-generator'

const mockFindDefault = jest.fn()
const mockCreateConcept = jest.fn()
const mockFindLatestByConceptId = jest.fn()
const mockCreateDesignSystem = jest.fn()

jest.mock('@/lib/studio/import/services/template-page-type-seeder', () => ({
  ensureTemplatePageTypes: jest.fn().mockResolvedValue(new Map())
}))

jest.mock('@/lib/studio/import/utils/update-system-event', () => ({
  updateSystemEvent: jest.fn().mockResolvedValue(undefined)
}))

jest.mock('@/lib/ai-tools/tools', () => ({
  tools: {}
}))

jest.mock('@/lib/studio/design-system/design-concept.repository', () => ({
  DesignConceptRepository: jest.fn().mockImplementation(() => ({
    findDefault: mockFindDefault,
    create: mockCreateConcept
  }))
}))

jest.mock('@/lib/studio/import/repositories/design-system.repository', () => ({
  DesignSystemRepository: jest.fn().mockImplementation(() => ({
    findLatestByConceptId: mockFindLatestByConceptId,
    create: mockCreateDesignSystem
  }))
}))

jest.mock('@/lib/studio/design-system/prompt-design-system-generator', () => ({
  generateDesignSystemFromPrompt: jest.fn()
}))

jest.mock('@/lib/studio/ai/component-catalog', () => ({
  getComponentCatalogSummary: jest.fn(),
  buildChatPrompt: jest.fn()
}))

jest.mock('@/lib/studio/ai/ai-sdk-provider', () => ({
  createAIModel: jest.fn(() => ({ modelId: 'test-model' }))
}))

jest.mock('ai', () => ({
  streamText: jest.fn(),
  tool: jest.fn((definition: any) => definition),
  stepCountIs: jest.fn((count: number) => ({ count }))
}))

const processedPrompt: ProcessedPromptSnapshot = {
  websiteName: 'SaaS Hero',
  description: 'Marketing site for SaaS tools',
  category: 'page',
  suggestedFeatures: ['pricing'],
  technicalRequirements: ['responsive'],
  targetAudience: 'founders'
}

const buildPrisma = () => ({
  website: {
    findUnique: jest.fn().mockResolvedValue({ id: 'site-1', accountId: 'acct-1' })
  },
  contentType: {
    findFirst: jest.fn().mockResolvedValue({ id: 'ct-1' })
  },
  websiteStructure: {
    findMany: jest.fn().mockResolvedValue([]),
    findFirst: jest.fn().mockResolvedValue(null)
  },
  websitePage: {
    findMany: jest.fn().mockResolvedValue([])
  },
  websiteComponentType: {
    findMany: jest.fn().mockResolvedValue([]),
    createMany: jest.fn().mockResolvedValue({ count: 0 })
  }
})

const buildTools = () => ({
  createSiteStructure: {
    execute: jest.fn()
  },
  populatePageContent: {
    execute: jest.fn()
  },
  searchImages: {
    execute: jest.fn()
  }
})

async function* chunks(items: any[]) {
  for (const item of items) {
    yield item
  }
}

describe('GreenfieldBootstrapper', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.OPENROUTER_API_KEY = 'test-key'
    process.env.OPENROUTER_MODEL = 'test-model'

    mockFindDefault.mockResolvedValue(null)
    mockCreateConcept.mockResolvedValue({ id: 'concept-1' })
    mockFindLatestByConceptId.mockResolvedValue(null)
    mockCreateDesignSystem.mockResolvedValue({ id: 'design-system-1' })
    ;(generateDesignSystemFromPrompt as jest.Mock).mockResolvedValue({
      tokens: { variables: { '--background': '0 0% 100%' } },
      hasCustomColors: true,
      mode: 'prompt'
    })
    ;(getComponentCatalogSummary as jest.Mock).mockResolvedValue({
      total: 1,
      categories: [{ name: 'Hero', components: [] }]
    })
    ;(buildChatPrompt as jest.Mock).mockReturnValue('dynamic component schemas')
  })

  it('throws when the dynamic component catalog cannot load', async () => {
    ;(getComponentCatalogSummary as jest.Mock).mockRejectedValue(new Error('catalog unavailable'))

    const bootstrapper = new GreenfieldBootstrapper({
      prismaClient: buildPrisma() as any,
      tools: buildTools() as any
    })

    await expect((bootstrapper as any).getComponentSchemas('site-1')).rejects.toThrow(
      'Failed to load component catalog for greenfield bootstrap: catalog unavailable'
    )
    expect(buildChatPrompt).not.toHaveBeenCalled()
  })

  it('fails design-system creation when LLM design generation fails', async () => {
    ;(generateDesignSystemFromPrompt as jest.Mock).mockRejectedValue(new Error('LLM failure'))

    const bootstrapper = new GreenfieldBootstrapper({
      prismaClient: buildPrisma() as any,
      tools: buildTools() as any
    })

    await expect((bootstrapper as any).createDefaultDesignSystem('site-1', processedPrompt)).rejects.toThrow('LLM failure')
    expect(mockCreateDesignSystem).not.toHaveBeenCalled()
  })

  it('fails design-system creation when persistence fails', async () => {
    mockCreateDesignSystem.mockRejectedValue(new Error('database unavailable'))

    const bootstrapper = new GreenfieldBootstrapper({
      prismaClient: buildPrisma() as any,
      tools: buildTools() as any
    })

    await expect((bootstrapper as any).createDefaultDesignSystem('site-1', processedPrompt)).rejects.toThrow('database unavailable')
    expect(generateDesignSystemFromPrompt).toHaveBeenCalledWith({
      prompt: 'SaaS Hero - Marketing site for SaaS tools - Target audience: founders'
    })
  })

  it('repairs an existing default concept that has no design system snapshot', async () => {
    mockFindDefault.mockResolvedValue({ id: 'existing-concept-1' })
    mockFindLatestByConceptId.mockResolvedValue(null)

    const bootstrapper = new GreenfieldBootstrapper({
      prismaClient: buildPrisma() as any,
      tools: buildTools() as any
    })

    await (bootstrapper as any).createDefaultDesignSystem('site-1', processedPrompt)

    expect(mockCreateConcept).not.toHaveBeenCalled()
    expect(mockFindLatestByConceptId).toHaveBeenCalledWith('existing-concept-1')
    expect(mockCreateDesignSystem).toHaveBeenCalledWith(expect.objectContaining({
      websiteId: 'site-1',
      designConceptId: 'existing-concept-1'
    }))
  })

  it('skips design-system generation only when the default concept already has a current snapshot', async () => {
    mockFindDefault.mockResolvedValue({ id: 'existing-concept-1' })
    mockFindLatestByConceptId.mockResolvedValue({ id: 'design-system-1' })

    const bootstrapper = new GreenfieldBootstrapper({
      prismaClient: buildPrisma() as any,
      tools: buildTools() as any
    })

    await (bootstrapper as any).createDefaultDesignSystem('site-1', processedPrompt)

    expect(generateDesignSystemFromPrompt).not.toHaveBeenCalled()
    expect(mockCreateDesignSystem).not.toHaveBeenCalled()
  })

  it('does not use the old hardcoded navbar hero footer retry prompt', async () => {
    const streamTextFn = jest.fn(() => ({
      fullStream: chunks([])
    }))
    const bootstrapper = new GreenfieldBootstrapper({
      prismaClient: buildPrisma() as any,
      tools: buildTools() as any,
      streamTextFn: streamTextFn as any
    })

    const result = await (bootstrapper as any).populateSinglePage(
      { websiteId: 'site-1', originalPrompt: 'Build a site' },
      {
        slug: 'home',
        title: 'Home',
        iaMetadata: {
          purpose: 'Introduce the business',
          targetAudience: 'founders',
          primaryQuestion: 'What is this?',
          journeyStage: 'awareness',
          sectionIntents: []
        }
      },
      { websiteName: 'SaaS Hero', targetAudience: 'founders', pages: [] },
      'ct-1',
      'dynamic component schemas'
    )

    const sentPrompts = streamTextFn.mock.calls.map(call => call[0].messages[0].parts[0].text)
    expect(result).toEqual({
      slug: 'home',
      success: false,
      error: 'AI did not call populatePageContent tool'
    })
    expect(streamTextFn).toHaveBeenCalledTimes(2)
    expect(sentPrompts.join('\n')).not.toContain('navbar, hero-simple, and footer')
  })

  it('returns page population results when any page fails', async () => {
    const bootstrapper = new GreenfieldBootstrapper({
      prismaClient: buildPrisma() as any,
      tools: buildTools() as any
    })

    jest.spyOn(bootstrapper as any, 'getComponentSchemas').mockResolvedValue('dynamic component schemas')
    jest.spyOn(bootstrapper as any, 'populateSinglePage')
      .mockResolvedValueOnce({ slug: 'home', success: true, pageId: 'page-1' })
      .mockResolvedValueOnce({ slug: 'pricing', success: false, error: 'tool failed' })

    await expect((bootstrapper as any).populateAllPagesParallel(
      {
        websiteId: 'site-1',
        accountId: 'acct-1',
        originalPrompt: 'Build a SaaS marketing site',
        processedPrompt
      },
      { id: 'site-1' },
      {
        structures: {
          home: { id: 'structure-1', fullPath: '/' },
          pricing: { id: 'structure-2', fullPath: '/pricing' }
        },
        pages: [
          {
            slug: 'home',
            title: 'Home',
            iaMetadata: {
              purpose: 'Intro',
              targetAudience: 'founders',
              primaryQuestion: 'What is this?',
              journeyStage: 'awareness',
              sectionIntents: []
            }
          },
          {
            slug: 'pricing',
            title: 'Pricing',
            iaMetadata: {
              purpose: 'Explain pricing',
              targetAudience: 'founders',
              primaryQuestion: 'What does it cost?',
              journeyStage: 'decision',
              sectionIntents: []
            }
          }
        ]
      }
    )).resolves.toEqual([
      { slug: 'home', success: true, pageId: 'page-1' },
      { slug: 'pricing', success: false, error: 'tool failed' }
    ])
  })

  it('reports partial page generation failures through the public bootstrap result', async () => {
    const bootstrapper = new GreenfieldBootstrapper({
      prismaClient: buildPrisma() as any,
      tools: buildTools() as any
    })

    jest.spyOn(bootstrapper as any, 'createDefaultDesignSystem').mockResolvedValue(undefined)
    jest.spyOn(bootstrapper as any, 'generateIA').mockResolvedValue({
      structures: {
        home: { id: 'structure-1', fullPath: '/' },
        pricing: { id: 'structure-2', fullPath: '/pricing' }
      },
      pages: []
    })
    jest.spyOn(bootstrapper as any, 'populateAllPagesParallel').mockResolvedValue([
      { slug: 'home', success: true, pageId: 'page-1' },
      { slug: 'pricing', success: false, error: 'tool failed' }
    ])
    jest.spyOn(bootstrapper as any, 'resolveReferences').mockResolvedValue(undefined)
    jest.spyOn(bootstrapper as any, 'registerComponentTypesFromPages').mockResolvedValue(undefined)

    const result = await bootstrapper.bootstrapWebsite({
      websiteId: 'site-1',
      accountId: 'acct-1',
      originalPrompt: 'Build a SaaS marketing site',
      processedPrompt
    })

    expect(result).toEqual({
      pagesCreated: 2,
      populatedPages: 1,
      fallbackApplied: false,
      success: false,
      error: 'Content generation failed for pages: pricing: tool failed'
    })
    expect((bootstrapper as any).resolveReferences).toHaveBeenCalled()
    expect((bootstrapper as any).registerComponentTypesFromPages).toHaveBeenCalledWith('site-1')
  })
})
