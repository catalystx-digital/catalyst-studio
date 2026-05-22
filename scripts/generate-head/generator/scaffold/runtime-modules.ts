import type { SiteSnapshot, SlugRegistryEntry, SnapshotRedirect } from '../../core/types'
import type { StructureIndex } from '../../core/structure'
import { ComponentCategory, ComponentType } from '@/lib/studio/components/cms/_core/types'
import { COMPONENT_REGISTRY } from '@/lib/studio/components/component-registry.generated'

export function buildPageRendererModule(): string {
  const resolveEnumKey = <T extends Record<string, string>>(enumObject: T, value: string): string | undefined => {
    const entry = Object.entries(enumObject).find(([, enumValue]) => enumValue === value)
    return entry ? entry[0] : undefined
  }

  const componentCategoryEntries = COMPONENT_REGISTRY.map(entry => {
    const typeKey = resolveEnumKey(ComponentType, entry.name)
    const categoryKey = resolveEnumKey(ComponentCategory, entry.category)
    const typeLiteral = typeKey ? `ComponentType.${typeKey}` : JSON.stringify(entry.name)
    const categoryLiteral = categoryKey ? `ComponentCategory.${categoryKey}` : JSON.stringify(entry.category)
    return `  [${typeLiteral}]: ${categoryLiteral}`
  })
  const componentCategoryLookupLiteral = componentCategoryEntries.join(',\n')

  return `import * as React from 'react'
import type { GeneratedSnapshotPage } from '@/generated/providers/types'
import { activeProvider } from '@/generated/providers'
import { getGeneratedComponentRenderer } from '@/generated/components'
import type { GeneratedComponentRenderer } from '@/generated/components'
import { buildComponentTree, type ComponentTreeNode } from '@/generated/runtime/component-tree'
import { createRenderContext, type RenderContext } from '@/generated/runtime/render-context'
import type { RouteResolution } from '@/generated/runtime/routing'
import { ComponentCategory, ComponentType } from '@/lib/studio/components/cms/_core/types'
import { resolveSharedComponentReference } from '@/lib/studio/types/site-builder/component-instance'

interface RenderPageOptions {
  headers?: Record<string, string>
  searchParams?: Record<string, string | string[]>
  url?: string
  requestId?: string
}

interface RenderComponentResult {
  element: React.ReactNode
  region: string
}

function renderMissingPage(slug: string[]): React.ReactElement {
  const slugPath = slug.length > 0 ? '/' + slug.join('/') : '/'
  return (
    <main className="container mx-auto space-y-6 py-12">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold">Missing page</h1>
        <p className="text-muted-foreground">No page data was found for {slugPath}</p>
      </header>
      <p className="text-sm text-muted-foreground">
        Ensure the slug exists in the route registry or is resolvable by the active provider.
      </p>
    </main>
  )
}

function renderMissingComponent(node: ComponentTreeNode, reason: string): React.ReactElement {
  return (
    <article className="rounded-md border border-dashed px-6 py-4">
      <p className="text-sm font-medium">Unable to render {node.instance.type}</p>
      <p className="text-xs text-muted-foreground">{reason}</p>
    </article>
  )
}

const COMPONENT_CATEGORY_LOOKUP: Partial<Record<ComponentType, ComponentCategory>> = {
${componentCategoryLookupLiteral}
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function clone<T>(value: T): T {
  if (value === undefined || value === null) {
    return value
  }

  try {
    return JSON.parse(JSON.stringify(value)) as T
  } catch {
    return value
  }
}

function normalizeRuntimeContent(
  content: Record<string, unknown>,
  componentType: string
): Record<string, unknown> {
  // Handle blog-list 'blogs' -> 'posts' mapping
  if (componentType === 'blog-list' && Array.isArray(content.blogs) && !content.posts) {
    const blogs = content.blogs as Array<Record<string, unknown>>
    return {
      ...content,
      title: (content.heading ?? content.title) as string | undefined,
      posts: blogs.map((blog) => ({
        id: blog.id ?? \`post-\${Math.random().toString(36).substr(2, 9)}\`,
        title: blog.title,
        excerpt: blog.excerpt,
        publishDate: blog.date ?? new Date().toISOString(),
        categories: blog.topic ? [blog.topic] : [],
        link: blog.link,
        attachments: blog.attachments,
      })),
    }
  }

  return content
}

function deriveInlineStyle(explicitStyle: unknown, styles: unknown): Record<string, unknown> | undefined {
  if (explicitStyle && isRecord(explicitStyle)) {
    return explicitStyle
  }

  if (!styles || typeof styles !== 'object') {
    return undefined
  }

  const desktopStyles = (styles as Record<string, unknown>)['desktop']
  if (desktopStyles && isRecord(desktopStyles)) {
    const entries = Object.entries(desktopStyles).filter(([, value]) => {
      return typeof value === 'string' || typeof value === 'number'
    })
    if (entries.length > 0) {
      return Object.fromEntries(entries)
    }
  }

  return undefined
}

function resolveComponentCategory(type: string | undefined): ComponentCategory {
  if (type) {
    const resolved = COMPONENT_CATEGORY_LOOKUP[type as ComponentType]
    if (resolved) {
      return resolved
    }
  }
  return ComponentCategory.Content
}

function sanitizeComponentProps(props: unknown): Record<string, unknown> {
  if (!props || typeof props !== 'object') {
    return {}
  }

  const entries = Object.entries(props as Record<string, unknown>).filter(([key]) => key !== 'region')
  return JSON.parse(JSON.stringify(Object.fromEntries(entries)))
}

function buildRegionChildrenMap(
  nodes: ComponentTreeNode[],
  rendered: RenderComponentResult[]
): Record<string, React.ReactNode[]> {
  const regions: Record<string, React.ReactNode[]> = {}

  nodes.forEach((child, index) => {
    const key = child.region ?? 'default'
    if (!regions[key]) {
      regions[key] = []
    }
    regions[key].push(rendered[index]?.element ?? null)
  })

  return regions
}

function assignCoreAdapterProps(
  node: ComponentTreeNode,
  props: Record<string, unknown>,
  renderer: GeneratedComponentRenderer
): void {
  const resolvedType =
    renderer.componentType ??
    (typeof node.instance.componentType === 'string' ? node.instance.componentType : undefined) ??
    (typeof node.instance.type === 'string' ? node.instance.type : undefined)

  if (resolvedType) {
    props.type = resolvedType
  }

  if (typeof props.category !== 'string') {
    props.category = resolveComponentCategory((resolvedType ?? undefined) as string | undefined)
  }

  const canonicalContent = isRecord(node.instance.content) ? clone(node.instance.content) : {}
  props.content = normalizeRuntimeContent(canonicalContent, node.instance.type)
  delete props.text

  const inlineStyle = deriveInlineStyle(props.style, node.instance.styles)
  if (inlineStyle) {
    props.style = inlineStyle
  } else if ('style' in props) {
    delete props.style
  }
}

async function renderComponentNode(node: ComponentTreeNode, context: RenderContext): Promise<RenderComponentResult> {
  const renderer = getGeneratedComponentRenderer(node.instance)
  if (!renderer) {
    context.diagnostics.add({
      level: 'warn',
      code: 'COMPONENT_RENDERER_MISSING',
      message: 'No renderer registered for component type',
      context: {
        componentId: node.instance.id,
        componentType: node.instance.type
      }
    })
    return {
      element: renderMissingComponent(node, 'Renderer not registered'),
      region: node.region ?? 'main'
    }
  }

  const childResults = await Promise.all(node.children.map(child => renderComponentNode(child, context)))
  const childElements = childResults.map(result => result.element)
  const regionChildren = buildRegionChildrenMap(node.children, childResults)

  const props = sanitizeComponentProps(node.instance.props)
  if (Object.keys(regionChildren).length > 0) {
    ;(props as Record<string, unknown>).__regions = regionChildren
  }

  if (typeof (props as Record<string, unknown>).id !== 'string') {
    ;(props as Record<string, unknown>).id = node.instance.id
  }

  assignCoreAdapterProps(node, props as Record<string, unknown>, renderer)

  if (renderer.loader) {
    const loaderData = await context.loadLoaderData(renderer.loader, node)
    if (loaderData !== undefined) {
      ;(props as Record<string, unknown>).loaderData = loaderData
    }
  }

  const sharedReference = resolveSharedComponentReference(node.instance)
  if (sharedReference) {
    const sharedComponent = await context.resolveSharedComponent(sharedReference)
    if (sharedComponent) {
      ;(props as Record<string, unknown>).sharedComponent = sharedComponent
    }
  }

  try {
    const element = renderer.render(node.instance, props, childElements)
    return {
      element,
      region: node.region ?? (renderer.regions[0] ?? 'main')
    }
  } catch (error) {
    const message =
      (error instanceof Error ? error.message : String(error)) || 'Unknown render error'

    console.error('head-runtime:component-render-failed', {
      componentId: node.instance.id,
      componentType: node.instance.type,
      error
    })

    context.diagnostics.add({
      level: 'error',
      code: 'COMPONENT_RENDER_FAILED',
      message: 'Component renderer threw an exception',
      context: {
        componentId: node.instance.id,
        componentType: node.instance.type,
        error: message
      }
    })

    return {
      element: renderMissingComponent(node, message),
      region: node.region ?? (renderer.regions[0] ?? 'main')
    }
  }
}

export interface PageSeoMetadata {
  title: string | null
  description: string | null
}

function resolveSeoMetadataFromPage(page: GeneratedSnapshotPage): PageSeoMetadata {
  const metadata = (page.metadata ?? {}) as {
    seoDescription?: string | null
    description?: string | null
    seo?: { title?: string | null; description?: string | null } | null
    title?: string | null
  }

  const title =
    typeof metadata.title === 'string' && metadata.title.trim().length > 0
      ? metadata.title.trim()
      : typeof page.title === 'string' && page.title.trim().length > 0
        ? page.title.trim()
        : null

  const description =
    typeof metadata.seoDescription === 'string' && metadata.seoDescription.trim().length > 0
      ? metadata.seoDescription.trim()
      : typeof metadata.description === 'string' && metadata.description.trim().length > 0
        ? metadata.description.trim()
        : typeof metadata.seo?.description === 'string' && metadata.seo.description.trim().length > 0
          ? metadata.seo.description.trim()
          : null

  return {
    title,
    description
  }
}

export async function renderPage(
  resolution: RouteResolution,
  options: RenderPageOptions = {}
): Promise<React.ReactElement> {
  const payload = resolution.payload

  if (!payload) {
    return renderMissingPage(resolution.slug)
  }

  const requestId =
    options.requestId ??
    \`render:\${resolution.matchedSlug.length > 0 ? resolution.matchedSlug.join('/') : 'root'}\`

  const context = createRenderContext({
    provider: activeProvider,
    payload,
    slug: resolution.matchedSlug,
    request: {
      headers: options.headers ?? {},
      searchParams: options.searchParams ?? {},
      url: options.url
    },
    requestId
  })

  const tree = buildComponentTree(Array.isArray(payload.page.components) ? Array.from(payload.page.components) : [])
  const renderedRoots = await Promise.all(tree.map(node => renderComponentNode(node, context)))

  const diagnostics = context.diagnostics.drain()
  if (diagnostics.length > 0) {
    const target = Array.isArray(payload.diagnostics) ? payload.diagnostics : []
    target.push(
      ...diagnostics.map(diagnostic => ({
        level: diagnostic.level,
        code: diagnostic.code,
        message: diagnostic.message,
        context: diagnostic.context
      }))
    )
    if (!Array.isArray(payload.diagnostics)) {
      payload.diagnostics = target
    }
  }

  const renderedSections = renderedRoots.map((result, index) => {
    const node = tree[index]
    const renderer: GeneratedComponentRenderer | undefined = getGeneratedComponentRenderer(node.instance)
    const regionAttr = node.region ?? renderer?.regions?.[0] ?? result.region ?? 'main'

    return (
      <section
        key={node.instance.id}
        data-component-type={node.instance.type}
        data-region={regionAttr}
      >
        {result.element}
      </section>
    )
  })

  // Ensure components assigned to the 'header' region render ahead of main sections
  // Also identify full-bleed components (heroes, footers) vs contained content
  const headerSections: React.ReactNode[] = []
  const heroSections: React.ReactNode[] = []
  const mainSections: React.ReactNode[] = []
  const footerSections: React.ReactNode[] = []

  renderedSections.forEach(section => {
    const region = (section as any)?.props?.['data-region']
    const componentType = ((section as any)?.props?.['data-component-type'] || '').toLowerCase()

    if (region === 'header') {
      // Skip search-bar in header region - it should be integrated into NavBar
      // Having a standalone search-bar in header breaks the transparent overlay effect
      if (componentType === 'search-bar') {
        return // Skip this component
      }
      headerSections.push(section)
    } else if (region === 'hero' || componentType.includes('hero')) {
      heroSections.push(section)
    } else if (region === 'footer' || componentType.includes('footer')) {
      footerSections.push(section)
    } else {
      mainSections.push(section)
    }
  })

  // When there's a hero, use absolute positioning so nav overlays it (Easter Show style)
  // The NavBar component handles its own fixed positioning when sticky+transparent
  const hasHero = heroSections.length > 0
  const headerWrapperClass = hasHero
    ? 'absolute top-0 left-0 right-0 z-50 w-full' // Overlay the hero
    : 'sticky top-0 z-50 w-full' // Normal sticky behavior without hero

  return (
    <main className="min-h-screen" data-has-hero={hasHero ? 'true' : 'false'}>
      {/* Navigation/header region - absolute when hero present, sticky otherwise */}
      {headerSections.length > 0 && (
        <div className={headerWrapperClass} data-has-hero={hasHero ? 'true' : 'false'}>
          {headerSections}
        </div>
      )}

      {/* Hero sections - full-bleed, no container */}
      {heroSections.length > 0 && (
        <div className="w-full">
          {heroSections}
        </div>
      )}

      {/* Main content - contained */}
      {mainSections.length > 0 && (
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid gap-0">
            {mainSections}
          </div>
        </div>
      )}

      {/* Footer sections - full-bleed, no container */}
      {footerSections.length > 0 && (
        <div className="w-full mt-auto">
          {footerSections}
        </div>
      )}
    </main>
  )
}

export function resolvePageMetadata(resolution: RouteResolution): PageSeoMetadata | null {
  const payload = resolution.payload
  if (!payload) {
    return null
  }
  return resolveSeoMetadataFromPage(payload.page)
}

`
}

