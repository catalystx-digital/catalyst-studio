import { applyTemplateOverrides } from '@/lib/studio/headless/site-snapshot/templates'
import type {
  GeneratorDiagnostic,
  PagePayload,
  PageStructurePayload,
  ProviderContextSnapshot,
  ProviderRequestContext,
  SharedComponentPayload,
  SiteSnapshot,
  SnapshotPage,
  SnapshotSharedComponent,
  SnapshotStructureNode,
  SlugSegments
} from '../core/types'
import {
  canonicalSlugKey,
  canonicalizeSlugSegments,
  sanitizeSlugSegments,
  slugSegmentsToPath
} from '@/lib/studio/utils/slug-canonicalizer'
import { extractSiteOriginFromMetadata } from '@/lib/studio/headless/ucs/snapshot-builder'
import type { HeadDataProvider } from '../core/provider'
import { GraphqlClient, GraphqlRequestError } from './graphql/graphql-client'
import type { GraphqlProviderOptions } from '../core/types'
import { ApiAccessClient } from '../utils/api-access-client'
import { ApiKeyManager } from '../utils/api-key-manager'
import { logger } from '../utils/logger'
import type { ComponentInstance } from '@/lib/studio/types/site-builder/component-instance'
import type { SnapshotRegionSummary } from '@/lib/studio/headless/site-snapshot/types'
import type { SnapshotDesignSystem } from '@/lib/studio/headless/site-snapshot/types'
import { slugifyConceptName } from '@/lib/studio/design-system/design-concept.repository'
import { SHARED_COMPONENTS_QUERY } from './graphql/queries'
import { resolveContentReferences } from '@/lib/services/export/helpers/resolve-content-references'
import { createMediaUrlLoader } from '@/lib/services/content-reference/media-url-loader'
import { createPagePathLoader } from '@/lib/services/content-reference/page-path-loader'

interface WebsiteQueryResult {
  website: {
    id: string
    name: string
    description?: string | null
    metadata?: Record<string, unknown> | null
    settings?: Record<string, unknown> | null
  } | null
  designSystems: Array<{
    id: string
    designConceptId?: string | null
    conceptName?: string | null
    tokens: Record<string, unknown>
    isCurrent: boolean
  }>
}

interface GraphqlStructureNode {
  id: string
  websitePageId?: string | null
  parentId?: string | null
  slug: string
  fullPath: string
  position: number
  isFolder: boolean
  title?: string | null
}

interface PageQueryResult {
  page: {
    id: string
    title: string
    fullPath: string
    templateKey: string | null
    templateProps: Record<string, unknown>
    regions: SnapshotRegionSummary[]
    components: ComponentInstance[]
    metadata: Record<string, unknown>
    sharedComponentIds?: string[]
    sharedComponents: SnapshotSharedComponent[]
    diagnostics: GeneratorDiagnostic[]
    structure: {
      current: GraphqlStructureNode | null
      ancestors: GraphqlStructureNode[]
      children: GraphqlStructureNode[]
    } | null
  } | null
}

interface SharedComponentListQuery {
  sharedComponents: SnapshotSharedComponent[]
}

const WEBSITE_QUERY = /* GraphQL */ `
  query WebsiteSnapshot($websiteId: ID!) {
    website(id: $websiteId) {
      id
      name
      description
      metadata
      settings
    }
    designSystems(websiteId: $websiteId) {
      id
      designConceptId
      conceptName
      tokens
      isCurrent
    }
  }
`

const PAGE_QUERY = /* GraphQL */ `
  query PageBySlug($websiteId: ID!, $slug: String!) {
    page(websiteId: $websiteId, slug: $slug) {
      id
      title
      fullPath
      templateKey
      templateProps
      regions {
        region
        componentTypes
      }
      components {
        id
        type
        componentType
        componentTypeId
        parentId
        position
        props
        content
        styles
        metadata
        sharedComponentId
        globalComponentId
        effectiveProps
        hasOverrides
        isSharedInstance
      }
      metadata
      sharedComponentIds
      sharedComponents {
        id
        name
        componentType
        componentTypeId
        content
        config
      }
      diagnostics {
        code
        level
        message
        context
      }
      structure {
        current {
          id
          websitePageId
          parentId
          slug
          fullPath
          position
          isFolder
          title
        }
        ancestors {
          id
          websitePageId
          parentId
          slug
          fullPath
          position
          isFolder
          title
        }
        children {
          id
          websitePageId
          parentId
          slug
          fullPath
          position
          isFolder
          title
        }
      }
    }
  }
`

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function toStructureNode(node: GraphqlStructureNode | null | undefined): SnapshotStructureNode | null {
  if (!node) {
    return null
  }
  return {
    id: node.id,
    websitePageId: node.websitePageId ?? null,
    parentId: node.parentId ?? null,
    slug: node.slug,
    fullPath: node.fullPath,
    position: node.position,
    isFolder: Boolean(node.isFolder),
    title: node.title ?? undefined
  }
}

