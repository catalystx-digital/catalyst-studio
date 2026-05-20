import type { ProviderKind } from '../../core/types'
export function buildProviderTypesModule(): string {
  // Define types explicitly instead of deriving from siteSnapshot
  // This ensures types are correct even when static snapshot is not included
  return `import type { ComponentType } from '@/lib/studio/components/cms/_core/types'
// PageTemplateRegionKey inlined to avoid dependency on pages module
export type PageTemplateRegionKey = 'header' | 'hero' | 'main' | 'footer'
import type { ComponentInstance } from '@/lib/studio/types/site-builder/component-instance'

export interface GeneratedSnapshotSiteInfo {
  id: string
  name: string
  description?: string
  origin?: string
}

export interface GeneratedSnapshotRegionSummary {
  region: PageTemplateRegionKey
  componentTypes: ComponentType[]
}

export interface GeneratedSnapshotPageMetadata {
  seoTitle?: string | null
  seoDescription?: string | null
  seoKeywords?: string[] | null
  ogImage?: string | null
  draft?: boolean
  [key: string]: unknown
}

export interface GeneratedSnapshotPage {
  id: string
  title: string
  fullPath: string
  templateKey: string | null
  templateProps: Record<string, unknown>
  regions: GeneratedSnapshotRegionSummary[]
  components: ComponentInstance[]
  metadata: GeneratedSnapshotPageMetadata
  sharedComponentIds?: string[]
}

export interface GeneratedSnapshotStructureNode {
  id: string
  websitePageId: string | null
  parentId: string | null
  slug: string
  fullPath: string
  position: number
  isFolder: boolean
  title?: string
}

export interface GeneratedSnapshotSharedComponent {
  id: string
  name: string
  componentType: ComponentType
  componentTypeId?: string
  content: Record<string, unknown> | null
  config: Record<string, unknown>
}

export interface GeneratedSiteSnapshot {
  site: GeneratedSnapshotSiteInfo
  pages: GeneratedSnapshotPage[]
  structure: GeneratedSnapshotStructureNode[]
  sharedComponents: GeneratedSnapshotSharedComponent[]
  capturedAt: string
  designSystem?: {
    tokens: Record<string, unknown>
    aliases?: Record<string, unknown>
    conceptId?: string
    conceptName?: string
  } | null
}

export interface GeneratedProviderDiagnostic {
  level: 'info' | 'warn' | 'error'
  code: string
  message: string
  context?: Record<string, unknown>
}

export interface GeneratedPageStructurePayload {
  current: GeneratedSnapshotStructureNode | null
  ancestors: GeneratedSnapshotStructureNode[]
  children: GeneratedSnapshotStructureNode[]
}

export interface GeneratedPagePayload {
  page: GeneratedSnapshotPage
  structure?: GeneratedPageStructurePayload
  sharedComponents: GeneratedSnapshotSharedComponent[]
  diagnostics: GeneratedProviderDiagnostic[]
}

export interface GeneratedProviderRequestContext {
  requestId?: string
  headers?: Record<string, string>
  searchParams?: Record<string, string | string[]>
  previewToken?: string
  designConcept?: string
}

export interface GeneratedRedirectPayload {
  id: string
  sourcePath: string
  targetPath: string
  redirectType: number
  isActive: boolean
  isExternal: boolean
  showInNav: boolean
  navLabel?: string
  openInNewTab: boolean
}

export interface GeneratedHeadDataProvider {
  name: string
  supportsLiveData: boolean
  fetchSiteSnapshot(options?: { includeStructure?: boolean; designConcept?: string }): Promise<GeneratedSiteSnapshot>
  resolvePageBySlug(slug: string[], context: GeneratedProviderRequestContext): Promise<GeneratedPagePayload | null>
  resolveRedirectByPath?(path: string, context: GeneratedProviderRequestContext): Promise<GeneratedRedirectPayload | null>
  preloadSharedComponents?(
    ids: string[],
    context: GeneratedProviderRequestContext
  ): Promise<Record<string, GeneratedSnapshotSharedComponent>>
  getDiagnostics?(): GeneratedProviderDiagnostic[] | Promise<GeneratedProviderDiagnostic[]>
}
`
}

export function buildStaticProviderModule(): string {
  return `import { siteSnapshot } from '@/data/site'
import type {
  GeneratedHeadDataProvider,
  GeneratedPagePayload,
  GeneratedPageStructurePayload,
  GeneratedProviderRequestContext,
  GeneratedSnapshotSharedComponent,
  GeneratedSiteSnapshot,
  GeneratedSnapshotPage,
  GeneratedSnapshotStructureNode
} from './types'
import { resolveSharedComponentReference } from '@/lib/studio/types/site-builder/component-instance'

// Static snapshot may be null if generated with --provider ucs without --include-static-snapshot
// In that case, the static provider will throw helpful errors directing to use the UCS provider
const SNAPSHOT_NOT_AVAILABLE_ERROR =
  'Static snapshot not available. This site was generated with --provider ucs and uses the database at runtime. ' +
  'Set HEAD_RUNTIME_PROVIDER=ucs in .env.local, or re-generate with --include-static-snapshot for debugging.'

type GeneratedSlugRegistryEntry = {
  pageId: string
  slug: string[]
  fullPath: string
  templateKey: string | null
  title: string
  aliasOf?: string | null
  structureId?: string | null
  parentId?: string | null
}

type SlugSegments = string[]
type SlugInput = readonly string[]

// Lazy initialization state - only initialize when snapshot is available and provider is accessed
let _initialized = false
let _snapshot: GeneratedSiteSnapshot | null = null
let _structureNodes: GeneratedSnapshotStructureNode[] | null = null
let _nodeById: Map<string, GeneratedSnapshotStructureNode> | null = null
let _pageById: Map<string, GeneratedSnapshotPage> | null = null
let _sharedComponentById: Map<string, GeneratedSnapshotSharedComponent> | null = null
let _pageToStructure: Map<string, string | null> | null = null
let _childrenByParent: Map<string, string[]> | null = null
let _slugIndex: Map<string, { pageId: string; structureId: string | null }> | null = null
let _registryMap: Map<string, GeneratedSlugRegistryEntry> | null = null

function ensureInitialized(): void {
  if (_initialized) return

  if (!siteSnapshot) {
    throw new Error(SNAPSHOT_NOT_AVAILABLE_ERROR)
  }

  // Use local const for type narrowing - siteSnapshot is guaranteed non-null here
  const snapshot = siteSnapshot
  _snapshot = snapshot
  _structureNodes = snapshot.structure
  _nodeById = new Map()
  _structureNodes.forEach(node => {
    _nodeById!.set(node.id, node)
  })

  _pageById = new Map()
  snapshot.pages.forEach(page => {
    _pageById!.set(page.id, page)
  })

  _sharedComponentById = new Map()
  snapshot.sharedComponents.forEach(component => {
    _sharedComponentById!.set(component.id, component)
  })

  _pageToStructure = new Map()
  _structureNodes.forEach(node => {
    if (node.websitePageId) {
      _pageToStructure!.set(node.websitePageId, node.id)
    }
  })

  snapshot.pages.forEach(page => {
    if (!_pageToStructure!.has(page.id)) {
      _pageToStructure!.set(page.id, null)
    }
  })

  _childrenByParent = new Map()
  _structureNodes.forEach(node => {
    const key = node.parentId ?? '__root__'
    const list = _childrenByParent!.get(key) ?? []
    list.push(node.id)
    _childrenByParent!.set(key, list)
  })

  _childrenByParent.forEach(list => {
    list.sort((a, b) => {
      const left = _nodeById!.get(a)
      const right = _nodeById!.get(b)
      const leftPos = left?.position ?? 0
      const rightPos = right?.position ?? 0
      return leftPos - rightPos
    })
  })

  _slugIndex = new Map()
  _registryMap = new Map()

  _snapshot.pages.forEach(page => {
    const structureId = _pageToStructure!.get(page.id) ?? null
    const structureNode = structureId ? _nodeById!.get(structureId) : undefined
    const segments = structureNode ? toSegments(structureNode.fullPath) : toSegments(page.fullPath)
    const key = toSlugKey(segments)
    _slugIndex!.set(key, { pageId: page.id, structureId })
  })

  if (_snapshot.pages.length > 0) {
    const first = _snapshot.pages[0]
    const structureId = _pageToStructure!.get(first.id) ?? null
    _slugIndex!.set('__root__', { pageId: first.id, structureId })
  }

  _slugIndex.forEach(({ pageId, structureId }, slugKey) => {
    const page = _pageById!.get(pageId)
    if (!page) {
      return
    }
    _registryMap!.set(slugKey, {
      pageId,
      slug: slugKeyToSegments(slugKey),
      fullPath: page.fullPath,
      templateKey: page.templateKey ?? null,
      title: page.title ?? '',
      aliasOf: null,
      structureId,
      parentId: structureId ? _nodeById!.get(structureId)?.parentId ?? null : null
    })
  })

  _initialized = true
}

function normalizeSlug(slug: SlugInput): SlugSegments {
  return Array.from(slug)
    .filter((segment): segment is string => typeof segment === 'string')
    .map(segment => segment.trim())
    .filter(segment => segment.length > 0)
}

function toSlugKey(slug: SlugInput): string {
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

function toSegments(fullPath: string): SlugSegments {
  const trimmed = fullPath.replace(/^[/]+/g, '').replace(/[/]+$/g, '')
  if (!trimmed) {
    return []
  }
  return trimmed.split('/').filter(Boolean)
}

function cloneStructureNode(node: NonNullable<typeof siteSnapshot>['structure'][number]): NonNullable<typeof siteSnapshot>['structure'][number] {
  return JSON.parse(JSON.stringify(node))
}

function buildStructurePayload(structureId: string | null): GeneratedPageStructurePayload {
  ensureInitialized()

  if (!structureId) {
    return { current: null, ancestors: [], children: [] }
  }

  const current = _nodeById!.get(structureId)
  if (!current) {
    return { current: null, ancestors: [], children: [] }
  }

  const ancestors: NonNullable<typeof siteSnapshot>['structure'][number][] = []
  let parentId = current.parentId ?? null

  while (parentId) {
    const parent = _nodeById!.get(parentId)
    if (!parent) {
      break
    }
    ancestors.push(parent)
    parentId = parent.parentId ?? null
  }

  ancestors.reverse()

  const childIds = _childrenByParent!.get(structureId) ?? []
  const children = childIds
    .map(id => _nodeById!.get(id))
    .filter((value): value is NonNullable<typeof siteSnapshot>['structure'][number] => Boolean(value))

  return {
    current: cloneStructureNode(current),
    ancestors: ancestors.map(cloneStructureNode),
    children: children.map(cloneStructureNode)
  }
}

function clonePage(page: NonNullable<typeof siteSnapshot>['pages'][number]): NonNullable<typeof siteSnapshot>['pages'][number] {
  return JSON.parse(JSON.stringify(page))
}

function resolveSharedComponents(page: NonNullable<typeof siteSnapshot>['pages'][number]): GeneratedSnapshotSharedComponent[] {
  ensureInitialized()

  const identifiers = new Set<string>()
  const sharedIds = (page as { sharedComponentIds?: readonly string[] }).sharedComponentIds
  if (Array.isArray(sharedIds)) {
    sharedIds.forEach(id => identifiers.add(id))
  }
  const components = Array.isArray(page.components) ? Array.from(page.components) : []
  components.forEach(component => {
    const sharedId = resolveSharedComponentReference(component as any)
    if (typeof sharedId === 'string' && sharedId) {
      identifiers.add(sharedId)
    }
  })

  return Array.from(identifiers)
    .map(id => _sharedComponentById!.get(id))
    .filter((value): value is NonNullable<typeof siteSnapshot>['sharedComponents'][number] => Boolean(value))
    .map(component => JSON.parse(JSON.stringify(component)))
}

function resolveFromSnapshot(slug: SlugInput): GeneratedPagePayload | null {
  ensureInitialized()

  const normalized = normalizeSlug(slug)
  const key = toSlugKey(normalized)
  const entry = _slugIndex!.get(key)
  if (!entry) {
    return null
  }

  const page = _pageById!.get(entry.pageId)
  if (!page) {
    return null
  }

  const clonedPage = clonePage(page)
  const structure = buildStructurePayload(entry.structureId ?? null)
  const sharedComponents = resolveSharedComponents(page)

  return {
    page: clonedPage,
    structure,
    sharedComponents,
    diagnostics: []
  }
}

export const staticProvider: GeneratedHeadDataProvider = {
  name: 'static',
  supportsLiveData: false,
  async fetchSiteSnapshot() {
    ensureInitialized()
    return _snapshot!
  },
  async resolvePageBySlug(slug: SlugInput, _context: GeneratedProviderRequestContext): Promise<GeneratedPagePayload | null> {
    return resolveFromSnapshot(slug)
  },
  async preloadSharedComponents(ids: string[]): Promise<Record<string, GeneratedSnapshotSharedComponent>> {
    ensureInitialized()
    const result: Record<string, GeneratedSnapshotSharedComponent> = {}
    ids.forEach(id => {
      const component = _sharedComponentById!.get(id)
      if (component) {
        result[id] = JSON.parse(JSON.stringify(component))
      }
    })
    return result
  },
  getDiagnostics() {
    if (!siteSnapshot) {
      return [{ level: 'error' as const, code: 'STATIC_SNAPSHOT_NOT_AVAILABLE', message: SNAPSHOT_NOT_AVAILABLE_ERROR }]
    }
    return []
  }
}
`
}

