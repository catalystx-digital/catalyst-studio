import http from 'node:http'
import { graphql } from 'graphql'
import nodeFetch from 'node-fetch'
import type { GenerationResult, GeneratorDiagnostic, SiteSnapshot, SlugSegments } from '../core/types'
import { generateHeadProject } from '../core/generator'
import sampleSite from '@/mock-data/ucs/sample-site.json'
import type { SnapshotSharedComponent, SnapshotStructureNode } from '@/lib/studio/headless/site-snapshot/types'
import type { ComponentInstance } from '@/lib/studio/types/site-builder/component-instance'
import type { ApiKeyEvent } from '../utils/api-key-manager'
import { ucsGraphqlSchema } from '@/lib/studio/graphql/schema'
import type { GraphqlContext } from '@/lib/studio/graphql/types'
import { resolveUcsPageBySlug } from '@/lib/studio/headless/ucs/page-resolver'
import { AccountApiKeyScope } from '@/lib/generated/prisma'

jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    setVerbose: jest.fn()
  }
}))

jest.mock('@/lib/studio/headless/ucs/snapshot-builder', () => {
  const actual = jest.requireActual('@/lib/studio/headless/ucs/snapshot-builder')
  return {
    ...actual,
    buildUcsSiteSnapshot: jest.fn()
  }
})

jest.mock('../core/ingest-warnings', () => ({
  loadLatestMediaIngestWarnings: jest.fn().mockResolvedValue([])
}))

jest.mock('../core/media-resolution', () => {
  const actual = jest.requireActual('../core/media-resolution')
  return {
    ...actual,
    resolveSnapshotMedia: jest.fn(async (snapshot: SiteSnapshot) => {
      const empty = actual.createEmptyMediaDiagnosticsReport()
      return {
        diagnostics: [],
        report: {
          ...empty,
          summary: {
            ...empty.summary,
            references: snapshot.pages.length,
            assetsLoaded: snapshot.sharedComponents.length
          }
        },
        unresolvedReferences: []
      }
    })
  }
})

jest.mock('@/lib/studio/headless/ucs/page-resolver', () => ({
  resolveUcsPageBySlug: jest.fn()
}))

const { buildUcsSiteSnapshot } = jest.requireMock('@/lib/studio/headless/ucs/snapshot-builder') as {
  buildUcsSiteSnapshot: jest.Mock
}
const mockedResolvePage = resolveUcsPageBySlug as jest.MockedFunction<typeof resolveUcsPageBySlug>

const website = sampleSite.website
const homePage = sampleSite.pages.home
const sharedComponents = sampleSite.sharedComponents as SnapshotSharedComponent[]

const baseAuth = {
  accountId: website.accountId,
  keyId: 'key_test',
  websiteId: website.id,
  scopes: [AccountApiKeyScope.ACCOUNT_READ],
  rateLimits: {
    key: { allowed: true, remaining: 50, limit: 120 },
    ip: { allowed: true, remaining: 10, limit: 20 }
  }
}

function normalizeComponent(component: ComponentInstance): ComponentInstance {
  return {
    effectiveProps: null,
    hasOverrides: Boolean(component.props?.overrides),
    isSharedInstance: Boolean(component.props?.sharedComponentId),
    globalComponentId: null,
    ...component
  }
}

function buildStructureNode(slug: SlugSegments): SnapshotStructureNode {
  return {
    id: `struct_${slug.join('_') || 'root'}`,
    websitePageId: homePage.id,
    parentId: null,
    slug: slug.join('/'),
    fullPath: `/${slug.join('/')}`.replace(/\/+$/, '') || '/',
    position: 0,
    isFolder: false,
    title: homePage.title
  }
}

function buildFixtureSnapshot(): SiteSnapshot {
  const structure = buildStructureNode([])
  return {
    site: {
      id: website.id,
      name: website.name,
      description: website.description,
      origin: (website.metadata as Record<string, unknown> | undefined)?.origin as string | undefined
    },
    pages: [
      {
        id: homePage.id,
        title: homePage.title,
        fullPath: homePage.fullPath,
        templateKey: homePage.templateKey,
        templateProps: homePage.templateProps,
        regions: homePage.regions,
        components: homePage.components.map(component => normalizeComponent(component as ComponentInstance)),
        metadata: homePage.metadata,
        sharedComponentIds: homePage.sharedComponentIds
      }
    ],
    sharedComponents,
    structure: [structure],
    capturedAt: '2024-12-05T00:00:00.000Z',
    designSystem: {
      tokens: sampleSite.designSystems[0].tokens,
      conceptId: sampleSite.designSystems[0].designConceptId,
      conceptName: sampleSite.designSystems[0].conceptName
    }
  }
}