export type RuntimeProviderKind = 'static' | 'ucs' | 'graphql'

export function buildRuntimeRoutingModule(
  slugRegistry: SlugRegistryEntry[],
  structureIndex: StructureIndex,
  redirects: SnapshotRedirect[] = [],
  providerKind: RuntimeProviderKind = 'static'
): string {
  // For static provider, generate full registry (it IS the data source)
  // For UCS/GraphQL providers, generate empty registry (provider handles all lookups)
  const useStaticRegistry = providerKind === 'static'
  const registryLiteral = useStaticRegistry
    ? JSON.stringify(slugRegistry, null, 2)
    : '[]'

  // For non-static providers, structure and redirects come from database
  const structureLiteral = useStaticRegistry
    ? JSON.stringify({
        nodes: structureIndex.nodes,
        childrenByParent: structureIndex.childrenByParent,
        pageToStructure: structureIndex.pageToStructure
      }, null, 2)
    : JSON.stringify({ nodes: [], childrenByParent: {}, pageToStructure: {} }, null, 2)

  // Redirects are resolved dynamically for UCS/GraphQL providers via resolveRedirectByPath
  const redirectsLiteral = useStaticRegistry
    ? JSON.stringify(redirects, null, 2)
    : '[]'

  return `import { activeProvider } from '@/generated/providers'
import { loadSiteSnapshot, registerSnapshotRefreshListener } from '@/generated/runtime/site-data'
import type {
  GeneratedPagePayload,
  GeneratedPageStructurePayload,
  GeneratedProviderRequestContext,
  GeneratedSiteSnapshot,
  GeneratedSnapshotPage,
  GeneratedSnapshotSharedComponent,
  GeneratedSnapshotStructureNode
} from '@/generated/providers/types'
import { resolveSharedComponentReference } from '@/lib/studio/types/site-builder/component-instance'

type SlugSegments = string[]

export interface GeneratedSlugRegistryEntry {
  pageId: string
  slug: string[]
  canonicalSlug: string[]
  canonicalFullPath: string
  originalSlug: string[]
  originalFullPath: string
  fullPath: string
  templateKey: string | null
  title: string
  aliasOf?: string | null
  structureId?: string | null
  parentId?: string | null
}

interface StructureIndexData {
  nodes: GeneratedSnapshotStructureNode[]
  childrenByParent: Record<string, string[]>
  pageToStructure: Record<string, string | null>
}

interface ResolveRouteOptions {
  requestContext?: GeneratedProviderRequestContext
  refresh?: boolean
  preferLive?: boolean
  designConcept?: string
}

export interface RouteResolution {
  slug: SlugSegments
  matchedSlug: SlugSegments
  canonicalSlug: SlugSegments
  canonicalPath: string
  shouldRedirect: boolean
  entry: GeneratedSlugRegistryEntry | null
  payload: GeneratedPagePayload | null
  source: 'static' | 'live' | 'cache' | 'none'
  aliasResolved: boolean
}

/**
 * Redirect entry from site snapshot
 */
export interface GeneratedRedirect {
  id: string
  sourcePath: string
  targetPath: string
  redirectType: number
  isActive: boolean
  isExternal: boolean
  showInNav: boolean
  navLabel?: string
  openInNewTab: boolean
  source?: string
  description?: string
}

/**
 * Result of redirect resolution
 */
export interface RedirectResolution {
  hasRedirect: boolean
  redirect: GeneratedRedirect | null
  targetPath: string | null
  isExternal: boolean
}

const staticRegistryEntries: GeneratedSlugRegistryEntry[] = ${registryLiteral}
const staticStructureIndex: StructureIndexData = ${structureLiteral}
const staticRedirects: GeneratedRedirect[] = ${redirectsLiteral}

// Build redirect map for fast lookup by source path
const redirectMap = new Map<string, GeneratedRedirect>()
staticRedirects.forEach(redirect => {
  if (redirect.isActive) {
    // Normalize the source path for lookup
    const normalizedPath = redirect.sourcePath.toLowerCase().replace(/^\\/+|\\/+$/g, '')
    const key = normalizedPath === '' ? '__root__' : normalizedPath
    redirectMap.set(key, redirect)
  }
})

const registryMap = new Map<string, GeneratedSlugRegistryEntry>()
staticRegistryEntries.forEach(entry => {
  const key = toSlugKey(entry.canonicalSlug ?? entry.slug)
  registryMap.set(key, cloneRegistryEntry(entry))
})

// Note: We deliberately do NOT cache page payloads or structures at the module level.
// Module-level caches persist across ISR revalidations in warm serverless instances,
// causing stale content to be served even after database updates.
// Next.js ISR and unstable_cache provide the caching layer instead.
// See: TKT-070 - Sandbox preview stale content bug

const structureNodeById = new Map<string, GeneratedSnapshotStructureNode>(
  staticStructureIndex.nodes.map(node => [node.id, node])
)

// clearDynamicEntry is now a no-op since we removed module-level caching
// Keeping the function signature for backward compatibility with refresh logic
function clearDynamicEntry(_key: string): void {
  // No-op: module-level caches removed to prevent stale content issues
}

const childrenByParent = new Map<string, string[]>(
  Object.entries(staticStructureIndex.childrenByParent)
)

const pageToStructure = new Map<string, string | null>(
  Object.entries(staticStructureIndex.pageToStructure)
)

function normalizeSlug(slug: SlugSegments): SlugSegments {
  return Array.from(slug)
    .filter((segment): segment is string => typeof segment === 'string')
    .map(segment => segment.trim().toLowerCase())
    .filter(segment => segment.length > 0)
}

function sanitizeSlug(slug: SlugSegments): SlugSegments {
  return Array.from(slug)
    .filter((segment): segment is string => typeof segment === 'string')
    .map(segment => segment.trim())
    .filter(segment => segment.length > 0)
}

function toSlugKey(slug: SlugSegments): string {
  const normalized = normalizeSlug(slug)
  if (normalized.length === 0) {
    return '__root__'
  }
  return normalized.join('/')
}

function slugKeyToSegments(slugKey: string): SlugSegments {
  if (slugKey === '__root__') {
    return []
  }
  return slugKey.split('/').filter(segment => segment.length > 0)
}

function slugSegmentsToPath(segments: SlugSegments): string {
  if (segments.length === 0) {
    return '/'
  }
  return '/' + segments.join('/')
}

function pathToSegments(path: string): SlugSegments {
  const trimmed = path.replace(/^\\/+|\\/+$/g, '')
  if (!trimmed) {
    return []
  }
  return trimmed.split('/').filter(segment => segment.length > 0)
}

function segmentsEqualCaseSensitive(a: SlugSegments, b: SlugSegments): boolean {
  if (a.length !== b.length) {
    return false
  }
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) {
      return false
    }
  }
  return true
}

interface RegistryResolution {
  slugKey: string
  entry: GeneratedSlugRegistryEntry | null
  matchedAlias: boolean
  trail: string[]
}

function resolveRegistryEntry(slugKey: string): RegistryResolution {
  const visited = new Set<string>()
  const trail: string[] = []
  let currentKey = slugKey

  while (true) {
    if (visited.has(currentKey)) {
      console.warn('head-runtime:alias-cycle', { slugKey, trail })
      return {
        slugKey,
        entry: registryMap.get(slugKey) ?? null,
        matchedAlias: trail.length > 0,
        trail: trail.slice()
      }
    }

    visited.add(currentKey)
    trail.push(currentKey)

    const entry = registryMap.get(currentKey)
    if (!entry || !entry.aliasOf) {
      return {
        slugKey: currentKey,
        entry: entry ?? null,
        matchedAlias: trail.length > 1,
        trail: trail.slice()
      }
    }

    currentKey = entry.aliasOf
  }
}

/**
 * Resolves a redirect for the given path segments.
 * When provider supports live data, fetches from database (dynamic).
 * Otherwise, uses static redirects baked in at export time.
 * Returns redirect info if a redirect exists, null otherwise.
 */
export async function resolveRedirect(
  slugSegments: SlugSegments,
  context?: { requestContext?: GeneratedProviderRequestContext }
): Promise<RedirectResolution> {
  const normalizedPath = normalizeSlug(slugSegments).join('/')
  const path = '/' + normalizedPath

  // When provider supports live data, use dynamic redirects from database
  // This ensures redirects can be changed without re-exporting the site
  if (activeProvider.supportsLiveData && typeof activeProvider.resolveRedirectByPath === 'function') {
    try {
      const dynamicRedirect = await activeProvider.resolveRedirectByPath(
        path,
        context?.requestContext ?? { requestId: \`redirect:\${normalizedPath || 'root'}\` }
      )

      if (dynamicRedirect) {
        return {
          hasRedirect: true,
          redirect: {
            id: dynamicRedirect.id,
            sourcePath: dynamicRedirect.sourcePath,
            targetPath: dynamicRedirect.targetPath,
            redirectType: dynamicRedirect.redirectType,
            isActive: dynamicRedirect.isActive,
            isExternal: dynamicRedirect.isExternal,
            showInNav: dynamicRedirect.showInNav,
            navLabel: dynamicRedirect.navLabel,
            openInNewTab: dynamicRedirect.openInNewTab
          },
          targetPath: dynamicRedirect.targetPath,
          isExternal: dynamicRedirect.isExternal
        }
      }

      // No dynamic redirect found
      return {
        hasRedirect: false,
        redirect: null,
        targetPath: null,
        isExternal: false
      }
    } catch (error) {
      console.error('head-runtime:redirect-resolution-error', {
        path,
        error: error instanceof Error ? error.message : String(error)
      })
      // Fall through to static redirects on error
    }
  }

  // Use static redirects (for static providers or as fallback)
  const key = normalizedPath === '' ? '__root__' : normalizedPath
  const redirect = redirectMap.get(key)
  if (!redirect) {
    return {
      hasRedirect: false,
      redirect: null,
      targetPath: null,
      isExternal: false
    }
  }

  return {
    hasRedirect: true,
    redirect,
    targetPath: redirect.targetPath,
    isExternal: redirect.isExternal
  }
}

/**
 * Get all redirects that should appear in navigation
 */
export function getNavigationExternalLinks(): GeneratedRedirect[] {
  return staticRedirects.filter(r => r.isActive && r.showInNav)
}

/**
 * Get all redirects (for sitemap exclusion, etc.)
 */
export function getAllRedirects(): GeneratedRedirect[] {
  return staticRedirects.slice()
}

function cloneRegistryEntry(entry: GeneratedSlugRegistryEntry): GeneratedSlugRegistryEntry {
  return JSON.parse(JSON.stringify(entry)) as GeneratedSlugRegistryEntry
}

function clonePage(page: GeneratedSnapshotPage): GeneratedSnapshotPage {
  return JSON.parse(JSON.stringify(page)) as GeneratedSnapshotPage
}

function cloneSharedComponent(component: GeneratedSnapshotSharedComponent): GeneratedSnapshotSharedComponent {
  return JSON.parse(JSON.stringify(component)) as GeneratedSnapshotSharedComponent
}

function cloneStructureNode(node: GeneratedSnapshotStructureNode): GeneratedSnapshotStructureNode {
  return JSON.parse(JSON.stringify(node)) as GeneratedSnapshotStructureNode
}

function cloneStructurePayload(payload: GeneratedPageStructurePayload): GeneratedPageStructurePayload {
  return JSON.parse(JSON.stringify(payload)) as GeneratedPageStructurePayload
}

function clonePagePayload(payload: GeneratedPagePayload): GeneratedPagePayload {
  return JSON.parse(JSON.stringify(payload)) as GeneratedPagePayload
}

function registerStructureNode(node: GeneratedSnapshotStructureNode): void {
  structureNodeById.set(node.id, cloneStructureNode(node))
  const parentKey = node.parentId ?? '__root__'
  const children = childrenByParent.get(parentKey) ?? []
  if (!children.includes(node.id)) {
    children.push(node.id)
    children.sort((a, b) => {
      const left = structureNodeById.get(a)?.position ?? 0
      const right = structureNodeById.get(b)?.position ?? 0
      return left - right
    })
    childrenByParent.set(parentKey, children)
  }
}

function buildStaticStructurePayload(structureId: string | null): GeneratedPageStructurePayload {
  if (!structureId) {
    return { current: null, ancestors: [], children: [] }
  }

  const current = structureNodeById.get(structureId)
  if (!current) {
    return { current: null, ancestors: [], children: [] }
  }

  const ancestors: GeneratedSnapshotStructureNode[] = []
  let parentId = current.parentId ?? null

  while (parentId) {
    const parent = structureNodeById.get(parentId)
    if (!parent) {
      break
    }
    ancestors.push(parent)
    parentId = parent.parentId ?? null
  }

  ancestors.reverse()

  const childIds = childrenByParent.get(current.id) ?? []
  const children = childIds
    .map(id => structureNodeById.get(id))
    .filter((value): value is GeneratedSnapshotStructureNode => Boolean(value))

  return {
    current: cloneStructureNode(current),
    ancestors: ancestors.map(cloneStructureNode),
    children: children.map(cloneStructureNode)
  }
}

function resolveSharedComponentsFromSnapshot(
  page: GeneratedSnapshotPage,
  snapshot: GeneratedSiteSnapshot
): GeneratedSnapshotSharedComponent[] {
  const identifiers = new Set<string>()
  const sharedIds = (page as { sharedComponentIds?: readonly string[] }).sharedComponentIds
  if (Array.isArray(sharedIds)) {
    sharedIds.forEach(id => identifiers.add(id))
  }
  const components = Array.isArray(page.components)
    ? Array.from(page.components)
    : []
  components.forEach(component => {
    const sharedId = resolveSharedComponentReference(component as any)
    if (typeof sharedId === 'string' && sharedId) {
      identifiers.add(sharedId)
    }
  })

  return Array.from(identifiers)
    .map(id => snapshot.sharedComponents.find(component => component.id === id))
    .filter((value): value is GeneratedSnapshotSharedComponent => Boolean(value))
    .map(cloneSharedComponent)
}

async function resolveStaticEntry(
  entry: GeneratedSlugRegistryEntry,
  slugKey: string,
  refresh = false,
  designConcept?: string
): Promise<GeneratedPagePayload | null> {
  const snapshot = refresh
    ? await loadSiteSnapshot({ refresh: true, designConcept })
    : await loadSiteSnapshot({ designConcept })
  const page = snapshot.pages.find(candidate => candidate.id === entry.pageId) ??
    snapshot.pages.find(candidate => candidate.fullPath === entry.fullPath)

  if (!page) {
    return null
  }

  const structure = buildStaticStructurePayload(entry.structureId ?? null)

  return {
    page: clonePage(page),
    structure,
    sharedComponents: resolveSharedComponentsFromSnapshot(page, snapshot),
    diagnostics: []
  }
}

function registerDynamicEntry(
  slugKey: string,
  slug: SlugSegments,
  payload: GeneratedPagePayload
): GeneratedSlugRegistryEntry {
  if (payload.structure) {
    if (payload.structure.current) {
      registerStructureNode(payload.structure.current)
    }
    payload.structure.ancestors.forEach(registerStructureNode)
    payload.structure.children.forEach(registerStructureNode)
  }

  const canonicalSlug = slug.slice()
  const canonicalFullPath = slugSegmentsToPath(canonicalSlug)
  const originalFullPath = payload.page.fullPath
  const originalSlug = pathToSegments(originalFullPath)

  const entry: GeneratedSlugRegistryEntry = {
    pageId: payload.page.id,
    slug: canonicalSlug,
    canonicalSlug,
    canonicalFullPath,
    originalSlug,
    originalFullPath,
    fullPath: originalFullPath,
    templateKey: payload.page.templateKey ?? null,
    title: payload.page.title,
    aliasOf: null,
    structureId: payload.structure?.current?.id ?? null,
    parentId: payload.structure?.current?.parentId ?? null
  }

  const stored = cloneRegistryEntry(entry)
  registryMap.set(slugKey, stored)
  if (entry.structureId) {
    pageToStructure.set(entry.pageId, entry.structureId)
  }

  return stored
}

export function getSlugRegistrySnapshot(): GeneratedSlugRegistryEntry[] {
  return Array.from(registryMap.values()).map(cloneRegistryEntry)
}

export async function resolveRoute(
  slug: SlugSegments,
  options: ResolveRouteOptions = {}
): Promise<RouteResolution> {
  const originalSlug = sanitizeSlug(slug)
  const normalized = normalizeSlug(slug)
  const requestedSlugKey = toSlugKey(normalized)
  const registryResolution = resolveRegistryEntry(requestedSlugKey)
  const canonicalKey = registryResolution.slugKey
  const aliasResolved = registryResolution.matchedAlias && canonicalKey !== requestedSlugKey
  const cacheKeys = Array.from(new Set([canonicalKey, requestedSlugKey]))
  const matchedSlug = slugKeyToSegments(canonicalKey)
  const canonicalSlug = matchedSlug.slice()
  const canonicalPath = slugSegmentsToPath(canonicalSlug)
  const canonicalEntry = registryMap.get(canonicalKey) ?? registryResolution.entry ?? null
  const hasCanonicalEntry = Boolean(canonicalEntry)
  const caseMismatch = hasCanonicalEntry && !segmentsEqualCaseSensitive(originalSlug, canonicalSlug)
  const shouldRedirect = Boolean(hasCanonicalEntry && (aliasResolved || caseMismatch))

  if (options.refresh) {
    cacheKeys.forEach(clearDynamicEntry)
  }

  // Module-level cache lookup removed - see TKT-070
  // Next.js ISR and unstable_cache handle caching at the appropriate layer

  if (canonicalEntry && !options.preferLive) {
    const staticPayload = await resolveStaticEntry(
      canonicalEntry,
      canonicalKey,
      Boolean(options.refresh),
      options.designConcept
    )
    if (staticPayload) {
      return {
        slug: originalSlug,
        matchedSlug,
        canonicalSlug,
        canonicalPath,
        shouldRedirect,
        entry: cloneRegistryEntry(canonicalEntry),
        payload: staticPayload,
        source: 'static',
        aliasResolved
      }
    }
  }

  if (activeProvider.supportsLiveData) {
    const canonicalSlugForRequest = canonicalSlug.slice()
    const context =
      options.requestContext ??
      {
        requestId: aliasResolved
          ? \`slug:\${requestedSlugKey}=>\${canonicalKey}\`
          : \`slug:\${canonicalKey}\`
      }

    let livePayload: GeneratedPagePayload | null = null
    try {
      livePayload = await activeProvider.resolvePageBySlug(canonicalSlugForRequest, context)
    } catch (error) {
      console.error('head-runtime:resolve-page-error', {
        provider: activeProvider.name,
        slugKey: canonicalKey,
        slug: canonicalSlugForRequest,
        error
      })
    }

    if (livePayload) {
      const payloadForCache = clonePagePayload(livePayload)
      // Module-level cache set removed - see TKT-070
      // Next.js ISR and unstable_cache handle caching at the appropriate layer

      const effectiveEntry =
        canonicalEntry ?? registerDynamicEntry(canonicalKey, canonicalSlugForRequest, payloadForCache)

      // Determine canonical path from provider response (database is source of truth)
      const liveCanonicalPath = payloadForCache.page.fullPath || canonicalPath
      const liveCanonicalSlug = pathToSegments(liveCanonicalPath)

      // Detect if redirect is needed based on provider response
      // This handles case normalization for UCS/GraphQL providers
      const liveCaseMismatch = !segmentsEqualCaseSensitive(originalSlug, liveCanonicalSlug)
      const liveShouldRedirect = shouldRedirect || liveCaseMismatch

      return {
        slug: originalSlug,
        matchedSlug: liveCanonicalSlug,
        canonicalSlug: liveCanonicalSlug,
        canonicalPath: liveCanonicalPath,
        shouldRedirect: liveShouldRedirect,
        entry: cloneRegistryEntry(effectiveEntry),
        payload: clonePagePayload(payloadForCache),
        source: 'live',
        aliasResolved
      }
    }
  }

  if (canonicalEntry && options.preferLive) {
    const staticPayload = await resolveStaticEntry(
      canonicalEntry,
      canonicalKey,
      Boolean(options.refresh),
      options.designConcept
    )
    if (staticPayload) {
      return {
        slug: originalSlug,
        matchedSlug,
        canonicalSlug,
        canonicalPath,
        shouldRedirect,
        entry: cloneRegistryEntry(canonicalEntry),
        payload: staticPayload,
        source: 'static',
        aliasResolved
      }
    }
  }

  return {
    slug: originalSlug,
    matchedSlug,
    canonicalSlug,
    canonicalPath,
    shouldRedirect,
    entry: canonicalEntry ? cloneRegistryEntry(canonicalEntry) : null,
    payload: null,
    source: 'none',
    aliasResolved
  }
}

export function needsCanonicalRedirect(resolution: RouteResolution): boolean {
  return Boolean(resolution.shouldRedirect)
}

export function clearDynamicRouteCache(): void {
  // No-op: module-level caches removed to prevent stale content issues
  // See TKT-070 - Sandbox preview stale content bug
}

registerSnapshotRefreshListener(clearDynamicRouteCache)
`
}

