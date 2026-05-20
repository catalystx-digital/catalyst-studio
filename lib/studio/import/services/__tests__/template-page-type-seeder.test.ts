jest.mock('@/lib/studio/ai/page-catalog', () => ({
  getPageCatalogSummary: jest.fn(),
}));

import { ensureTemplatePageTypes } from '@/lib/studio/import/services/template-page-type-seeder'
import { getPageCatalogSummary } from '@/lib/studio/ai/page-catalog'

describe('ensureTemplatePageTypes', () => {
  const mockSummary = {
    total: 3,
    generatedAt: '2024-10-01T00:00:00.000Z',
    templates: [
      {
        templateKey: 'core/folder',
        name: 'Navigation Folder',
        category: 'core',
        isHomeEligible: false,
        description: 'Folder container',
        requiredRegions: [],
        optionalRegions: [],
        contentSchema: {
          components: {
            type: 'component-list',
            required: false,
            allowedComponentTypes: []
          }
        },
        propsMeta: undefined,
        aiMetadata: {
          keywords: [],
          layoutGuidelines: [],
          contentGuidelines: [],
          recommendedComponents: [],
          discouragedComponents: [],
          exampleUseCases: [],
          routeHints: []
        }
      },
      {
        templateKey: 'blog/post-standard',
        name: 'Blog Post',
        category: 'blog',
        isHomeEligible: false,
        description: 'Blog article detail',
        requiredRegions: [
          { region: 'main', allowedComponents: ['blog-post'], min: 1 }
        ],
        optionalRegions: [],
        contentSchema: {
          components: {
            type: 'component-list',
            required: true,
            allowedComponentTypes: ['blog-post', 'article-header', 'author-bio', 'related-posts']
          }
        },
        propsMeta: undefined,
        aiMetadata: {
          keywords: [],
          layoutGuidelines: [],
          contentGuidelines: [],
          recommendedComponents: [],
          discouragedComponents: [],
          exampleUseCases: [],
          routeHints: []
        }
      },
      {
        templateKey: 'marketing/home-default',
        name: 'Marketing Home',
        category: 'marketing',
        isHomeEligible: true,
        description: 'Home page layout',
        requiredRegions: [
          { region: 'header', allowedComponents: ['navbar'], min: 1 },
          { region: 'main', allowedComponents: ['hero-with-image', 'card-grid'], min: 1 }
        ],
        optionalRegions: [],
        contentSchema: {
          components: {
            type: 'component-list',
            required: true,
            allowedComponentTypes: ['navbar', 'hero-with-image', 'card-grid', 'footer']
          }
        },
        propsMeta: undefined,
        aiMetadata: {
          keywords: [],
          layoutGuidelines: [],
          contentGuidelines: [],
          recommendedComponents: [],
          discouragedComponents: [],
          exampleUseCases: [],
          routeHints: []
        }
      }
    ],
    categories: [],
    homeEligibleTemplates: ['marketing/home-default']
  }

  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    jest.spyOn(console, 'error').mockImplementation(() => undefined)
    ;(getPageCatalogSummary as jest.Mock).mockResolvedValue(mockSummary)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('upserts content types derived from templates', async () => {
    const upsert = jest.fn().mockResolvedValue({})
    const findMany = jest.fn().mockResolvedValue([
      { id: 'ct-core-folder', fields: { templateKey: 'core/folder' } },
      { id: 'ct-blog-post', fields: { templateKey: 'blog/post-standard' } },
      { id: 'ct-marketing-home', fields: { templateKey: 'marketing/home-default' } }
    ])
    const prisma = {
      contentType: {
        upsert,
        findMany
      }
    } as any

    const mapping = await ensureTemplatePageTypes({ prisma, websiteId: 'site-1' })

    expect(getPageCatalogSummary).toHaveBeenCalled()
    expect(upsert).toHaveBeenCalledTimes(3)

    expect(mapping.get('blog/post-standard')).toBe('ct-blog-post')
    expect(mapping.get('marketing/home-default')).toBe('ct-marketing-home')
    expect(mapping.get('core/folder')).toBe('ct-core-folder')

    expect(findMany).toHaveBeenCalledWith({
      where: {
        websiteId: 'site-1',
        key: {
          startsWith: 'template-'
        }
      },
      select: {
        id: true,
        fields: true
      }
    })

    const blogCall = upsert.mock.calls.find(call => call[0].where.websiteId_key.key === 'template-blog-post-standard')
    expect(blogCall).toBeDefined()
    expect(blogCall?.[0].create).toEqual(expect.objectContaining({
      websiteId: 'site-1',
      key: 'template-blog-post-standard',
      name: 'Blog Post',
      pluralName: 'Blog Posts'
    }))
    const blogFieldsPayload = blogCall?.[0].create.fields as any
    expect(blogFieldsPayload.templateKey).toBe('blog/post-standard')
    expect(blogFieldsPayload.isHomeEligible).toBe(false)
    expect(blogFieldsPayload.fields).toEqual([
      expect.objectContaining({
        name: 'components',
        type: 'component-list',
        required: true,
        allowedComponentTypes: expect.arrayContaining(['blog-post'])
      })
    ])

    const homeCall = upsert.mock.calls.find(call => call[0].where.websiteId_key.key === 'template-marketing-home-default')
    expect(homeCall).toBeDefined()
    const homeFieldsPayload = homeCall?.[0].create.fields as any
    expect(homeFieldsPayload.isHomeEligible).toBe(true)
    expect(homeFieldsPayload.fields).toEqual([
      expect.objectContaining({
        name: 'components',
        type: 'component-list',
        required: true,
        allowedComponentTypes: expect.arrayContaining(['navbar', 'hero-with-image', 'card-grid', 'footer'])
      })
    ])

    const folderCall = upsert.mock.calls.find(call => call[0].where.websiteId_key.key === 'template-core-folder')
    expect(folderCall).toBeDefined()
    const folderFieldsPayload = folderCall?.[0].create.fields as any
    expect(folderFieldsPayload.fields).toEqual([
      expect.objectContaining({
        name: 'components',
        type: 'component-list',
        required: false,
        allowedComponentTypes: []
      })
    ])
  })

  it('skips when prisma contentType client is missing', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    const result = await ensureTemplatePageTypes({ prisma: {} as any, websiteId: 'site-1' })
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('TemplatePageTypeSeeder'))
    expect(result.size).toBe(0)
  })
})