function normalizeDiagnostics(entries: GeneratorDiagnostic[]): GeneratorDiagnostic[] {
  return entries
    .map(entry => ({
      ...entry,
      context: entry.context ? { ...entry.context } : undefined
    }))
    .sort((a, b) => `${a.level}:${a.code}:${a.message}`.localeCompare(`${b.level}:${b.code}:${b.message}`))
}

function normalizeComputedAt(value: any): any {
  if (Array.isArray(value)) {
    return value.map(entry => normalizeComputedAt(entry))
  }
  if (value && typeof value === 'object') {
    const clone: Record<string, any> = { ...value }
    if (typeof clone.computedAt === 'string') {
      clone.computedAt = 'normalized'
    }
    Object.keys(clone).forEach(key => {
      clone[key] = normalizeComputedAt(clone[key])
    })
    return clone
  }
  return value
}

function normalizeSnapshot(snapshot: SiteSnapshot): SiteSnapshot {
  const designSystem = snapshot.designSystem ? normalizeComputedAt({ ...snapshot.designSystem }) : snapshot.designSystem
  if (designSystem) {
    designSystem.conceptName = designSystem.conceptName ?? sampleSite.designSystems[0].conceptName
  }
  return {
    ...snapshot,
    capturedAt: 'normalized',
    designSystem,
    pages: [...snapshot.pages]
      .map(page => ({
        ...page,
        sharedComponentIds: page.sharedComponentIds ? [...page.sharedComponentIds].sort() : page.sharedComponentIds,
        components: [...page.components]
          .map(component => {
            let effectiveProps =
              component.effectiveProps ?? (component.props as Record<string, unknown> | undefined)?.overrides ?? null
            if (effectiveProps && typeof effectiveProps === 'object' && Object.keys(effectiveProps).length === 0) {
              effectiveProps = null
            }
            const sharedComponentId =
              (component as any).sharedComponentId ?? (component.props as Record<string, unknown> | undefined)?.sharedComponentId ?? null
            return { ...component, effectiveProps, sharedComponentId }
          })
          .sort((a, b) => a.id.localeCompare(b.id))
      }))
      .sort((a, b) => a.fullPath.localeCompare(b.fullPath)),
    sharedComponents: [...snapshot.sharedComponents].map(component => ({ ...component })).sort((a, b) => a.id.localeCompare(b.id)),
    structure: [...snapshot.structure]
      .map(node => ({
        ...node,
        id: node.fullPath === '/' ? 'struct_root' : node.id,
        title: node.title ?? homePage.title
      }))
      .sort((a, b) => a.fullPath.localeCompare(b.fullPath))
  }
}

function normalizeManifest(manifest: GenerationResult['manifest']) {
  return {
    ...manifest,
    generatedAt: 'normalized',
    pages: [...manifest.pages]
      .map(page => ({
        ...page,
        components: [...page.components].sort((a, b) => a.id.localeCompare(b.id))
      }))
      .sort((a, b) => a.fullPath.localeCompare(b.fullPath)),
    sharedComponents: [...manifest.sharedComponents].sort((a, b) => a.sharedComponentId.localeCompare(b.sharedComponentId)),
    routes: [...manifest.routes].sort((a, b) => a.fullPath.localeCompare(b.fullPath)),
    loaders: [...manifest.loaders].sort((a, b) => a.loaderKey.localeCompare(b.loaderKey))
  }
}

function normalizeRoutes(routes: GenerationResult['routes']) {
  return [...routes].sort((a, b) => a.fullPath.localeCompare(b.fullPath))
}

function normalizeSlugRegistry(entries: GenerationResult['slugRegistry']) {
  return [...entries]
    .map(entry => ({
      ...entry,
      structureId: entry.fullPath === '/' ? 'struct_root' : entry.structureId
    }))
    .sort((a, b) => a.canonicalFullPath.localeCompare(b.canonicalFullPath))
}