export function buildRouteRequestHelpersModule(): string {
  return `export type Awaitable<T> = T | Promise<T>

export function normalizeHeaders(entries: Iterable<[string, string]>): Record<string, string> {
  return Object.fromEntries(entries)
}

export function normalizeSlugParam(slug: string[] | undefined): string[] {
  if (!Array.isArray(slug)) {
    return []
  }
  return slug.filter(segment => typeof segment === 'string')
}

export function normalizeSearchParams(
  searchParams: Record<string, string | string[] | undefined> | undefined
): Record<string, string | string[]> {
  if (!searchParams) {
    return {}
  }

  const entries: Array<[string, string | string[]]> = []
  Object.entries(searchParams).forEach(([key, value]) => {
    if (typeof value === 'undefined') {
      return
    }
    entries.push([key, value])
  })

  return Object.fromEntries(entries)
}

export function isPromise<T>(value: unknown): value is Promise<T> {
  return Boolean(value) && typeof (value as Promise<T>).then === 'function'
}

export async function resolveMaybePromise<T>(value: Awaitable<T>): Promise<T> {
  if (isPromise<T>(value)) {
    return await value
  }
  return value
}
`
}

export function buildDesignSystemInjectorModule(): string {
  return `import * as React from 'react'
import { loadSiteSnapshot } from './site-data'

interface DesignSystemStyleProps {
  designConcept?: string
}

/**
 * Server component that injects design system CSS variables from the database snapshot.
 * When designConcept is provided, fetches that specific concept.
 * When not provided, fetches the default/first concept from the database.
 * This ensures design system CSS is always available, even without query params.
 */
export async function DesignSystemStyle({ designConcept }: DesignSystemStyleProps): Promise<React.ReactElement | null> {
  try {
    // Always fetch snapshot - when designConcept is undefined, the provider
    // will automatically select the default or first available design concept
    const snapshot = await loadSiteSnapshot({ designConcept })
    const designSystem = snapshot.designSystem

    if (!designSystem?.tokens?.variables) {
      return null
    }

    const variables = designSystem.tokens.variables
    const cssLines = Object.entries(variables)
      .map(([key, value]) => \`  \${key}: \${value};\`)
      .join('\\n')

    const css = \`:root {\\n\${cssLines}\\n}\`

    // Use the resolved concept name from snapshot, or 'default' if none specified
    const resolvedConcept = designSystem.conceptName || designConcept || 'default'

    return (
      <style
        dangerouslySetInnerHTML={{ __html: css }}
        data-design-concept={resolvedConcept}
      />
    )
  } catch (error) {
    console.error('Failed to load design system:', designConcept || 'default', error)
    return null
  }
}
`
}

