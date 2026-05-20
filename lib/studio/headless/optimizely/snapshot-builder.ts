/**
 * Optimizely Content Graph Snapshot Builder
 *
 * Queries Optimizely Graph API at build time to discover site structure,
 * pages, and build a SiteSnapshot compatible with the UCS format.
 */

import type {
  GeneratorDiagnostic,
  SiteSnapshot,
  SnapshotPage,
  SnapshotStructureNode,
  SnapshotSharedComponent
} from '@/lib/studio/headless/site-snapshot/types'
import type { ComponentInstance } from '@/lib/studio/types/site-builder/component-instance'
import { OptimizelyGraphqlClient, type OptimizelyGraphqlClientOptions } from './graphql-client'
import { DISCOVER_PAGES_QUERY, PAGE_BY_ID_QUERY } from './queries'

export interface OptimizelySnapshotOptions extends OptimizelyGraphqlClientOptions {
  /** Starting page ID for site traversal */
  startPageId?: string
  /** Maximum pages to discover (default: 1000) */
  maxPages?: number
  /** Strip locale prefix from paths (default: true) */
  stripLocalePrefix?: boolean
  /** Design system to bake into the snapshot */
  designSystem?: import('@/lib/studio/import/types/design-system.types').DesignSystem
}

interface OptiMetadata {
  key: string
  displayName?: string
  types?: string[]
  url?: { default?: string }
  locale?: string
  status?: string
}

interface OptiContentItem {
  __typename?: string
  _metadata?: OptiMetadata
  _json?: Record<string, unknown>
}

interface DiscoverPagesResponse {
  _Content: {
    items: OptiContentItem[]
    cursor?: string
  }
}

interface PageByIdResponse {
  _Content: {
    items: OptiContentItem[]
  }
}

interface DiscoveredPage {
  id: string
  title: string
  fullPath: string
  contentType: string
  locale: string
  status: string
  rawUrl: string
}

function normalizeOptimizelyPath(
  rawPath: string | undefined,
  locale: string,
  stripLocale: boolean
): string {
  if (!rawPath) {
    return '/'
  }

  let normalized = rawPath.trim()

  // Strip locale prefix if configured (e.g., /en/path -> /path)
  if (stripLocale) {
    const localePrefix = `/${locale}/`
    if (normalized.startsWith(localePrefix)) {
      normalized = '/' + normalized.slice(localePrefix.length)
    } else if (normalized === `/${locale}` || normalized === `/${locale}/`) {
      normalized = '/'
    }
  }

  // Remove trailing slash except for root
  if (normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1)
  }

  return normalized || '/'
}

function buildStructureFromPages(
  pages: DiscoveredPage[],
  startPagePath: string
): SnapshotStructureNode[] {
  const structure: SnapshotStructureNode[] = []
  const pathToId = new Map<string, string>()

  // First pass: map paths to IDs
  pages.forEach(page => {
    pathToId.set(page.fullPath, page.id)
  })

  // Second pass: build structure with parent relationships
  pages.forEach((page, index) => {
    const pathParts = page.fullPath.split('/').filter(Boolean)
    const parentPath = pathParts.length > 1
      ? '/' + pathParts.slice(0, -1).join('/')
      : null
    const slug = pathParts.length > 0 ? pathParts[pathParts.length - 1] : ''

    structure.push({
      id: `opti-struct-${page.id}`,
      websitePageId: page.id,
      parentId: parentPath && pathToId.has(parentPath)
        ? `opti-struct-${pathToId.get(parentPath)}`
        : null,
      slug,
      fullPath: page.fullPath,
      position: index,
      isFolder: false,
      title: page.title
    })
  })

  return structure
}

export class OptimizelySnapshotBuilder {
  private readonly client: OptimizelyGraphqlClient
  private readonly diagnostics: GeneratorDiagnostic[] = []
  private readonly options: OptimizelySnapshotOptions
  private discoveredPages: DiscoveredPage[] = []
  private startPagePath: string = '/'

  constructor(options: OptimizelySnapshotOptions) {
    this.options = {
      maxPages: 1000,
      stripLocalePrefix: true,
      ...options
    }
    this.client = new OptimizelyGraphqlClient({
      endpoint: options.endpoint,
      singleKey: options.singleKey,
      locale: options.locale,
      debug: options.debug
    })
  }

  async build(): Promise<{ snapshot: SiteSnapshot; diagnostics: GeneratorDiagnostic[] }> {
    const locale = this.client.getLocale()

    // Step 1: Discover start page if provided
    if (this.options.startPageId) {
      await this.discoverStartPage(this.options.startPageId, locale)
    }

    // Step 2: Discover all pages with URLs
    await this.discoverPages(locale)

    // Step 3: Build structure from discovered pages
    const structure = buildStructureFromPages(this.discoveredPages, this.startPagePath)

    // Step 4: Build minimal page entries (full content fetched at runtime)
    const pages: SnapshotPage[] = this.discoveredPages.map(page => ({
      id: page.id,
      title: page.title,
      fullPath: page.fullPath,
      templateKey: page.contentType,
      templateProps: {},
      regions: [],
      components: [],
      metadata: {
        contentTypeId: page.contentType,
        locale: page.locale,
        status: page.status,
        optimizelyUrl: page.rawUrl
      },
      sharedComponentIds: []
    }))

    const snapshot: SiteSnapshot = {
      site: {
        id: 'optimizely-site',
        name: 'Optimizely Site',
        description: `Discovered ${pages.length} pages from Optimizely Graph`,
        origin: this.options.endpoint.replace('/content/v2', '')
      },
      pages,
      structure,
      sharedComponents: [],
      capturedAt: new Date().toISOString(),
      designSystem: this.options.designSystem
        ? { tokens: this.options.designSystem }
        : null
    }

    this.diagnostics.push({
      level: 'info',
      code: 'OPTIMIZELY_SNAPSHOT_COMPLETE',
      message: `Built snapshot with ${pages.length} pages and ${structure.length} structure nodes`,
      context: {
        pageCount: pages.length,
        structureCount: structure.length,
        locale,
        startPageId: this.options.startPageId
      }
    })

    return { snapshot, diagnostics: this.diagnostics }
  }