async function startGraphqlTestServer() {
  const server = http.createServer(async (req, res) => {
    if (req.method !== 'POST') {
      res.writeHead(405)
      res.end()
      return
    }

    const chunks: Buffer[] = []
    for await (const chunk of req) {
      chunks.push(chunk as Buffer)
    }
    const body = Buffer.concat(chunks).toString('utf-8')
    let payload: { query: string; variables?: Record<string, unknown>; operationName?: string }
    try {
      payload = JSON.parse(body)
    } catch {
      res.writeHead(400)
      res.end()
      return
    }

    const contextValue = createContext()
    const result = await graphql({
      schema: ucsGraphqlSchema,
      source: payload.query,
      variableValues: payload.variables,
      operationName: payload.operationName,
      contextValue
    })

    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify(result))
  })

  await new Promise<void>(resolve => server.listen(0, resolve))
  const address = server.address()
  const port = typeof address === 'object' && address && 'port' in address ? address.port : 0
  const url = `http://127.0.0.1:${port}`

  return {
    url,
    close: () =>
      new Promise<void>(resolve => {
        server.close(() => resolve())
      })
  }
}

function createContext(overrides: Partial<GraphqlContext> = {}): GraphqlContext {
  const prisma = {
    websiteSharedComponent: {
      findMany: jest.fn().mockResolvedValue(
        sharedComponents.map(component => ({
          id: component.id,
          name: component.name,
          websiteId: website.id,
          websiteComponentTypeId: component.componentTypeId,
          websiteComponentType: { type: component.componentType },
          content: component.content,
          config: component.config,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
      ),
    },
  }

  const services = {
    website: {
      getWebsite: jest.fn().mockResolvedValue(website),
      getWebsitesConnection: jest.fn().mockResolvedValue({
        edges: [
          {
            cursor: Buffer.from(`${website.id}:${website.createdAt}`).toString('base64'),
            node: website
          }
        ],
        pageInfo: {
          endCursor: Buffer.from(`${website.id}:${website.createdAt}`).toString('base64'),
          hasNextPage: false
        },
        totalCount: 1
      })
    },
    page: {
      getPage: jest.fn()
    },
    structure: {
      getStructureByPageId: jest.fn()
    }
  }

  const loaders = {
    pageById: { load: jest.fn() },
    structureByPageId: { load: jest.fn().mockResolvedValue({ fullPath: '/' }) },
    sharedComponentById: {
      load: jest.fn().mockResolvedValue({
        id: sharedComponents[0].id,
        name: sharedComponents[0].name,
        websiteId: website.id,
        websiteComponentTypeId: sharedComponents[0].componentTypeId,
        websiteComponentType: { type: sharedComponents[0].componentType },
        content: sharedComponents[0].content,
        config: sharedComponents[0].config
      })
    }
  }

  const repositories = {
    unifiedContent: {
      getPageWithResolvedComponents: jest.fn().mockResolvedValue({
        pageId: homePage.id,
        websiteId: website.id,
        title: homePage.title,
        components: homePage.components.map(component => ({
          id: component.id,
          type: component.type,
          position: component.position,
          parentId: component.parentId,
          sharedId: (component.props as any)?.sharedComponentId ?? null,
          isShared: Boolean((component.props as any)?.sharedComponentId),
          hasOverrides: Boolean((component.props as any)?.overrides),
          effectiveProps: (component.props as any)?.overrides ?? component.props ?? {}
        }))
      })
    },
    designSystem: {
      findMany: jest.fn().mockResolvedValue(sampleSite.designSystems)
    }
  }

  const context: GraphqlContext = {
    auth: baseAuth,
    prisma: prisma as never,
    loaders: loaders as never,
    services: services as never,
    repositories: repositories as never,
    sharedComponentCache: new Map(),
    requestId: 'req-test',
    ...overrides
  }

  return context
}

describe('UCS provider parity between Prisma and GraphQL', () => {
  beforeAll(() => {
    process.env.SKIP_DB_SETUP = 'true'
    // Ensure fetch is available for the GraphQL client in Node test environments
    // @ts-ignore
    globalThis.fetch = nodeFetch as unknown as typeof fetch
  })

  beforeEach(() => {
    mockedResolvePage.mockResolvedValue({
      payload: {
        page: JSON.parse(JSON.stringify(homePage)),
        sharedComponents: JSON.parse(JSON.stringify(sharedComponents)),
        structure: {
          current: {
            id: 'struct_home',
            websitePageId: homePage.id,
            parentId: null,
            slug: '',
            fullPath: '/',
            position: 0,
            isFolder: false
          },
          ancestors: [],
          children: []
        },
        diagnostics: []
      },
      diagnostics: []
    })
    buildUcsSiteSnapshot.mockResolvedValue({
      snapshot: buildFixtureSnapshot(),
      diagnostics: []
    })
  })

  it('produces matching exports across Prisma and GraphQL data sources', async () => {
    const server = await startGraphqlTestServer()
    const apiKeyEvents: ApiKeyEvent[] = []

    const prismaResult = await generateHeadProject({
      provider: 'ucs',
      websiteId: website.id,
      outputDir: '.tmp-parity-prisma',
      dataSource: 'prisma',
      dryRun: true
    })

    const graphqlResult = await generateHeadProject({
      provider: 'ucs',
      websiteId: website.id,
      outputDir: '.tmp-parity-graphql',
      dataSource: 'graphql',
      dryRun: true,
      graphql: {
        endpoint: server.url,
        apiKey: 'test-key',
        onApiKeyEvent: event => apiKeyEvents.push(event)
      }
    })

    expect(apiKeyEvents).toEqual([])
    expect(normalizeSnapshot(prismaResult.snapshot)).toEqual(normalizeSnapshot(graphqlResult.snapshot))
    expect(normalizeManifest(prismaResult.manifest)).toEqual(normalizeManifest(graphqlResult.manifest))
    expect(normalizeDiagnostics(prismaResult.diagnostics)).toEqual(normalizeDiagnostics(graphqlResult.diagnostics))
    expect(normalizeRoutes(prismaResult.routes)).toEqual(normalizeRoutes(graphqlResult.routes))
    expect(normalizeSlugRegistry(prismaResult.slugRegistry)).toEqual(normalizeSlugRegistry(graphqlResult.slugRegistry))
    expect(prismaResult.mediaDiagnostics.summary).toEqual(graphqlResult.mediaDiagnostics.summary)

    await server.close()
  })

  describe('optional live parity against real endpoints', () => {
    const enableLive = process.env.UCS_PARITY_ENABLE_LIVE === 'true'
    const liveWebsiteId = process.env.UCS_PARITY_LIVE_WEBSITE_ID
    const liveGraphqlEndpoint = process.env.UCS_PARITY_LIVE_GRAPHQL_ENDPOINT
    const liveGraphqlApiKey = process.env.UCS_PARITY_LIVE_GRAPHQL_API_KEY

    const canRun =
      enableLive && liveWebsiteId && liveGraphqlEndpoint && liveGraphqlApiKey

    const testFn = canRun ? it : it.skip

    testFn('produces matching exports against the live schema', async () => {
      const apiKeyEvents: ApiKeyEvent[] = []

      const prismaResult = await generateHeadProject({
        provider: 'ucs',
        websiteId: liveWebsiteId as string,
        outputDir: '.tmp-parity-live-prisma',
        dataSource: 'prisma',
        dryRun: true
      })

      const graphqlResult = await generateHeadProject({
        provider: 'ucs',
        websiteId: liveWebsiteId as string,
        outputDir: '.tmp-parity-live-graphql',
        dataSource: 'graphql',
        dryRun: true,
        graphql: {
          endpoint: liveGraphqlEndpoint as string,
          apiKey: liveGraphqlApiKey as string,
          onApiKeyEvent: event => apiKeyEvents.push(event)
        }
      })

      expect(apiKeyEvents).toEqual([])
      expect(normalizeSnapshot(prismaResult.snapshot)).toEqual(normalizeSnapshot(graphqlResult.snapshot))
      expect(normalizeManifest(prismaResult.manifest)).toEqual(normalizeManifest(graphqlResult.manifest))
      expect(normalizeDiagnostics(prismaResult.diagnostics)).toEqual(normalizeDiagnostics(graphqlResult.diagnostics))
      expect(normalizeRoutes(prismaResult.routes)).toEqual(normalizeRoutes(graphqlResult.routes))
      expect(normalizeSlugRegistry(prismaResult.slugRegistry)).toEqual(normalizeSlugRegistry(graphqlResult.slugRegistry))
      expect(prismaResult.mediaDiagnostics.summary).toEqual(graphqlResult.mediaDiagnostics.summary)
    })
  })
})