function isFolderPage(page: SnapshotPage): boolean {
  return Boolean((page.metadata as Record<string, unknown> | undefined)?.isFolder)
}

export interface UcsGraphqlProviderOptions {
  websiteId: string
  templateOverrideKey?: string
  designConcept?: string
  graphql: GraphqlProviderOptions
}

export class UcsGraphqlHeadDataProvider implements HeadDataProvider {
  readonly name = 'ucs'
  readonly supportsLiveData = true
  private diagnostics: GeneratorDiagnostic[] = []
  private readonly slugCache = new Map<string, PagePayload>()
  private readonly sharedComponentCache = new Map<string, SnapshotSharedComponent>()
  private assetOrigin?: string
  private readonly graphqlClient: GraphqlClient
  private readonly apiKeyManager?: ApiKeyManager
  private readonly manualApiKey?: string
  private apiKeyErrorReported = false

  constructor(private readonly options: UcsGraphqlProviderOptions) {
    this.graphqlClient = new GraphqlClient({
      endpoint: options.graphql.endpoint ?? '',
      maxRetries: options.graphql.maxRetries
    })

    if (options.graphql.apiKey) {
      this.manualApiKey = options.graphql.apiKey
    } else if (options.graphql.autoManageKeys) {
      const endpoint = new URL(options.graphql.endpoint ?? '')
      const client = new ApiAccessClient({
        baseUrl: endpoint.origin,
        supabaseUserHeader: options.graphql.apiAccess?.encodedUser ?? null,
        cookies: options.graphql.apiAccess?.cookies ?? null
      })
      this.apiKeyManager = new ApiKeyManager(client, {
        websiteId: options.websiteId,
        label: options.graphql.apiKeyLabel,
        persistKeyPath: options.graphql.persistKeyPath,
        logger,
        onEvent: options.graphql.onApiKeyEvent
      })
    }
  }

  async loadSnapshot(): Promise<ProviderContextSnapshot> {
    this.slugCache.clear()
    this.diagnostics = []
    this.apiKeyErrorReported = false
    const websiteData = await this.fetchWebsite()
    if (!websiteData.website) {
      this.diagnostics.push({
        code: 'GRAPHQL_WEBSITE_NOT_FOUND',
        level: 'error',
        message: `Website ${this.options.websiteId} was not found via GraphQL`,
        context: { websiteId: this.options.websiteId }
      })
      const fallback: SiteSnapshot = {
        site: {
          id: this.options.websiteId,
          name: 'Unknown Website'
        },
        pages: [],
        structure: [],
        sharedComponents: [],
        capturedAt: new Date().toISOString(),
        designSystem: null
      }
      const normalizedFallback = applyTemplateOverrides(fallback, this.options.templateOverrideKey)
      return { ...normalizedFallback, diagnostics: this.diagnostics }
    }

    this.assetOrigin =
      extractSiteOriginFromMetadata(websiteData.website.metadata) ??
      extractSiteOriginFromMetadata(websiteData.website.settings)

    // UCS GraphQL provider has supportsLiveData = true
    // Pages are fetched at runtime via resolvePageBySlug(), NOT during export
    // This eliminates the N+1 query problem that was causing performance issues
    const sharedComponentMap = new Map<string, SnapshotSharedComponent>()

    // Fetch all shared components (single query)
    const allSharedComponents = await this.fetchAllSharedComponents()
    allSharedComponents.forEach(component => {
      sharedComponentMap.set(component.id, cloneValue(component))
      this.sharedComponentCache.set(component.id, cloneValue(component))
    })

    const snapshot: SiteSnapshot = {
      site: {
        id: websiteData.website.id,
        name: websiteData.website.name ?? 'Untitled Website',
        description: websiteData.website.description ?? undefined,
        origin: this.assetOrigin
      },
      pages: [], // Pages loaded at runtime via resolvePageBySlug()
      structure: [], // Structure discovered at runtime
      sharedComponents: Array.from(sharedComponentMap.values()),
      capturedAt: new Date().toISOString(),
      designSystem: this.pickDesignSystem(websiteData.designSystems)
    }

    const normalizedSnapshot = applyTemplateOverrides(snapshot, this.options.templateOverrideKey)
    return { ...normalizedSnapshot, diagnostics: this.diagnostics }
  }

