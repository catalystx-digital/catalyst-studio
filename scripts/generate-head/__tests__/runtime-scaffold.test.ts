import vm from 'node:vm'
import ts from 'typescript'
import { ComponentType } from '@/lib/studio/components/cms/_core/types'
import type { ComponentInstance } from '@/lib/studio/types/site-builder/component-instance'
import {
  buildComponentTreeModule,
  buildRuntimeLoadersModule,
  buildRenderContextModule,
  buildCatchAllRouteModule,
  buildRootRouteModule,
  buildRuntimeDiagnosticsModule
} from '../generator/scaffold'

type ModuleExports = Record<string, any>

function loadModuleFromSource(source: string, deps: Record<string, ModuleExports> = {}): ModuleExports {
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.React
    }
  }).outputText

  const module = { exports: {} as ModuleExports }
  const sandbox = {
    module,
    exports: module.exports,
    require: (id: string): ModuleExports => {
      if (deps[id]) {
        return deps[id]
      }
      if (id === 'tslib') {
        return {}
      }
      throw new Error(`Unexpected require: ${id}`)
    },
    console,
    process,
    setTimeout,
    clearTimeout
  }

  vm.runInNewContext(transpiled, sandbox)
  return module.exports
}

function createRuntimeHarness() {
  const componentTreeExports = loadModuleFromSource(buildComponentTreeModule())
  const loaderExports = loadModuleFromSource(buildRuntimeLoadersModule())
  const renderContextExports = loadModuleFromSource(buildRenderContextModule(), {
    '@/generated/runtime/loaders': loaderExports
  })

  return {
    componentTree: componentTreeExports,
    loaders: loaderExports,
    renderContext: renderContextExports
  }
}

const requestHelpersModule = {
  normalizeHeaders(entries: Iterable<[string, string]>) {
    return Object.fromEntries(entries)
  },
  normalizeSearchParams(
    searchParams: Record<string, string | string[] | undefined> | undefined
  ) {
    if (!searchParams) {
      return {}
    }
    const result: Record<string, string | string[]> = {}
    Object.entries(searchParams).forEach(([key, value]) => {
      if (typeof value === 'undefined') {
        return
      }
      result[key] = value
    })
    return result
  },
  normalizeSlugParam(slug: string[] | undefined) {
    return Array.isArray(slug) ? slug.filter(segment => typeof segment === 'string') : []
  },
  async resolveMaybePromise<T>(value: T | Promise<T>): Promise<T> {
    return await value
  }
}

const needsCanonicalRedirect = jest.fn((resolution: { shouldRedirect?: boolean }) => Boolean(resolution?.shouldRedirect))

