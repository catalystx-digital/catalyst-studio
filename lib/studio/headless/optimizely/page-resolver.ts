/**
 * Optimizely Page Resolver
 *
 * Resolves full page content from Optimizely Graph API by slug/URL.
 * Used at runtime or during build to fetch complete page data.
 */

import type {
  GeneratorDiagnostic,
  SnapshotPage,
  SnapshotSharedComponent,
  SnapshotRegionSummary
} from '@/lib/studio/headless/site-snapshot/types'
import type { ComponentInstance } from '@/lib/studio/types/site-builder/component-instance'
import { ComponentType, COMPONENT_TYPE_ALIASES } from '@/lib/studio/components/cms/_core/types'
import { OptimizelyGraphqlClient, type OptimizelyGraphqlClientOptions } from './graphql-client'
import { PAGE_WITH_CONTENT_QUERY } from './queries'

export interface ResolvedPage {
  page: SnapshotPage
  sharedComponents: SnapshotSharedComponent[]
  diagnostics: GeneratorDiagnostic[]
}

interface OptiMetadata {
  key: string
  displayName?: string
  types?: string[]
  url?: { default?: string }
  locale?: string
  status?: string
}

interface OptiComponent {
  __typename?: string
  _metadata?: {
    key: string
    types?: string[]
    displayName?: string
  }
  _json?: Record<string, unknown>
  [key: string]: unknown
}

interface OptiContentItem {
  __typename?: string
  _metadata?: OptiMetadata
  _json?: Record<string, unknown>
  components?: OptiComponent[]
  [key: string]: unknown
}

interface PageQueryResponse {
  _Content: {
    items: OptiContentItem[]
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseJsonField(value: unknown, depth: number = 0): unknown {
  if (depth > 5) return value
  if (!value) return null
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        return JSON.parse(trimmed)
      } catch {
        return value
      }
    }
    return value
  }
  if (isRecord(value)) {
    const result: Record<string, unknown> = {}
    for (const [key, v] of Object.entries(value)) {
      result[key] = parseJsonField(v, depth + 1)
    }
    return result
  }
  if (Array.isArray(value)) {
    return value.map(item => parseJsonField(item, depth + 1))
  }
  return value
}

function mapComponentType(optiType: string): string {
  const typeMap: Record<string, string> = {
    navbar: 'navbar',
    footer: 'footer',
    card_grid: 'card-grid',
    two_column: 'two-column',
    hero: 'hero-video',
    hero_carousel: 'hero-with-image',
    content_feed: 'blog-list',
    hero_banner: 'hero-video',
    hero_split: 'hero-split',
    hero_minimal: 'hero-minimal',
    text_block: 'text-block',
    image_gallery: 'image-gallery',
    cta_banner: 'cta-banner',
    cta_simple: 'cta-simple',
    feature_grid: 'feature-grid'
  }
  return typeMap[optiType] || optiType.replace(/_/g, '-')
}

/**
 * Resolve a component type string to the canonical ComponentType enum value.
 * Returns undefined if no match is found.
 */
function resolveComponentType(typeString: string): ComponentType | undefined {
  // Check if it's already a valid enum value
  const enumValues = Object.values(ComponentType) as string[]
  if (enumValues.includes(typeString)) {
    return typeString as ComponentType
  }
  // Check aliases
  return COMPONENT_TYPE_ALIASES[typeString]
}

function getComponentRegion(componentType: string): string {
  const regionMap: Record<string, string> = {
    navbar: 'header',
    footer: 'footer',
    'hero-video': 'hero',
    'hero-with-image': 'hero',
    'hero-split': 'hero',
    'hero-minimal': 'hero',
    'hero-banner': 'hero'
  }
  return regionMap[componentType] || 'main'
}