function buildRuntimeRoutingModule(slugRegistry: SlugRegistryEntry[], structureIndex: StructureIndex): string {
  const registryLiteral = JSON.stringify(slugRegistry, null, 2)
  const structureLiteral = JSON.stringify({
    nodes: structureIndex.nodes,
    childrenByParent: structureIndex.childrenByParent,
    pageToStructure: structureIndex.pageToStructure
  }, null, 2)

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

const staticRegistryEntries: GeneratedSlugRegistryEntry[] = ${registryLiteral}
const staticStructureIndex: StructureIndexData = ${structureLiteral}

const registryMap = new Map<string, GeneratedSlugRegistryEntry>()
staticRegistryEntries.forEach(entry => {
  const key = toSlugKey(entry.canonicalSlug ?? entry.slug)
  registryMap.set(key, cloneRegistryEntry(entry))
})

const dynamicPayloadCache = new Map<string, GeneratedPagePayload>()
const dynamicStructureCache = new Map<string, GeneratedPageStructurePayload>()

const structureNodeById = new Map<string, GeneratedSnapshotStructureNode>(
  staticStructureIndex.nodes.map(node => [node.id, node])
)

const childrenByParent = new Map<string, string[]>(
  Object.entries(staticStructureIndex.childrenByParent)
)

const pageToStructure = new Map<string, string | null>(
  Object.entries(staticStructureIndex.pageToStructure)
)

function normalizeSlug(slug: SlugSegments): SlugSegments {
  return slug
    .filter((segment): segment is string => typeof segment === 'string')
    .map(segment => segment.trim().toLowerCase())
    .filter(segment => segment.length > 0)
}

function sanitizeSlug(slug: SlugSegments): SlugSegments {
  return slug
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
  const trimmed = path.replace(/^\/+|\/+$/g, '')
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
  if (Array.isArray(page.sharedComponentIds)) {
    page.sharedComponentIds.forEach(id => identifiers.add(id))
  }
  page.components.forEach(component => {
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
  refresh = false
): Promise<GeneratedPagePayload | null> {
  const snapshot = refresh
    ? await loadSiteSnapshot({ refresh: true })
    : await loadSiteSnapshot()
  const page = snapshot.pages.find(candidate => candidate.id === entry.pageId) ??
    snapshot.pages.find(candidate => candidate.fullPath === entry.fullPath)

  if (!page) {
    return null
  }

  const structure = dynamicStructureCache.has(slugKey)
    ? cloneStructurePayload(dynamicStructureCache.get(slugKey)!)
    : buildStaticStructurePayload(entry.structureId ?? null)

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

  for (const key of cacheKeys) {
    const cached = dynamicPayloadCache.get(key)
    if (!cached) {
      continue
    }
    const entry = registryMap.get(canonicalKey) ?? registryResolution.entry ?? null
    return {
      slug: originalSlug,
      matchedSlug,
      canonicalSlug,
      canonicalPath,
      shouldRedirect,
      entry: entry ? cloneRegistryEntry(entry) : null,
      payload: clonePagePayload(cached),
      source: 'cache',
      aliasResolved
    }
  }

  if (canonicalEntry && !options.preferLive) {
    const staticPayload = await resolveStaticEntry(
      canonicalEntry,
      canonicalKey,
      Boolean(options.refresh)
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

    try {
      const livePayload = await activeProvider.resolvePageBySlug(canonicalSlugForRequest, context)
      if (livePayload) {
        const payloadForCache = clonePagePayload(livePayload)
        const structureForCache = payloadForCache.structure
          ? cloneStructurePayload(payloadForCache.structure)
          : null

        cacheKeys.forEach((key, index) => {
          dynamicPayloadCache.set(
            key,
            index === 0 ? payloadForCache : clonePagePayload(payloadForCache)
          )
          if (structureForCache) {
            dynamicStructureCache.set(
              key,
              index === 0 ? structureForCache : cloneStructurePayload(structureForCache)
            )
          }
        })

        const effectiveEntry =
          canonicalEntry ?? registerDynamicEntry(canonicalKey, canonicalSlugForRequest, payloadForCache)

        return {
          slug: originalSlug,
          matchedSlug,
          canonicalSlug,
          canonicalPath,
          shouldRedirect,
          entry: cloneRegistryEntry(effectiveEntry),
          payload: clonePagePayload(payloadForCache),
          source: 'live',
          aliasResolved
        }
      }
    } catch (error) {
      console.error('head-runtime:resolve-page-error', {
        provider: activeProvider.name,
        slugKey: canonicalKey,
        slug: canonicalSlugForRequest,
        error
      })
    }
  }

  if (canonicalEntry && options.preferLive) {
    const staticPayload = await resolveStaticEntry(
      canonicalEntry,
      canonicalKey,
      Boolean(options.refresh)
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
  dynamicPayloadCache.clear()
  dynamicStructureCache.clear()
}

registerSnapshotRefreshListener(clearDynamicRouteCache)
`
}

function buildRouteRequestHelpersModule(): string {
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

// NOTE: buildCatchAllRouteModule and buildRootRouteModule are defined in runtime-modules.ts
// They were previously duplicated here with bugs (missing headers import, duplicate normalizeSearchParams)
// The correct versions are imported from runtime-modules.ts in scaffold.ts

function buildAppErrorModule(): string {
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

function buildGlobalErrorModule(): string {
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

function buildRuntimeConfigModule(
  snapshot: SiteSnapshot,
  runtimeWebsiteId: string,
  templateOverrideKey?: string | null
): string {
  const defaultWebsiteId = JSON.stringify(runtimeWebsiteId || snapshot.site.id)
  const defaultTemplateOverride = templateOverrideKey ? JSON.stringify(templateOverrideKey) : 'undefined'

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
`
}

function buildRuntimeCacheModule(): string {
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

function buildRuntimeSiteDataModule(): string {
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
}

export async function loadSiteSnapshot(options: LoadSiteSnapshotOptions = {}): Promise<GeneratedSiteSnapshot> {
  const cache = getSiteSnapshotCache()

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

function buildDiagnosticsApiRouteModule(): string {
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

function buildDiagnosticsLogApiRouteModule(): string {
  return [
    "import { NextResponse } from 'next/server'",
    "import { logRuntimeDiagnostic } from '@/generated/runtime/diagnostics'",
    '',
    "// Enable ISR for performance",
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

function buildCacheApiRouteModule(): string {
  return [
    "import { NextResponse } from 'next/server'",
    "import { invalidateSiteSnapshotCache, loadSiteSnapshot, getSnapshotFetchMetadata } from '@/generated/runtime/site-data'",
    '',
    'export async function POST() {',
    '  const snapshot = await loadSiteSnapshot({ refresh: true }) as unknown as { pages: unknown[] }',
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

function buildHealthApiRouteModule(): string {
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

export function buildPrismaClientModule(options: { stub?: boolean } = {}): string {
  if (options.stub) {
    return [
      "export class PrismaClient {",
      "  constructor() {",
      "    throw new Error('Prisma client is not bundled in this GraphQL/static export. Regenerate with HEAD_RUNTIME_PROVIDER=ucs to enable Prisma-backed runtime.')",
      "  }",
      "}",
      'export default PrismaClient',
      ''
    ].join('\n')
  }

  return ["export { PrismaClient } from './prisma'", "export * from './prisma'", ''].join('\n')
}

export function buildUcsProviderModule(): string {
  return [
    "import { PrismaClient } from '@/lib/generated/prisma-client'",
    "import type { GeneratedHeadDataProvider, GeneratedPagePayload, GeneratedProviderDiagnostic, GeneratedRedirectPayload, GeneratedSiteSnapshot } from './types'",
    "import { getRuntimeConfig } from '@/generated/runtime/config'",
    "import { buildUcsSiteSnapshot } from '@/lib/studio/headless/ucs/snapshot-builder'",
    "import { loadSharedComponentsById, resolveUcsPageBySlug } from '@/lib/studio/headless/ucs/page-resolver'",
    "import type { SnapshotSharedComponent } from '@/lib/studio/headless/site-snapshot/types'",
    "",
    "type DiagnosticLevel = GeneratedProviderDiagnostic['level']",
    "type SlugSegments = readonly string[]",
    "",
    "let prismaInstance: PrismaClient | null = null",
    "",
    "function getPrismaClient(): PrismaClient {",
    "  const globalForPrisma = globalThis as unknown as { __generatedHeadPrisma?: PrismaClient }",
    "  if (!prismaInstance) {",
    "    prismaInstance = globalForPrisma.__generatedHeadPrisma ?? new PrismaClient()",
    "    if (process.env.NODE_ENV !== 'production') {",
    "      globalForPrisma.__generatedHeadPrisma = prismaInstance",
    "    }",
    "  }",
    "  return prismaInstance",
    "}",
    "",
    "let lastDiagnostics: GeneratedProviderDiagnostic[] = []",
    "let runtimeDiagnostics: GeneratedProviderDiagnostic[] = []",
    "// Note: We deliberately do NOT cache page payloads at the module level.",
    "// Module-level caches persist across ISR revalidations in warm serverless instances,",
    "// causing stale content to be served even after database updates.",
    "// Next.js ISR and unstable_cache provide the caching layer instead.",
    "const sharedComponentCache = new Map<string, SnapshotSharedComponent>()",
    "",
    "function logDiagnostic(provider: string, diagnostic: GeneratedProviderDiagnostic): void {",
    "  const payload = { provider, ...diagnostic }",
    "  const level: DiagnosticLevel = diagnostic.level",
    "  if (level === 'error') {",
    "    console.error('head-runtime:diagnostic', payload)",
    "    return",
    "  }",
    "  if (level === 'warn') {",
    "    console.warn('head-runtime:diagnostic', payload)",
    "    return",
    "  }",
    "  console.info('head-runtime:diagnostic', payload)",
    "}",
    "",
    "function clonePayload<T>(payload: T): T {",
    "  return JSON.parse(JSON.stringify(payload)) as T",
    "}",
    "",
    "function sanitizeSlug(slug: SlugSegments): string[] {",
    "  return Array.from(slug).filter((segment): segment is string => typeof segment === 'string').map(segment => segment.trim()).filter(segment => segment.length > 0)",
    "}",
    "",
    "function canonicalizeSlug(slug: SlugSegments): string[] {",
    "  return sanitizeSlug(slug).map(segment => segment.toLowerCase())",
    "}",
    "",
    "function toSlugKey(slug: SlugSegments): string {",
    "  const canonical = canonicalizeSlug(slug)",
    "  if (canonical.length === 0) {",
    "    return '__root__'",
    "  }",
    "  return canonical.join('/')",
    "}",
    "",
    "export const ucsProvider: GeneratedHeadDataProvider = {",
    "  name: 'ucs',",
    "  supportsLiveData: true,",
    "  async fetchSiteSnapshot(options?: { designConcept?: string }) {",
    "    const config = getRuntimeConfig()",
    "    if (!config.websiteId) {",
    "      throw new Error('Head runtime configuration is missing a websiteId; re-run the generator with --website-id')",
    "    }",
    "",
    "    const prisma = getPrismaClient()",
    "",
    "    sharedComponentCache.clear()",
    "    runtimeDiagnostics = []",
    "",
    "    const { snapshot, diagnostics } = await buildUcsSiteSnapshot({",
    "      prisma,",
    "      websiteId: config.websiteId,",
    "      templateOverrideKey: config.templateOverrideKey,",
    "      designConcept: options?.designConcept",
    "    })",
    "",
    "    lastDiagnostics = diagnostics.map(diagnostic => ({",
    "      level: diagnostic.level,",
    "      code: diagnostic.code,",
    "      message: diagnostic.message,",
    "      context: diagnostic.context",
    "    }))",
    "",
    "    lastDiagnostics.forEach(diagnostic => logDiagnostic('ucs', diagnostic))",
    "",
    "    snapshot.sharedComponents.forEach(component => {",
    "      sharedComponentCache.set(component.id, clonePayload(component))",
    "    })",
    "",
    "    return clonePayload(snapshot) as unknown as GeneratedSiteSnapshot",
    "  },",
    "  async resolvePageBySlug(slugSegments, _context) {",
    "    const config = getRuntimeConfig()",
    "    if (!config.websiteId) {",
    "      throw new Error('Head runtime configuration is missing a websiteId; re-run the generator with --website-id')",
    "    }",
    "",
    "    const requestedSlug = sanitizeSlug(slugSegments)",
    "    const canonicalSlug = canonicalizeSlug(requestedSlug)",
    "",
    "    const prisma = getPrismaClient()",
    "",
    "    const result = await resolveUcsPageBySlug({",
    "      prisma,",
    "      websiteId: config.websiteId,",
    "      slug: canonicalSlug,",
    "      originalSlug: requestedSlug,",
    "      sharedComponentCache",
    "    })",
    "",
    "    const mappedDiagnostics: GeneratedProviderDiagnostic[] = result.diagnostics.map(diagnostic => ({",
    "      level: diagnostic.level,",
    "      code: diagnostic.code,",
    "      message: diagnostic.message,",
    "      context: diagnostic.context",
    "    }))",
    "",
    "    runtimeDiagnostics = mappedDiagnostics",
    "",
    "    mappedDiagnostics.forEach(diagnostic => logDiagnostic('ucs', diagnostic))",
    "",
    "    if (!result.payload) {",
    "      return null",
    "    }",
    "",
    "    return clonePayload(result.payload) as unknown as GeneratedPagePayload",
    "  },",
    "  async preloadSharedComponents(ids) {",
    "    const config = getRuntimeConfig()",
    "    if (!config.websiteId || ids.length === 0) {",
    "      return {}",
    "    }",
    "",
    "    const prisma = getPrismaClient()",
    "",
    "    const components = await loadSharedComponentsById(",
    "      prisma,",
    "      config.websiteId,",
    "      ids,",
    "      sharedComponentCache",
    "    )",
    "",
    "    const result: Record<string, GeneratedPagePayload['sharedComponents'][number]> = {}",
    "    components.forEach(component => {",
    "      result[component.id] = clonePayload(component) as unknown as GeneratedPagePayload['sharedComponents'][number]",
    "    })",
    "",
    "    return result",
    "  },",
    "  async resolveRedirectByPath(path, context) {",
    "    const config = getRuntimeConfig()",
    "    if (!config.websiteId) {",
    "      return null",
    "    }",
    "",
    "    const prisma = getPrismaClient()",
    "",
    "    // Normalize the path for lookup",
    "    const normalizedPath = path.toLowerCase().replace(/^\\/+|\\/+$/g, '')",
    "",
    "    try {",
    "      const redirect = await prisma.redirect.findFirst({",
    "        where: {",
    "          websiteId: config.websiteId,",
    "          isActive: true,",
    "          sourcePath: {",
    "            in: [",
    "              normalizedPath,",
    "              `/${normalizedPath}`,",
    "              normalizedPath === '' ? '/' : normalizedPath",
    "            ]",
    "          }",
    "        }",
    "      })",
    "",
    "      if (!redirect) {",
    "        return null",
    "      }",
    "",
    "      return {",
    "        id: redirect.id,",
    "        sourcePath: redirect.sourcePath,",
    "        targetPath: redirect.targetPath,",
    "        redirectType: redirect.redirectType,",
    "        isActive: redirect.isActive,",
    "        isExternal: redirect.isExternal,",
    "        showInNav: redirect.showInNav,",
    "        navLabel: redirect.navLabel ?? undefined,",
    "        openInNewTab: redirect.openInNewTab",
    "      }",
    "    } catch (error) {",
    "      const diagnostic: GeneratedProviderDiagnostic = {",
    "        level: 'error',",
    "        code: 'UCS_REDIRECT_RESOLUTION_ERROR',",
    "        message: 'Failed to resolve redirect',",
    "        context: {",
    "          path,",
    "          normalizedPath,",
    "          error: error instanceof Error ? error.message : String(error)",
    "        }",
    "      }",
    "      logDiagnostic('ucs', diagnostic)",
    "      runtimeDiagnostics.push(diagnostic)",
    "      return null",
    "    }",
    "  },",
    "  async getDiagnostics() {",
    "    return [...lastDiagnostics, ...runtimeDiagnostics]",
    "  }",
    "}",
    ""
  ].join('\n')
}

export function buildGraphqlProviderModule(): string {
  const websiteQuery = [
    'query WebsiteSnapshot($websiteId: ID!) {',
    '  website(id: $websiteId) {',
    '    id',
    '    name',
    '    description',
    '    metadata',
    '    settings',
    '  }',
    '  designSystems(websiteId: $websiteId) {',
    '    id',
    '    designConceptId',
    '    conceptName',
    '    tokens',
    '    isCurrent',
    '  }',
    '}'
  ].join('\n')

  const pageQuery = [
    'query PageBySlug($websiteId: ID!, $slug: String!) {',
    '  page(websiteId: $websiteId, slug: $slug) {',
    '    id',
    '    title',
    '    fullPath',
    '    templateKey',
    '    templateProps',
    '    regions {',
    '      region',
    '      componentTypes',
    '    }',
    '    components {',
    '      id',
    '      type',
    '      componentType',
    '      componentTypeId',
    '      parentId',
    '      position',
    '      props',
    '      content',
    '      styles',
    '      metadata',
    '      sharedComponentId',
    '      globalComponentId',
    '      effectiveProps',
    '      hasOverrides',
    '      isSharedInstance',
    '    }',
    '    metadata',
    '    sharedComponentIds',
    '    sharedComponents {',
    '      id',
    '      name',
    '      componentType',
    '      componentTypeId',
    '      content',
    '      config',
    '    }',
    '    diagnostics {',
    '      code',
    '      level',
    '      message',
    '      context',
    '    }',
    '    structure {',
    '      current {',
    '        id',
    '        websitePageId',
    '        parentId',
    '        slug',
    '        fullPath',
    '        position',
    '        isFolder',
    '        title',
    '      }',
    '      ancestors {',
    '        id',
    '        websitePageId',
    '        parentId',
    '        slug',
    '        fullPath',
    '        position',
    '        isFolder',
    '        title',
    '      }',
    '      children {',
    '        id',
    '        websitePageId',
    '        parentId',
    '        slug',
    '        fullPath',
    '        position',
    '        isFolder',
    '        title',
    '      }',
    '    }',
    '  }',
    '}'
  ].join('\n')

  const sharedComponentsQuery = [
    'query SharedComponents($websiteId: ID!) {',
    '  sharedComponents(websiteId: $websiteId) {',
    '    id',
    '    name',
    '    componentType',
    '    componentTypeId',
    '    content',
    '    config',
    '  }',
    '}'
  ].join('\n')

  const redirectQuery = [
    'query RedirectByPath($websiteId: ID!, $sourcePath: String!) {',
    '  redirect(websiteId: $websiteId, sourcePath: $sourcePath) {',
    '    id',
    '    sourcePath',
    '    targetPath',
    '    redirectType',
    '    isActive',
    '    isExternal',
    '    showInNav',
    '    navLabel',
    '    openInNewTab',
    '  }',
    '}'
  ].join('\n')

  return `import type { GeneratedHeadDataProvider, GeneratedPagePayload, GeneratedProviderDiagnostic, GeneratedProviderRequestContext, GeneratedSiteSnapshot, GeneratedSnapshotSharedComponent, GeneratedSnapshotStructureNode } from './types'
import { getRuntimeConfig } from '@/generated/runtime/config'

type DiagnosticLevel = GeneratedProviderDiagnostic['level']
type SlugSegments = readonly string[]

interface GraphqlRequestInit<TVariables extends Record<string, unknown>> {
  query: string
  variables?: TVariables
  operationName?: string
  apiKey: string
}

interface GraphqlResponse<T> {
  data?: T
  errors?: Array<{ message: string }>
}

interface GraphqlClientOptions {
  endpoint: string
  timeoutMs: number
  maxRetries: number
}

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
    regions: Array<{ region: string; componentTypes: string[] }>
    components: Array<Record<string, unknown>>
    metadata: Record<string, unknown>
    sharedComponentIds?: string[]
    sharedComponents: GeneratedSnapshotSharedComponent[]
    diagnostics: GeneratedProviderDiagnostic[]
    structure: {
      current: GraphqlStructureNode | null
      ancestors: GraphqlStructureNode[]
      children: GraphqlStructureNode[]
    } | null
  } | null
}

interface SharedComponentListQuery {
  sharedComponents: GeneratedSnapshotSharedComponent[]
}

interface RedirectQueryResult {
  redirect: {
    id: string
    sourcePath: string
    targetPath: string
    redirectType: number
    isActive: boolean
    isExternal: boolean
    showInNav: boolean
    navLabel?: string | null
    openInNewTab: boolean
  } | null
}

const WEBSITE_QUERY = /* GraphQL */ \`${websiteQuery}\`
const PAGE_QUERY = /* GraphQL */ \`${pageQuery}\`
const SHARED_COMPONENTS_QUERY = /* GraphQL */ \`${sharedComponentsQuery}\`
const REDIRECT_QUERY = /* GraphQL */ \`${redirectQuery}\`

class GraphqlRequestError extends Error {
  constructor(
    message: string,
    public readonly options: {
      status?: number
      operationName?: string
      rateLimited?: boolean
      attempt: number
      retryAfterMs?: number
      timeoutMs?: number
      cause?: unknown
    }
  ) {
    super(message)
    this.name = 'GraphqlRequestError'
  }
}

class GraphqlClient {
  private readonly endpoint: string
  private readonly timeoutMs: number
  private readonly maxRetries: number

  constructor(options: GraphqlClientOptions) {
    this.endpoint = options.endpoint
    this.timeoutMs = options.timeoutMs
    this.maxRetries = options.maxRetries
  }

  async request<TResponse, TVariables extends Record<string, unknown> = Record<string, unknown>>(
    init: GraphqlRequestInit<TVariables>
  ): Promise<TResponse> {
    const operationName = resolveOperationName(init.query, init.operationName)

    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs)
        const response = await fetch(this.endpoint, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            accept: 'application/json',
            'x-ucs-api-key': init.apiKey
          },
          body: JSON.stringify({
            query: init.query,
            variables: init.variables ?? {},
            operationName: init.operationName
          }),
          signal: controller.signal
        })
        clearTimeout(timeoutId)

        const isOk = typeof response.ok === 'boolean' ? response.ok : response.status >= 200 && response.status < 300

        if (response.status === 429) {
          const retryAfter = parseRetryAfter(response.headers.get('retry-after'))
          if (attempt < this.maxRetries) {
            await wait(retryAfter ?? computeBackoff(attempt))
            continue
          }
          throw new GraphqlRequestError('GraphQL request was rate limited', {
            status: response.status,
            operationName,
            rateLimited: true,
            attempt,
            retryAfterMs: retryAfter
          })
        }

        if (!isOk) {
          const bodyText = await response.text()
          throw new GraphqlRequestError('GraphQL request failed (' + response.status + '): ' + bodyText, {
            status: response.status,
            operationName,
            attempt
          })
        }

        const payload = (await response.json()) as GraphqlResponse<TResponse>
        if (payload.errors?.length) {
          throw new GraphqlRequestError(payload.errors.map(error => error.message).join('; '), {
            status: response.status,
            operationName,
            attempt
          })
        }

        if (!payload.data) {
          throw new GraphqlRequestError('GraphQL response did not include data', {
            status: response.status,
            operationName,
            attempt
          })
        }

        return payload.data
      } catch (error) {
        const isAbortError = error instanceof Error && error.name === 'AbortError'
        if (isAbortError && attempt < this.maxRetries) {
          await wait(computeBackoff(attempt))
          continue
        }

        if (error instanceof GraphqlRequestError) {
          if (attempt >= this.maxRetries) {
            throw error
          }
          await wait(computeBackoff(attempt))
          continue
        }

        if (attempt >= this.maxRetries) {
          throw new GraphqlRequestError(error instanceof Error ? error.message : String(error), {
            operationName,
            attempt,
            cause: error
          })
        }

        await wait(computeBackoff(attempt))
      }
    }

    throw new Error('GraphQL request failed after maximum retries')
  }
}

function computeBackoff(attempt: number): number {
  const base = 250
  return Math.min(base * 2 ** attempt, 2000)
}

function parseRetryAfter(headerValue: string | null): number | undefined {
  if (!headerValue) {
    return undefined
  }
  const numeric = Number(headerValue)
  if (!Number.isNaN(numeric) && numeric >= 0) {
    return numeric * 1000
  }
  const dateMs = Date.parse(headerValue)
  if (!Number.isNaN(dateMs)) {
    return Math.max(0, dateMs - Date.now())
  }
  return undefined
}

function wait(ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, ms)
  })
}

function resolveOperationName(query: string, provided?: string): string {
  if (provided) {
    return provided
  }
  const match = /(?:query|mutation)\\s+([A-Za-z0-9_]+)/.exec(query)
  return match?.[1] ?? 'anonymous'
}

function parseNumberEnv(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10)
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed
  }
  return fallback
}

function readGraphqlConfig(): { endpoint: string; apiKey: string; timeoutMs: number; maxRetries: number } {
  const endpoint = process.env.HEAD_RUNTIME_GRAPHQL_ENDPOINT?.trim() || ''
  const apiKey = process.env.HEAD_RUNTIME_GRAPHQL_API_KEY?.trim() || ''
  const timeoutMs = parseNumberEnv(process.env.HEAD_RUNTIME_GRAPHQL_TIMEOUT_MS, 5000)
  const maxRetries = parseNumberEnv(process.env.HEAD_RUNTIME_GRAPHQL_MAX_RETRIES, 3)

  const missing: string[] = []
  if (!endpoint) {
    missing.push('HEAD_RUNTIME_GRAPHQL_ENDPOINT')
  }
  if (!apiKey) {
    missing.push('HEAD_RUNTIME_GRAPHQL_API_KEY')
  }

  if (missing.length > 0) {
    const provider = process.env.HEAD_RUNTIME_PROVIDER || 'unknown'
    const suffix = missing.length === 2 ? ' and ' + missing[1] : ''
    throw new Error(
      'GraphQL runtime is not configured: set ' +
        missing[0] +
        suffix +
        ' when HEAD_RUNTIME_PROVIDER=graphql (current provider=' +
        provider +
        ').'
    )
  }

  return { endpoint, apiKey, timeoutMs, maxRetries }
}

function clonePayload<T>(payload: T): T {
  return JSON.parse(JSON.stringify(payload)) as T
}

function sanitizeSlug(slug: SlugSegments): string[] {
  return Array.from(slug).filter((segment): segment is string => typeof segment === 'string').map(segment => segment.trim()).filter(segment => segment.length > 0)
}

function canonicalizeSlug(slug: SlugSegments): string[] {
  return sanitizeSlug(slug).map(segment => segment.toLowerCase())
}

function toSlugKey(slug: SlugSegments): string {
  const canonical = canonicalizeSlug(slug)
  if (canonical.length === 0) {
    return '__root__'
  }
  return canonical.join('/')
}

function slugSegmentsToPath(segments: SlugSegments): string {
  if (segments.length === 0) {
    return '/'
  }
  return '/' + segments.join('/')
}

function pathToSegments(path: string): string[] {
  const trimmed = path.replace(/^\\/+|\\/+$/g, '')
  if (!trimmed) {
    return []
  }
  return trimmed.split('/').filter(Boolean)
}

function logDiagnostic(provider: string, diagnostic: GeneratedProviderDiagnostic): void {
  if (!diagnostic || typeof diagnostic !== 'object') {
    console.error('head-runtime:diagnostic', { provider, code: 'UNKNOWN_DIAGNOSTIC', message: 'Received malformed diagnostic from provider' })
    return
  }

  const level: DiagnosticLevel = diagnostic.level ?? 'error'
  const payload = {
    provider,
    code: diagnostic.code ?? 'UNKNOWN_DIAGNOSTIC',
    message: diagnostic.message ?? 'Provider reported an unknown issue',
    context: diagnostic.context
  }
  if (level === 'error') {
    console.error('head-runtime:diagnostic', payload)
    return
  }
  if (level === 'warn') {
    console.warn('head-runtime:diagnostic', payload)
    return
  }
  console.info('head-runtime:diagnostic', payload)
}

const ORIGIN_KEYS = ['siteOrigin', 'origin', 'canonicalUrl', 'siteUrl', 'homeUrl', 'homepage', 'url']

function extractSiteOrigin(source: unknown): string | undefined {
  if (!source || typeof source !== 'object') {
    return undefined
  }
  const record = source as Record<string, unknown>
  for (const key of ORIGIN_KEYS) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) {
      try {
        const url = new URL(value.startsWith('http') ? value : 'https://' + value)
        return url.origin
      } catch {
        continue
      }
    }
  }
  return undefined
}

function toStructureNode(node: GraphqlStructureNode | null | undefined): GeneratedSnapshotStructureNode | null {
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

function pickDesignSystem(entries: WebsiteQueryResult['designSystems']): GeneratedSiteSnapshot['designSystem'] {
  if (!entries.length) {
    return null
  }
  const selected = entries.find(entry => entry.isCurrent) ?? entries[0]
  if (!selected) {
    return null
  }
  return {
    tokens: clonePayload(selected.tokens),
    conceptId: selected.designConceptId ?? undefined,
    conceptName: selected.conceptName ?? undefined
  }
}

let lastDiagnostics: GeneratedProviderDiagnostic[] = []
let runtimeDiagnostics: GeneratedProviderDiagnostic[] = []
const slugCache = new Map<string, GeneratedPagePayload | null>()
const sharedComponentCache = new Map<string, GeneratedSnapshotSharedComponent>()

async function requestWithDiagnostics(
  client: GraphqlClient,
  apiKey: string,
  params: { query: string; variables?: Record<string, unknown>; operationName: string }
): Promise<any | null> {
  try {
    return await client.request<any>({
      query: params.query,
      variables: params.variables,
      operationName: params.operationName,
      apiKey
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const graphqlError = error as GraphqlRequestError
    const isRateLimited = graphqlError?.options?.rateLimited || graphqlError?.options?.status === 429
    runtimeDiagnostics.push({
      code: isRateLimited ? 'GRAPHQL_RATE_LIMITED' : 'GRAPHQL_REQUEST_FAILED',
      level: isRateLimited ? 'warn' : 'error',
      message: isRateLimited ? 'GraphQL request was rate limited' : message,
      context: {
        operationName: graphqlError?.options?.operationName ?? params.operationName,
        status: graphqlError?.options?.status,
        attempt: graphqlError?.options?.attempt,
        retryAfterMs: graphqlError?.options?.retryAfterMs,
        timeoutMs: graphqlError?.options?.timeoutMs
      }
    })
    return null
  }
}

async function fetchWebsiteSnapshot(client: GraphqlClient, apiKey: string, websiteId: string) {
  const data = await requestWithDiagnostics(client, apiKey, {
    query: WEBSITE_QUERY,
    variables: { websiteId },
    operationName: 'WebsiteSnapshot'
  }) as WebsiteQueryResult | null

  if (!data?.website) {
    runtimeDiagnostics.push({
      code: 'GRAPHQL_WEBSITE_NOT_FOUND',
      level: 'error',
      message: 'Website ' + websiteId + ' was not found via GraphQL',
      context: { websiteId }
    })
    return null
  }

  return data
}

async function fetchPagePayload(
  client: GraphqlClient,
  apiKey: string,
  websiteId: string,
  slugSegments: SlugSegments
) {
  const slugPath = slugSegmentsToPath(slugSegments)
  const data = await requestWithDiagnostics(client, apiKey, {
    query: PAGE_QUERY,
    variables: { websiteId, slug: slugPath },
    operationName: 'PageBySlug'
  }) as PageQueryResult | null

  if (!data) {
    return null
  }

  if (!data.page) {
    runtimeDiagnostics.push({
      code: 'GRAPHQL_PAGE_NOT_FOUND',
      level: 'warn',
      message: 'GraphQL page query returned null for slug ' + slugPath,
      context: { slug: slugPath }
    })
    return null
  }

  const page: GeneratedPagePayload['page'] = {
    id: data.page.id,
    title: data.page.title,
    fullPath: data.page.fullPath ?? slugPath,
    templateKey: data.page.templateKey,
    templateProps: data.page.templateProps ?? {},
    regions: (data.page.regions ?? []).map(entry => ({
      region: entry.region,
      componentTypes: entry.componentTypes
    })),
    components: (data.page.components ?? []) as GeneratedPagePayload['page']['components'],
    metadata: data.page.metadata ?? {},
    sharedComponentIds: data.page.sharedComponentIds ?? undefined
  }

  const structure = data.page.structure
    ? {
        current: toStructureNode(data.page.structure.current),
        ancestors: data.page.structure.ancestors
          .map(node => toStructureNode(node))
          .filter((node): node is GeneratedSnapshotStructureNode => Boolean(node)),
        children: data.page.structure.children
          .map(node => toStructureNode(node))
          .filter((node): node is GeneratedSnapshotStructureNode => Boolean(node))
      }
    : undefined

  return {
    page,
    structure,
    sharedComponents: (data.page.sharedComponents ?? []).map(component => clonePayload(component)),
    diagnostics: data.page.diagnostics ?? []
  } as GeneratedPagePayload
}

export const graphqlProvider: GeneratedHeadDataProvider = {
  name: 'graphql',
  supportsLiveData: true,
  async fetchSiteSnapshot() {
    const config = getRuntimeConfig()
    if (!config.websiteId) {
      throw new Error(
        'Head runtime configuration is missing a websiteId; set HEAD_RUNTIME_WEBSITE_ID or re-run the generator with --website-id'
      )
    }

    const graphqlConfig = readGraphqlConfig()
    const client = new GraphqlClient(graphqlConfig)

    runtimeDiagnostics = []
    lastDiagnostics = []
    slugCache.clear()
    sharedComponentCache.clear()

    const websiteData = await fetchWebsiteSnapshot(client, graphqlConfig.apiKey, config.websiteId)
    const structureMap = new Map<string, GeneratedSnapshotStructureNode>()
    const pages: GeneratedSiteSnapshot['pages'] = []
    const pageDiagnostics: GeneratedProviderDiagnostic[] = []
    let assetOrigin: string | undefined =
      extractSiteOrigin(websiteData?.website?.metadata) || extractSiteOrigin(websiteData?.website?.settings)

    if (websiteData) {
      const slugQueue: SlugSegments[] = [[]]
      const visited = new Set<string>()

      while (slugQueue.length > 0) {
        const slug = slugQueue.shift() ?? []
        const slugKey = toSlugKey(slug)
        if (visited.has(slugKey)) {
          continue
        }
        visited.add(slugKey)

        const payload = await fetchPagePayload(client, graphqlConfig.apiKey, config.websiteId, slug)
        if (!payload) {
          continue
        }

        slugCache.set(slugKey, clonePayload(payload))

        if (payload.page && !payload.page.metadata?.isFolder) {
          pages.push(clonePayload({ ...payload.page, templateKey: config.templateOverrideKey ?? payload.page.templateKey }))
        }

        payload.sharedComponents.forEach(component => {
          sharedComponentCache.set(component.id, clonePayload(component))
        })

        if (payload.structure) {
          const currentNode = toStructureNode(payload.structure.current)
          if (currentNode) {
            structureMap.set(currentNode.id, currentNode)
          }
          payload.structure.ancestors.forEach(node => {
            const snapshotNode = toStructureNode(node)
            if (snapshotNode) {
              structureMap.set(snapshotNode.id, snapshotNode)
            }
          })
          payload.structure.children.forEach(node => {
            const snapshotNode = toStructureNode(node)
            if (snapshotNode) {
              structureMap.set(snapshotNode.id, snapshotNode)
              const childSegments = pathToSegments(snapshotNode.fullPath)
              const childKey = toSlugKey(childSegments)
              if (!visited.has(childKey)) {
                slugQueue.push(childSegments)
              }
            }
          })
        }

        payload.diagnostics.forEach(diag => pageDiagnostics.push({ ...diag }))
        const originOverride = extractSiteOrigin(payload.page.metadata)
        if (originOverride) {
          assetOrigin = originOverride
        }
      }
    }

    const sharedComponents = sharedComponentCache.size > 0 ? Array.from(sharedComponentCache.values()) : []
    let resolvedSharedComponents = sharedComponents

    if (sharedComponents.length === 0) {
      const shared = (await requestWithDiagnostics<SharedComponentListQuery>(client, graphqlConfig.apiKey, {
        query: SHARED_COMPONENTS_QUERY,
        variables: { websiteId: config.websiteId },
        operationName: 'SharedComponents'
      })) as SharedComponentListQuery | null
      resolvedSharedComponents = shared?.sharedComponents ? shared.sharedComponents.map(component => clonePayload(component)) : []
      resolvedSharedComponents.forEach(component => sharedComponentCache.set(component.id, clonePayload(component)))
    }

    const snapshot: GeneratedSiteSnapshot = {
      site: {
        id: websiteData?.website?.id ?? config.websiteId,
        name: websiteData?.website?.name ?? 'Untitled Website',
        description: websiteData?.website?.description ?? undefined,
        origin: assetOrigin
      },
      pages,
      structure: Array.from(structureMap.values()),
      sharedComponents: resolvedSharedComponents,
      capturedAt: new Date().toISOString(),
      designSystem: websiteData ? pickDesignSystem(websiteData.designSystems) : null
    }

    lastDiagnostics = [...runtimeDiagnostics, ...pageDiagnostics]
    lastDiagnostics.forEach(diagnostic => logDiagnostic('graphql', diagnostic))

    return snapshot
  },
  async resolvePageBySlug(slugSegments, _context: GeneratedProviderRequestContext) {
    const config = getRuntimeConfig()
    if (!config.websiteId) {
      throw new Error(
        'Head runtime configuration is missing a websiteId; set HEAD_RUNTIME_WEBSITE_ID or re-run the generator with --website-id'
      )
    }

    const graphqlConfig = readGraphqlConfig()
    const client = new GraphqlClient(graphqlConfig)
    const requestedSlug = sanitizeSlug(slugSegments)
    const slugKey = toSlugKey(requestedSlug)
    const canonicalSlug = canonicalizeSlug(requestedSlug)

    if (slugCache.has(slugKey)) {
      const cached = slugCache.get(slugKey)
      return cached ? clonePayload(cached) : null
    }

    const payload = await fetchPagePayload(client, graphqlConfig.apiKey, config.websiteId, canonicalSlug)
    if (!payload) {
      slugCache.set(slugKey, null)
      return null
    }

    const normalizedPayload: GeneratedPagePayload = {
      ...payload,
      page: {
        ...payload.page,
        templateKey: config.templateOverrideKey ?? payload.page.templateKey
      }
    }

    slugCache.set(slugKey, clonePayload(normalizedPayload))
    return clonePayload(normalizedPayload)
  },
  async preloadSharedComponents(ids) {
    const config = getRuntimeConfig()
    if (!config.websiteId || ids.length === 0) {
      return {}
    }

    const graphqlConfig = readGraphqlConfig()
    const client = new GraphqlClient(graphqlConfig)
    const uniqueIds = Array.from(new Set(ids.filter(Boolean))).filter(id => !sharedComponentCache.has(id))

    if (uniqueIds.length > 0) {
      const response = await requestWithDiagnostics<SharedComponentListQuery>(client, graphqlConfig.apiKey, {
        query: SHARED_COMPONENTS_QUERY,
        variables: { websiteId: config.websiteId },
        operationName: 'SharedComponents'
      })

      response?.sharedComponents?.forEach(component => {
        sharedComponentCache.set(component.id, clonePayload(component))
      })
    }

    const result: Record<string, GeneratedPagePayload['sharedComponents'][number]> = {}
    ids.forEach(id => {
      const component = sharedComponentCache.get(id)
      if (component) {
        result[id] = clonePayload(component) as unknown as GeneratedPagePayload['sharedComponents'][number]
      }
    })

    return result
  },
  async resolveRedirectByPath(path: string, _context: GeneratedProviderRequestContext) {
    const config = getRuntimeConfig()
    if (!config.websiteId) {
      return null
    }

    const graphqlConfig = readGraphqlConfig()
    const client = new GraphqlClient(graphqlConfig)

    // Normalize the path for lookup
    const normalizedPath = path.toLowerCase().replace(/^\\/+|\\/+$/g, '')
    const pathVariants = [
      normalizedPath,
      \`/\${normalizedPath}\`,
      normalizedPath === '' ? '/' : normalizedPath
    ]

    for (const sourcePath of pathVariants) {
      try {
        const data = await requestWithDiagnostics(client, graphqlConfig.apiKey, {
          query: REDIRECT_QUERY,
          variables: { websiteId: config.websiteId, sourcePath },
          operationName: 'RedirectByPath'
        }) as RedirectQueryResult | null

        if (data?.redirect && data.redirect.isActive) {
          return {
            id: data.redirect.id,
            sourcePath: data.redirect.sourcePath,
            targetPath: data.redirect.targetPath,
            redirectType: data.redirect.redirectType,
            isActive: data.redirect.isActive,
            isExternal: data.redirect.isExternal,
            showInNav: data.redirect.showInNav,
            navLabel: data.redirect.navLabel ?? undefined,
            openInNewTab: data.redirect.openInNewTab
          }
        }
      } catch (error) {
        const diagnostic: GeneratedProviderDiagnostic = {
          level: 'error',
          code: 'GRAPHQL_REDIRECT_RESOLUTION_ERROR',
          message: 'Failed to resolve redirect',
          context: {
            path,
            normalizedPath,
            error: error instanceof Error ? error.message : String(error)
          }
        }
        logDiagnostic('graphql', diagnostic)
        runtimeDiagnostics.push(diagnostic)
      }
    }

    return null
  },
  async getDiagnostics() {
    return [...lastDiagnostics, ...runtimeDiagnostics]
  }
}
`
}

export function buildProvidersIndexModule(
  provider: ProviderKind,
  options: { includeGraphql?: boolean; includeOptimizely?: boolean; includeUmbracoCompose?: boolean; defaultRuntimeProvider?: 'static' | 'ucs' | 'graphql' | 'optimizely' | 'umbraco-compose' }
): string {
  const includeGraphql = Boolean(options?.includeGraphql)
  const includeOptimizely = Boolean(options?.includeOptimizely)
  const includeUmbracoCompose = Boolean(options?.includeUmbracoCompose)
  const defaultProvider = options?.defaultRuntimeProvider ?? (
    provider === 'ucs' ? 'ucs' :
    provider === 'optimizely' ? 'optimizely' :
    provider === 'umbraco-compose' ? 'umbraco-compose' :
    'static'
  )
  const providerUnionParts = ["'static'", "'ucs'"]
  if (includeGraphql) providerUnionParts.push("'graphql'")
  if (includeOptimizely) providerUnionParts.push("'optimizely'")
  if (includeUmbracoCompose) providerUnionParts.push("'umbraco-compose'")
  const providerUnion = providerUnionParts.join(' | ')
  const providerKeys = ["  static: staticProvider,"]
  if (includeGraphql) {
    providerKeys.push("  graphql: graphqlProvider,")
  }
  if (includeOptimizely) {
    providerKeys.push("  optimizely: optimizelyProvider,")
  }
  if (includeUmbracoCompose) {
    providerKeys.push("  'umbraco-compose': umbracoComposeProvider,")
  }
  providerKeys.push("  ucs: ucsProvider")

  return [
    "import type { GeneratedHeadDataProvider } from './types'",
    "import { staticProvider } from './static-provider'",
    ...(includeGraphql ? ["import { graphqlProvider } from './graphql-provider'"] : []),
    ...(includeOptimizely ? ["import { optimizelyProvider } from './optimizely-provider'"] : []),
    ...(includeUmbracoCompose ? ["import { umbracoComposeProvider } from './umbraco-compose-provider'"] : []),
    "import { ucsProvider } from './ucs-provider'",
    '',
    `type RuntimeProviderKey = ${providerUnion}`,
    '',
    'const registry: Record<RuntimeProviderKey, GeneratedHeadDataProvider> = {',
    ...providerKeys,
    '}',
    '',
    `const defaultProviderKey: RuntimeProviderKey = '${defaultProvider}'`,
    '',
    "function normalizeProviderKey(key?: string | null): RuntimeProviderKey {",
    "  const normalized = (key ?? '').trim().toLowerCase()",
    "  if (normalized && normalized in registry) {",
    '    return normalized as RuntimeProviderKey',
    '  }',
    "  if (normalized) {",
    "    console.warn('head-runtime:provider-unknown', { requested: normalized, available: Object.keys(registry) })",
    '  }',
    '  return defaultProviderKey',
    '}',
    '',
    'const envProviderKey = normalizeProviderKey(process.env.HEAD_RUNTIME_PROVIDER)',
    '',
    'export function getActiveProvider(key?: string): GeneratedHeadDataProvider {',
    '  const providerKey = key ? normalizeProviderKey(key) : envProviderKey',
    '  return registry[providerKey] ?? registry[defaultProviderKey]',
    '}',
    '',
    'export const activeProvider = getActiveProvider()',
    'export const providerRegistry = registry',
    'export const supportedProviderKeys = Object.keys(registry)',
    ''
  ].join('\n')
}

export function buildProvidersReadme(options: {
  includeGraphql: boolean
  defaultRuntimeProvider: 'static' | 'ucs' | 'graphql'
}): string {
  const bullets = [
    '- static: uses the embedded snapshot shipped in generated/data; no network or database required.',
    options.includeGraphql
      ? '- graphql: uses the UCS GraphQL read API (requires HEAD_RUNTIME_GRAPHQL_ENDPOINT and HEAD_RUNTIME_GRAPHQL_API_KEY).'
      : null,
    '- ucs: Prisma-backed runtime for live UCS data (requires DATABASE_URL, optional DIRECT_URL).'
  ].filter(Boolean) as string[]

  return [
    '# Generated Providers',
    '',
    `HEAD_RUNTIME_PROVIDER selects the runtime provider (default: ${options.defaultRuntimeProvider}).`,
    '',
    'Supported providers:',
    ...bullets,
    '',
    'Update .env/.env.local to switch providers; no regeneration is required.',
    'The provider contract lives in generated/providers/types.ts. Providers should return the full site snapshot and any diagnostics they want surfaced.'
  ].join('\n')
}

export function buildEnvLocalFile(context: {
  provider: ProviderKind
  websiteId: string
  templateOverrideKey?: string | null
  defaultRuntimeProvider: 'static' | 'ucs' | 'graphql' | 'umbraco-compose'
  includeGraphqlRuntime?: boolean
  graphqlRuntime?: {
    endpoint?: string
    apiKey?: string
    timeoutMs?: number
    maxRetries?: number
  }
  /** S3 public base URL for media resolution at runtime */
  mediaStoragePublicUrl?: string
  /** Database connection URL for UCS provider */
  databaseUrl?: string
  /** Direct database URL for migrations */
  directUrl?: string
  /** Umbraco Compose configuration */
  umbracoCompose?: {
    projectAlias?: string
    region?: string
    environment?: string
    personalAccessToken?: string
  }
}): string {
  const lines: string[] = [
    '# Generated by the Catalyst head generator.',
    '# Update these values with real secrets before running the app.',
    ''
  ]

  lines.push(
    '# Runtime selection: graphql | static | ucs | umbraco-compose. Default is baked in from generation time.',
    `HEAD_RUNTIME_PROVIDER=${context.defaultRuntimeProvider}`,
    ''
  )

  // Umbraco Compose configuration
  if (context.umbracoCompose || context.defaultRuntimeProvider === 'umbraco-compose') {
    const uc = context.umbracoCompose ?? {}
    lines.push(
      '# Umbraco Compose runtime (HEAD_RUNTIME_PROVIDER=umbraco-compose)',
      `UMBRACO_PROJECT_ALIAS=${uc.projectAlias ?? ''}`,
      `UMBRACO_REGION=${uc.region ?? ''}`,
      `UMBRACO_ENVIRONMENT=${uc.environment ?? 'production'}`,
      `UMBRACO_PAT=${uc.personalAccessToken ?? ''}`,
      `# UMBRACO_GRAPHQL_ENDPOINT= # Optional: Override computed endpoint`,
      ''
    )
  }

  if (context.includeGraphqlRuntime) {
    const endpoint = context.graphqlRuntime?.endpoint ?? ''
    const apiKey = context.graphqlRuntime?.apiKey ?? ''
    const timeoutMs = context.graphqlRuntime?.timeoutMs
    const maxRetries = context.graphqlRuntime?.maxRetries
    lines.push(
      '# GraphQL runtime (HEAD_RUNTIME_PROVIDER=graphql) - no database required.',
      `HEAD_RUNTIME_GRAPHQL_ENDPOINT=${endpoint}`,
      `HEAD_RUNTIME_GRAPHQL_API_KEY=${apiKey}`,
      timeoutMs ? `HEAD_RUNTIME_GRAPHQL_TIMEOUT_MS=${timeoutMs}` : '# HEAD_RUNTIME_GRAPHQL_TIMEOUT_MS=5000',
      typeof maxRetries === 'number' ? `HEAD_RUNTIME_GRAPHQL_MAX_RETRIES=${maxRetries}` : '# HEAD_RUNTIME_GRAPHQL_MAX_RETRIES=3',
      ''
    )
  }

  if (context.defaultRuntimeProvider === 'ucs') {
    // For UCS provider, include database URLs (from context or require user to fill)
    const dbUrl = context.databaseUrl ?? ''
    const directDbUrl = context.directUrl ?? ''
    lines.push(
      '# Required when HEAD_RUNTIME_PROVIDER=ucs: Postgres connection string used by Prisma.',
      `DATABASE_URL="${dbUrl}"`,
      '',
      '# Optional: direct connection string for migrations or read replicas.',
      `DIRECT_URL="${directDbUrl}"`,
      ''
    )
  } else {
    lines.push(
      '# Optional: Provide DATABASE_URL/DIRECT_URL if you switch to the Prisma runtime (HEAD_RUNTIME_PROVIDER=ucs).',
      'DATABASE_URL=',
      '# DIRECT_URL=',
      ''
    )
  }

  lines.push(
    '# Override the baked-in runtime defaults only if needed.',
    `HEAD_RUNTIME_WEBSITE_ID=${context.websiteId}`
  )

  if (context.templateOverrideKey) {
    lines.push(`HEAD_RUNTIME_TEMPLATE_OVERRIDE_KEY=${context.templateOverrideKey}`)
  } else {
    lines.push('# HEAD_RUNTIME_TEMPLATE_OVERRIDE_KEY=')
  }

  lines.push('HEAD_RUNTIME_CACHE_TTL_SECONDS=30')

  // Media storage configuration for runtime media resolution
  if (context.mediaStoragePublicUrl) {
    // Decode URL-encoded spaces - dotenvx may encode %20, but vercel-env-push needs raw spaces
    const decodedUrl = decodeURIComponent(context.mediaStoragePublicUrl)
    lines.push(
      `STUDIO_MEDIA_STORAGE_S3_PUBLIC_BASE_URL="${decodedUrl}"`
    )
  } else {
    lines.push(
      '# STUDIO_MEDIA_STORAGE_S3_PUBLIC_BASE_URL=  # Set this to enable media resolution at runtime'
    )
  }

  lines.push('')

  return lines.join('\n')
}


/**
 * Builds the Optimizely GraphQL client module.
 */
export function buildOptimizelyClientModule(): string {
  return `// Optimizely Content Graph client
import { getOptimizelyConfig } from '@/generated/runtime/config'

export interface OptimizelyMetadata {
  key: string
  displayName?: string
  types?: string[]
  url?: { default?: string }
  locale?: string
  locales?: string[]
  status?: string
}

export interface OptimizelyComponent {
  __typename?: string
  _metadata?: OptimizelyMetadata
  _json?: Record<string, unknown>
  [key: string]: unknown
}

export interface OptimizelyContent {
  __typename?: string
  _metadata: OptimizelyMetadata
  _json?: Record<string, unknown>
  components?: OptimizelyComponent[]
  [key: string]: unknown
}

interface OptimizelyGraphResponse {
  data?: {
    content?: {
      items?: OptimizelyContent[]
      item?: OptimizelyContent
    }
  }
  errors?: Array<{ message: string; locations?: unknown[]; path?: string[] }>
}

class OptimizelyClient {
  private endpoint: string
  private singleKey: string
  private defaultLocale: string
  private discoveredPageTypes: Set<string> = new Set()
  // In-flight request map to deduplicate parallel requests for the same path
  private inFlightRequests: Map<string, Promise<OptimizelyContent | null>> = new Map()

  constructor() {
    const config = getOptimizelyConfig()
    this.endpoint = config.gateway + '/content/v2'
    this.singleKey = config.singleKey
    this.defaultLocale = config.locale || 'en'
  }

  private async fetchGraphQL(query: string, variables: Record<string, unknown> = {}): Promise<OptimizelyGraphResponse> {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': \`epi-single \${this.singleKey}\`
      },
      body: JSON.stringify({ query, variables }),
      next: { revalidate: 60 }
    })

    if (!response.ok) {
      throw new Error(\`Optimizely GraphQL request failed: \${response.status} \${response.statusText}\`)
    }

    const result = await response.json() as OptimizelyGraphResponse
    return result
  }

  private buildContentQuery(pageTypeIds: string[], locale: string): string {
    const fragments = pageTypeIds.map(typeId => \`
      ... on \${typeId} {
        components {
          _metadata { key types displayName }
          _json
        }
      }
    \`).join('\\n')

    return \`
query GetContentByPath($path: [String!]!) {
  content: _Content(
    where: { _metadata: { url: { default: { in: $path } } } }
    locale: [\${locale}]
  ) {
    item {
      __typename
      _metadata { key displayName types url { default } locale status }
      _json
      \${fragments}
    }
  }
}
\`
  }

  private buildFallbackQuery(locale: string): string {
    return \`
query GetContentByPath($path: [String!]!) {
  content: _Content(
    where: { _metadata: { url: { default: { in: $path } } } }
    locale: [\${locale}]
  ) {
    item {
      __typename
      _metadata { key displayName types url { default } locale status }
      _json
    }
  }
}
\`
  }

  async getContentByPath(path: string): Promise<OptimizelyContent | null> {
    // Deduplicate parallel requests for the same path
    // This ensures type discovery completes before other parallel requests proceed
    const existingRequest = this.inFlightRequests.get(path)
    if (existingRequest) {
      return existingRequest
    }

    const requestPromise = this.fetchContentInternal(path)
    this.inFlightRequests.set(path, requestPromise)

    try {
      return await requestPromise
    } finally {
      this.inFlightRequests.delete(path)
    }
  }

  private async fetchContentInternal(path: string): Promise<OptimizelyContent | null> {
    const locale = this.defaultLocale
    // Use the simple query that fetches _json - it contains all component data
    // Type-specific fragments don't work because template types like 'template_marketing_home_default'
    // are metadata types, not valid GraphQL types in the Optimizely schema
    const query = this.buildFallbackQuery(locale)

    const result = await this.fetchGraphQL(query, { path: [path] })
    const content = result.data?.content?.item
    if (!content) return null

    return content
  }

  async getAllPages(): Promise<OptimizelyContent[]> {
    const locale = this.defaultLocale
    const allPages: OptimizelyContent[] = []
    let cursor: string | null = null
    const pageSize = 100

    // Phase 1: Discover all content with URLs to get page types
    const discoveryQuery = \`
query DiscoverAllContent($cursor: String, $limit: Int!) {
  content: _Content(
    locale: [\${locale}]
    limit: $limit
    cursor: $cursor
  ) {
    items {
      __typename
      _metadata { key displayName types url { default } locale status }
    }
    cursor
  }
}
\`

    // First pass: discover all page types
    let hasMore = true
    while (hasMore) {
      const result = await this.fetchGraphQL(discoveryQuery, { cursor, limit: pageSize })
      const items = result.data?.content?.items || []

      for (const item of items) {
        const concreteType = item._metadata?.types?.[0]
        if (concreteType) {
          this.discoveredPageTypes.add(concreteType)
        }
        // Only collect items that have URLs (actual pages)
        if (item._metadata?.url?.default) {
          allPages.push(item)
        }
      }

      cursor = (result.data?.content as { cursor?: string })?.cursor ?? null
      hasMore = cursor !== null && items.length === pageSize
    }

    // Phase 2: Re-fetch pages with full _json data
    // Note: We use _json which contains all component data - type-specific fragments don't work
    // because template types like 'template_marketing_home_default' are metadata, not GraphQL types
    if (allPages.length > 0) {
      const fullDataQuery = \`
query GetContentByPaths($paths: [String!]!) {
  content: _Content(
    where: { _metadata: { url: { default: { in: $paths } } } }
    locale: [\${locale}]
    limit: 100
  ) {
    items {
      __typename
      _metadata { key displayName types url { default } locale status }
      _json
    }
  }
}
\`

      // Batch fetch in groups of 50 paths
      const batchSize = 50
      const fullPages: OptimizelyContent[] = []

      for (let i = 0; i < allPages.length; i += batchSize) {
        const batch = allPages.slice(i, i + batchSize)
        const paths = batch.map(p => p._metadata.url?.default).filter(Boolean) as string[]

        if (paths.length > 0) {
          const result = await this.fetchGraphQL(fullDataQuery, { paths })
          const items = result.data?.content?.items || []
          fullPages.push(...items)
        }
      }

      return fullPages
    }

    return allPages
  }
}

let clientInstance: OptimizelyClient | null = null

export function getOptimizelyClient(): OptimizelyClient {
  if (!clientInstance) {
    clientInstance = new OptimizelyClient()
  }
  return clientInstance
}
`
}

/**
 * Builds the Optimizely mapper module.
 */
export function buildOptimizelyMapperModule(): string {
  return `// Optimizely response mapper
import type {
  GeneratedPagePayload,
  GeneratedSnapshotPage,
  GeneratedSnapshotPageMetadata,
  GeneratedProviderDiagnostic,
  GeneratedSnapshotSharedComponent
} from '../providers/types'
import type { OptimizelyContent, OptimizelyComponent } from './optimizely-client'
import type { ComponentInstance } from '@/lib/studio/types/site-builder/component-instance'

function extractPageMetadata(content: OptimizelyContent): GeneratedSnapshotPageMetadata {
  const metadata: GeneratedSnapshotPageMetadata = {}
  metadata.contentTypeId = content.__typename
  for (const [key, value] of Object.entries(content)) {
    if (key.startsWith('_') || key === '__typename') continue
    if (value === null || value === undefined) continue
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      metadata[key] = value
    }
  }
  return metadata
}

function parseJsonField(value: unknown, depth: number = 0): unknown {
  if (depth > 5) return value
  if (!value) return null
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed)
        return parseJsonFieldDeep(parsed, depth + 1)
      } catch { return value }
    }
    return value
  }
  if (typeof value === 'object' && value !== null) {
    return parseJsonFieldDeep(value, depth + 1)
  }
  return value
}

function parseJsonFieldDeep(obj: unknown, depth: number = 0): unknown {
  if (depth > 5) return obj
  if (!obj || typeof obj !== 'object') return obj
  if (Array.isArray(obj)) {
    return obj.map(item => parseJsonField(item, depth))
  }
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    result[key] = parseJsonField(value, depth)
  }
  return result
}

function transformLogo(logo: unknown): Record<string, unknown> | undefined {
  if (!logo || typeof logo !== 'object') return undefined
  const logoObj = logo as Record<string, unknown>
  const result: Record<string, unknown> = { alt: logoObj.alt || 'Logo', href: logoObj.href || '/' }
  if (logoObj.src && typeof logoObj.src === 'object') {
    const srcObj = logoObj.src as Record<string, unknown>
    result.src = srcObj.src || srcObj.originalUrl || srcObj.url
  } else if (typeof logoObj.src === 'string') {
    result.src = logoObj.src
  }
  return result
}

function transformContentForType(content: Record<string, unknown>, componentType: string): Record<string, unknown> {
  const transformed = { ...content }
  switch (componentType) {
    case 'navbar':
      if (transformed.logo) transformed.logo = transformLogo(transformed.logo)
      if (!Array.isArray(transformed.menuItems)) transformed.menuItems = []
      break
    case 'footer':
      if (transformed.logo) transformed.logo = transformLogo(transformed.logo)
      if (!Array.isArray(transformed.columns)) transformed.columns = []
      if (!Array.isArray(transformed.socialLinks)) transformed.socialLinks = []
      break
    case 'hero-with-image':
    case 'hero-carousel':
      if (!Array.isArray(transformed.slides)) transformed.slides = []
      break
    case 'card-grid':
      if (!Array.isArray(transformed.cards)) transformed.cards = []
      break
    case 'two-column':
      if (!Array.isArray(transformed.leftColumn)) transformed.leftColumn = []
      if (!Array.isArray(transformed.rightColumn)) transformed.rightColumn = []
      break
  }
  return transformed
}

function mapComponentType(optiType: string): string {
  const typeMap: Record<string, string> = {
    'navbar': 'navbar', 'footer': 'footer', 'card_grid': 'card-grid', 'two_column': 'two-column',
    'hero': 'hero-carousel', 'hero_carousel': 'hero-carousel', 'content_feed': 'content-feed',
    'hero_banner': 'hero-carousel', 'hero_split': 'hero-split', 'hero_minimal': 'hero-minimal',
    'card_item': 'card-grid'  // card_item should be rendered as part of card-grid
  }
  return typeMap[optiType] || optiType.replace(/_/g, '-')
}

function getComponentRegion(componentType: string): string {
  const regionMap: Record<string, string> = {
    'navbar': 'header', 'footer': 'footer', 'hero-carousel': 'hero', 'hero-video': 'hero',
    'hero-split': 'hero', 'hero-minimal': 'hero', 'hero-banner': 'hero'
  }
  return regionMap[componentType] || 'main'
}

function mapComponent(optiComp: OptimizelyComponent, index: number): ComponentInstance {
  const concreteType = optiComp._metadata?.types?.[0] || optiComp.__typename || 'unknown'
  const componentType = mapComponentType(concreteType)
  const region = getComponentRegion(componentType)

  let content: Record<string, unknown> = {}
  if (optiComp._json && typeof optiComp._json === 'object') {
    content = { ...optiComp._json }
    delete content._metadata
    delete content.__typename
    for (const [key, value] of Object.entries(content)) {
      if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
        content[key] = parseJsonField(value)
      }
    }
  }
  for (const [key, value] of Object.entries(optiComp)) {
    if (key.startsWith('_') || key === '__typename' || key === 'components') continue
    if (content[key] === undefined && value !== undefined) {
      content[key] = parseJsonField(value)
    }
  }
  content = transformContentForType(content, componentType)

  return {
    id: optiComp._metadata?.key || \`opti-comp-\${index}\`,
    type: componentType,
    componentType,
    componentTypeId: concreteType,
    region,
    position: index,
    parentId: null,
    props: { region },
    content,
    styles: {},
    metadata: {},
    config: { displayName: optiComp._metadata?.displayName || componentType },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
}

function mapToSnapshotPage(content: OptimizelyContent): GeneratedSnapshotPage {
  const metadata = content._metadata
  const components: ComponentInstance[] = []
  const sharedComponentIds: string[] = []

  // Components can be at content.components (if using type fragments) or content._json.components (if using _json only)
  const rawComponents = content.components ?? (content._json as { components?: OptimizelyComponent[] } | undefined)?.components
  if (rawComponents && Array.isArray(rawComponents)) {
    rawComponents.forEach((optiComp, index) => {
      components.push(mapComponent(optiComp, index))
      if (optiComp._metadata?.key) sharedComponentIds.push(optiComp._metadata.key)
    })
  }

  const regionTypes = new Map<string, Set<string>>()
  components.forEach(comp => {
    const types = regionTypes.get(comp.region) || new Set()
    types.add(comp.componentType)
    regionTypes.set(comp.region, types)
  })

  const regions = Array.from(regionTypes.entries()).map(([region, types]) => ({
    region: region as 'header' | 'hero' | 'main' | 'footer',
    componentTypes: Array.from(types)
  }))

  return {
    id: metadata.key || 'page-' + Date.now(),
    title: metadata.displayName || metadata.key || 'Untitled',
    fullPath: metadata.url?.default || '/',
    templateKey: content.__typename || null,
    templateProps: {},
    regions,
    components,
    metadata: extractPageMetadata(content),
    sharedComponentIds
  }
}

export function mapOptimizelyToPagePayload(
  content: OptimizelyContent,
  sharedComponentCache: Map<string, GeneratedSnapshotSharedComponent>
): GeneratedPagePayload {
  const page = mapToSnapshotPage(content)
  const diagnostics: GeneratedProviderDiagnostic[] = []
  const sharedComponents: GeneratedSnapshotSharedComponent[] = []

  // Components can be at content.components or content._json.components
  const rawComponents = content.components ?? (content._json as { components?: OptimizelyComponent[] } | undefined)?.components
  if (rawComponents && Array.isArray(rawComponents)) {
    rawComponents.forEach((optiComp) => {
      if (optiComp._metadata?.key) {
        const concreteType = optiComp._metadata?.types?.[0] || optiComp.__typename || 'unknown'
        const shared: GeneratedSnapshotSharedComponent = {
          id: optiComp._metadata.key,
          name: optiComp._metadata.displayName || concreteType,
          componentType: mapComponentType(concreteType),
          componentTypeId: concreteType,
          content: optiComp._json || {},
          config: {}
        }
        sharedComponents.push(shared)
        sharedComponentCache.set(shared.id, shared)
      }
    })
  }

  if (page.components.length > 0) {
    diagnostics.push({
      level: 'info',
      code: 'OPTIMIZELY_COMPONENTS_MAPPED',
      message: \`Mapped \${page.components.length} components from Optimizely\`,
      context: { componentTypes: [...new Set(page.components.map(c => c.componentType))] }
    })
  }

  return { page, structure: undefined, sharedComponents, diagnostics }
}
`
}

/**
 * Builds the Optimizely runtime provider module.
 */
export function buildOptimizelyProviderModule(): string {
  return `// Optimizely runtime provider
import type {
  GeneratedHeadDataProvider,
  GeneratedPagePayload,
  GeneratedProviderDiagnostic,
  GeneratedSiteSnapshot,
  GeneratedSnapshotSharedComponent
} from './types'
import { getOptimizelyConfig } from '@/generated/runtime/config'
import { getOptimizelyClient } from '@/generated/runtime/optimizely-client'
import { mapOptimizelyToPagePayload } from '@/generated/runtime/optimizely-mapper'

type SlugSegments = readonly string[]

const slugCache = new Map<string, GeneratedPagePayload>()
const sharedComponentCache = new Map<string, GeneratedSnapshotSharedComponent>()
const runtimeDiagnostics: GeneratedProviderDiagnostic[] = []

function sanitizeSlug(slug: SlugSegments): string[] {
  return Array.from(slug).filter((segment): segment is string => typeof segment === 'string').map(segment => segment.trim()).filter(segment => segment.length > 0)
}

function clonePayload<T>(payload: T): T {
  return JSON.parse(JSON.stringify(payload)) as T
}

export const optimizelyProvider: GeneratedHeadDataProvider = {
  name: 'optimizely',
  supportsLiveData: true,

  async resolvePageBySlug(slug: SlugSegments): Promise<GeneratedPagePayload | null> {
    const sanitized = sanitizeSlug(slug)
    const config = getOptimizelyConfig()
    const locale = config.locale || 'en'

    // Strip locale prefix if slug already starts with it (avoid /en/en/path)
    const slugWithoutLocale = sanitized[0] === locale ? sanitized.slice(1) : sanitized
    const pathWithLocale = '/' + locale + '/' + slugWithoutLocale.join('/') + '/'
    const cacheKey = pathWithLocale

    if (slugCache.has(cacheKey)) {
      return clonePayload(slugCache.get(cacheKey)!)
    }

    try {
      const client = getOptimizelyClient()
      const content = await client.getContentByPath(pathWithLocale)

      if (!content) {
        console.warn('optimizely:page-not-found', { path: pathWithLocale })
        return null
      }

      const payload = mapOptimizelyToPagePayload(content, sharedComponentCache)

      // Strip locale prefix and trailing slash from fullPath so routing works without locale in URL
      // Example: /en/the-royal-children-s-hospital-melbourne/ -> /the-royal-children-s-hospital-melbourne
      if (payload.page.fullPath) {
        let normalizedPath = payload.page.fullPath
        // Remove locale prefix (e.g., /en/ -> /)
        const localePrefix = '/' + locale + '/'
        if (normalizedPath.startsWith(localePrefix)) {
          normalizedPath = '/' + normalizedPath.slice(localePrefix.length)
        }
        // Remove trailing slash (except for root)
        if (normalizedPath.length > 1 && normalizedPath.endsWith('/')) {
          normalizedPath = normalizedPath.slice(0, -1)
        }
        payload.page.fullPath = normalizedPath
      }

      slugCache.set(cacheKey, payload)
      return clonePayload(payload)
    } catch (error) {
      console.error('optimizely:fetch-error', { path: pathWithLocale, error })
      return null
    }
  },

  async fetchSiteSnapshot(): Promise<GeneratedSiteSnapshot> {
    const config = getOptimizelyConfig()
    const locale = config.locale || 'en'
    const client = getOptimizelyClient()

    // Clear caches for fresh snapshot
    slugCache.clear()
    sharedComponentCache.clear()

    try {
      const allContent = await client.getAllPages()
      const pages: GeneratedSiteSnapshot['pages'] = []
      const structureMap = new Map<string, { id: string; websitePageId: string | null; parentId: string | null; slug: string; fullPath: string; position: number; isFolder: boolean; title?: string }>()

      for (const content of allContent) {
        const payload = mapOptimizelyToPagePayload(content, sharedComponentCache)

        // Normalize fullPath: remove locale prefix and trailing slash
        if (payload.page.fullPath) {
          let normalizedPath = payload.page.fullPath
          const localePrefix = '/' + locale + '/'
          if (normalizedPath.startsWith(localePrefix)) {
            normalizedPath = '/' + normalizedPath.slice(localePrefix.length)
          }
          if (normalizedPath.length > 1 && normalizedPath.endsWith('/')) {
            normalizedPath = normalizedPath.slice(0, -1)
          }
          payload.page.fullPath = normalizedPath
        }

        pages.push(payload.page)

        // Build structure node from page
        const fullPath = payload.page.fullPath || '/'
        const pathParts = fullPath.split('/').filter(Boolean)
        const slug = pathParts[pathParts.length - 1] || ''

        structureMap.set(payload.page.id, {
          id: payload.page.id,
          websitePageId: payload.page.id,
          parentId: null,
          slug,
          fullPath,
          position: pages.length - 1,
          isFolder: false,
          title: payload.page.title
        })

        // Cache for resolvePageBySlug
        const cacheKey = '/' + locale + fullPath + (fullPath.endsWith('/') ? '' : '/')
        slugCache.set(cacheKey, payload)
      }

      return {
        site: { id: 'optimizely-site', name: 'Optimizely Site' },
        pages,
        structure: Array.from(structureMap.values()),
        sharedComponents: Array.from(sharedComponentCache.values()),
        capturedAt: new Date().toISOString()
      }
    } catch (error) {
      console.error('optimizely:fetchSiteSnapshot-error', error)
      return {
        site: { id: 'optimizely-site', name: 'Optimizely Site' },
        pages: [],
        structure: [],
        sharedComponents: Array.from(sharedComponentCache.values()),
        capturedAt: new Date().toISOString()
      }
    }
  },

  getDiagnostics(): GeneratedProviderDiagnostic[] {
    return [...runtimeDiagnostics]
  }
}
`
}

/**
 * Builds the Umbraco Compose runtime provider module for generated sites.
 * This provider fetches content from Umbraco Compose GraphQL API at request time.
 */
export function buildUmbracoComposeProviderModule(): string {
  return `// Umbraco Compose runtime provider - fetches content from GraphQL API at request time
import type {
  GeneratedHeadDataProvider,
  GeneratedPagePayload,
  GeneratedProviderDiagnostic,
  GeneratedProviderRequestContext,
  GeneratedSiteSnapshot,
  GeneratedSnapshotPage,
  GeneratedSnapshotSharedComponent,
  GeneratedSnapshotStructureNode
} from './types'
import type { ComponentInstance } from '@/lib/studio/types/site-builder/component-instance'
import type { ComponentType } from '@/lib/studio/components/cms/_core/types'

// Configuration from environment variables
interface UmbracoComposeConfig {
  projectAlias: string
  region: string
  environment: string
  personalAccessToken: string
  graphqlEndpoint: string
  cacheTtlSeconds: number
}

function getUmbracoComposeConfig(): UmbracoComposeConfig {
  const projectAlias = process.env.UMBRACO_PROJECT_ALIAS || ''
  const region = process.env.UMBRACO_REGION || ''
  const environment = process.env.UMBRACO_ENVIRONMENT || 'production'
  const personalAccessToken = process.env.UMBRACO_PAT || ''
  const cacheTtlSeconds = parseInt(process.env.HEAD_RUNTIME_CACHE_TTL_SECONDS || '30', 10)

  const graphqlEndpoint = process.env.UMBRACO_GRAPHQL_ENDPOINT ||
    \`https://graphql.\${region}.umbracocompose.com/\${projectAlias}/\${environment}\`

  return {
    projectAlias,
    region,
    environment,
    personalAccessToken,
    graphqlEndpoint,
    cacheTtlSeconds
  }
}

// Simple in-memory cache
const pageCache = new Map<string, { data: GeneratedPagePayload; expiry: number }>()
const snapshotCache = { data: null as GeneratedSiteSnapshot | null, expiry: 0 }
const runtimeDiagnostics: GeneratedProviderDiagnostic[] = []

// GraphQL query execution
async function executeGraphQL<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const config = getUmbracoComposeConfig()

  const response = await fetch(config.graphqlEndpoint, {
    method: 'POST',
    headers: {
      'Authorization': \`Bearer \${config.personalAccessToken}\`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({ query, variables }),
    cache: 'no-store'
  })

  const text = await response.text()

  if (!response.ok) {
    throw new Error(\`Umbraco GraphQL request failed: \${response.status} \${text.substring(0, 500)}\`)
  }

  const result = JSON.parse(text) as { data?: T; errors?: Array<{ message: string }> }

  if (result.errors && result.errors.length > 0) {
    const messages = result.errors.map(e => e.message).join(', ')
    throw new Error(\`Umbraco GraphQL errors: \${messages}\`)
  }

  if (!result.data) {
    throw new Error('No data returned from Umbraco GraphQL')
  }

  return result.data
}

// Content item interface from Umbraco - generic to support any component structure
interface UmbracoContentItem {
  id: string
  __typename?: string
  title?: string
  slug?: string
  navbarRef?: { id: string } | string
  footerRef?: { id: string } | string
  headerRef?: { id: string } | string
  components?: UmbracoComponent[]
  logo?: string
  copyright?: string
  navItems?: Array<{ label: string; url: string }>
  links?: Array<{ label: string; url: string }>
  [key: string]: unknown
}

// Generic component interface - supports any Umbraco component type
interface UmbracoComponent {
  __typename?: string
  type?: string
  id?: string
  [key: string]: unknown
}

// Map Umbraco type to canonical component type (same pattern as Optimizely)
function mapComponentType(umbracoType: string): string {
  const typeMap: Record<string, string> = {
    'hero': 'hero-simple',
    'herosimple': 'hero-simple',
    'herobanner': 'hero-banner',
    'herocarousel': 'hero-carousel',
    'herovideo': 'hero-video',
    'herosplit': 'hero-split',
    'herominimal': 'hero-minimal',
    'navbar': 'navbar',
    'footer': 'footer',
    'cardgrid': 'card-grid',
    'card-grid': 'card-grid',
    'textblock': 'text-block',
    'text-block': 'text-block',
    'text': 'text-block',
    'twocolumn': 'two-column',
    'two-column': 'two-column',
    'contentfeed': 'content-feed',
    'content-feed': 'content-feed',
    'imagegallery': 'image-gallery',
    'image-gallery': 'image-gallery',
    'ctabanner': 'cta-banner',
    'cta-banner': 'cta-banner',
    'ctasimple': 'cta-simple',
    'cta-simple': 'cta-simple',
    'featuregrid': 'feature-grid',
    'feature-grid': 'feature-grid',
    'testimonials': 'testimonials',
    'statistics': 'statistics',
    'accordion': 'accordion',
    'tabs': 'tabs',
    'faq': 'faq'
  }
  const normalized = umbracoType.toLowerCase().replace(/[_\s]/g, '')
  return typeMap[normalized] || umbracoType.replace(/_/g, '-').toLowerCase()
}

// Get component region based on type (same pattern as Optimizely)
function getComponentRegion(componentType: string): string {
  const regionMap: Record<string, string> = {
    'navbar': 'header',
    'footer': 'footer',
    'hero-simple': 'hero',
    'hero-banner': 'hero',
    'hero-carousel': 'hero',
    'hero-video': 'hero',
    'hero-split': 'hero',
    'hero-minimal': 'hero'
  }
  return regionMap[componentType] || 'main'
}

// Transform content fields for specific component types (same pattern as Optimizely)
function transformContentForType(content: Record<string, unknown>, componentType: string): Record<string, unknown> {
  const transformed = { ...content }
  switch (componentType) {
    case 'card-grid':
      // Map gridTitle -> heading
      if (transformed.gridTitle && !transformed.heading) {
        transformed.heading = transformed.gridTitle
        delete transformed.gridTitle
      }
      // Transform cards array: cardTitle -> title, cardDescription -> description
      if (Array.isArray(transformed.cards)) {
        transformed.cards = transformed.cards.map((card: Record<string, unknown>, i: number) => ({
          id: card.id || \`card-\${i}\`,
          title: card.cardTitle || card.title,
          description: card.cardDescription || card.description,
          image: card.cardImage || card.image,
          href: card.cardLink || card.href,
          ...Object.fromEntries(
            Object.entries(card).filter(([k]) =>
              !['cardTitle', 'cardDescription', 'cardImage', 'cardLink'].includes(k)
            )
          )
        }))
      } else {
        transformed.cards = []
      }
      break
    case 'text-block':
      // Map bodyText -> body for text blocks
      if (transformed.bodyText && !transformed.body) {
        transformed.body = transformed.bodyText
        delete transformed.bodyText
      }
      break
    case 'hero-simple':
    case 'hero':
      // Map subheadline -> subheading for hero components
      if (transformed.subheadline && !transformed.subheading) {
        transformed.subheading = transformed.subheadline
        delete transformed.subheadline
      }
      // Map ctaText/ctaUrl to cta object
      if (transformed.ctaText || transformed.ctaUrl) {
        transformed.cta = {
          text: transformed.ctaText || 'Learn More',
          href: transformed.ctaUrl || '#'
        }
        delete transformed.ctaText
        delete transformed.ctaUrl
      }
      break
  }
  return transformed
}

// Map a single Umbraco component to ComponentInstance (same pattern as Optimizely)
function mapComponent(comp: UmbracoComponent, index: number, pageId: string): ComponentInstance {
  const rawType = comp.__typename || comp.type || 'unknown'
  const componentType = mapComponentType(rawType)
  const region = getComponentRegion(componentType)

  // Extract content from component data (exclude internal fields) - goes into 'content', not 'props'
  let content: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(comp)) {
    if (key === '__typename' || key === 'type' || key === 'id') continue
    if (value === null || value === undefined) continue
    content[key] = value
  }

  // Apply content transformations for type-specific field mappings
  content = transformContentForType(content, componentType)

  return {
    id: comp.id || \`\${componentType}-\${pageId.slice(-8)}-\${index}\`,
    type: componentType,
    componentType: componentType as ComponentType,
    parentId: null,
    props: { region },
    content,
    styles: {},
    metadata: {},
    region,
    position: index
  }
}

// Detect if a field value looks like a component object
function isComponentObject(value: unknown): value is UmbracoComponent {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const obj = value as Record<string, unknown>
  // Has __typename or type field, or has component-like structure
  return Boolean(obj.__typename || obj.type || obj.headline || obj.title || obj.heading || obj.gridTitle)
}

// Known component field names to check in page data
const COMPONENT_FIELD_NAMES = [
  'hero', 'cardGrid', 'textBlock', 'content', 'sections', 'components',
  'cta', 'features', 'testimonials', 'gallery', 'stats', 'faq', 'accordion'
]

// Map Umbraco content to our page format (dynamic approach like Optimizely)
function mapToPage(item: UmbracoContentItem): GeneratedSnapshotPage {
  const slug = item.slug || extractSlugFromId(item.id)
  const fullPath = slug === 'home' ? '/' : \`/\${slug}\`
  const components: ComponentInstance[] = []
  const sharedComponentIds: string[] = []

  // Extract shared component references
  const extractRefId = (ref: unknown): string | null => {
    if (typeof ref === 'string') return ref
    if (ref && typeof ref === 'object' && 'id' in ref) return (ref as { id: string }).id
    return null
  }
  const navbarId = extractRefId(item.navbarRef)
  const footerId = extractRefId(item.footerRef)
  const headerId = extractRefId(item.headerRef)
  if (navbarId) sharedComponentIds.push(navbarId)
  if (footerId) sharedComponentIds.push(footerId)
  if (headerId) sharedComponentIds.push(headerId)

  // If page has explicit components array, use it (preferred)
  if (item.components && Array.isArray(item.components)) {
    item.components.forEach((comp, index) => {
      components.push(mapComponent(comp, index, item.id))
    })
  } else {
    // Otherwise, scan for component fields dynamically
    let position = 0
    for (const fieldName of COMPONENT_FIELD_NAMES) {
      const value = item[fieldName]
      if (!value) continue

      if (Array.isArray(value)) {
        // Array of components
        for (const comp of value) {
          if (isComponentObject(comp)) {
            // Derive type from field name if not in component
            const compWithType = { ...comp, __typename: comp.__typename || fieldName }
            components.push(mapComponent(compWithType, position++, item.id))
          }
        }
      } else if (isComponentObject(value)) {
        // Single component - derive type from field name
        const compWithType = { ...value, __typename: value.__typename || fieldName }
        components.push(mapComponent(compWithType, position++, item.id))
      }
    }
  }

  return {
    id: item.id,
    title: item.title || slug,
    fullPath,
    templateKey: 'default',
    templateProps: {},
    regions: [],
    components,
    metadata: {},
    sharedComponentIds
  }
}

function mapToSharedComponent(item: UmbracoContentItem): GeneratedSnapshotSharedComponent {
  const type = extractTypeFromId(item.id) || item.__typename?.toLowerCase() || 'component'

  return {
    id: item.id,
    name: type.charAt(0).toUpperCase() + type.slice(1),
    componentType: type as ComponentType,
    content: {
      logo: item.logo,
      copyright: item.copyright,
      navItems: item.navItems,
      links: item.links
    },
    config: {}
  }
}

function extractSlugFromId(id: string): string {
  // ID format: page-{slug}-{timestamp}
  const match = id.match(/^page-(.+?)-[a-z0-9]+$/)
  return match ? match[1] : id
}

function extractTypeFromId(id: string): string {
  // ID format: {type}-{name}-{timestamp} or shared-{type}-{timestamp}
  if (id.startsWith('shared-')) {
    const match = id.match(/^shared-([a-z-]+)-[a-z0-9]+$/)
    return match ? match[1] : 'component'
  }
  const parts = id.split('-')
  return parts[0] || 'component'
}

function isPageContent(item: UmbracoContentItem): boolean {
  return item.id.startsWith('page-') || item.__typename === 'Page'
}

function isSharedComponent(item: UmbracoContentItem): boolean {
  return item.id.startsWith('shared-') ||
    item.__typename === 'Navbar' ||
    item.__typename === 'Footer'
}

// Build GraphQL query - queries known component fields from the Umbraco schema
// Note: Field names must match the actual Umbraco Compose schema (e.g., hero, cardGrid, textBlock)
function buildContentQuery(): string {
  return \`
    query GetAllContent {
      pages(first: 100) {
        edges {
          node {
            id
            __typename
            ... on Page {
              id
              title
              slug
              hero { headline subheadline ctaText ctaUrl }
              cardGrid { gridTitle cards { cardTitle cardDescription } }
              textBlock { heading bodyText }
              navbarRef { id logo navItems { label url } }
              footerRef { id copyright links { label url } }
            }
            ... on Navbar {
              id
              logo
              navItems { label url }
            }
            ... on Footer {
              id
              copyright
              links { label url }
            }
          }
        }
      }
    }
  \`
}

async function fetchAllContent(): Promise<UmbracoContentItem[]> {
  interface QueryResponse {
    pages: {
      edges: Array<{ node: UmbracoContentItem }>
    }
  }

  const data = await executeGraphQL<QueryResponse>(buildContentQuery())
  return data.pages.edges.map(edge => edge.node)
}

export const umbracoComposeProvider: GeneratedHeadDataProvider = {
  name: 'umbraco-compose',
  supportsLiveData: true,

  async resolvePageBySlug(slug: string[], context: GeneratedProviderRequestContext): Promise<GeneratedPagePayload | null> {
    const config = getUmbracoComposeConfig()
    const fullPath = slug.length === 0 ? '/' : '/' + slug.join('/')
    const cacheKey = fullPath
    const now = Date.now()

    // Check cache
    const cached = pageCache.get(cacheKey)
    if (cached && cached.expiry > now) {
      return JSON.parse(JSON.stringify(cached.data))
    }

    try {
      // Fetch all content and find the matching page
      const allContent = await fetchAllContent()
      const pageItems = allContent.filter(isPageContent)
      const sharedItems = allContent.filter(isSharedComponent)

      // Map shared components
      const sharedComponents: GeneratedSnapshotSharedComponent[] = sharedItems.map(mapToSharedComponent)
      const sharedComponentsMap = new Map(sharedComponents.map(c => [c.id, c]))

      // Find matching page
      const matchingItem = pageItems.find(item => {
        const itemSlug = item.slug || extractSlugFromId(item.id)
        const itemPath = itemSlug === 'home' ? '/' : \`/\${itemSlug}\`
        return itemPath === fullPath
      })

      if (!matchingItem) {
        return null
      }

      const page = mapToPage(matchingItem)
      const pageSharedComponents = (page.sharedComponentIds || [])
        .map(id => sharedComponentsMap.get(id))
        .filter((c): c is GeneratedSnapshotSharedComponent => c !== undefined)

      const payload: GeneratedPagePayload = {
        page,
        sharedComponents: pageSharedComponents,
        diagnostics: []
      }

      // Cache the result
      pageCache.set(cacheKey, {
        data: payload,
        expiry: now + config.cacheTtlSeconds * 1000
      })

      return JSON.parse(JSON.stringify(payload))
    } catch (error) {
      console.error('umbraco-compose:resolve-error', { fullPath, error })
      runtimeDiagnostics.push({
        level: 'error',
        code: 'UMBRACO_RESOLVE_ERROR',
        message: \`Failed to resolve page: \${fullPath}\`,
        context: { error: error instanceof Error ? error.message : String(error) }
      })
      return null
    }
  },

  async fetchSiteSnapshot(): Promise<GeneratedSiteSnapshot> {
    const config = getUmbracoComposeConfig()
    const now = Date.now()

    // Check cache
    if (snapshotCache.data && snapshotCache.expiry > now) {
      return JSON.parse(JSON.stringify(snapshotCache.data))
    }

    try {
      const allContent = await fetchAllContent()
      const pageItems = allContent.filter(isPageContent)
      const sharedItems = allContent.filter(isSharedComponent)

      const pages = pageItems.map(mapToPage)
      const sharedComponents = sharedItems.map(mapToSharedComponent)

      // Build structure from pages
      const structure: GeneratedSnapshotStructureNode[] = pages.map((page, index) => ({
        id: \`structure-\${page.id}\`,
        websitePageId: page.id,
        parentId: null,
        slug: page.fullPath === '/' ? '' : page.fullPath.slice(1),
        fullPath: page.fullPath,
        position: index,
        isFolder: false,
        title: page.title
      }))

      const snapshot: GeneratedSiteSnapshot = {
        site: {
          id: \`umbraco-\${config.projectAlias}\`,
          name: config.projectAlias.replace(/-/g, ' ').replace(/\\b\\w/g, c => c.toUpperCase())
        },
        pages,
        structure,
        sharedComponents,
        capturedAt: new Date().toISOString()
      }

      // Cache the result
      snapshotCache.data = snapshot
      snapshotCache.expiry = now + config.cacheTtlSeconds * 1000

      return JSON.parse(JSON.stringify(snapshot))
    } catch (error) {
      console.error('umbraco-compose:snapshot-error', error)
      runtimeDiagnostics.push({
        level: 'error',
        code: 'UMBRACO_SNAPSHOT_ERROR',
        message: 'Failed to fetch site snapshot',
        context: { error: error instanceof Error ? error.message : String(error) }
      })
      return {
        site: { id: 'umbraco-error', name: 'Umbraco Compose (Error)' },
        pages: [],
        structure: [],
        sharedComponents: [],
        capturedAt: new Date().toISOString()
      }
    }
  },

  getDiagnostics(): GeneratedProviderDiagnostic[] {
    return [...runtimeDiagnostics]
  }
}
`
}