export function buildCatchAllRouteModule(): string {
  return `import type { Metadata } from 'next'
import { notFound, permanentRedirect, redirect } from 'next/navigation'
import { renderPage, resolvePageMetadata } from '@/generated/page-renderer'
import { needsCanonicalRedirect, resolveRoute, resolveRedirect } from '@/generated/runtime/routing'
import type { GeneratedProviderRequestContext } from '@/generated/providers/types'
import { DesignSystemStyle } from '@/generated/runtime/design-system-injector'
import {
  normalizeSearchParams,
  normalizeSlugParam,
  resolveMaybePromise
} from '@/generated/runtime/request-helpers'

interface CatchAllPageProps {
  params?: Promise<{ slug?: string[] }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

// Direct route resolution without module-level caching
// This ensures content changes in the database are reflected immediately
// Next.js ISR (export const revalidate) handles page-level caching
// See: TKT-070 - Sandbox preview stale content bug
async function getRouteResolution(slugKey: string, designConcept?: string) {
  const slugSegments = slugKey === '__root__' ? [] : slugKey.split('/')
  const headerRecord: Record<string, string> = {}
  const normalizedSearchParams: Record<string, string | string[]> = {}

  const requestContext: GeneratedProviderRequestContext = {
    requestId: \`route:\${slugKey}\`,
    headers: headerRecord,
    searchParams: normalizedSearchParams,
    designConcept
  }

  const redirectResolution = await resolveRedirect(slugSegments, { requestContext })
  const resolution = await resolveRoute(slugSegments, { requestContext, designConcept })

  return {
    resolution,
    redirectResolution,
    slugSegments,
    headerRecord,
    normalizedSearchParams,
    designConcept
  }
}

async function resolveRouteForRequest({
  params,
  searchParams
}: CatchAllPageProps) {
  const resolvedParams = params ? await resolveMaybePromise(params) : undefined
  const resolvedSearchParams = searchParams ? await resolveMaybePromise(searchParams) : undefined
  const slugSegments = normalizeSlugParam(resolvedParams?.slug)
  const slugKey = slugSegments.length > 0 ? slugSegments.join('/') : '__root__'

  // Extract designConcept from URL searchParams
  const designConceptParam = resolvedSearchParams?.designConcept
  const designConcept = typeof designConceptParam === 'string' ? designConceptParam : undefined

  // Direct resolution (module-level caching removed - see TKT-070)
  return getRouteResolution(slugKey, designConcept)
}

// Dynamic rendering - pages query database on each request
// Module-level caches removed to ensure fresh content (TKT-070)
// Site snapshot cache (HEAD_RUNTIME_CACHE_TTL_SECONDS) controls data caching
export const dynamic = 'force-dynamic'

export async function generateMetadata({ params, searchParams }: CatchAllPageProps): Promise<Metadata> {
  const { resolution } = await resolveRouteForRequest({ params, searchParams })
  const metadata = resolvePageMetadata(resolution)
  if (!metadata) {
    return {}
  }
  return {
    title: metadata.title ?? undefined,
    description: metadata.description ?? undefined
  }
}

export default async function CatchAllPage({ params, searchParams }: CatchAllPageProps) {
  const {
    resolution,
    redirectResolution,
    slugSegments,
    headerRecord,
    normalizedSearchParams,
    designConcept
  } = await resolveRouteForRequest({ params, searchParams })

  // Handle redirects first (before page resolution)
  if (redirectResolution.hasRedirect && redirectResolution.targetPath) {
    const redirectType = redirectResolution.redirect?.redirectType ?? 301
    if (redirectType === 301) {
      // 301 Permanent redirect (for SEO)
      permanentRedirect(redirectResolution.targetPath)
    } else {
      // 302 Temporary redirect
      redirect(redirectResolution.targetPath)
    }
  }

  if (needsCanonicalRedirect(resolution)) {
    permanentRedirect(resolution.canonicalPath || '/')
  }

  if (!resolution.payload) {
    notFound()
  }

  const url = slugSegments.length > 0 ? \`/\${slugSegments.join('/')}\` : '/'
  const pageContent = await renderPage(resolution, {
    headers: headerRecord,
    searchParams: normalizedSearchParams,
    url,
    requestId: \`render:\${slugSegments.join('/') || 'root'}\`
  })

  return (
    <>
      <DesignSystemStyle designConcept={designConcept} />
      {pageContent}
    </>
  )
}
`
}
export function buildRootRouteModule(): string {
  return `import type { Metadata } from 'next'
import { notFound, permanentRedirect, redirect } from 'next/navigation'
import { renderPage, resolvePageMetadata } from '@/generated/page-renderer'
import { getSlugRegistrySnapshot, needsCanonicalRedirect, resolveRoute, resolveRedirect } from '@/generated/runtime/routing'
import type { GeneratedProviderRequestContext } from '@/generated/providers/types'
import { DesignSystemStyle } from '@/generated/runtime/design-system-injector'
import { normalizeSearchParams, resolveMaybePromise } from '@/generated/runtime/request-helpers'

interface RootPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

// Direct root route resolution without module-level caching
// This ensures content changes in the database are reflected immediately
// Next.js ISR (export const revalidate) handles page-level caching
// See: TKT-070 - Sandbox preview stale content bug
async function getRootResolution(designConcept?: string) {
  const headerRecord: Record<string, string> = {}
  const normalizedSearchParams: Record<string, string | string[]> = {}

  const requestContext: GeneratedProviderRequestContext = {
    requestId: 'route:root',
    headers: headerRecord,
    searchParams: normalizedSearchParams,
    designConcept
  }

  const redirectResolution = await resolveRedirect([], { requestContext })
  const resolution = await resolveRoute([], { requestContext, designConcept })

  return {
    resolution,
    redirectResolution,
    headerRecord,
    normalizedSearchParams,
    designConcept
  }
}

async function resolveRootRoute(searchParams?: Promise<Record<string, string | string[] | undefined>>) {
  // Extract designConcept from URL searchParams
  const resolvedSearchParams = searchParams ? await resolveMaybePromise(searchParams) : undefined
  const designConceptParam = resolvedSearchParams?.designConcept
  const designConcept = typeof designConceptParam === 'string' ? designConceptParam : undefined

  // Direct resolution (module-level caching removed - see TKT-070)
  return getRootResolution(designConcept)
}

// Dynamic rendering - pages query database on each request
// Module-level caches removed to ensure fresh content (TKT-070)
// Site snapshot cache (HEAD_RUNTIME_CACHE_TTL_SECONDS) controls data caching
export const dynamic = 'force-dynamic'

export async function generateMetadata({ searchParams }: RootPageProps): Promise<Metadata> {
  const { resolution } = await resolveRootRoute(searchParams)
  const metadata = resolvePageMetadata(resolution)
  if (!metadata) {
    return {}
  }
  return {
    title: metadata.title ?? undefined,
    description: metadata.description ?? undefined
  }
}

export default async function RootPage({ searchParams }: RootPageProps) {
  const { resolution, redirectResolution, headerRecord, normalizedSearchParams, designConcept } = await resolveRootRoute(searchParams)

  // Handle redirects first (before page resolution)
  if (redirectResolution.hasRedirect && redirectResolution.targetPath) {
    const redirectType = redirectResolution.redirect?.redirectType ?? 301
    if (redirectType === 301) {
      permanentRedirect(redirectResolution.targetPath)
    } else {
      redirect(redirectResolution.targetPath)
    }
  }

  if (needsCanonicalRedirect(resolution)) {
    permanentRedirect(resolution.canonicalPath || '/')
  }

  if (!resolution.payload) {
    const registry = getSlugRegistrySnapshot().filter(entry => entry.slug.length > 0)
    if (registry.length > 0) {
      const target = '/' + registry[0].slug.join('/')
      redirect(target)
    }
    notFound()
  }

  const pageContent = await renderPage(resolution, {
    headers: headerRecord,
    searchParams: normalizedSearchParams,
    url: '/',
    requestId: 'render:root'
  })

  return (
    <>
      <DesignSystemStyle designConcept={designConcept} />
      {pageContent}
    </>
  )
}
`
}
export function buildAppErrorModule(): string {
  return `'use client'
import * as React from 'react'

interface ErrorPageProps {
  error: Error & { digest?: string }
  reset: () => void
}

function reportRuntimeError(error: Error & { digest?: string }): () => void {
  const controller = new AbortController()
  const payload = {
    level: 'error',
    code: 'APP_ERROR_BOUNDARY',
    message: error?.message ?? 'Unknown runtime error',
    context: {
      digest: typeof error?.digest === 'string' ? error.digest : null
    }
  }

  fetch('/api/head-runtime/diagnostics/log', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    signal: controller.signal
  }).catch(() => undefined)

  return () => controller.abort()
}

export default function Error({ error, reset }: ErrorPageProps) {
  React.useEffect(() => {
    console.error('head-runtime:app-error-boundary', error)
    return reportRuntimeError(error)
  }, [error])

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-3xl font-semibold">Something went wrong</h1>
      <p className="text-muted-foreground">
        We could not render this page. You can retry the request or return to the home page.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-4">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-md bg-primary px-4 py-2 text-primary-foreground transition hover:bg-primary/90"
        >
          Try again
        </button>
        <a
          href="/"
          className="rounded-md border border-border px-4 py-2 text-sm font-medium transition hover:bg-muted"
        >
          Go home
        </a>
      </div>
      {typeof error?.digest === 'string' && error.digest.trim().length > 0 ? (
        <p className="text-xs text-muted-foreground">
          Error digest: <span className="font-mono">{error.digest}</span>
        </p>
      ) : null}
    </main>
  )
}
`
}