  async resolvePageBySlug(slug: SlugSegments, _context: ProviderRequestContext): Promise<PagePayload | null> {
    const sanitized = sanitizeSlugSegments(slug)
    const canonical = canonicalizeSlugSegments(sanitized)
    const slugKey = canonicalSlugKey(canonical)

    if (this.slugCache.has(slugKey)) {
      const cached = this.slugCache.get(slugKey)
      return cached ? cloneValue(cached) : null
    }

    const payload = await this.fetchPagePayload(canonical)
    if (!payload) {
      this.slugCache.set(slugKey, null as unknown as PagePayload)
      return null
    }
    this.slugCache.set(slugKey, cloneValue(payload))
    return cloneValue(payload)
  }

  async preloadSharedComponents(ids: string[]): Promise<Record<string, SharedComponentPayload>> {
    const uniqueIds = Array.from(new Set(ids.filter(Boolean))).filter(id => !this.sharedComponentCache.has(id))

    if (uniqueIds.length > 0) {
      const response = await this.requestWithDiagnostics<SharedComponentListQuery>({
        query: SHARED_COMPONENTS_QUERY,
        variables: { websiteId: this.options.websiteId },
        operationName: 'SharedComponents'
      })

      if (response?.sharedComponents) {
        response.sharedComponents
          .filter(component => uniqueIds.includes(component.id))
          .forEach(component => {
            const snapshot = cloneValue(component)
            this.sharedComponentCache.set(snapshot.id, snapshot)
          })
      }
    }

    const result: Record<string, SharedComponentPayload> = {}
    ids.forEach(id => {
      const component = this.sharedComponentCache.get(id)
      if (component) {
        result[id] = cloneValue(component)
      }
    })
    return result
  }

  async getDiagnostics(): Promise<GeneratorDiagnostic[]> {
    return this.diagnostics.map(entry => ({ ...entry }))
  }

  private async requestWithDiagnostics<T>(params: {
    query: string
    variables?: Record<string, unknown>
    operationName: string
  }): Promise<T | null> {
    const apiKey = await this.resolveApiKey(params.operationName)
    if (!apiKey) {
      return null
    }

    try {
      return await this.graphqlClient.request<T>({
        query: params.query,
        variables: params.variables,
        operationName: params.operationName,
        apiKey
      })
    } catch (error) {
      this.handleGraphqlError(error, params.operationName)
      return null
    }
  }

  private handleGraphqlError(error: unknown, operationName: string): void {
    const errorMessage = error instanceof Error ? error.message : String(error)
    if (error instanceof GraphqlRequestError) {
      const isRateLimited =
        Boolean(error.options.rateLimited) || error.options.status === 429
      this.diagnostics.push({
        code: isRateLimited ? 'GRAPHQL_RATE_LIMITED' : 'GRAPHQL_REQUEST_FAILED',
        level: isRateLimited ? 'warn' : 'error',
        message: isRateLimited ? 'GraphQL request was rate limited' : errorMessage,
        context: {
          operationName: error.options.operationName ?? operationName,
          status: error.options.status,
          attempt: error.options.attempt,
          retryAfterMs: error.options.retryAfterMs,
          timeoutMs: error.options.timeoutMs,
          message: error.message
        }
      })
      return
    }

    this.diagnostics.push({
      code: 'GRAPHQL_REQUEST_FAILED',
      level: 'error',
      message: errorMessage,
      context: {
        operationName,
        error: error instanceof Error ? error.message : String(error)
      }
    })
  }

  private async resolveApiKey(operationName: string): Promise<string | null> {
    if (this.manualApiKey) {
      return this.manualApiKey
    }
    if (!this.apiKeyManager) {
      if (!this.apiKeyErrorReported) {
        this.apiKeyErrorReported = true
        this.diagnostics.push({
          code: 'API_KEY_UNAVAILABLE',
          level: 'error',
          message: 'GraphQL provider is not configured with an API key',
          context: { operationName }
        })
      }
      return null
    }
    try {
      return await this.apiKeyManager.getApiKey()
    } catch (error) {
      if (!this.apiKeyErrorReported) {
        this.apiKeyErrorReported = true
        this.diagnostics.push({
          code: 'API_KEY_UNAVAILABLE',
          level: 'error',
          message: 'Unable to retrieve a GraphQL API key',
          context: {
            operationName,
            error: error instanceof Error ? error.message : String(error)
          }
        })
      }
      return null
    }
  }