  private async discoverStartPage(startPageId: string, locale: string): Promise<void> {
    try {
      const response = await this.client.request<PageByIdResponse>(
        PAGE_BY_ID_QUERY,
        { id: parseInt(startPageId, 10), locale: [locale] }
      )

      const startPage = response._Content?.items?.[0]
      if (startPage?._metadata?.url?.default) {
        this.startPagePath = normalizeOptimizelyPath(
          startPage._metadata.url.default,
          locale,
          this.options.stripLocalePrefix ?? true
        )

        this.diagnostics.push({
          level: 'info',
          code: 'OPTIMIZELY_START_PAGE_FOUND',
          message: `Start page resolved to path: ${this.startPagePath}`,
          context: {
            startPageId,
            rawUrl: startPage._metadata.url.default,
            normalizedPath: this.startPagePath
          }
        })
      }
    } catch (error) {
      this.diagnostics.push({
        level: 'warn',
        code: 'OPTIMIZELY_START_PAGE_ERROR',
        message: `Failed to resolve start page ID ${startPageId}`,
        context: {
          startPageId,
          error: error instanceof Error ? error.message : String(error)
        }
      })
    }
  }

  private async discoverPages(locale: string): Promise<void> {
    const maxPages = this.options.maxPages ?? 1000
    const pageSize = 100
    let cursor: string | undefined
    let totalDiscovered = 0

    while (totalDiscovered < maxPages) {
      try {
        const response = await this.client.request<DiscoverPagesResponse>(
          DISCOVER_PAGES_QUERY,
          { locale: [locale], limit: pageSize, cursor }
        )

        const items = response._Content?.items ?? []
        if (items.length === 0) {
          break
        }

        for (const item of items) {
          if (!item._metadata?.url?.default) {
            continue
          }

          const rawUrl = item._metadata.url.default
          const fullPath = normalizeOptimizelyPath(
            rawUrl,
            locale,
            this.options.stripLocalePrefix ?? true
          )

          this.discoveredPages.push({
            id: String(item._metadata.key),
            title: item._metadata.displayName ?? `Page ${item._metadata.key}`,
            fullPath,
            contentType: item._metadata.types?.[0] ?? item.__typename ?? 'Page',
            locale: item._metadata.locale ?? locale,
            status: item._metadata.status ?? 'Published',
            rawUrl
          })

          totalDiscovered++
          if (totalDiscovered >= maxPages) {
            break
          }
        }

        cursor = response._Content?.cursor
        if (!cursor) {
          break
        }
      } catch (error) {
        this.diagnostics.push({
          level: 'error',
          code: 'OPTIMIZELY_DISCOVER_PAGES_ERROR',
          message: 'Failed to discover pages from Optimizely Graph',
          context: {
            discoveredSoFar: totalDiscovered,
            error: error instanceof Error ? error.message : String(error)
          }
        })
        break
      }
    }

    this.diagnostics.push({
      level: 'info',
      code: 'OPTIMIZELY_PAGES_DISCOVERED',
      message: `Discovered ${totalDiscovered} pages from Optimizely Graph`,
      context: { count: totalDiscovered, locale }
    })
  }

  getDiscoveredPages(): DiscoveredPage[] {
    return [...this.discoveredPages]
  }
}

export interface BuildOptimizelySnapshotOptions {
  gateway: string
  singleKey: string
  startPageId?: string
  locale?: string
  maxPages?: number
  stripLocalePrefix?: boolean
  debug?: boolean
  /**
   * Design system to bake into the snapshot.
   * For non-UCS providers like Optimizely, design system is provided at build time
   * rather than extracted from the CMS.
   */
  designSystem?: import('@/lib/studio/import/types/design-system.types').DesignSystem
}

export async function buildOptimelySiteSnapshot(
  options: BuildOptimizelySnapshotOptions
): Promise<{ snapshot: SiteSnapshot; diagnostics: GeneratorDiagnostic[] }> {
  const endpoint = options.gateway.endsWith('/content/v2')
    ? options.gateway
    : `${options.gateway}/content/v2`

  const builder = new OptimizelySnapshotBuilder({
    endpoint,
    singleKey: options.singleKey,
    startPageId: options.startPageId,
    locale: options.locale,
    maxPages: options.maxPages,
    stripLocalePrefix: options.stripLocalePrefix,
    debug: options.debug,
    designSystem: options.designSystem
  })

  return builder.build()
}
