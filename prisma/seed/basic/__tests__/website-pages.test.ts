import { createWebsitePages } from '../website-pages'
import { PrismaClient, Prisma } from '../../../../lib/generated/prisma'
import { getPageCatalogSummary } from '../../../../lib/studio/pages/catalog'
import { validatePageTemplate } from '../../../../lib/studio/pages/validation/template-validation'
import type { PageCatalogTemplateSummary } from '../../../../lib/studio/pages/catalog'
import { ensureTemplatePageTypes } from '../../../../lib/studio/import/services/template-page-type-seeder'

// Mock Prisma
jest.mock('../../../../lib/generated/prisma', () => ({
  PrismaClient: jest.fn(),
  Prisma: {
    JsonNull: null
  }
}))

jest.mock('../../../../lib/studio/import/services/template-page-type-seeder', () => ({
  ensureTemplatePageTypes: jest.fn()
}))

describe('Website Pages Seed', () => {
  let prisma: any
  let mockCreate: jest.Mock
  let mockUpsert: jest.Mock
  let sharedComponents: any[]
  
  let warnSpy: jest.SpyInstance
  let mockEnsureTemplatePageTypes: jest.Mock

  beforeEach(() => {
    mockCreate = jest.fn()
    mockUpsert = jest.fn()
    sharedComponents = buildSharedComponentRefs()

    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})

    prisma = {
      websitePage: {
        create: mockCreate
      },
      contentType: {
        upsert: mockUpsert
      }
    }
    jest.clearAllMocks()

    mockUpsert.mockResolvedValue({
      id: 'test-content-type-id',
      key: 'test_content',
      name: 'Test',
      pluralName: 'Tests',
      category: 'page',
      displayField: 'title',
      websiteId: 'test-website',
      fields: []
    })

    mockCreate.mockImplementation(async ({ data }) => ({
      id: `${data.title}-${data.type}`,
      ...data
    }))

    mockEnsureTemplatePageTypes = ensureTemplatePageTypes as unknown as jest.Mock
    mockEnsureTemplatePageTypes.mockResolvedValue(
      new Map([
        ['core/generic-default', 'template-core-generic-default-id'],
        ['core/folder', 'template-core-folder-id'],
        ['marketing/home-default', 'template-marketing-home-id'],
        ['blog/index-standard', 'template-blog-index-id'],
        ['blog/post-standard', 'template-blog-post-id'],
        ['commerce/product-detail', 'template-commerce-product-detail-id']
      ])
    )
  })

  afterEach(() => {
    warnSpy.mockRestore()
  })

  function getCreatedData() {
    return mockCreate.mock.calls.map(call => call[0].data)
  }

  it('creates pages with template metadata and region summaries', async () => {
    await createWebsitePages(prisma as PrismaClient, 'test-website', [], sharedComponents as any)

    const pageCalls = getCreatedData().filter(data => data.type === 'page')
    expect(pageCalls).toHaveLength(6)

    expect(warnSpy).not.toHaveBeenCalled()

    pageCalls.forEach(data => {
      expect(typeof data.templateKey).toBe('string')
      expect(data.templateKey.length).toBeGreaterThan(0)
      expect(data.templateProps).not.toBe(Prisma.JsonNull)
      expect(data.content).toBeDefined()
      expect(data.content.templateKey).toBe(data.templateKey)
      expect(data.content.components).toBeInstanceOf(Array)
      expect(Object.keys(data.content.regions || {})).toHaveLength(4)
    })
  })

  it('creates a folder with prepared content shell for folders', async () => {
    await createWebsitePages(prisma as PrismaClient, 'test-website', [], sharedComponents as any)

    const folderCall = getCreatedData().find(data => data.type === 'folder')
    expect(folderCall).toBeDefined()
    expect(folderCall?.templateKey).toBe('core/folder')
    expect(folderCall?.templateProps).toBe(Prisma.JsonNull)
    expect(folderCall?.content).toEqual(
      expect.objectContaining({
        templateKey: 'core/folder',
        components: expect.any(Array)
      })
    )
    expect(Array.isArray(folderCall?.content?.components)).toBe(true)
    expect(folderCall?.content?.components).toHaveLength(0)
  })

  it('resolves template content types without manual folder upsert', async () => {
    await createWebsitePages(prisma as PrismaClient, 'test-website', [], sharedComponents as any)

    expect(mockEnsureTemplatePageTypes).toHaveBeenCalledWith({
      prisma,
      websiteId: 'test-website'
    })

    expect(mockUpsert).not.toHaveBeenCalled()
  })

  it('preserves localized and special characters in metadata', async () => {
    await createWebsitePages(prisma as PrismaClient, 'test-website', [], sharedComponents as any)

    const intlPage = getCreatedData().find(data => data.title === 'International Launch')
    expect(intlPage).toBeDefined()
    expect(intlPage?.metadata.seoTitle).toContain('Launch')
    expect(intlPage?.metadata.seoDescription).toContain('localized')

    const docsPage = getCreatedData().find(data => data.title === 'Developer Documentation')
    expect(docsPage?.metadata.seoDescription).toContain('&')
  })

  it('returns seven records including the resources folder', async () => {
    const pages = await createWebsitePages(prisma as PrismaClient, 'test-website', [], sharedComponents as any)
    expect(pages).toHaveLength(7)
    expect(mockCreate).toHaveBeenCalledTimes(7)
  })

  it('captures region assignments for template validation', async () => {
    await createWebsitePages(prisma as PrismaClient, 'test-website', [], sharedComponents as any)

    const homeCall = getCreatedData().find(data => data.title === 'Home')
    expect(homeCall).toBeDefined()
    expect(homeCall?.content.regions.header).toContain('navbar')
    expect(homeCall?.content.regions.hero).toContain('hero-banner')
    expect(homeCall?.content.regions.footer).toContain('footer')
  })

  it('aligns component trees with registered templates', async () => {
    await createWebsitePages(prisma as PrismaClient, 'test-website', [], sharedComponents as any)

    const summary = await getPageCatalogSummary(true)
    const templates = new Map(summary.templates.map(template => [template.templateKey, template]))

    const pageCalls = getCreatedData().filter(data => data.type === 'page')

    for (const data of pageCalls) {
      const template = normalizeTemplateForValidation(templates.get(data.templateKey))
      expect(template).toBeDefined()

      const componentTypes = buildComponentTypeStubs(data.content.components)
      const validation = validatePageTemplate({
        template: template!,
        templateProps: data.templateProps ?? undefined,
        componentTree: data.content.components as any,
        componentTypes
      })

      const errors = validation.issues.filter(issue => issue.severity === 'error')
      expect(validation.isValid).toBe(true)
      expect(errors).toHaveLength(0)
    }
  })

  it('propagates prisma errors', async () => {
    const error = new Error('Database error')
    mockCreate.mockRejectedValueOnce(error)

    await expect(createWebsitePages(prisma as PrismaClient, 'test-website', [], sharedComponents as any)).rejects.toThrow(error)
  })

  it('sets varied publishing states', async () => {
    await createWebsitePages(prisma as PrismaClient, 'test-website', [], sharedComponents as any)
    const statuses = getCreatedData().map(data => data.status)

    expect(statuses).toContain('published')
    expect(statuses).toContain('draft')
    expect(statuses).toContain('archived')
  })
})

