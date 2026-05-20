import vm from 'node:vm'
import ts from 'typescript'
import { buildProviderTypesModule, buildGraphqlProviderModule, buildUcsProviderModule, buildProvidersIndexModule } from '../generator/scaffold/provider-modules'

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
    process,
    console,
    fetch: global.fetch,
    AbortController,
    URL,
    setTimeout,
    clearTimeout
  }

  vm.runInNewContext(transpiled, sandbox)
  return module.exports
}

describe('generated GraphQL runtime provider', () => {
  const siteSnapshot = {
    site: {
      id: 'site_123',
      name: 'GraphQL Test Site',
      description: null
    },
    pages: [],
    structure: [],
    sharedComponents: [],
    capturedAt: '2025-01-01T00:00:00.000Z',
    designSystem: null
  }

  const staticProviderStub = {
    staticProvider: {
      name: 'static',
      supportsLiveData: false,
      async fetchSiteSnapshot() {
        return siteSnapshot
      },
      async resolvePageBySlug() {
        return null
      },
      preloadSharedComponents: async () => ({})
    }
  }

  let originalFetch: typeof global.fetch
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    originalFetch = global.fetch
    originalEnv = { ...process.env }
    delete process.env.DATABASE_URL
    delete process.env.DIRECT_URL
    process.env.HEAD_RUNTIME_GRAPHQL_ENDPOINT = 'https://example.test/graphql'
    process.env.HEAD_RUNTIME_GRAPHQL_API_KEY = 'test-key'
  })

  afterEach(() => {
    global.fetch = originalFetch
    Object.keys(process.env).forEach(key => {
      delete (process.env as Record<string, string | undefined>)[key]
    })
    Object.assign(process.env, originalEnv)
  })

  it('boots the GraphQL runtime without touching Prisma', async () => {
    const prismaCounter = { value: 0 }
    const fetchMock = jest.fn(async (_url, init?: RequestInit) => {
      const body = typeof init?.body === 'string' ? JSON.parse(init!.body) : {}
      const operation = body.operationName as string | undefined

      if (operation === 'WebsiteSnapshot') {
        return new Response(
          JSON.stringify({
            data: {
              website: {
                id: 'site_123',
                name: 'GraphQL Runtime Site',
                description: 'A GraphQL test site',
                metadata: { origin: 'https://graphql.test' },
                settings: null
              },
              designSystems: [
                { id: 'ds_1', designConceptId: null, conceptName: 'Default', tokens: { colors: {} }, isCurrent: true }
              ]
            }
          }),
          { status: 200 }
        )
      }

      if (operation === 'PageBySlug') {
        return new Response(
          JSON.stringify({
            data: {
              page: {
                id: 'page_1',
                title: 'Home',
                fullPath: '/',
                templateKey: null,
                templateProps: {},
                regions: [],
                components: [],
                metadata: {},
                sharedComponentIds: [],
                sharedComponents: [],
                diagnostics: [],
                structure: {
                  current: {
                    id: 'struct_root',
                    websitePageId: 'page_1',
                    parentId: null,
                    slug: '',
                    fullPath: '/',
                    position: 0,
                    isFolder: false,
                    title: 'Home'
                  },
                  ancestors: [],
                  children: []
                }
              }
            }
          }),
          { status: 200 }
        )
      }

      if (operation === 'SharedComponents') {
        return new Response(
          JSON.stringify({
            data: {
              sharedComponents: [
                { id: 'shared_1', name: 'Footer', componentType: 'footer', componentTypeId: null, content: null, config: {} }
              ]
            }
          }),
          { status: 200 }
        )
      }

      throw new Error(`Unexpected GraphQL operation: ${operation}`)
    }) as unknown as typeof fetch

    // @ts-expect-error - assign test mock
    global.fetch = fetchMock

    const typesModule = loadModuleFromSource(buildProviderTypesModule(), {
      '@/data/site': { siteSnapshot }
    })

    const graphqlModule = loadModuleFromSource(buildGraphqlProviderModule(), {
      './types': typesModule,
      '@/generated/runtime/config': { getRuntimeConfig: () => ({ websiteId: 'site_123', cacheTtlSeconds: 0 }) }
    })

    const ucsModule = loadModuleFromSource(buildUcsProviderModule(), {
      './types': typesModule,
      '@/lib/generated/prisma-client': {
        PrismaClient: class {
          constructor() {
            prismaCounter.value += 1
          }
        }
      },
      '@/generated/runtime/config': { getRuntimeConfig: () => ({ websiteId: 'site_123' }) },
      '@/lib/studio/headless/ucs/snapshot-builder': {
        buildUcsSiteSnapshot: jest.fn(async () => ({ snapshot: siteSnapshot, diagnostics: [] }))
      },
      '@/lib/studio/headless/ucs/page-resolver': {
        resolveUcsPageBySlug: jest.fn(async () => ({ payload: null, diagnostics: [] })),
        loadSharedComponentsById: jest.fn(async () => [])
      }
    })

    const providersIndex = loadModuleFromSource(
      buildProvidersIndexModule('ucs', { includeGraphql: true, defaultRuntimeProvider: 'graphql' }),
      {
        './types': typesModule,
        './static-provider': staticProviderStub,
        './graphql-provider': graphqlModule,
        './ucs-provider': ucsModule
      }
    )

    const snapshot = await providersIndex.activeProvider.fetchSiteSnapshot()
    expect(snapshot.site.id).toBe('site_123')
    expect(snapshot.pages).toHaveLength(1)
    expect(fetchMock).toHaveBeenCalled()
    expect(prismaCounter.value).toBe(0)

    const page = await providersIndex.activeProvider.resolvePageBySlug([], {})
    expect(page?.page.id).toBe('page_1')
    expect(await providersIndex.activeProvider.getDiagnostics()).toEqual([])
  })

  it('fails fast when GraphQL env is missing', async () => {
    delete process.env.HEAD_RUNTIME_GRAPHQL_ENDPOINT
    delete process.env.HEAD_RUNTIME_GRAPHQL_API_KEY

    const typesModule = loadModuleFromSource(buildProviderTypesModule(), {
      '@/data/site': { siteSnapshot }
    })

    const graphqlModule = loadModuleFromSource(buildGraphqlProviderModule(), {
      './types': typesModule,
      '@/generated/runtime/config': { getRuntimeConfig: () => ({ websiteId: 'site_123', cacheTtlSeconds: 0 }) }
    })

    const providersIndex = loadModuleFromSource(
      buildProvidersIndexModule('ucs', { includeGraphql: true, defaultRuntimeProvider: 'graphql' }),
      {
        './types': typesModule,
        './static-provider': staticProviderStub,
        './graphql-provider': graphqlModule,
        './ucs-provider': { ucsProvider: { name: 'ucs', supportsLiveData: true, fetchSiteSnapshot: jest.fn() } }
      }
    )

    await expect(providersIndex.activeProvider.fetchSiteSnapshot()).rejects.toThrow(
      /HEAD_RUNTIME_GRAPHQL_ENDPOINT/i
    )
  })
})