export function buildGlobalErrorModule(): string {
  return `'use client'
import * as React from 'react'

interface GlobalErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

function reportRuntimeError(error: Error & { digest?: string }): () => void {
  const controller = new AbortController()
  const payload = {
    level: 'error',
    code: 'APP_GLOBAL_ERROR_BOUNDARY',
    message: error?.message ?? 'Unknown runtime error',
    context: {
      digest: typeof error?.digest === 'string' ? error.digest : null
    }
  }

  fetch('/api/head-runtime/diagnostics/log', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    signal: controller.signal
  }).catch(() => undefined)

  return () => controller.abort()
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  React.useEffect(() => {
    console.error('head-runtime:global-error-boundary', error)
    return reportRuntimeError(error)
  }, [error])

  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground">
        <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-6 px-6 text-center">
          <h1 className="text-3xl font-semibold">Application error</h1>
          <p className="text-muted-foreground">
            A fatal error occurred while rendering this experience. Try again or navigate home.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => reset()}
              className="rounded-md bg-primary px-4 py-2 text-primary-foreground transition hover:bg-primary/90"
            >
              Retry request
            </button>
            <a
              href="/"
              className="rounded-md border border-border px-4 py-2 text-sm font-medium transition hover:bg-muted"
            >
              Go home
            </a>
          </div>
          {typeof error?.digest === 'string' && error.digest.trim().length > 0 ? (
            <p className="text-xs text-muted-foreground">
              Error digest: <span className="font-mono">{error.digest}</span>
            </p>
          ) : null}
        </main>
      </body>
    </html>
  )
}
`
}

export interface RuntimeConfigOptions {
  optimizely?: {
    gateway: string
    singleKey: string
    locale: string
    startPageId: string
  }
}