  private async fetchWebsite(): Promise<WebsiteQueryResult> {
    return (
      (await this.requestWithDiagnostics<WebsiteQueryResult>({
        query: WEBSITE_QUERY,
        variables: { websiteId: this.options.websiteId },
        operationName: 'WebsiteSnapshot'
      })) ?? { website: null, designSystems: [] }
    )
  }

  private async fetchAllSharedComponents(): Promise<SnapshotSharedComponent[]> {
    const data = await this.requestWithDiagnostics<SharedComponentListQuery>({
      query: SHARED_COMPONENTS_QUERY,
      variables: { websiteId: this.options.websiteId },
      operationName: 'SharedComponents'
    })
    if (!data) {
      return []
    }
    return (data.sharedComponents ?? []).map(component => cloneValue(component))
  }

  private async fetchPagePayload(slugSegments: SlugSegments): Promise<PagePayload | null> {
    const slugPath = slugSegmentsToPath(slugSegments)
    const data = await this.requestWithDiagnostics<PageQueryResult>({
      query: PAGE_QUERY,
      variables: { websiteId: this.options.websiteId, slug: slugPath },
      operationName: 'PageBySlug'
    })

    if (!data) {
      return null
    }

    if (!data.page) {
      this.diagnostics.push({
        code: 'GRAPHQL_PAGE_NOT_FOUND',
        level: 'warn',
        message: `GraphQL page query returned null for slug ${slugPath}`,
        context: { slug: slugPath }
      })
      return null
    }

    const metadata = data.page.metadata ?? {}
    const originOverride = extractSiteOriginFromMetadata(metadata)
    if (originOverride) {
      this.assetOrigin = originOverride
    }

    const page: SnapshotPage = {
      id: data.page.id,
      title: data.page.title,
      fullPath: data.page.fullPath ?? slugPath,
      templateKey: data.page.templateKey,
      templateProps: data.page.templateProps ?? {},
      regions: data.page.regions ?? [],
      components: data.page.components ?? [],
      metadata: metadata,
      sharedComponentIds: data.page.sharedComponentIds ?? undefined
    }

    const structure: PageStructurePayload | undefined = data.page.structure
      ? {
          current: toStructureNode(data.page.structure.current),
          ancestors: data.page.structure.ancestors
            .map(node => toStructureNode(node))
            .filter((node): node is SnapshotStructureNode => Boolean(node)),
          children: data.page.structure.children
            .map(node => toStructureNode(node))
            .filter((node): node is SnapshotStructureNode => Boolean(node))
        }
      : undefined

    const payload: PagePayload = {
      page: cloneValue(page),
      structure,
      sharedComponents: (data.page.sharedComponents ?? []).map(component => cloneValue(component)),
      diagnostics: data.page.diagnostics ?? []
    }

    // Resolve content references (media and page references) in page components and shared components
    const mediaLoader = createMediaUrlLoader()
    const pageLoader = createPagePathLoader()
    await resolveContentReferences(payload.page, { mediaLoader, pageLoader })
    await Promise.all(
      payload.sharedComponents.map(component =>
        resolveContentReferences(component, { mediaLoader, pageLoader })
      )
    )

    return payload
  }

  private pickDesignSystem(
    entries: WebsiteQueryResult['designSystems']
  ): SnapshotDesignSystem | null | undefined {
    if (!entries.length) {
      return null
    }

    let selected = entries.find(entry => entry.isCurrent) ?? entries[0]
    if (this.options.designConcept) {
      selected =
        entries.find(entry => entry.designConceptId === this.options.designConcept) ??
        entries.find(entry => slugifyConceptName(entry.conceptName ?? '') === slugifyConceptName(this.options.designConcept ?? '')) ??
        selected
    }

    if (!selected) {
      return null
    }

    return {
      tokens: cloneValue(selected.tokens),
      conceptId: selected.designConceptId ?? undefined,
      conceptName: selected.conceptName ?? undefined
    }
  }
}
