/**
 * Umbraco Compose HeadDataProvider
 *
 * Reads content from Umbraco Compose GraphQL API and transforms it
 * into the site snapshot format for Next.js site generation.
 *
 * This provider:
 * - Uses PAT (Personal Access Token) authentication
 * - Queries the GraphQL API at build time
 * - Maps Umbraco content types to React components
 * - Supports shared components (navbar, footer)
 */

import type { HeadDataProvider, ProviderFactory, ProviderFactoryContext } from '../core/provider'
import type {
  GeneratorDiagnostic,
  PagePayload,
  PageStructurePayload,
  ProviderContextSnapshot,
  ProviderRequestContext,
  SharedComponentPayload,
  SlugSegments,
  SnapshotPage,
  SnapshotSharedComponent
} from '../core/types'
import type { ComponentType } from '@/lib/studio/components/cms/_core/types'
import {
  canonicalSlugKey,
  canonicalizeSlugSegments,
  sanitizeSlugSegments
} from '@/lib/studio/utils/slug-canonicalizer'
import { UmbracoComposeGraphQLClient } from './umbraco-compose/client'
import type { UmbracoComposeProviderOptions, UmbracoContentItem } from './umbraco-compose/types'
import {
  mapUmbracoPage,
  isPageContent,
  buildSiteStructure,
  findNodeByPageId,
  findChildren,
  findAncestors,
  mapUmbracoComponent,
  isSharedComponent,
  extractComponentType
} from './umbraco-compose/mappers'

/**
 * Extract content data from Umbraco content item.
 */
function extractContentData(content: UmbracoContentItem): Record<string, unknown> {
  if (content.data && typeof content.data === 'object') {
    return content.data
  }

  const data: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(content)) {
    if (key !== 'id' && key !== '__typename' && key !== 'type') {
      data[key] = value
    }
  }
  return data
}

/**
 * Umbraco Compose HeadDataProvider implementation.
 */
class UmbracoComposeHeadDataProvider implements HeadDataProvider {
  readonly name = 'umbraco-compose'
  readonly supportsLiveData = false // Build-time only

  private readonly client: UmbracoComposeGraphQLClient
  private readonly options: UmbracoComposeProviderOptions
  private diagnostics: GeneratorDiagnostic[] = []
  private pageCache = new Map<string, SnapshotPage>()
  private sharedComponentCache = new Map<string, SnapshotSharedComponent>()
  private structureCache: import('../core/types').SnapshotStructureNode[] = []

  constructor(options: UmbracoComposeProviderOptions) {
    this.options = options
    this.client = new UmbracoComposeGraphQLClient({
      projectAlias: options.projectAlias,
      region: options.region,
      environment: options.environment,
      personalAccessToken: options.personalAccessToken,
      collection: options.collection,
      debug: options.debug
    })
  }

  /**
   * Deep clone helper to prevent mutation.
   */
  private clonePayload<T>(payload: T): T {
    return JSON.parse(JSON.stringify(payload)) as T
  }

  /**
   * Load complete site snapshot from Umbraco Compose.
   */
  async loadSnapshot(): Promise<ProviderContextSnapshot> {
    this.diagnostics = []
    this.pageCache.clear()
    this.sharedComponentCache.clear()

    try {
      // Test connection
      const connected = await this.client.testConnection()
      if (!connected) {
        throw new Error('Failed to connect to Umbraco Compose GraphQL API')
      }

      if (this.options.debug) {
        console.log(`[UmbracoComposeProvider] Connected to ${this.client.getEndpoint()}`)
      }

      // Fetch all content
      const allContent = await this.client.getAllContent()

      if (this.options.debug) {
        console.log(`[UmbracoComposeProvider] Fetched ${allContent.length} content items`)
      }

      // Separate pages from shared components
      const pageItems: UmbracoContentItem[] = []
      const sharedItems: UmbracoContentItem[] = []

      for (const item of allContent) {
        if (isSharedComponent(item)) {
          sharedItems.push(item)
        } else if (isPageContent(item)) {
          pageItems.push(item)
        } else {
          // Unknown content type
          this.diagnostics.push({
            level: 'warn',
            code: 'UMBRACO_UNKNOWN_CONTENT_TYPE',
            message: `Unknown content type for item: ${item.id}`,
            context: { id: item.id, typename: item.__typename }
          })
        }
      }

      // Map pages
      const pages: SnapshotPage[] = []
      for (const item of pageItems) {
        try {
          const page = mapUmbracoPage(item, {
            componentTypeMap: this.options.componentTypeMap,
            templateMap: this.options.templateMap,
            debug: this.options.debug
          })
          pages.push(page)
          this.pageCache.set(page.id, this.clonePayload(page))
        } catch (error) {
          this.diagnostics.push({
            level: 'error',
            code: 'UMBRACO_PAGE_MAPPING_ERROR',
            message: `Failed to map page: ${item.id}`,
            context: {
              id: item.id,
              error: error instanceof Error ? error.message : String(error)
            }
          })
        }
      }

      // Map shared components
      const sharedComponents: SnapshotSharedComponent[] = []
      for (const item of sharedItems) {
        try {
          const shared = this.mapSharedComponent(item)
          sharedComponents.push(shared)
          this.sharedComponentCache.set(shared.id, this.clonePayload(shared))
        } catch (error) {
          this.diagnostics.push({
            level: 'error',
            code: 'UMBRACO_SHARED_COMPONENT_ERROR',
            message: `Failed to map shared component: ${item.id}`,
            context: {
              id: item.id,
              error: error instanceof Error ? error.message : String(error)
            }
          })
        }
      }

      // Build site structure
      const structure = buildSiteStructure(pages)
      this.structureCache = structure

      if (this.options.debug) {
        console.log(`[UmbracoComposeProvider] Mapped ${pages.length} pages, ${sharedComponents.length} shared components`)
      }

      this.diagnostics.push({
        level: 'info',
        code: 'UMBRACO_SNAPSHOT_COMPLETE',
        message: 'Successfully loaded Umbraco Compose snapshot',
        context: {
          pageCount: pages.length,
          sharedComponentCount: sharedComponents.length,
          structureNodeCount: structure.length
        }
      })

      return {
        site: {
          id: `umbraco-${this.options.projectAlias}`,
          name: this.options.projectAlias.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
          description: `Site from Umbraco Compose project: ${this.options.projectAlias}`
        },
        pages,
        structure,
        sharedComponents,
        capturedAt: new Date().toISOString(),
        designSystem: null, // Umbraco Compose doesn't provide design system
        diagnostics: this.diagnostics
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)

      this.diagnostics.push({
        level: 'error',
        code: 'UMBRACO_SNAPSHOT_ERROR',
        message: 'Failed to load Umbraco Compose snapshot',
        context: {
          endpoint: this.client.getEndpoint(),
          error: errorMessage
        }
      })

      // Return minimal snapshot on error
      return {
        site: {
          id: `umbraco-${this.options.projectAlias}`,
          name: `${this.options.projectAlias} (Error)`,
          description: `Failed to load from Umbraco Compose: ${errorMessage}`
        },
        pages: [],
        structure: [],
        sharedComponents: [],
        capturedAt: new Date().toISOString(),
        designSystem: null,
        diagnostics: this.diagnostics
      }
    }
  }