describe('generated runtime scaffolding', () => {
  beforeEach(() => {
    needsCanonicalRedirect.mockReset()
    needsCanonicalRedirect.mockImplementation(resolution => Boolean(resolution?.shouldRedirect))
  })


  const baseInstance = (overrides: Partial<ComponentInstance> = {}): ComponentInstance => ({
    id: 'component',
    type: 'hero-banner',
    parentId: null,
    position: 0,
    props: {},
    content: {},
    styles: {},
    metadata: {},
    ...overrides
  })

  it('builds component trees with parent-child relationships', () => {
    const { componentTree } = createRuntimeHarness()
    const { buildComponentTree, getChildren, flattenTree } = componentTree

    const instances: ComponentInstance[] = [
      baseInstance({ id: 'hero', position: 0, props: { region: 'hero' } }),
      baseInstance({ id: 'cta', parentId: 'hero', position: 0, props: {} }),
      baseInstance({ id: 'footer', position: 1, props: { region: 'footer' } })
    ]

    const tree = buildComponentTree(instances)
    expect(tree).toHaveLength(2)
    expect(tree[0].instance.id).toBe('hero')
    expect(tree[0].region).toBe('hero')
    expect(tree[0].children).toHaveLength(1)
    expect(tree[0].children[0].instance.id).toBe('cta')
    expect(tree[0].children[0].depth).toBe(1)
    expect(tree[1].region).toBe('footer')

    expect(getChildren(tree[0])).toHaveLength(1)
    expect(getChildren(tree[0], 'sidebar')).toHaveLength(0)

    const flat = flattenTree(tree)
    expect(flat.map(node => node.instance.id)).toEqual(['hero', 'cta', 'footer'])
  })

  it('creates render context with loader caching and shared component hydration', async () => {
    const { componentTree, loaders, renderContext } = createRuntimeHarness()
    const { buildComponentTree } = componentTree
    const { registerComponentLoader, listComponentLoaderKeys } = loaders
    const { createRenderContext } = renderContext

    const payload = {
      page: {
        id: 'page',
        title: 'Test Page',
        fullPath: '/test',
        templateKey: null,
        templateProps: {},
        regions: [],
        components: [
          baseInstance({ id: 'hero', props: { region: 'hero' } })
        ],
        metadata: {},
        sharedComponentIds: []
      },
      structure: undefined,
      sharedComponents: [
        {
          id: 'shared:initial',
          name: 'Primary Footer',
          componentType: ComponentType.Footer,
          content: null,
          config: {}
        }
      ],
      diagnostics: []
    }

    const provider = {
      name: 'test',
      supportsLiveData: false,
      async fetchSiteSnapshot() {
        return null
      },
      async resolvePageBySlug() {
        return null
      },
      preloadSharedComponents: jest.fn(async (ids: string[]) => {
        return ids.reduce<Record<string, typeof payload.sharedComponents[number]>>((acc, id) => {
          acc[id] = {
            id,
            name: `Shared ${id}`,
            componentType: ComponentType.Footer,
            content: null,
            config: {}
          }
          return acc
        }, {})
      })
    }

    const tree = buildComponentTree(payload.page.components)
    const node = tree[0]

    const missingLoaderContext = createRenderContext({
      provider,
      payload,
      slug: ['test'],
      request: {
        headers: { Accept: 'text/html' },
        searchParams: { preview: 'false' }
      }
    })

    // Loader diagnostics when loader missing
    const missingLoader = await missingLoaderContext.loadLoaderData('hero.loader', node)
    expect(missingLoader).toBeNull()
    expect(missingLoaderContext.diagnostics.list().some(diag => diag.code === 'COMPONENT_LOADER_NOT_REGISTERED')).toBe(
      true
    )
    missingLoaderContext.diagnostics.drain()

    let loaderInvocations = 0
    registerComponentLoader({
      key: 'hero.loader',
      resolve: async (inputNode: typeof node) => {
        loaderInvocations += 1
        return { id: inputNode.instance.id, timestamp: loaderInvocations }
      }
    })
    expect(listComponentLoaderKeys()).toEqual(['hero.loader'])

    const context = createRenderContext({
      provider,
      payload,
      slug: ['test'],
      request: {
        headers: { Accept: 'text/html' },
        searchParams: { preview: 'false' }
      }
    })

    const loaderResult = await context.loadLoaderData('hero.loader', node)
    expect(loaderResult).toEqual({ id: 'hero', timestamp: 1 })

    const cachedResult = await context.loadLoaderData('hero.loader', node)
    expect(cachedResult).toEqual(loaderResult)
    expect(loaderInvocations).toBe(1)

    // Shared component resolution uses cached snapshot clone
    const sharedInitial = await context.resolveSharedComponent('shared:initial')
    expect(sharedInitial).toBeTruthy()
    expect(sharedInitial?.id).toBe('shared:initial')

    const dynamicShared = await context.resolveSharedComponent('shared:dynamic')
    expect(dynamicShared?.id).toBe('shared:dynamic')
    expect(provider.preloadSharedComponents).toHaveBeenCalledWith(['shared:dynamic'], expect.any(Object))

    context.diagnostics.drain()
    provider.preloadSharedComponents.mockClear()

    // Cached shared component should not trigger provider twice
    const dynamicSharedAgain = await context.resolveSharedComponent('shared:dynamic')
    expect(dynamicSharedAgain?.id).toBe('shared:dynamic')
    expect(provider.preloadSharedComponents).not.toHaveBeenCalled()
  })

  it('records diagnostics when provider cannot preload shared components', async () => {
    const { componentTree, renderContext } = createRuntimeHarness()
    const { buildComponentTree } = componentTree
    const { createRenderContext } = renderContext

    const payload = {
      page: {
        id: 'page',
        title: 'Test',
        fullPath: '/',
        templateKey: null,
        templateProps: {},
        regions: [],
        components: [baseInstance({ id: 'root' })],
        metadata: {},
        sharedComponentIds: []
      },
      structure: undefined,
      sharedComponents: [],
      diagnostics: []
    }

    const provider = {
      name: 'static',
      supportsLiveData: false,
      async fetchSiteSnapshot() {
        return null
      },
      async resolvePageBySlug() {
        return null
      }
    }

    const tree = buildComponentTree(payload.page.components)
    const node = tree[0]

    const context = createRenderContext({
      provider,
      payload,
      slug: [],
      request: {}
    })

    const result = await context.resolveSharedComponent('missing-shared')
    expect(result).toBeNull()
    expect(context.diagnostics.list().some(diag => diag.code === 'SHARED_COMPONENT_LOADER_UNAVAILABLE')).toBe(true)

    // Missing loader should also log diagnostics
    await context.loadLoaderData('missing', node)
    expect(context.diagnostics.list().some(diag => diag.code === 'COMPONENT_LOADER_NOT_REGISTERED')).toBe(true)
  })

  it('invokes notFound when route resolution lacks payload', async () => {
    const notFound = jest.fn(() => {
      throw new Error('NOT_FOUND')
    })
    const resolveRoute = jest.fn(async () => ({
      slug: ['missing'],
      matchedSlug: ['missing'],
      entry: null,
      payload: null,
      source: 'none',
      aliasResolved: false
    }))
    const renderPage = jest.fn(async () => null)
    const resolvePageMetadata = jest.fn()
    const headersMock = jest.fn(() => new Map([['accept', 'text/html']]))

    const catchAllModule = loadModuleFromSource(buildCatchAllRouteModule(), {
      'next/headers': { headers: headersMock },
      'next/navigation': { notFound },
      '@/generated/page-renderer': { renderPage, resolvePageMetadata },
      '@/generated/runtime/routing': { resolveRoute, needsCanonicalRedirect },
      '@/generated/runtime/request-helpers': requestHelpersModule
    })

    await expect(
      catchAllModule.default({
        params: { slug: ['missing'] },
        searchParams: { preview: 'true' }
      })
    ).rejects.toThrow('NOT_FOUND')

    expect(resolveRoute).toHaveBeenCalledTimes(1)
    const [slug, options] = resolveRoute.mock.calls[0]
    expect(slug).toEqual(['missing'])
    expect(options.requestContext).toMatchObject({
      requestId: 'route:missing',
      headers: { accept: 'text/html' },
      searchParams: { preview: 'true' }
    })
    expect(renderPage).not.toHaveBeenCalled()
  })

  it('renders page when payload is available', async () => {
    const notFound = jest.fn()
    const headersMock = jest.fn(() => new Map([['accept-language', 'en-US']]))
    const payload = {
      page: {
        id: 'page',
        title: 'News',
        fullPath: '/news',
        templateKey: null,
        templateProps: {},
        regions: [],
        components: [],
        metadata: {},
        sharedComponentIds: []
      },
      structure: undefined,
      sharedComponents: [],
      diagnostics: []
    }
    const resolveRoute = jest.fn(async () => ({
      slug: ['news'],
      matchedSlug: ['news'],
      canonicalSlug: ['news'],
      canonicalPath: '/news',
      shouldRedirect: false,
      entry: {
        pageId: 'page',
        slug: ['news'],
        fullPath: '/news',
        templateKey: null,
        title: 'News'
      },
      payload,
      source: 'static',
      aliasResolved: false
    }))
    const permanentRedirect = jest.fn()
    const renderResult = { rendered: true }
    const renderPage = jest.fn(async () => renderResult)
    const resolvePageMetadata = jest.fn()

    const catchAllModule = loadModuleFromSource(buildCatchAllRouteModule(), {
      'next/headers': { headers: headersMock },
      'next/navigation': { notFound, permanentRedirect },
      '@/generated/page-renderer': { renderPage, resolvePageMetadata },
      '@/generated/runtime/routing': { resolveRoute, needsCanonicalRedirect },
      '@/generated/runtime/request-helpers': requestHelpersModule
    })

    const result = await catchAllModule.default({
      params: { slug: ['news'] },
      searchParams: { locale: 'en' }
    })

    expect(result).toBe(renderResult)
    expect(notFound).not.toHaveBeenCalled()
    expect(permanentRedirect).not.toHaveBeenCalled()
    expect(resolveRoute).toHaveBeenCalledWith(['news'], expect.objectContaining({
      requestContext: expect.objectContaining({
        requestId: 'route:news',
        headers: { 'accept-language': 'en-US' },
        searchParams: { locale: 'en' }
      })
    }))
    expect(renderPage).toHaveBeenCalledWith(
      expect.objectContaining({ matchedSlug: ['news'], payload }),
      expect.objectContaining({
        headers: { 'accept-language': 'en-US' },
        searchParams: { locale: 'en' },
        url: '/news',
        requestId: 'render:news'
      })
    )
  })

  it('permanently redirects when request slug casing differs from canonical path', async () => {
    const notFound = jest.fn()
    const headersMock = jest.fn(() => new Map())
    const resolveRoute = jest.fn(async () => ({
      slug: ['News'],
      matchedSlug: ['news'],
      canonicalSlug: ['news'],
      canonicalPath: '/news',
      shouldRedirect: true,
      entry: {
        pageId: 'news',
        slug: ['news'],
        fullPath: '/news',
        templateKey: null,
        title: 'News'
      },
      payload: {
        page: {
          id: 'news',
          title: 'News',
          fullPath: '/news',
          templateKey: null,
          templateProps: {},
          regions: [],
          components: [],
          metadata: {},
          sharedComponentIds: []
        },
        structure: undefined,
        sharedComponents: [],
        diagnostics: []
      },
      source: 'static',
      aliasResolved: false
    }))
    const permanentRedirect = jest.fn()

    const catchAllModule = loadModuleFromSource(buildCatchAllRouteModule(), {
      'next/headers': { headers: headersMock },
      'next/navigation': { notFound, permanentRedirect },
      '@/generated/page-renderer': { renderPage: jest.fn(), resolvePageMetadata: jest.fn() },
      '@/generated/runtime/routing': { resolveRoute, needsCanonicalRedirect },
      '@/generated/runtime/request-helpers': requestHelpersModule
    })

    await catchAllModule.default({ params: { slug: ['News'] }, searchParams: {} })

    expect(permanentRedirect).toHaveBeenCalledWith('/news')
    expect(notFound).not.toHaveBeenCalled()
  })

  it('generates metadata for catch-all routes', async () => {
    const notFound = jest.fn()
    const headersMock = jest.fn(() => new Map())
    const resolveRoute = jest.fn(async () => ({
      slug: ['landing'],
      matchedSlug: ['landing'],
      canonicalSlug: ['landing'],
      canonicalPath: '/landing',
      shouldRedirect: false,
      entry: {
        pageId: 'landing',
        slug: ['landing'],
        fullPath: '/landing',
        templateKey: null,
        title: 'Landing'
      },
      payload: {
        page: {
          id: 'landing',
          title: 'Landing',
          fullPath: '/landing',
          templateKey: null,
          templateProps: {},
          regions: [],
          components: [],
          metadata: {},
          sharedComponentIds: []
        },
        structure: undefined,
        sharedComponents: [],
        diagnostics: []
      },
      source: 'static',
      aliasResolved: false
    }))
    const resolvePageMetadata = jest.fn(() => ({
      title: 'Landing Page',
      description: 'Grow with us'
    }))
    const permanentRedirect = jest.fn()

    const catchAllModule = loadModuleFromSource(buildCatchAllRouteModule(), {
      'next/headers': { headers: headersMock },
      'next/navigation': { notFound, permanentRedirect },
      '@/generated/page-renderer': { renderPage: jest.fn(), resolvePageMetadata },
      '@/generated/runtime/routing': { resolveRoute, needsCanonicalRedirect },
      '@/generated/runtime/request-helpers': requestHelpersModule
    })

    const metadata = await catchAllModule.generateMetadata({
      params: { slug: ['landing'] },
      searchParams: { ref: 'ads' }
    })

    expect(resolveRoute).toHaveBeenCalledWith(['landing'], expect.any(Object))
    expect(resolvePageMetadata).toHaveBeenCalledWith(expect.objectContaining({ matchedSlug: ['landing'] }))
    expect(metadata).toEqual({
      title: 'Landing Page',
      description: 'Grow with us'
    })
    expect(permanentRedirect).not.toHaveBeenCalled()
  })

  it('generates metadata for the root route', async () => {
    const notFound = jest.fn()
    const redirect = jest.fn()
    const headersMock = jest.fn(() => new Map())
    const resolveRoute = jest.fn(async () => ({
      slug: [],
      matchedSlug: [],
      canonicalSlug: [],
      canonicalPath: '/',
      shouldRedirect: false,
      entry: {
        pageId: 'home',
        slug: [],
        fullPath: '/',
        templateKey: null,
        title: 'Home'
      },
      payload: {
        page: {
          id: 'home',
          title: 'Home',
          fullPath: '/',
          templateKey: null,
          templateProps: {},
          regions: [],
          components: [],
          metadata: {},
          sharedComponentIds: []
        },
        structure: undefined,
        sharedComponents: [],
        diagnostics: []
      },
      source: 'static',
      aliasResolved: false
    }))
    const resolvePageMetadata = jest.fn(() => ({
      title: 'Catalyst Studio',
      description: null
    }))
    const permanentRedirect = jest.fn()

    const rootModule = loadModuleFromSource(buildRootRouteModule(), {
      'next/headers': { headers: headersMock },
      'next/navigation': { notFound, redirect, permanentRedirect },
      '@/generated/page-renderer': { renderPage: jest.fn(), resolvePageMetadata },
      '@/generated/runtime/routing': { resolveRoute, needsCanonicalRedirect, getSlugRegistrySnapshot: jest.fn(() => []) },
      '@/generated/runtime/request-helpers': requestHelpersModule
    })

    const metadata = await rootModule.generateMetadata({ searchParams: { preview: '0' } })

    expect(resolveRoute).toHaveBeenCalledWith([], expect.any(Object))
    expect(resolvePageMetadata).toHaveBeenCalledWith(expect.objectContaining({ matchedSlug: [] }))
    expect(metadata).toEqual({
      title: 'Catalyst Studio',
      description: undefined
    })
    expect(permanentRedirect).not.toHaveBeenCalled()
  })

  it('redirects root requests that are not canonical', async () => {
    const notFound = jest.fn()
    const redirect = jest.fn()
    const permanentRedirect = jest.fn()
    const headersMock = jest.fn(() => new Map())
    const resolveRoute = jest.fn(async () => ({
      slug: ['Home'],
      matchedSlug: [],
      canonicalSlug: [],
      canonicalPath: '/',
      shouldRedirect: true,
      entry: {
        pageId: 'home',
        slug: [],
        fullPath: '/',
        templateKey: null,
        title: 'Home'
      },
      payload: {
        page: {
          id: 'home',
          title: 'Home',
          fullPath: '/',
          templateKey: null,
          templateProps: {},
          regions: [],
          components: [],
          metadata: {},
          sharedComponentIds: []
        },
        structure: undefined,
        sharedComponents: [],
        diagnostics: []
      },
      source: 'static',
      aliasResolved: false
    }))

    const rootModule = loadModuleFromSource(buildRootRouteModule(), {
      'next/headers': { headers: headersMock },
      'next/navigation': { notFound, redirect, permanentRedirect },
      '@/generated/page-renderer': { renderPage: jest.fn(), resolvePageMetadata: jest.fn() },
      '@/generated/runtime/routing': { resolveRoute, needsCanonicalRedirect, getSlugRegistrySnapshot: jest.fn(() => []) },
      '@/generated/runtime/request-helpers': requestHelpersModule
    })

    await rootModule.default({ searchParams: {} })

    expect(permanentRedirect).toHaveBeenCalledWith('/')
    expect(notFound).not.toHaveBeenCalled()
  })

  it('records runtime diagnostics events and exposes them via the API payload', async () => {
    const diagnosticsStub = {
      summary: { infoCount: 0, warnCount: 0, errorCount: 0 },
      diagnostics: []
    }

    const diagnosticsModule = loadModuleFromSource(buildRuntimeDiagnosticsModule(), {
      '@/generated/diagnostics.json': diagnosticsStub,
      '@/generated/providers': {
        activeProvider: {
          name: 'stub',
          getDiagnostics: jest.fn(async () => [
            { level: 'warn', code: 'STUB_WARN', message: 'Test warning' }
          ])
        },
        providerRegistry: { stub: {} }
      },
      './config': {
        getRuntimeConfig: () => ({
          cacheTtlSeconds: 45
        })
      },
      './site-data': {
        getSnapshotFetchMetadata: () => ({
          fetchedAt: '2025-01-01T00:00:00.000Z',
          provider: 'stub'
        })
      }
    })

    expect(typeof diagnosticsModule.logRuntimeDiagnostic).toBe('function')
    expect(typeof diagnosticsModule.clearRuntimeDiagnostics).toBe('function')

    diagnosticsModule.clearRuntimeDiagnostics()
    diagnosticsModule.logRuntimeDiagnostic({
      code: 'APP_ERROR_BOUNDARY',
      message: 'Example failure',
      level: 'error',
      timestamp: '2025-01-02T00:00:00.000Z',
      context: { slug: '/missing' }
    })

    const payload = await diagnosticsModule.buildRuntimeDiagnostics()

    expect(payload.runtimeDiagnostics).toEqual([
      expect.objectContaining({
        code: 'APP_ERROR_BOUNDARY',
        message: 'Example failure',
        level: 'error',
        timestamp: '2025-01-02T00:00:00.000Z',
        context: { slug: '/missing' }
      })
    ])
    expect(payload.providerDiagnostics).toEqual([
      expect.objectContaining({ code: 'STUB_WARN' })
    ])
    expect(payload.supportedProviders).toEqual(['stub'])
  })
})
