import { UcsGraphqlHeadDataProvider } from '../providers/ucs-graphql-provider'
import type { GraphqlProviderOptions } from '../core/types'

jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    setVerbose: jest.fn()
  }
}))

jest.mock('../providers/graphql/graphql-client', () => {
  const requestMock = jest.fn()
  return {
    GraphqlClient: jest.fn().mockImplementation(() => ({
      request: requestMock
    })),
    __requestMock: requestMock
  }
})

const { GraphqlClient, __requestMock: requestMock } = jest.requireMock('../providers/graphql/graphql-client') as {
  GraphqlClient: jest.Mock
  __requestMock: jest.Mock
}

const websiteId = 'site-graphql'

const sharedComponentsFixture = [
  {
    id: 'shared-hero',
    name: 'Hero',
    componentType: 'hero-banner',
    componentTypeId: 'type-hero',
    content: { text: 'welcome' },
    config: { variant: 'default' }
  },
  {
    id: 'shared-unused',
    name: 'Unused CTA',
    componentType: 'cta',
    componentTypeId: 'type-cta',
    content: { text: 'Call us' },
    config: { variant: 'primary' }
  }
]

const pageBySlug: Record<string, any> = {
  '/': {
    id: 'page-home',
    title: 'Home',
    fullPath: '/',
    templateKey: 'home',
    templateProps: {},
    regions: [],
    components: [
      {
        id: 'comp-hero',
        type: 'hero-banner',
        componentType: 'hero-banner',
        componentTypeId: 'type-hero',
        parentId: null,
        position: 0,
        props: {},
        content: {},
        styles: {},
        metadata: {},
        sharedComponentId: 'shared-hero',
        globalComponentId: null,
        effectiveProps: null,
        hasOverrides: false,
        isSharedInstance: true
      }
    ],
    metadata: {},
    sharedComponentIds: ['shared-hero'],
    sharedComponents: [sharedComponentsFixture[0]],
    diagnostics: [],
    structure: {
      current: {
        id: 'struct-root',
        websitePageId: 'page-home',
        parentId: null,
        slug: '',
        fullPath: '/',
        position: 0,
        isFolder: false,
        title: 'Home'
      },
      ancestors: [],
      children: [
        {
          id: 'struct-about',
          websitePageId: 'page-about',
          parentId: 'struct-root',
          slug: 'about',
          fullPath: '/about',
          position: 0,
          isFolder: false,
          title: 'About'
        }
      ]
    }
  },
  '/about': {
    id: 'page-about',
    title: 'About',
    fullPath: '/about',
    templateKey: 'standard',
    templateProps: {},
    regions: [],
    components: [],
    metadata: {},
    sharedComponentIds: [],
    sharedComponents: [],
    diagnostics: [],
    structure: {
      current: {
        id: 'struct-about',
        websitePageId: 'page-about',
        parentId: 'struct-root',
        slug: 'about',
        fullPath: '/about',
        position: 0,
        isFolder: false,
        title: 'About'
      },
      ancestors: [
        {
          id: 'struct-root',
          websitePageId: 'page-home',
          parentId: null,
          slug: '',
          fullPath: '/',
          position: 0,
          isFolder: false,
          title: 'Home'
        }
      ],
      children: []
    }
  }
}

function setupGraphqlResponses(): void {
  requestMock.mockImplementation(async (init: { query: string; variables?: Record<string, any> }) => {
    if (init.query.includes('WebsiteSnapshot')) {
      return {
        website: {
          id: websiteId,
          name: 'GraphQL Site',
          description: 'demo',
          metadata: {},
          settings: {}
        },
        designSystems: [
          {
            id: 'design-1',
            designConceptId: 'concept-1',
            conceptName: 'Primary',
            tokens: { colors: {} },
            isCurrent: true
          }
        ]
      }
    }
    if (init.query.includes('PageBySlug')) {
      const slug = init.variables?.slug ?? ''
      return { page: pageBySlug[slug] ?? null }
    }
    if (init.query.includes('SharedComponents($websiteId')) {
      return { sharedComponents: sharedComponentsFixture }
    }
    if (init.query.includes('SharedComponentsById')) {
      const ids = new Set(init.variables?.ids ?? [])
      return {
        sharedComponents: sharedComponentsFixture.filter(component => ids.has(component.id))
      }
    }
    throw new Error(`Unexpected GraphQL query: ${init.query}`)
  })
}

function buildProvider(overrides?: Partial<GraphqlProviderOptions>) {
  const provider = new UcsGraphqlHeadDataProvider({
    websiteId,
    graphql: {
      endpoint: 'https://example/graphql',
      apiKey: 'test-key',
      ...overrides
    }
  })
  return provider
}

describe('UcsGraphqlHeadDataProvider', () => {
  beforeEach(() => {
    requestMock.mockReset()
    ;(GraphqlClient as jest.Mock).mockClear()
    setupGraphqlResponses()
  })

  it('loads snapshot with all shared components including unreferenced entries', async () => {
    const provider = buildProvider()
    const snapshot = await provider.loadSnapshot()

    expect(snapshot.sharedComponents).toHaveLength(2)
    const ids = snapshot.sharedComponents.map(component => component.id).sort()
    expect(ids).toEqual(['shared-hero', 'shared-unused'])

    expect(snapshot.pages).toHaveLength(2)
    expect(snapshot.structure).toHaveLength(2)
  })

  it('reuses slug cache on resolvePageBySlug and shared component cache on preload', async () => {
    const provider = buildProvider()
    await provider.loadSnapshot()
    requestMock.mockClear()

    const home = await provider.resolvePageBySlug([], {})
    expect(home?.page.title).toBe('Home')
    expect(requestMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ query: expect.stringContaining('PageBySlug') })
    )

    requestMock.mockClear()
    const preload = await provider.preloadSharedComponents(['shared-unused'], {})
    expect(preload['shared-unused'].name).toBe('Unused CTA')
    expect(requestMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ query: expect.stringContaining('SharedComponentsById') })
    )
  })
})