function transformComponentContent(
  content: Record<string, unknown>,
  componentType: string
): Record<string, unknown> {
  const transformed = { ...content }

  // Type-specific transformations
  switch (componentType) {
    case 'navbar':
      if (!Array.isArray(transformed.menuItems)) {
        transformed.menuItems = []
      }
      break
    case 'footer':
      if (!Array.isArray(transformed.columns)) {
        transformed.columns = []
      }
      if (!Array.isArray(transformed.socialLinks)) {
        transformed.socialLinks = []
      }
      break
    case 'card-grid':
      if (!Array.isArray(transformed.cards)) {
        transformed.cards = []
      }
      break
    case 'two-column':
      if (!Array.isArray(transformed.leftColumn)) {
        transformed.leftColumn = []
      }
      if (!Array.isArray(transformed.rightColumn)) {
        transformed.rightColumn = []
      }
      break
  }

  return transformed
}

function mapOptiComponent(optiComp: OptiComponent, index: number): ComponentInstance {
  const concreteType = optiComp._metadata?.types?.[0] ?? optiComp.__typename ?? 'unknown'
  const componentType = mapComponentType(concreteType)
  const region = getComponentRegion(componentType)

  let content: Record<string, unknown> = {}

  // Extract content from _json field
  if (optiComp._json && isRecord(optiComp._json)) {
    content = { ...optiComp._json }
    delete content._metadata
    delete content.__typename

    // Parse any JSON string fields
    for (const [key, value] of Object.entries(content)) {
      content[key] = parseJsonField(value)
    }
  }

  // Merge top-level properties (excluding metadata/system fields)
  for (const [key, value] of Object.entries(optiComp)) {
    if (key.startsWith('_') || key === '__typename' || key === 'components') {
      continue
    }
    if (content[key] === undefined && value !== undefined) {
      content[key] = parseJsonField(value)
    }
  }

  content = transformComponentContent(content, componentType)

  return {
    id: optiComp._metadata?.key ?? `opti-comp-${index}`,
    type: componentType,
    componentType: resolveComponentType(componentType),
    componentTypeId: concreteType,
    parentId: null,
    position: index,
    props: {
      region,
      className: '',
      // Store Optimizely-specific metadata in props
      _optimizelyType: concreteType,
      _displayName: optiComp._metadata?.displayName
    },
    content,
    styles: {},
    metadata: {}
  }
}

function buildRegionSummary(components: ComponentInstance[]): SnapshotRegionSummary[] {
  const regionTypes = new Map<string, Set<string>>()

  components.forEach(comp => {
    const region = (comp.props as Record<string, unknown>)?.region as string ?? 'main'
    const types = regionTypes.get(region) ?? new Set()
    types.add(comp.componentType ?? comp.type)
    regionTypes.set(region, types)
  })

  return Array.from(regionTypes.entries()).map(([region, types]) => ({
    region: region as 'header' | 'hero' | 'main' | 'footer',
    componentTypes: Array.from(types) as SnapshotRegionSummary['componentTypes']
  }))
}

export interface OptimizelyPageResolverOptions extends OptimizelyGraphqlClientOptions {
  /** Strip locale prefix from paths (default: true) */
  stripLocalePrefix?: boolean
}

export class OptimizelyPageResolver {
  private readonly client: OptimizelyGraphqlClient
  private readonly options: OptimizelyPageResolverOptions
  private readonly sharedComponentCache = new Map<string, SnapshotSharedComponent>()