export function buildRuntimeConfigModule(
  snapshot: SiteSnapshot,
  runtimeWebsiteId: string,
  templateOverrideKey?: string | null,
  options?: RuntimeConfigOptions
): string {
  const defaultWebsiteId = JSON.stringify(runtimeWebsiteId || snapshot.site.id)
  const defaultTemplateOverride = templateOverrideKey ? JSON.stringify(templateOverrideKey) : 'undefined'

  // Generate Optimizely config section if provided
  const optimizelyConfigSection = options?.optimizely ? `
// =============================================================================
// OPTIMIZELY CONFIGURATION
// =============================================================================

export interface OptimizelyRuntimeConfig {
  gateway: string
  singleKey: string
  locale: string
  startPageId: string
}

const DEFAULT_OPTIMIZELY_CONFIG: OptimizelyRuntimeConfig = {
  gateway: ${JSON.stringify(options.optimizely.gateway)},
  singleKey: ${JSON.stringify(options.optimizely.singleKey)},
  locale: ${JSON.stringify(options.optimizely.locale)},
  startPageId: ${JSON.stringify(options.optimizely.startPageId)}
}

let cachedOptimizelyConfig: OptimizelyRuntimeConfig | null = null

export function getOptimizelyConfig(): OptimizelyRuntimeConfig {
  if (cachedOptimizelyConfig) {
    return cachedOptimizelyConfig
  }

  cachedOptimizelyConfig = {
    gateway: process.env.OPTIMIZELY_GRAPH_GATEWAY ?? DEFAULT_OPTIMIZELY_CONFIG.gateway,
    singleKey: process.env.OPTIMIZELY_GRAPH_SINGLE_KEY ?? DEFAULT_OPTIMIZELY_CONFIG.singleKey,
    locale: process.env.OPTIMIZELY_GRAPH_LOCALE ?? DEFAULT_OPTIMIZELY_CONFIG.locale,
    startPageId: process.env.OPTIMIZELY_START_PAGE_ID ?? DEFAULT_OPTIMIZELY_CONFIG.startPageId
  }

  return cachedOptimizelyConfig
}
` : ''

  return `import { siteSnapshot } from '@/data/site'

export interface HeadRuntimeConfig {
  websiteId: string
  cacheTtlSeconds: number
  templateOverrideKey?: string
}

const DEFAULT_CACHE_TTL_SECONDS = 30

const DEFAULT_RUNTIME_CONFIG: HeadRuntimeConfig = {
  websiteId: ${defaultWebsiteId},
  cacheTtlSeconds: DEFAULT_CACHE_TTL_SECONDS${templateOverrideKey ? `,
  templateOverrideKey: ${defaultTemplateOverride}` : ''}
}

function parseTtl(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback
  }

  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback
  }

  return parsed
}

let cachedConfig: HeadRuntimeConfig | null = null

export function getRuntimeConfig(): HeadRuntimeConfig {
  if (cachedConfig) {
    return cachedConfig
  }

  const websiteId = process.env.HEAD_RUNTIME_WEBSITE_ID ?? DEFAULT_RUNTIME_CONFIG.websiteId
  const templateOverrideKey = process.env.HEAD_RUNTIME_TEMPLATE_OVERRIDE_KEY ?? ${defaultTemplateOverride}
  const cacheTtlSeconds = parseTtl(process.env.HEAD_RUNTIME_CACHE_TTL_SECONDS, DEFAULT_RUNTIME_CONFIG.cacheTtlSeconds)

  const runtimeConfig: HeadRuntimeConfig = {
    websiteId: websiteId || (siteSnapshot ? siteSnapshot.site.id : ''),
    cacheTtlSeconds
  }

  if (templateOverrideKey) {
    runtimeConfig.templateOverrideKey = templateOverrideKey
  }

  cachedConfig = runtimeConfig

  return cachedConfig
}
${optimizelyConfigSection}`
}

export function buildRuntimeCacheModule(): string {
  return `import type { GeneratedSiteSnapshot } from '@/generated/providers/types'

export interface SiteSnapshotCacheAdapter {
  get(): Promise<GeneratedSiteSnapshot | null>
  set(snapshot: GeneratedSiteSnapshot, ttlSeconds: number): Promise<void>
  clear(): Promise<void>
}

interface CacheEntry {
  snapshot: GeneratedSiteSnapshot
  expiresAt: number | null
}

class InMemorySiteSnapshotCache implements SiteSnapshotCacheAdapter {
  private entry: CacheEntry | null = null

  async get(): Promise<GeneratedSiteSnapshot | null> {
    if (!this.entry) {
      return null
    }

    const now = Date.now()
    if (this.entry.expiresAt !== null && this.entry.expiresAt <= now) {
      this.entry = null
      return null
    }

    return this.entry.snapshot
  }

  async set(snapshot: GeneratedSiteSnapshot, ttlSeconds: number): Promise<void> {
    const expiresAt = ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : null
    this.entry = { snapshot, expiresAt }
  }

  async clear(): Promise<void> {
    this.entry = null
  }
}

let activeCache: SiteSnapshotCacheAdapter = new InMemorySiteSnapshotCache()

export function setSiteSnapshotCache(cache: SiteSnapshotCacheAdapter): void {
  activeCache = cache
}

export function getSiteSnapshotCache(): SiteSnapshotCacheAdapter {
  return activeCache
}

export function createInMemorySiteSnapshotCache(): SiteSnapshotCacheAdapter {
  return new InMemorySiteSnapshotCache()
}
`
}

export function buildRuntimeSiteDataModule(): string {
  return `import type { GeneratedSiteSnapshot } from '@/generated/providers/types'
import { activeProvider } from '@/generated/providers'
import { getSiteSnapshotCache } from './cache'
import { getRuntimeConfig } from './config'

let inFlight: Promise<GeneratedSiteSnapshot> | null = null
let lastSnapshotMetadata: { fetchedAt: string; provider: string } | null = null

type SnapshotRefreshListener = () => void
const snapshotRefreshListeners = new Set<SnapshotRefreshListener>()

export function registerSnapshotRefreshListener(listener: SnapshotRefreshListener): void {
  snapshotRefreshListeners.add(listener)
}

export function unregisterSnapshotRefreshListener(listener: SnapshotRefreshListener): void {
  snapshotRefreshListeners.delete(listener)
}

function notifySnapshotRefresh(): void {
  snapshotRefreshListeners.forEach(listener => {
    try {
      listener()
    } catch (error) {
      console.error('head-runtime:snapshot-refresh-listener-error', { error })
    }
  })
}

export interface LoadSiteSnapshotOptions {
  refresh?: boolean
  designConcept?: string
}

export async function loadSiteSnapshot(options: LoadSiteSnapshotOptions = {}): Promise<GeneratedSiteSnapshot> {
  const cache = getSiteSnapshotCache()
  const hasDesignConcept = Boolean(options.designConcept)

  // When a specific design concept is requested, skip cache and fetch fresh
  // This ensures design concept switching works correctly
  if (hasDesignConcept) {
    const snapshot = await activeProvider.fetchSiteSnapshot({ designConcept: options.designConcept })
    lastSnapshotMetadata = {
      fetchedAt: new Date().toISOString(),
      provider: activeProvider.name
    }
    return snapshot
  }

  if (options.refresh) {
    await cache.clear().catch(() => {})
    inFlight = null
    notifySnapshotRefresh()
  } else {
    const cached = await cache.get()
    if (cached) {
      return cached
    }
  }

  if (!inFlight) {
    const { cacheTtlSeconds } = getRuntimeConfig()
    const promise = activeProvider.fetchSiteSnapshot().then(async snapshot => {
      if (cacheTtlSeconds > 0) {
        try {
          await cache.set(snapshot, cacheTtlSeconds)
        } catch (error) {
          console.warn('head-runtime:cache-set-failed', { error })
        }
      }

      if (cacheTtlSeconds === 0) {
        await cache.clear().catch(() => {})
      }

      lastSnapshotMetadata = {
        fetchedAt: new Date().toISOString(),
        provider: activeProvider.name
      }

      notifySnapshotRefresh()

      return snapshot
    })

    inFlight = promise
    promise
      .catch(error => {
        console.error('head-runtime:snapshot-fetch-failed', { error })
      })
      .finally(() => {
        if (inFlight === promise) {
          inFlight = null
        }
      })
  }

  if (!inFlight) {
    throw new Error('Failed to load site snapshot')
  }

  return inFlight
}

export async function invalidateSiteSnapshotCache(): Promise<void> {
  await getSiteSnapshotCache().clear()
  lastSnapshotMetadata = null
  notifySnapshotRefresh()
}

export function getSnapshotFetchMetadata(): { fetchedAt: string; provider: string } | null {
  return lastSnapshotMetadata ? { ...lastSnapshotMetadata } : null
}
`
}

export function buildRuntimeDiagnosticsModule(): string {
  return [
    "import diagnostics from '@/generated/diagnostics.json'",
    "import { activeProvider, providerRegistry } from '@/generated/providers'",
    "import type { GeneratedProviderDiagnostic } from '@/generated/providers/types'",
    "import { getRuntimeConfig } from './config'",
    "import { getSnapshotFetchMetadata } from './site-data'",
    '',
    'type GeneratorDiagnostics = typeof diagnostics',
    '',
    "export interface RuntimeDiagnosticEvent {",
    "  timestamp: string",
    "  level: 'info' | 'warn' | 'error'",
    "  code: string",
    "  message: string",
    "  context?: Record<string, unknown>",
    '}',
    '',
    'const runtimeDiagnostics: RuntimeDiagnosticEvent[] = []',
    'const MAX_RUNTIME_DIAGNOSTICS = 200',
    '',
    'export interface RuntimeDiagnosticsPayload {',
    '  provider: string',
    '  providerDiagnostics: GeneratedProviderDiagnostic[]',
    '  generatorDiagnostics: GeneratorDiagnostics',
    '  cache: {',
    '    ttlSeconds: number',
    '    lastFetch: ReturnType<typeof getSnapshotFetchMetadata>',
    '  }',
    '  supportedProviders: string[]',
    '  runtimeDiagnostics: RuntimeDiagnosticEvent[]',
    '}',
    '',
    'function cloneContext(context: Record<string, unknown> | undefined): Record<string, unknown> | undefined {',
    '  if (!context) {',
    '    return undefined',
    '  }',
    '  return Object.entries(context).reduce<Record<string, unknown>>((acc, [key, value]) => {',
    '    acc[key] = value',
    '    return acc',
    '  }, {})',
    '}',
    '',
    "export function logRuntimeDiagnostic(event: {",
    "  level?: 'info' | 'warn' | 'error'",
    '  code: string',
    '  message: string',
    '  context?: Record<string, unknown>',
    '  timestamp?: string',
    '}): void {',
    '  const entry: RuntimeDiagnosticEvent = {',
    '    timestamp: event.timestamp ?? new Date().toISOString(),',
    '    level: event.level ?? "error",',
    '    code: event.code,',
    '    message: event.message,',
    '    context: cloneContext(event.context)',
    '  }',
    '',
    '  runtimeDiagnostics.push(entry)',
    '  if (runtimeDiagnostics.length > MAX_RUNTIME_DIAGNOSTICS) {',
    '    runtimeDiagnostics.splice(0, runtimeDiagnostics.length - MAX_RUNTIME_DIAGNOSTICS)',
    '  }',
    '}',
    '',
    'export function listRuntimeDiagnostics(): RuntimeDiagnosticEvent[] {',
    '  return runtimeDiagnostics.map(entry => ({',
    '    timestamp: entry.timestamp,',
    '    level: entry.level,',
    '    code: entry.code,',
    '    message: entry.message,',
    '    context: cloneContext(entry.context)',
    '  }))',
    '}',
    '',
    'export function clearRuntimeDiagnostics(): void {',
    '  runtimeDiagnostics.splice(0, runtimeDiagnostics.length)',
    '}',
    '',
    'export async function getProviderDiagnostics(): Promise<GeneratedProviderDiagnostic[]> {',
    '  if (typeof activeProvider.getDiagnostics !== "function") {',
    '    return []',
    '  }',
    '',
    '  const diagnostics = await activeProvider.getDiagnostics()',
    '  return Array.isArray(diagnostics) ? diagnostics : []',
    '}',
    '',
    'export function getGeneratorDiagnostics(): GeneratorDiagnostics {',
    '  return diagnostics',
    '}',
    '',
    'export async function buildRuntimeDiagnostics(): Promise<RuntimeDiagnosticsPayload> {',
    '  const config = getRuntimeConfig()',
    '  const providerDiagnostics = await getProviderDiagnostics()',
    '',
    '  return {',
    '    provider: activeProvider.name,',
    '    providerDiagnostics,',
    '    generatorDiagnostics: diagnostics,',
    '    cache: {',
    '      ttlSeconds: config.cacheTtlSeconds,',
    '      lastFetch: getSnapshotFetchMetadata()',
    '    },',
    '    supportedProviders: Object.keys(providerRegistry),',
    '    runtimeDiagnostics: listRuntimeDiagnostics()',
    '  }',
    '}',
    ''
  ].join('\n')
}