  /**
   * Resolve a single page by slug.
   */
  async resolvePageBySlug(
    slug: SlugSegments,
    _context: ProviderRequestContext
  ): Promise<PagePayload | null> {
    const sanitized = sanitizeSlugSegments(slug)
    const canonical = canonicalizeSlugSegments(sanitized)
    const slugKey = canonicalSlugKey(canonical)
    const fullPath = slugKey === '' ? '/' : `/${slugKey}`

    // Find page by path
    const page = Array.from(this.pageCache.values()).find(p => p.fullPath === fullPath)

    if (!page) {
      return null
    }

    // Build structure payload
    const structureNode = findNodeByPageId(page.id, this.structureCache)
    let structure: PageStructurePayload | undefined

    if (structureNode) {
      structure = {
        current: this.clonePayload(structureNode),
        ancestors: findAncestors(structureNode.id, this.structureCache).map(n => this.clonePayload(n)),
        children: findChildren(structureNode.id, this.structureCache).map(n => this.clonePayload(n))
      }
    }

    // Collect shared components referenced by this page
    const sharedComponents: SharedComponentPayload[] = []
    if (page.sharedComponentIds) {
      for (const id of page.sharedComponentIds) {
        const shared = this.sharedComponentCache.get(id)
        if (shared) {
          sharedComponents.push(this.clonePayload(shared))
        }
      }
    }

    return {
      page: this.clonePayload(page),
      structure,
      sharedComponents,
      diagnostics: []
    }
  }

  /**
   * Preload shared components by IDs.
   */
  async preloadSharedComponents(
    ids: string[],
    _context: ProviderRequestContext
  ): Promise<Record<string, SharedComponentPayload>> {
    const result: Record<string, SharedComponentPayload> = {}

    for (const id of ids) {
      const cached = this.sharedComponentCache.get(id)
      if (cached) {
        result[id] = this.clonePayload(cached)
      }
    }

    return result
  }

  /**
   * Get collected diagnostics.
   */
  getDiagnostics(): GeneratorDiagnostic[] {
    return this.diagnostics.map(d => ({ ...d }))
  }

  /**
   * Map an Umbraco content item to a SnapshotSharedComponent.
   */
  private mapSharedComponent(item: UmbracoContentItem): SnapshotSharedComponent {
    const type = extractComponentType(item, 'component')
    const data = extractContentData(item)

    // Map to component instance to get transformed props
    const component = mapUmbracoComponent(data, type, {
      componentTypeMap: this.options.componentTypeMap,
      debug: this.options.debug
    })

    // Extract name from data or derive from ID
    const name = typeof data.name === 'string'
      ? data.name
      : typeof data.title === 'string'
        ? data.title
        : type.charAt(0).toUpperCase() + type.slice(1)

    return {
      id: item.id,
      name,
      componentType: component.componentType as ComponentType,
      content: component.props,
      config: {}
    }
  }
}

/**
 * Factory function to create Umbraco Compose provider.
 */
export const createUmbracoComposeProvider: ProviderFactory = (
  context: ProviderFactoryContext
): HeadDataProvider => {
  const options = context.umbracoCompose

  if (!options) {
    throw new Error(
      'Umbraco Compose provider requires configuration. ' +
      'Use --umbraco-project, --umbraco-region, and --umbraco-pat flags.'
    )
  }

  if (!options.projectAlias) {
    throw new Error('The --umbraco-project flag is required for Umbraco Compose provider')
  }

  if (!options.region) {
    throw new Error('The --umbraco-region flag is required for Umbraco Compose provider')
  }

  if (!options.personalAccessToken) {
    throw new Error('The --umbraco-pat flag is required for Umbraco Compose provider')
  }

  return new UmbracoComposeHeadDataProvider(options)
}
