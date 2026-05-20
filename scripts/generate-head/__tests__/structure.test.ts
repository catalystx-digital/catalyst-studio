import type { SiteSnapshot, MappedPageDefinition, RouteDefinition } from '../core/types'
import { buildRouteDefinitions, buildSlugRegistry, buildStructureIndex } from '../core/structure'

describe('buildRouteDefinitions', () => {
  const snapshot: SiteSnapshot = {
    site: { id: 'site', name: 'Demo' },
    capturedAt: new Date().toISOString(),
    pages: [
      {
        id: 'home',
        title: 'Home',
        fullPath: '/home',
        templateKey: 'marketing/home-default',
        templateProps: {},
        regions: [],
        components: [],
        metadata: {}
      },
      {
        id: 'products',
        title: 'Products',
        fullPath: '/home/products',
        templateKey: 'marketing/home-default',
        templateProps: {},
        regions: [],
        components: [],
        metadata: {}
      }
    ],
    sharedComponents: [],
    structure: [
      {
        id: 'home-node',
        websitePageId: 'home',
        parentId: null,
        slug: 'home',
        fullPath: '/home',
        position: 0,
        isFolder: false,
        title: 'Home'
      },
      {
        id: 'products-node',
        websitePageId: 'products',
        parentId: 'home-node',
        slug: 'products',
        fullPath: '/home/products',
        position: 0,
        isFolder: false,
        title: 'Products'
      }
    ]
  }

  const mappedPages: MappedPageDefinition[] = [
    {
      pageId: 'home',
      fullPath: '/home',
      templateKey: 'marketing/home-default',
      template: {
        templateKey: 'marketing/home-default',
        name: 'Marketing Home',
        category: 'marketing' as any,
        isHomeEligible: true,
        description: 'Mock',
        requiredRegions: [],
        optionalRegions: [],
        propsMeta: undefined,
        aiMetadata: { keywords: [], layoutGuidelines: [] }
      },
      components: []
    },
    {
      pageId: 'products',
      fullPath: '/home/products',
      templateKey: 'marketing/home-default',
      template: undefined,
      components: []
    }
  ]

  it('creates route definitions matching structure hierarchy', () => {
    const routes = buildRouteDefinitions(snapshot, mappedPages)
    expect(routes).toHaveLength(2)
    expect(routes[0]).toMatchObject({
      pageId: 'home',
      routePath: 'home',
      segments: ['home'],
      canonicalSegments: ['home'],
      canonicalRoutePath: 'home',
      canonicalFullPath: '/home',
      title: 'Home'
    })
    expect(routes[1]).toMatchObject({
      pageId: 'products',
      routePath: 'home/products',
      segments: ['home', 'products'],
      canonicalSegments: ['home', 'products'],
      canonicalRoutePath: 'home/products',
      canonicalFullPath: '/home/products',
      title: 'Products'
    })
  })

  it('falls back to page fullPath when not in structure', () => {
    const fallbackSnapshot: SiteSnapshot = { ...snapshot, structure: [] }
    const routes = buildRouteDefinitions(fallbackSnapshot, mappedPages)
    expect(routes.map(route => route.routePath)).toEqual(['home', 'home/products'])
    expect(routes.map(route => route.title)).toEqual(['Home', 'Products'])
  })
})

describe('buildSlugRegistry', () => {
  const snapshot: SiteSnapshot = {
    site: { id: 'site', name: 'Demo' },
    capturedAt: new Date().toISOString(),
    pages: [
      {
        id: 'home',
        title: 'Home',
        fullPath: '/home',
        templateKey: 'marketing/home-default',
        templateProps: {},
        regions: [],
        components: [],
        metadata: {}
      }
    ],
    sharedComponents: [],
    structure: [
      {
        id: 'home-node',
        websitePageId: 'home',
        parentId: null,
        slug: 'home',
        fullPath: '/home',
        position: 0,
        isFolder: false,
        title: 'Home'
      }
    ]
  }

  it('adds alias entry for root path when missing', () => {
    const routes = [
      {
        pageId: 'home',
        fullPath: '/home',
        canonicalFullPath: '/home',
        routePath: 'home',
        canonicalRoutePath: 'home',
        segments: ['home'],
        canonicalSegments: ['home'],
        title: 'Home',
        templateKey: 'marketing/home-default'
      }
    ]
    const structureIndex = buildStructureIndex(snapshot)
    const { entries: registry } = buildSlugRegistry(routes, structureIndex)

    expect(registry).toHaveLength(routes.length + 1)
    const rootEntry = registry.find(entry => entry.slug.length === 0)
    expect(rootEntry).toBeDefined()
    expect(rootEntry).toMatchObject({
      fullPath: '/',
      canonicalFullPath: '/',
      aliasOf: 'home',
      parentId: null,
      structureId: null
    })
    expect(rootEntry?.canonicalSlug).toEqual([])
    expect(rootEntry?.originalSlug).toEqual([])
  })

  it('respects existing root entry without duplicating alias', () => {
    const routes = [
      {
        pageId: 'home',
        fullPath: '/',
        canonicalFullPath: '/',
        routePath: '',
        canonicalRoutePath: '',
        segments: [],
        canonicalSegments: [],
        title: 'Root',
        templateKey: null
      },
      {
        pageId: 'home',
        fullPath: '/home',
        canonicalFullPath: '/home',
        routePath: 'home',
        canonicalRoutePath: 'home',
        segments: ['home'],
        canonicalSegments: ['home'],
        title: 'Home',
        templateKey: 'marketing/home-default'
      }
    ]
    const structureIndex = buildStructureIndex({ ...snapshot, pages: [], structure: [] })
    const { entries: registry } = buildSlugRegistry(routes, structureIndex)

    expect(registry.filter(entry => entry.slug.length === 0)).toHaveLength(1)
    expect(registry[0].aliasOf).toBeNull()
    expect(registry[0].canonicalSlug).toEqual([])
    expect(registry[0].canonicalFullPath).toEqual('/')
  })

  it('records diagnostics when canonical paths collide', () => {
    const collisionRoutes: RouteDefinition[] = [
      {
        pageId: 'about-a',
        fullPath: '/About',
        canonicalFullPath: '/about',
        routePath: 'About',
        canonicalRoutePath: 'about',
        segments: ['About'],
        canonicalSegments: ['about'],
        title: 'About',
        templateKey: null
      },
      {
        pageId: 'about-b',
        fullPath: '/about',
        canonicalFullPath: '/about',
        routePath: 'about',
        canonicalRoutePath: 'about',
        segments: ['about'],
        canonicalSegments: ['about'],
        title: 'About Lower',
        templateKey: null
      }
    ]
    const structureIndex = buildStructureIndex({
      site: { id: 'site', name: 'Demo' },
      capturedAt: new Date().toISOString(),
      pages: [
        { id: 'about-a', title: 'About', fullPath: '/About', templateKey: null, templateProps: {}, regions: [], components: [], metadata: {} },
        { id: 'about-b', title: 'About Lower', fullPath: '/about', templateKey: null, templateProps: {}, regions: [], components: [], metadata: {} }
      ],
      sharedComponents: [],
      structure: []
    })

    const { diagnostics } = buildSlugRegistry(collisionRoutes, structureIndex)
    expect(diagnostics).toHaveLength(1)
    expect(diagnostics[0]).toMatchObject({ code: 'ROUTE_CASE_COLLISION', level: 'error' })
    expect(diagnostics[0].context).toMatchObject({ canonicalFullPath: '/about' })
  })
})