export function buildDiagnosticsApiRouteModule(): string {
  return [
    "import { NextResponse } from 'next/server'",
    "import { buildRuntimeDiagnostics } from '@/generated/runtime/diagnostics'",
    '',
    'export async function GET() {',
    '  const diagnostics = await buildRuntimeDiagnostics()',
    '  return NextResponse.json(diagnostics)',
    '}',
    ''
  ].join('\n')
}

export function buildDiagnosticsLogApiRouteModule(): string {
  return [
    "import { NextResponse } from 'next/server'",
    "import { logRuntimeDiagnostic } from '@/generated/runtime/diagnostics'",
    '',
    "export const dynamic = 'force-dynamic'",
    '',
    'function parseBody(value: unknown): { level?: \'info\' | \'warn\' | \'error\'; code: string; message: string; context?: Record<string, unknown> } | null {',
    '  if (typeof value !== \'object\' || value === null) {',
    '    return null',
    '  }',
    '',
    '  const payload = value as Record<string, unknown>',
    '  if (typeof payload.code !== \'string\' || payload.code.trim().length === 0) {',
    '    return null',
    '  }',
    '  if (typeof payload.message !== \'string\' || payload.message.trim().length === 0) {',
    '    return null',
    '  }',
    '',
    '  const context = typeof payload.context === \'object\' && payload.context !== null ? (payload.context as Record<string, unknown>) : undefined',
    '  const level = typeof payload.level === \'string\' ? payload.level : undefined',
    '',
    '  return {',
    '    level: level === \'info\' || level === \'warn\' || level === \'error\' ? level : \'error\',',
    '    code: payload.code.trim(),',
    '    message: payload.message.trim(),',
    '    context',
    '  }',
    '}',
    '',
    'export async function POST(request: Request) {',
    '  const body = await request.json().catch(() => null)',
    '  const payload = parseBody(body)',
    '  if (!payload) {',
    "    return NextResponse.json({ error: 'Invalid diagnostic payload' }, { status: 400 })",
    '  }',
    '',
    '  logRuntimeDiagnostic(payload)',
    '  return NextResponse.json({ ok: true })',
    '}',
    ''
  ].join('\n')
}

export function buildCacheApiRouteModule(): string {
  return [
    "import { NextResponse } from 'next/server'",
    "import { invalidateSiteSnapshotCache, loadSiteSnapshot, getSnapshotFetchMetadata } from '@/generated/runtime/site-data'",
    '',
    'export async function POST() {',
    '  const snapshot = await loadSiteSnapshot({ refresh: true })',
    '  return NextResponse.json({',
    "    status: 'refreshed',",
    '    pageCount: snapshot.pages.length,',
    '    lastFetch: getSnapshotFetchMetadata()',
    '  })',
    '}',
    '',
    'export async function DELETE() {',
    '  await invalidateSiteSnapshotCache()',
    "  return NextResponse.json({ status: 'cleared' })",
    '}',
    ''
  ].join('\n')
}

export function buildHealthApiRouteModule(): string {
  return [
    "import { NextResponse } from 'next/server'",
    "import { activeProvider } from '@/generated/providers'",
    "import { getRuntimeConfig } from '@/generated/runtime/config'",
    "import { getSnapshotFetchMetadata } from '@/generated/runtime/site-data'",
    '',
    'export async function GET() {',
    '  const metadata = getSnapshotFetchMetadata()',
    '  const config = getRuntimeConfig()',
    '',
    '  return NextResponse.json({',
    "    status: 'ok',",
    '    provider: activeProvider.name,',
    '    cacheTtlSeconds: config.cacheTtlSeconds,',
    '    lastFetch: metadata',
    '  })',
    '}',
    ''
  ].join('\n')
}

export function buildComponentProbeModule(): string {
  return `import * as React from 'react'

export interface ComponentProbeMeta {
  id: string
  type?: string
  region?: string | null
  loaderKey?: string | null
}

export function withComponentProbe(element: React.ReactNode, meta: ComponentProbeMeta): React.ReactNode {
  if (process.env.HEAD_RUNTIME_COMPONENT_PROBE !== '1') {
    return element
  }

  return React.createElement(
    'div',
    {
      'data-catalyst-component-id': meta.id,
      'data-catalyst-component-type': meta.type ?? 'unknown',
      'data-catalyst-region': meta.region ?? 'none',
      'data-catalyst-loader': meta.loaderKey ?? 'none'
    },
    element
  )
}
`
}