function buildSharedComponentRefs(): any[] {

  return [

    createSharedComponentStub('shared-main-nav', 'Main Navigation'),

    createSharedComponentStub('shared-footer', 'Footer'),

    createSharedComponentStub('shared-sidebar', 'Sidebar Navigation'),

    createSharedComponentStub('shared-cta', 'Call-to-Action Banner')

  ]

}

function createSharedComponentStub(id: string, name: string) {

  return {

    id,

    name,

    websiteId: 'test-website',

    websiteComponentTypeId: `${id}-type`,

    content: {},

    config: {},

    usageCount: 0,

    createdAt: new Date('2024-01-01T00:00:00Z'),

    updatedAt: new Date('2024-01-01T00:00:00Z'),

    createdBy: 'test',

    updatedBy: 'test'

  }

}

function buildComponentTypeStubs(components: any[]): RegistryComponentType[] {
  const types = new Set<string>()
  const queue = [...components]

  while (queue.length > 0) {
    const current = queue.shift()
    if (current && typeof current.type === 'string') {
      types.add(current.type)
    }
    if (current && Array.isArray(current.children)) {
      queue.push(...current.children)
    }
  }

  return Array.from(types).map(createComponentTypeStub)
}

function createComponentTypeStub(type: string): RegistryComponentType {
  return {
    type,
    category: 'generated',
    version: '1.0.0',
    defaultConfig: {},
    placeholderData: {},
    styles: null,
    aiMetadata: {},
    confidence: 1,
    isGlobal: false,
    websiteId: 'test-website',
    website: null as any,
    sharedComponents: [],
    analytics: [],
    createdBy: null,
    updatedBy: null,
    patterns: []
  } as unknown as RegistryComponentType
}

function normalizeTemplateForValidation(template: PageCatalogTemplateSummary | undefined): PageCatalogTemplateSummary | undefined {
  if (!template) {
    return undefined
  }

  const requiredMap = new Map<string, { region: string; allowedComponents: string[] }>()
  const mergedRequired = template.requiredRegions.map(region => {
    const copy = { ...region, allowedComponents: [...region.allowedComponents] }
    requiredMap.set(copy.region, copy)
    return copy
  })

  const remainingOptional: typeof template.optionalRegions = []

  if (template.optionalRegions) {
    for (const optional of template.optionalRegions) {
      const existing = requiredMap.get(optional.region)
      if (existing) {
        const merged = new Set([...existing.allowedComponents, ...optional.allowedComponents])
        existing.allowedComponents = Array.from(merged)
      } else {
        remainingOptional.push({ ...optional, allowedComponents: [...optional.allowedComponents] })
      }
    }
  }

  return {
    ...template,
    requiredRegions: mergedRequired,
    optionalRegions: remainingOptional
  }
}