  constructor(options: OptimizelyPageResolverOptions) {
    this.options = {
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

  async resolvePageBySlug(slug: string[]): Promise<ResolvedPage | null> {
    const locale = this.client.getLocale()
    const diagnostics: GeneratorDiagnostic[] = []

    // Build path with locale prefix for Optimizely query
    const slugPath = '/' + slug.filter(Boolean).join('/')
    const pathWithLocale = `/${locale}${slugPath === '/' ? '' : slugPath}/`

    try {
      const response = await this.client.request<PageQueryResponse>(
        PAGE_WITH_CONTENT_QUERY,
        { path: [pathWithLocale], locale: [locale] }
      )

      const content = response._Content?.items?.[0]
      if (!content) {
        diagnostics.push({
          level: 'warn',
          code: 'OPTIMIZELY_PAGE_NOT_FOUND',
          message: `No page found for path: ${pathWithLocale}`,
          context: { slug, pathWithLocale }
        })
        return null
      }

      // Map components
      const components: ComponentInstance[] = []
      const sharedComponents: SnapshotSharedComponent[] = []

      if (Array.isArray(content.components)) {
        content.components.forEach((optiComp, index) => {
          const component = mapOptiComponent(optiComp, index)
          components.push(component)

          // Cache as shared component if it has a key
          if (optiComp._metadata?.key) {
            const sharedId = String(optiComp._metadata.key)
            const shared: SnapshotSharedComponent = {
              id: sharedId,
              name: optiComp._metadata.displayName ?? component.type,
              componentType: component.componentType as SnapshotSharedComponent['componentType'],
              componentTypeId: component.componentTypeId,
              content: component.content as Record<string, unknown>,
              config: {}
            }
            sharedComponents.push(shared)
            this.sharedComponentCache.set(sharedId, shared)
          }
        })
      }

      // Normalize the path (strip locale, trailing slash)
      let normalizedPath = content._metadata?.url?.default ?? slugPath
      if (this.options.stripLocalePrefix) {
        const localePrefix = `/${locale}/`
        if (normalizedPath.startsWith(localePrefix)) {
          normalizedPath = '/' + normalizedPath.slice(localePrefix.length)
        } else if (normalizedPath === `/${locale}` || normalizedPath === `/${locale}/`) {
          normalizedPath = '/'
        }
      }
      if (normalizedPath.length > 1 && normalizedPath.endsWith('/')) {
        normalizedPath = normalizedPath.slice(0, -1)
      }

      const page: SnapshotPage = {
        id: String(content._metadata?.key ?? 'page'),
        title: content._metadata?.displayName ?? 'Untitled',
        fullPath: normalizedPath,
        templateKey: content.__typename ?? null,
        templateProps: {},
        regions: buildRegionSummary(components),
        components,
        metadata: {
          contentTypeId: content.__typename,
          locale: content._metadata?.locale ?? locale,
          status: content._metadata?.status,
          optimizelyUrl: content._metadata?.url?.default
        },
        sharedComponentIds: sharedComponents.map(s => s.id)
      }

      diagnostics.push({
        level: 'info',
        code: 'OPTIMIZELY_PAGE_RESOLVED',
        message: `Resolved page with ${components.length} components`,
        context: {
          pageId: page.id,
          fullPath: page.fullPath,
          componentCount: components.length
        }
      })

      return { page, sharedComponents, diagnostics }
    } catch (error) {
      diagnostics.push({
        level: 'error',
        code: 'OPTIMIZELY_PAGE_RESOLVE_ERROR',
        message: 'Failed to resolve page from Optimizely',
        context: {
          slug,
          pathWithLocale,
          error: error instanceof Error ? error.message : String(error)
        }
      })
      return null
    }
  }

  getSharedComponentCache(): Map<string, SnapshotSharedComponent> {
    return this.sharedComponentCache
  }
}

export async function resolveOptimizelyPageBySlug(
  slug: string[],
  options: {
    gateway: string
    singleKey: string
    locale?: string
    stripLocalePrefix?: boolean
    debug?: boolean
  }
): Promise<ResolvedPage | null> {
  const endpoint = options.gateway.endsWith('/content/v2')
    ? options.gateway
    : `${options.gateway}/content/v2`

  const resolver = new OptimizelyPageResolver({
    endpoint,
    singleKey: options.singleKey,
    locale: options.locale,
    stripLocalePrefix: options.stripLocalePrefix,
    debug: options.debug
  })

  return resolver.resolvePageBySlug(slug)
}