export function buildValidationRunnerModule(): string {
  return `import { resolveRoute } from '@/generated/runtime/routing'
import { renderPage } from '@/generated/page-renderer'
import { siteSnapshot } from '@/data/site'
import { renderToString } from 'react-dom/server'
import { writeFileSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'parse5'

// Parse5 types for HTML parsing
interface Element {
  nodeName: string
  attrs?: Array<{ name: string; value: string }>
  childNodes?: Element[]
}

interface Document {
  childNodes?: Element[]
}

// Simple interface for the validation report
interface HeadValidationReport {
  websiteId: string
  slug: string
  pageId: string
  expectedCount: number
  renderedCount: number
  missingIds: Array<{ id: string; type: string; region?: string | null }>
  unexpectedIds: Array<{ id: string; type?: string }>
  typeMismatches: Array<{ id: string; expectedType: string; renderedType: string }>
  generatorDiagnostics: any[]
  runtimeDiagnostics: any[]
  generatedAt: string
}

// Parse5 implementation for proper DOM traversal
interface Parse5Node {
  nodeName: string
  attrs?: Array<{ name: string; value: string }>
  childNodes?: Parse5Node[]
}

function parseHTML(html: string): Element {
  const document = parse(html) as Parse5Node

  function convertParse5Node(node: Parse5Node): Element {
    const attrs = node.attrs?.map(attr => ({ name: attr.name, value: attr.value })) || []
    const childNodes = node.childNodes?.map(convertParse5Node) || []

    return {
      nodeName: node.nodeName.toLowerCase(),
      attrs,
      childNodes
    }
  }

  // Find the body element
  let bodyNode = document.childNodes?.find(node => node.nodeName === 'body')
  if (!bodyNode) {
    // If no body found, create a synthetic one with all children
    bodyNode = {
      nodeName: 'body',
      childNodes: document.childNodes || []
    }
  }

  return convertParse5Node(bodyNode)
}

function findElementsWithAttribute(root: Element, attributeName: string): Element[] {
  const results: Element[] = []

  function traverse(node: Element) {
    if (node.attrs && node.attrs.some(attr => attr.name === attributeName)) {
      results.push(node)
    }

    if (node.childNodes) {
      node.childNodes.forEach(traverse)
    }
  }

  traverse(root)
  return results
}

function getAttributeValue(element: Element, attributeName: string): string {
  if (!element.attrs) return ''
  const attr = element.attrs.find(attr => attr.name === attributeName)
  return attr ? attr.value : ''
}

function slugToKey(slug: string): string {
  return slug === '/' ? 'root' : slug.replace(/^\\//, '').replace(/\\//g, '-')
}

async function runValidation(slug: string = '/'): Promise<void> {
  // Enable probe
  process.env.HEAD_RUNTIME_COMPONENT_PROBE = process.env.HEAD_RUNTIME_COMPONENT_PROBE ?? '1'

  console.log(\`Running validation for slug: \${slug}\`)
  console.log(\`Environment check:\`)
  console.log(\`  DATABASE_URL: \${process.env.DATABASE_URL ? '[SET - ' + process.env.DATABASE_URL.substring(0, 50) + '...]' : '[NOT SET]'}\`)
  console.log(\`  DIRECT_URL: \${process.env.DIRECT_URL ? '[SET - ' + process.env.DIRECT_URL.substring(0, 50) + '...]' : '[NOT SET]'}\`)
  console.log(\`  HEAD_RUNTIME_WEBSITE_ID: \${process.env.HEAD_RUNTIME_WEBSITE_ID}\`)

  try {
    // Resolve route - handle slug parsing correctly
    const slugSegments = slug === '/' ? [] : slug.replace(/^\\/+/, '').split('/').filter(Boolean)
    const resolution = await resolveRoute(slugSegments)

    if (!resolution.payload) {
      console.error(\`No payload found for slug: \${slug}\`)
      process.exit(1)
    }

    console.log(\`Found page: \${resolution.payload.page.title} (ID: \${resolution.payload.page.id})\`)

    // Render page to HTML
    const element = await renderPage(resolution)
    const html = renderToString(element)

    // Write HTML file for debugging
    const slugKey = slugToKey(slug)
    const htmlPath = join(process.cwd(), 'generated', 'validation', \`\${slugKey}.html\`)

    // Ensure directory exists
    const { mkdirSync } = await import('node:fs')
    const { dirname } = await import('node:path')

    try {
      mkdirSync(dirname(htmlPath), { recursive: true })
    } catch (error) {
      // Directory might already exist
    }

    writeFileSync(htmlPath, html, 'utf8')
    console.log(\`HTML written to: \${htmlPath}\`)

    // Parse HTML and collect component markers
    const parsed = parseHTML(html)
    const markedElements = findElementsWithAttribute(parsed, 'data-catalyst-component-id')

    const renderedComponents = new Map<string, { type: string; region: string }>()

    markedElements.forEach(element => {
      const id = getAttributeValue(element, 'data-catalyst-component-id')
      const type = getAttributeValue(element, 'data-catalyst-component-type')
      const region = getAttributeValue(element, 'data-catalyst-region')

      if (id) {
        renderedComponents.set(id, { type, region })
      }
    })

    // Get expected components from site snapshot
    if (!siteSnapshot) {
      console.error('Static snapshot not available. This validation requires --include-static-snapshot during generation.')
      process.exit(1)
    }
    const pageId = resolution.payload.page.id
    const snapshotPage = siteSnapshot.pages.find(p => p.id === pageId)

    if (!snapshotPage) {
      console.error(\`Page \${pageId} not found in site snapshot\`)
      process.exit(1)
    }

    const expectedComponents = new Map<string, { type: string; region?: string | null }>()

    snapshotPage.components.forEach(component => {
      expectedComponents.set(component.id, {
        type: component.type || 'unknown',
        region: component.props?.region || 'main'
      })
    })

    // Build comparison result
    const expectedIds = Array.from(expectedComponents.keys())
    const renderedIds = Array.from(renderedComponents.keys())

    const missingIds = expectedIds.filter(id => !renderedComponents.has(id)).map(id => ({
      id,
      type: expectedComponents.get(id)!.type,
      region: expectedComponents.get(id)!.region
    }))

    const unexpectedIds = renderedIds.filter(id => !expectedComponents.has(id)).map(id => ({
      id,
      type: renderedComponents.get(id)!.type
    }))

    const typeMismatches = expectedIds.filter(id => {
      if (!renderedComponents.has(id)) return false
      const expected = expectedComponents.get(id)!
      const rendered = renderedComponents.get(id)!
      return expected.type !== rendered.type
    }).map(id => ({
      id,
      expectedType: expectedComponents.get(id)!.type,
      renderedType: renderedComponents.get(id)!.type
    }))

    // Load generator diagnostics
    let generatorDiagnostics: any[] = []
    try {
      const diagnosticsPath = join(process.cwd(), 'generated', 'diagnostics.json')
      if (existsSync(diagnosticsPath)) {
        const diagnosticsContent = readFileSync(diagnosticsPath, 'utf8')
        const diagnosticsData = JSON.parse(diagnosticsContent)
        generatorDiagnostics = diagnosticsData.diagnostics || []
      }
    } catch (error) {
      console.warn('Failed to load generator diagnostics:', error instanceof Error ? error.message : String(error))
    }

    // Create report
    const report: HeadValidationReport = {
      websiteId: process.env.HEAD_RUNTIME_WEBSITE_ID || 'unknown',
      slug,
      pageId,
      expectedCount: expectedIds.length,
      renderedCount: renderedIds.length,
      missingIds,
      unexpectedIds,
      typeMismatches,
      generatorDiagnostics,
      runtimeDiagnostics: resolution.payload?.diagnostics || [],
      generatedAt: new Date().toISOString()
    }

    // Write JSON report
    const reportPath = join(process.cwd(), 'generated', 'validation', 'report.json')
    try {
      mkdirSync(dirname(reportPath), { recursive: true })
    } catch (error) {
      // Directory might already exist
    }
    writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8')
    console.log(\`JSON report written to: \${reportPath}\`)

    // Write human-readable report
    const txtLines = [
      \`Head Validation Report for \${slug}\`,
      \`Generated: \${report.generatedAt}\`,
      '',
      \`Website ID: \${report.websiteId}\`,
      \`Page ID: \${report.pageId}\`,
      '',
      \`Summary:\`,
      \`  Expected components: \${report.expectedCount}\`,
      \`  Rendered components: \${report.renderedCount}\`,
      ''
    ]

    if (missingIds.length > 0) {
      txtLines.push('Missing Components:')
      missingIds.forEach(item => {
        txtLines.push(\`  MISSING \${item.id} (type=\${item.type}, region=\${item.region || 'none'})\`)
      })
      txtLines.push('')
    }

    if (unexpectedIds.length > 0) {
      txtLines.push('Unexpected Components:')
      unexpectedIds.forEach(item => {
        txtLines.push(\`  UNEXPECTED \${item.id} (type=\${item.type || 'unknown'})\`)
      })
      txtLines.push('')
    }

    if (typeMismatches.length > 0) {
      txtLines.push('Type Mismatches:')
      typeMismatches.forEach(item => {
        txtLines.push(\`  TYPE_MISMATCH \${item.id} (expected=\${item.expectedType}, rendered=\${item.renderedType})\`)
      })
      txtLines.push('')
    }

    if (missingIds.length === 0 && unexpectedIds.length === 0 && typeMismatches.length === 0) {
      txtLines.push('✅ All components validated successfully!')
    }

    const txtPath = join(process.cwd(), 'generated', 'validation', 'report.txt')
    writeFileSync(txtPath, txtLines.join('\\n'), 'utf8')
    console.log(\`Text report written to: \${txtPath}\`)

    // Log summary to console
    console.log('\\nValidation Summary:')
    console.log(\`  Expected: \${report.expectedCount}\`)
    console.log(\`  Rendered: \${report.renderedCount}\`)
    console.log(\`  Missing: \${missingIds.length}\`)
    console.log(\`  Unexpected: \${unexpectedIds.length}\`)
    console.log(\`  Type Mismatches: \${typeMismatches.length}\`)

    // Set exit code
    if (missingIds.length > 0 || unexpectedIds.length > 0 || typeMismatches.length > 0) {
      console.log('\\n❌ Validation failed with discrepancies')
      process.exit(2)
    } else {
      console.log('\\n✅ Validation passed')
      process.exit(0)
    }

  } catch (error) {
    console.error('Validation failed with error:', error)
    process.exit(1)
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2)
  const slugIndex = args.findIndex(arg => arg === '--slug')
  let slug = slugIndex >= 0 && args[slugIndex + 1] ? args[slugIndex + 1] : '/'

  // Handle Windows path issue where '/' gets resolved to current directory
  if (process.platform === 'win32' && (slug.includes('Program Files') || slug.includes(':'))) {
    console.warn('Detected Windows path interpretation, using root slug "/"')
    slug = '/'
  }

  runValidation(slug).catch(error => {
    console.error('Validation runner failed:', error)
    process.exit(1)
  })
}

export { runValidation as default }
`
}

/**
 * Build the sitemap.ts module for Next.js MetadataRoute.Sitemap
 * Excludes redirect source paths from the sitemap
 * For UCS/GraphQL providers: uses dynamic provider calls
 * For static provider: uses baked-in site.json
 */
export function buildSitemapModule(baseUrl: string, providerKind: RuntimeProviderKind = 'static'): string {
  const useProvider = providerKind !== 'static'

  if (useProvider) {
    // Dynamic sitemap using provider (UCS/GraphQL)
    return `import type { MetadataRoute } from 'next'
import { activeProvider } from '@/generated/providers'

// ISR sitemap - revalidates every hour from database
export const revalidate = 3600

/**
 * Generate sitemap.xml for SEO
 * Uses provider to fetch pages from database
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = ${JSON.stringify(baseUrl)}

  try {
    // Fetch site snapshot from provider (includes all pages)
    const snapshot = await activeProvider.fetchSiteSnapshot()
    const pages = snapshot?.pages || []

    // Build sitemap entries from all pages
    // Note: Pages in the snapshot are real content pages, not redirect sources
    const sitemapEntries: MetadataRoute.Sitemap = pages
      .filter(page => !page.metadata?.draft) // Exclude draft pages
      .map(page => {
        const url = page.fullPath === '/'
          ? baseUrl
          : \`\${baseUrl}\${page.fullPath}\`

        return {
          url,
          lastModified: new Date(),
          changeFrequency: 'weekly' as const,
          priority: page.fullPath === '/' ? 1.0 : 0.8
        }
      })

    return sitemapEntries
  } catch (error) {
    console.error('head-runtime:sitemap-error', { error })
    return []
  }
}
`
  }

  // Static sitemap using baked-in site.json
  return `import type { MetadataRoute } from 'next'
import { getAllRedirects } from '@/generated/runtime/routing'
import siteData from '@/generated/data/site.json'

export const dynamic = 'force-static'
export const revalidate = 3600 // Revalidate every hour

/**
 * Generate sitemap.xml for SEO
 * Automatically excludes redirect source paths since they're not real pages
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = ${JSON.stringify(baseUrl)}
  const pages = siteData?.pages || []

  // Get all redirect source paths to exclude them from sitemap
  const redirectSourcePaths = new Set(
    getAllRedirects()
      .filter(r => r.isActive)
      .map(r => r.sourcePath.toLowerCase())
  )

  // Filter pages to exclude redirect source paths
  const sitemapEntries: MetadataRoute.Sitemap = pages
    .filter(page => {
      const pagePath = (page.fullPath || '').toLowerCase()
      return !redirectSourcePaths.has(pagePath)
    })
    .map(page => {
      const url = page.fullPath === '/'
        ? baseUrl
        : \`\${baseUrl}\${page.fullPath}\`

      return {
        url,
        lastModified: new Date(),
        changeFrequency: 'weekly' as const,
        priority: page.fullPath === '/' ? 1.0 : 0.8
      }
    })

  return sitemapEntries
}
`
}
