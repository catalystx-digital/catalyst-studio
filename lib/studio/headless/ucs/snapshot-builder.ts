import { PrismaClient, type WebsiteDesignConcept } from '@/lib/generated/prisma'
import {
  ComponentCategory,
  ComponentType,
  type CMSComponentProps
} from '@/lib/studio/components/cms/_core/types'
import { resolveSharedComponentReference, type ComponentInstance } from '@/lib/studio/types/site-builder/component-instance'
import {
  normalizeComponent,
  normalizeComponents,
  normalizeMetadata,
  normalizeProps,
  normalizeRegionSummary,
  normalizeTemplateProps,
  parseJsonString,
  resolveCmsComponentType,
} from '@/lib/studio/page-content'
import { applyTemplateOverrides } from '@/lib/studio/headless/site-snapshot/templates'
import type {
  GeneratorDiagnostic,
  SiteSnapshot,
  SnapshotPage,
  SnapshotRedirect,
  SnapshotSharedComponent,
  SnapshotStructureNode,
  SnapshotDesignSystem
} from '@/lib/studio/headless/site-snapshot/types'
import type { DesignSystem } from '@/lib/studio/import/types/design-system.types'
import { resolveRuntimeMediaBatch } from './runtime-media-resolver'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// Inlined to avoid external dependency that doesn't exist in generated headless sites
function slugifyConceptName(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
}

const ABSOLUTE_URL_PATTERN = /^[a-z][a-z\d+\-.]*:/i
const DOMAIN_LIKE_PATTERN = /^[\w.-]+\.[a-z]{2,}(?:[/:?].*)?$/i
const ORIGIN_CANDIDATE_KEYS = [
  'importSourceNormalized',
  'normalizedImportSource',
  'import_source_normalized',
  'importSource',
  'import_source',
  'siteOrigin',
  'site_origin',
  'siteUrl',
  'siteURL',
  'site_url',
  'baseUrl',
  'base_url',
  'homepage',
  'homePage',
  'home_url',
  'homeUrl',
  'origin',
  'canonicalUrl',
  'canonical_url',
  'url',
  'website',
  'domain',
  'host',
  'hostname'
] as const
const ORIGIN_ARRAY_KEYS = ['importSources', 'import_sources', 'sources'] as const
const ORIGIN_NESTED_KEYS = ['site', 'general', 'metadata', 'settings'] as const

const RESERVED_SCHEMES = ['data:', 'mailto:', 'tel:', 'javascript:']

const hasReservedScheme = (value: string): boolean =>
  RESERVED_SCHEMES.some(prefix => value.toLowerCase().startsWith(prefix))

const normalizeOriginString = (raw: string): string | undefined => {
  const trimmed = raw.trim()
  if (!trimmed || hasReservedScheme(trimmed)) {
    return undefined
  }

  if (ABSOLUTE_URL_PATTERN.test(trimmed)) {
    try {
      const url = new URL(trimmed)
      return url.origin !== 'null' ? url.origin : undefined
    } catch {
      return undefined
    }
  }

  if (!DOMAIN_LIKE_PATTERN.test(trimmed)) {
    return undefined
  }

  try {
    const url = new URL(`https://${trimmed}`)
    return url.origin !== 'null' ? url.origin : undefined
  } catch {
    return undefined
  }
}

const extractOriginFromValue = (value: unknown, depth: number): string | undefined => {
  if (depth > 4 || value === null || value === undefined) {
    return undefined
  }

  if (typeof value === 'string') {
    return normalizeOriginString(value)
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      const origin = extractOriginFromValue(entry, depth + 1)
      if (origin) {
        return origin
      }
    }
    return undefined
  }

  if (!isRecord(value)) {
    return undefined
  }

  for (const key of ORIGIN_CANDIDATE_KEYS) {
    if (key in value) {
      const origin = extractOriginFromValue(value[key], depth + 1)
      if (origin) {
        return origin
      }
    }
  }

  for (const key of ORIGIN_ARRAY_KEYS) {
    if (key in value) {
      const origin = extractOriginFromValue(value[key], depth + 1)
      if (origin) {
        return origin
      }
    }
  }

  for (const key of ORIGIN_NESTED_KEYS) {
    if (key in value) {
      const origin = extractOriginFromValue(value[key], depth + 1)
      if (origin) {
        return origin
      }
    }
  }

  return undefined
}

export const extractSiteOriginFromMetadata = (metadata: unknown): string | undefined => {
  if (!isRecord(metadata)) {
    return undefined
  }
  return extractOriginFromValue(metadata, 0)
}

const extractSiteOriginFromWebsite = (metadata: unknown, settings: unknown): string | undefined => {
  return extractSiteOriginFromMetadata(metadata) ?? extractSiteOriginFromMetadata(settings)
}

export const normalizeAssetUrl = (raw: unknown, origin: string | undefined): string | undefined => {
  const value = typeof raw === 'string' ? raw.trim() : ''
  if (!value) {
    return undefined
  }

  if (!origin || ABSOLUTE_URL_PATTERN.test(value) || hasReservedScheme(value)) {
    return value
  }

  try {
    return new URL(value, origin).toString()
  } catch {
    return value
  }
}

const URL_VALUE_KEYS = [
  'url',
  'href',
  'src',
  'originalUrl',
  'value',
  'link',
  'mediaUrl',
  'publicUrl',
  'signedUrl',
  'path',
  'to'
] as const

function extractUrlValue(candidate: unknown, depth = 0): string | undefined {
  if (depth > 5) {
    return undefined
  }

  if (typeof candidate === 'string') {
    const trimmed = candidate.trim()
    return trimmed.length > 0 ? trimmed : undefined
  }

  if (!candidate || typeof candidate !== 'object') {
    return undefined
  }

  if (Array.isArray(candidate)) {
    for (const item of candidate) {
      const resolved = extractUrlValue(item, depth + 1)
      if (resolved) {
        return resolved
      }
    }
    return undefined
  }

  const record = candidate as Record<string, unknown>
  for (const key of URL_VALUE_KEYS) {
    if (!(key in record)) {
      continue
    }
    const nested = extractUrlValue(record[key], depth + 1)
    if (nested) {
      return nested
    }
  }

  return undefined
}

type WebsiteDesignSystemDelegate = {
  findFirst?: (args: Record<string, unknown>) => Promise<unknown>
}

function cloneJson<T>(value: T): T {
  return value ? JSON.parse(JSON.stringify(value)) as T : value
}

function normalizeSharedComponentContent(
  content: unknown,
  shared: SnapshotSharedComponent[] | undefined,
  sharedComponentId?: string
): Record<string, unknown> {
  if (isRecord(content)) {
    return content
  }

  if (!sharedComponentId || !Array.isArray(shared)) {
    return {}
  }

  const sharedComponent = shared.find(entry => entry.id === sharedComponentId)
  return sharedComponent && isRecord(sharedComponent.content) ? cloneJson(sharedComponent.content) : {}
}

interface PrismaPageWithStructure {
  id: string
  title: string
  content: unknown
  templateKey: string | null
  templateProps: unknown
  metadata: unknown
  contentTypeId: string | null
  status: string
  structures: Array<{
    id: string
    fullPath: string | null
    slug: string | null
    parentId: string | null
    position: number
  }>
}

class PrismaSiteSnapshotBuilder {
  private readonly diagnostics: GeneratorDiagnostic[] = []
  private sharedComponents: SnapshotSharedComponent[] = []
  private siteOrigin?: string
  private resolvedConcept: WebsiteDesignConcept | null = null

  constructor(
    private readonly prisma: PrismaClient,
    private readonly websiteId: string,
    private readonly templateOverrideKey?: string,
    private readonly designConceptSelector?: string,
    private readonly skipPageContent?: boolean
  ) {}

  public async build(): Promise<{ snapshot: SiteSnapshot; diagnostics: GeneratorDiagnostic[] }> {
    const website = await this.prisma.website.findUnique({
      where: { id: this.websiteId },
      select: {
        id: true,
        name: true,
        description: true,
        metadata: true,
        settings: true
      }
    })

    if (!website) {
      throw new Error(`Website ${this.websiteId} was not found in UCS database`)
    }

    this.siteOrigin = extractSiteOriginFromWebsite(website.metadata, website.settings)

    const sharedComponents = await this.loadSharedComponents()
    this.sharedComponents = sharedComponents

    // When skipPageContent is true, skip loading pages (UCS providers load pages at runtime)
    const [pages, structure, designSystem, redirects] = await Promise.all([
      this.skipPageContent ? Promise.resolve([]) : this.loadPages(),
      this.loadStructure(),
      this.loadDesignSystem(),
      this.loadRedirects()
    ])

    const snapshot: SiteSnapshot = {
      site: {
        id: website.id,
        name: website.name ?? 'Untitled Website',
        description: website.description ?? undefined,
        origin: this.siteOrigin
      },
      pages,
      structure,
      sharedComponents,
      capturedAt: new Date().toISOString(),
      designSystem,
      redirects: redirects.length > 0 ? redirects : undefined
    }

    if (!this.siteOrigin) {
      this.diagnostics.push({
        code: 'SITE_ORIGIN_MISSING',
        level: 'info',
        message: `Website ${this.websiteId} does not provide an import origin; asset URLs will remain unchanged.`,
        context: { websiteId: this.websiteId }
      })
    }

    const normalizedSnapshot = applyTemplateOverrides(snapshot, this.templateOverrideKey)

    return { snapshot: normalizedSnapshot, diagnostics: this.diagnostics }
  }

  private ensureSiteOrigin(metadata: Record<string, unknown>): void {
    if (this.siteOrigin) {
      return
    }
    const origin = extractSiteOriginFromMetadata(metadata)
    if (origin) {
      this.siteOrigin = origin
    }
  }

  private async loadPages(): Promise<SnapshotPage[]> {
    const pages = await this.prisma.websitePage.findMany({
      where: { websiteId: this.websiteId },
      include: {
        structures: {
          select: {
            id: true,
            fullPath: true,
            slug: true,
            parentId: true,
            position: true
          }
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    })

    return pages.map(page => this.toSnapshotPage(page))
  }

  private toSnapshotPage(page: PrismaPageWithStructure): SnapshotPage {
    const rawContent = isRecord(page.content) ? page.content : {}
    const regions = normalizeRegionSummary(rawContent.regions)
    const components = normalizeComponents(rawContent.components)
      .map(component => {
        if (!component) {
          return component
        }

        return enrichComponentFromShared(component, this.sharedComponents, {
          assetOrigin: this.siteOrigin
        })
      })
    const templateProps = normalizeTemplateProps(page.templateProps)
    const metadata = normalizeMetadata(page.metadata)
    this.ensureSiteOrigin(metadata)
    const metadataFullPath = typeof metadata.fullPath === 'string' ? metadata.fullPath : undefined
    const primaryStructure = Array.isArray(page.structures)
      ? page.structures.find(entry => entry.fullPath) ?? page.structures[0] ?? null
      : null
    const fullPath = primaryStructure?.fullPath ?? metadataFullPath ?? `/${page.id}`

    if (!primaryStructure?.fullPath) {
      this.diagnostics.push({
        code: 'MISSING_STRUCTURE_ENTRY',
        level: 'warn',
        message: `Page ${page.id} is missing a WebsiteStructure entry; using fallback fullPath ${fullPath}`,
        context: { pageId: page.id }
      })
    }

    const sharedRefs = components
      .map(component => resolveSharedComponentReference(component))
      .filter((value): value is string => typeof value === 'string' && value.length > 0)

    return {
      id: page.id,
      title: page.title,
      fullPath,
      templateKey: page.templateKey,
      templateProps,
      regions,
      components,
      metadata,
      sharedComponentIds: Array.from(new Set(sharedRefs))
    }
  }

  private async loadStructure(): Promise<SnapshotStructureNode[]> {
    const structure = await this.prisma.websiteStructure.findMany({
      where: { websiteId: this.websiteId },
      orderBy: [{ parentId: 'asc' }, { position: 'asc' }]
    })

    return structure.map(node => ({
      id: node.id,
      websitePageId: node.websitePageId,
      parentId: node.parentId,
      slug: node.slug,
      fullPath: node.fullPath,
      position: node.position,
      isFolder: !node.websitePageId,
      title: undefined
    }))
  }

  private async loadSharedComponents(): Promise<SnapshotSharedComponent[]> {
    const sharedComponents = await this.prisma.websiteSharedComponent.findMany({
      where: { websiteId: this.websiteId },
      include: {
        websiteComponentType: {
          select: {
            type: true
          }
        }
      }
    })

    return sharedComponents.map(component => {
      const componentTypeId =
        typeof component.websiteComponentTypeId === 'string' ? component.websiteComponentTypeId : undefined
      const componentType =
        resolveCmsComponentType(component.websiteComponentType?.type) ?? undefined
      if (!componentType) {
        this.diagnostics.push({
          code: 'SHARED_COMPONENT_TYPE_MISSING',
          level: 'warn',
          message: `Shared component ${component.id} is missing a component type reference`,
          context: { sharedComponentId: component.id }
        })
      }

      return {
        id: component.id,
        name: component.name,
        componentType: componentType ?? ComponentType.TextBlock,
        componentTypeId,
        content: isRecord(component.content) ? component.content : null,
        config: isRecord(component.config) ? component.config : {}
      }
    })
  }

  private async loadDesignSystem(): Promise<SnapshotDesignSystem | null> {
    const designConcept = await this.resolveDesignConcept()
    const delegate = (this.prisma as unknown as { websiteDesignSystem?: WebsiteDesignSystemDelegate }).websiteDesignSystem

    if (!delegate || typeof delegate.findFirst !== 'function') {
      this.diagnostics.push({
        code: 'DESIGN_SYSTEM_DELEGATE_MISSING',
        level: 'info',
        message: 'Current Prisma client does not expose website design system records; falling back to defaults.',
        context: { websiteId: this.websiteId }
      })
      return null
    }

    const findFirst = delegate.findFirst as (args: Record<string, unknown>) => Promise<unknown>
    const whereClause: Record<string, unknown> = {
      websiteId: this.websiteId,
      isCurrent: true
    }

    if (designConcept?.id) {
      whereClause.designConceptId = designConcept.id
    }

    const designSystemEntity = (await findFirst({
      where: whereClause,
      orderBy: { createdAt: 'desc' }
    })) as { id: string; tokens: unknown } | null

    if (!designSystemEntity) {
      this.diagnostics.push({
        code: designConcept ? 'DESIGN_SYSTEM_CONCEPT_MISSING' : 'DESIGN_SYSTEM_MISSING',
        level: 'warn',
        message: designConcept
          ? `No design system tokens were found for concept "${designConcept.name}". Export will fall back to Catalyst defaults.`
          : 'No design system tokens were found for this website. Export will fall back to Catalyst defaults.',
        context: {
          websiteId: this.websiteId,
          conceptId: designConcept?.id,
          conceptName: designConcept?.name
        }
      })
      return null
    }

    const rawTokens = designSystemEntity.tokens as unknown
    if (!isRecord(rawTokens)) {
      this.diagnostics.push({
        code: 'DESIGN_SYSTEM_INVALID_PAYLOAD',
        level: 'warn',
        message: 'Latest design system record has an invalid token payload and will be ignored.',
        context: { designSystemId: designSystemEntity.id, websiteId: this.websiteId }
      })
      return null
    }

    const tokens = JSON.parse(JSON.stringify(rawTokens)) as DesignSystem

    return {
      tokens,
      aliases: tokens.aliases ?? undefined,
      conceptId: designConcept?.id,
      conceptName: designConcept?.name ?? undefined
    }
  }

  private async resolveDesignConcept(): Promise<WebsiteDesignConcept | null> {
    if (this.resolvedConcept) {
      return this.resolvedConcept
    }

    const selector = this.designConceptSelector?.trim()
    let concept: WebsiteDesignConcept | null = null

    if (selector) {
      const normalizedSlug = slugifyConceptName(selector)
      concept = await this.prisma.websiteDesignConcept.findFirst({
        where: {
          websiteId: this.websiteId,
          OR: [
            { id: selector },
            { slug: normalizedSlug },
            {
              name: {
                equals: selector,
                mode: 'insensitive'
              }
            }
          ]
        }
      })

      if (!concept) {
        this.diagnostics.push({
          code: 'DESIGN_CONCEPT_NOT_FOUND',
          level: 'warn',
          message: `Design concept "${selector}" was not found. Falling back to default concept.`,
          context: { websiteId: this.websiteId, selector }
        })
      }
    }

    if (!concept) {
      concept =
        (await this.prisma.websiteDesignConcept.findFirst({
          where: { websiteId: this.websiteId, isDefault: true },
          orderBy: [{ updatedAt: 'desc' }, { position: 'asc' }]
        })) ??
        (await this.prisma.websiteDesignConcept.findFirst({
          where: { websiteId: this.websiteId },
          orderBy: [{ position: 'asc' }, { createdAt: 'asc' }]
        }))
    }

    if (!concept) {
      this.diagnostics.push({
        code: 'DESIGN_CONCEPT_MISSING',
        level: 'info',
        message: 'No design concepts available for this website; falling back to latest tokens.',
        context: { websiteId: this.websiteId }
      })
    }

    this.resolvedConcept = concept
    return concept
  }

  /**
   * Load all active redirects for the website (both internal and external)
   */
  private async loadRedirects(): Promise<SnapshotRedirect[]> {
    const redirects = await this.prisma.redirect.findMany({
      where: {
        websiteId: this.websiteId,
        isActive: true
      },
      orderBy: { createdAt: 'asc' }
    })

    return redirects.map(redirect => ({
      id: redirect.id,
      sourcePath: redirect.sourcePath,
      targetPath: redirect.targetPath,
      redirectType: redirect.redirectType,
      isActive: redirect.isActive,
      isExternal: redirect.isExternal,
      showInNav: redirect.showInNav,
      navLabel: redirect.navLabel ?? undefined,
      openInNewTab: redirect.openInNewTab,
      source: redirect.source ?? undefined,
      description: redirect.description ?? undefined
    }))
  }
}

function mergeClassNames(...values: Array<string | undefined>): string | undefined {
  const tokens = values
    .flatMap(value => (typeof value === 'string' ? value.split(/\s+/) : []))
    .filter(Boolean)
  const unique = Array.from(new Set(tokens))
  return unique.length > 0 ? unique.join(' ') : undefined
}

function getDefaultClassName(normalizedType: string): string | undefined {
  // NOTE: Use bg-background instead of bg-surface since --surface is not a standard shadcn variable
  // This ensures exported sites render correctly without custom variable definitions
  switch (normalizedType) {
    case 'navigation':
    case 'navbar':
      return 'bg-background/90 backdrop-blur border-b border-border/60 shadow-sm'
    case 'hero':
    case 'hero-banner':
    case 'hero-split':
    case 'hero-minimal':
      return 'relative overflow-hidden rounded-[2.5rem] border border-border/60 bg-background shadow-2xl px-6 py-20'
    case 'feature-grid':
    case 'feature-list':
    case 'feature-showcase':
      return 'rounded-3xl border border-border/60 bg-background/80 shadow-lg'
    case 'text-block':
      return 'prose prose-slate max-w-none'
    case 'cta':
    case 'cta-banner':
    case 'cta-simple':
    case 'cta-button-group':
      return 'rounded-3xl bg-gradient-to-r from-primary to-secondary text-primary-foreground shadow-xl overflow-hidden'
    case 'footer':
      return 'mt-24 border-t border-border/60 bg-background/90'
    default:
      return undefined
  }
}

function gatherCandidateRecords(value: unknown, seen: WeakSet<object> = new WeakSet()): Record<string, unknown>[] {
  if (!isRecord(value)) {
    return []
  }

  const queue: Array<Record<string, unknown>> = [value]
  const records: Array<Record<string, unknown>> = []

  while (queue.length > 0) {
    const current = queue.shift()
    if (!current || seen.has(current)) {
      continue
    }
    seen.add(current)
    records.push(current)

    Object.values(current).forEach(entry => {
      if (isRecord(entry)) {
        queue.push(entry)
        return
      }
      if (Array.isArray(entry)) {
        entry.forEach(nested => {
          if (isRecord(nested)) {
            queue.push(nested)
          }
        })
      }
    })
  }

  return records
}

function resolveStringValue(
  value: unknown,
  keys: readonly string[],
  visited: WeakSet<object> = new WeakSet()
): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : undefined
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      const resolved = resolveStringValue(entry, keys, visited)
      if (resolved) {
        return resolved
      }
    }
    return undefined
  }

  if (!isRecord(value)) {
    return undefined
  }

  if (visited.has(value)) {
    return undefined
  }
  visited.add(value)

  for (const key of keys) {
    if (key in value) {
      const resolved = resolveStringValue(value[key], keys, visited)
      if (resolved) {
        return resolved
      }
    }
  }

  if ('value' in value) {
    return resolveStringValue(value.value, keys, visited)
  }

  return undefined
}

function extractStringFromCandidates(source: unknown, keys: readonly string[]): string | undefined {
  const records = gatherCandidateRecords(source)
  for (const record of records) {
    const resolved = resolveStringValue(record, keys)
    if (resolved) {
      return resolved
    }
  }
  return undefined
}

function extractBooleanFromCandidates(source: unknown, keys: readonly string[]): boolean | undefined {
  const records = gatherCandidateRecords(source)
  for (const record of records) {
    for (const key of keys) {
      const entry = record[key]
      if (typeof entry === 'boolean') {
        return entry
      }
      if (typeof entry === 'string') {
        const normalized = entry.trim().toLowerCase()
        if (normalized === 'true') {
          return true
        }
        if (normalized === 'false') {
          return false
        }
      }
    }
  }
  return undefined
}

function extractChildCandidates(source: unknown): Record<string, unknown>[] {
  const records = gatherCandidateRecords(source)
  const children: Record<string, unknown>[] = []
  const childKeys = ['children', 'items', 'links', 'menuItems']

  records.forEach(record => {
    childKeys.forEach(key => {
      const entry = record[key]
      if (Array.isArray(entry)) {
        entry.forEach(candidate => {
          if (isRecord(candidate)) {
            children.push(candidate)
          }
        })
      }
    })
  })

  return children
}

const NAV_ITEM_LABEL_KEYS = ['label', 'text', 'title', 'name'] as const
const NAV_ITEM_HREF_KEYS = ['href', 'url', 'link', 'to'] as const
const NAV_ITEM_EXTERNAL_KEYS = ['external', 'isExternal', 'newTab', 'openInNewTab'] as const
const MAX_NAV_MENU_DEPTH = 4

type NormalizedMenuItem = {
  label: string
  href: string
  external?: boolean
  children?: NormalizedMenuItem[]
}

function normalizeNavBarContent(content: unknown, assetOrigin?: string): Record<string, unknown> {
  const source = isRecord(content) ? content : {}
  const container = isRecord(source.content) ? (source.content as Record<string, unknown>) : source

  const menuItems: NormalizedMenuItem[] = []

  const normalizeMenuItem = (
    item: unknown,
    depth: number,
    seen: Set<string>
  ): NormalizedMenuItem | undefined => {
    if (!isRecord(item)) {
      return undefined
    }

    const label = extractStringFromCandidates(item, NAV_ITEM_LABEL_KEYS)
    const href = extractStringFromCandidates(item, NAV_ITEM_HREF_KEYS)

    if (!label || !href) {
      return undefined
    }

    const identifier = `${label}::${href}`
    if (seen.has(identifier) && depth === 0) {
      return undefined
    }

    const menuEntry: NormalizedMenuItem = {
      label,
      href
    }

    const external = extractBooleanFromCandidates(item, NAV_ITEM_EXTERNAL_KEYS)
    if (typeof external === 'boolean') {
      menuEntry.external = external
    }

    if (depth < MAX_NAV_MENU_DEPTH) {
      const childCandidates = extractChildCandidates(item)
      const childEntries = childCandidates
        .map(child => normalizeMenuItem(child, depth + 1, seen))
        .filter((child): child is NormalizedMenuItem => Boolean(child))

      if (childEntries.length > 0) {
        menuEntry.children = childEntries
      }
    }

    if (depth === 0) {
      seen.add(identifier)
    }

    return menuEntry
  }

  // Shared seen set across all collectLinks calls to prevent duplicates
  // when container === source (which happens when source.content is undefined)
  const globalSeen = new Set<string>()

  const collectLinks = (value: unknown) => {
    if (!Array.isArray(value)) {
      return
    }

    value.forEach(entry => {
      const normalized = normalizeMenuItem(entry, 0, globalSeen)
      if (normalized) {
        menuItems.push(normalized)
      }
    })
  }

  collectLinks(container.links)
  collectLinks(container.menuItems)
  collectLinks(source.links)
  collectLinks(source.menuItems)
  collectLinks(container.items)
  collectLinks(source.items)

  const logoValue = container.logo ?? source.logo
  let logo: Record<string, unknown> | undefined
  if (typeof logoValue === 'string') {
    logo = {
      src: logoValue,
      alt: typeof container.logoAlt === 'string' ? container.logoAlt : typeof source.logoAlt === 'string' ? source.logoAlt : undefined,
      href: typeof container.logoHref === 'string' ? container.logoHref : typeof source.logoHref === 'string' ? source.logoHref : undefined
    }
  } else if (isRecord(logoValue)) {
    logo = {
      src: typeof logoValue.src === 'string' ? logoValue.src : typeof logoValue.url === 'string' ? logoValue.url : undefined,
      alt: typeof logoValue.alt === 'string'
        ? logoValue.alt
        : typeof container.logoAlt === 'string'
          ? container.logoAlt
          : typeof source.logoAlt === 'string'
            ? source.logoAlt
            : undefined,
      text: typeof logoValue.text === 'string' ? logoValue.text : undefined,
      href: typeof logoValue.href === 'string' ? logoValue.href : undefined,
      width: typeof logoValue.width === 'number' ? logoValue.width : undefined,
      height: typeof logoValue.height === 'number' ? logoValue.height : undefined
    }
  }

  const ctaValue = container.cta ?? source.cta
  let cta: Record<string, unknown> | undefined
  if (isRecord(ctaValue)) {
    const text = typeof ctaValue.text === 'string' ? ctaValue.text : typeof ctaValue.label === 'string' ? ctaValue.label : undefined
    const href = typeof ctaValue.href === 'string' ? ctaValue.href : typeof ctaValue.url === 'string' ? ctaValue.url : undefined
    if (text && href) {
      cta = {
        text,
        href,
        variant: typeof ctaValue.variant === 'string' ? ctaValue.variant : typeof ctaValue.style === 'string' ? ctaValue.style : undefined,
        external: typeof ctaValue.external === 'boolean' ? ctaValue.external : undefined
      }
    }
  }

  const normalized: Record<string, unknown> = {
    menuItems
  }

  if (logo) {
    const src = typeof logo.src === 'string' ? normalizeAssetUrl(logo.src, assetOrigin) ?? logo.src : undefined
    if (src) {
      logo.src = src
    }
    normalized.logo = logo
  }

  if (cta) {
    normalized.cta = cta
  }

  if (typeof container.sticky === 'boolean') {
    normalized.sticky = container.sticky
  } else if (typeof source.sticky === 'boolean') {
    normalized.sticky = source.sticky
  }

  if (typeof container.transparent === 'boolean') {
    normalized.transparent = container.transparent
  } else if (typeof source.transparent === 'boolean') {
    normalized.transparent = source.transparent
  }

  if (typeof container.mobileBreakpoint === 'number') {
    normalized.mobileBreakpoint = container.mobileBreakpoint
  } else if (typeof source.mobileBreakpoint === 'number') {
    normalized.mobileBreakpoint = source.mobileBreakpoint
  }

  return normalized
}

function normalizeCtaContent(content: unknown): Record<string, unknown> {
  const source = isRecord(content) ? content : {}
  const heading = typeof source.heading === 'string' ? source.heading : undefined
  const subheading = typeof source.subheading === 'string' ? source.subheading : undefined
  const body = typeof source.body === 'string' ? source.body : typeof source.description === 'string' ? source.description : undefined

  const buttons = Array.isArray(source.buttons)
    ? source.buttons
        .filter(isRecord)
        .map(button => {
          const text = typeof button.text === 'string' ? button.text : typeof button.label === 'string' ? button.label : undefined
          const href = typeof button.href === 'string' ? button.href : typeof button.url === 'string' ? button.url : undefined
          if (!text || !href) {
            return undefined
          }
          return {
            text,
            href,
            variant: typeof button.variant === 'string' ? button.variant : typeof button.style === 'string' ? button.style : undefined,
            external: typeof button.external === 'boolean' ? button.external : undefined
          }
        })
        .filter((entry): entry is { text: string; href: string; variant: string | undefined; external: boolean | undefined } => Boolean(entry))
    : []

  const normalized: Record<string, unknown> = {}
  if (heading) normalized.heading = heading
  if (subheading) normalized.subheading = subheading
  if (body) normalized.body = body
  if (buttons.length > 0) normalized.buttons = buttons

  return normalized
}

function normalizeFeatureGridContent(content: unknown, assetOrigin?: string): Record<string, unknown> {
  const source = isRecord(content) ? content : {}
  const heading = typeof source.heading === 'string' ? source.heading : typeof source.title === 'string' ? source.title : undefined
  const subheading = typeof source.subheading === 'string' ? source.subheading : typeof source.description === 'string' ? source.description : undefined
  const columnsRaw = source.columns
  const columns = typeof columnsRaw === 'number' && [2, 3, 4].includes(columnsRaw) ? (columnsRaw as 2 | 3 | 4) : undefined

  const features = Array.isArray(source.features)
    ? source.features
        .filter(isRecord)
        .map(feature => {
          const title = typeof feature.title === 'string' ? feature.title : typeof feature.heading === 'string' ? feature.heading : undefined
          const description = typeof feature.description === 'string' ? feature.description : typeof feature.body === 'string' ? feature.body : undefined
          if (!title || !description) {
            return undefined
          }

          const linkSource = isRecord(feature.link)
            ? feature.link
            : isRecord(feature.cta)
            ? feature.cta
            : undefined

          const linkText = linkSource && typeof linkSource.label === 'string' ? linkSource.label : typeof linkSource?.text === 'string' ? linkSource.text : undefined
          const linkHref = linkSource && typeof linkSource.url === 'string' ? linkSource.url : typeof linkSource?.href === 'string' ? linkSource.href : undefined

          let icon = typeof feature.icon === 'string' ? feature.icon : undefined
          if (icon) {
            icon = normalizeAssetUrl(icon, assetOrigin) ?? icon
          }

          return {
            icon: icon ?? '�',
            title,
            description,
            link: linkText && linkHref ? { text: linkText, url: linkHref } : undefined
          }
        })
        .filter((entry): entry is { icon: string; title: string; description: string; link: { text: string; url: string } | undefined } => Boolean(entry))
    : []

  const normalized: Record<string, unknown> = {
    features
  }

  if (heading) normalized.heading = heading
  if (subheading) normalized.subheading = subheading
  if (columns) normalized.columns = columns

  return normalized
}

function normalizeComponentKey(value: unknown): string {
  if (typeof value !== 'string') {
    return ''
  }

  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
}

type TwoColumnSide = 'left' | 'right'

/**
 * Maps component type to category. Used for normalizing two-column children
 * that have type but are missing category field.
 */
const TYPE_TO_CATEGORY: Record<string, ComponentCategory> = {
  // Navigation
  'navbar': ComponentCategory.Navigation,
  'footer': ComponentCategory.Navigation,
  'sidemenu': ComponentCategory.Navigation,
  'sidebar-nav': ComponentCategory.Navigation,
  'breadcrumbs': ComponentCategory.Navigation,
  'mobile-menu': ComponentCategory.Navigation,
  // Heroes
  'hero-simple': ComponentCategory.Heroes,
  'hero-banner': ComponentCategory.Heroes,
  'hero-split': ComponentCategory.Heroes,
  'hero-carousel': ComponentCategory.Heroes,
  // Content (default for most)
  'text-block': ComponentCategory.Content,
  'card-item': ComponentCategory.Content,
  'card-grid': ComponentCategory.Content,
  'html-block': ComponentCategory.Content,
  'image-gallery': ComponentCategory.Content,
  'video-embed': ComponentCategory.Content,
  'video-player': ComponentCategory.Content,
  'accordion': ComponentCategory.Content,
  'tabs': ComponentCategory.Content,
  'quote-block': ComponentCategory.Content,
  'two-column': ComponentCategory.Content,
  // Features
  'feature-grid': ComponentCategory.Features,
  'feature-list': ComponentCategory.Features,
  // CTA
  'cta-simple': ComponentCategory.CTA,
  'cta-banner': ComponentCategory.CTA,
  'cta-button-group': ComponentCategory.CTA,
  // Contact
  'contact-form': ComponentCategory.Contact,
  'contact-info': ComponentCategory.Contact,
  // Data
  'statistics': ComponentCategory.Data,
  'data-table': ComponentCategory.Data,
  'chart': ComponentCategory.Data
}

function resolveCategoryFromType(type: string): ComponentCategory {
  const normalized = normalizeComponentKey(type)
  return TYPE_TO_CATEGORY[normalized] ?? TYPE_TO_CATEGORY[type] ?? ComponentCategory.Content
}

const NON_EMPTY_STRING = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function createSlotComponentId(componentId: string, side: TwoColumnSide, index: number, existingId?: unknown): string {
  if (typeof existingId === 'string' && existingId.trim().length > 0) {
    return existingId
  }
  return `${componentId}:${side}:${index}`
}

function isCmsComponentPropsCandidate(value: unknown): value is CMSComponentProps {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.id === 'string' &&
    typeof value.type === 'string' &&
    typeof value.category === 'string' &&
    isRecord(value.content)
  )
}

type LegacyTwoColumnMapperContext = {
  entry: Record<string, unknown>
  component: ComponentInstance
  side: TwoColumnSide
  index: number
  assetOrigin?: string
}

type LegacyTwoColumnMapper = (context: LegacyTwoColumnMapperContext) => Omit<CMSComponentProps, 'id'> | undefined

const LEGACY_TWO_COLUMN_MAPPERS: Record<string, LegacyTwoColumnMapper> = {
  'text-block': ({ entry }) => {
    const heading = NON_EMPTY_STRING(entry.heading)
    const subheading = NON_EMPTY_STRING(entry.subheading)
    const body = NON_EMPTY_STRING(entry.body) ?? ''
    const alignment = NON_EMPTY_STRING(entry.alignment)
    const columns = typeof entry.columns === 'number' ? entry.columns : undefined
    const headingLevel = typeof entry.headingLevel === 'number' ? entry.headingLevel : undefined

    return {
      type: ComponentType.TextBlock,
      category: ComponentCategory.Content,
      theme: 'auto',
      variant: 'default',
      content: {
        ...(heading ? { heading } : {}),
        ...(subheading ? { subheading } : {}),
        body,
        ...(alignment ? { alignment } : {}),
        ...(columns ? { columns } : {}),
        ...(headingLevel ? { headingLevel } : {})
      }
    }
  },
  'card-item': ({ entry, assetOrigin }) => {
    const title =
      NON_EMPTY_STRING(entry.title) ??
      NON_EMPTY_STRING(entry.heading) ??
      NON_EMPTY_STRING(entry.name) ??
      ''
    const description =
      NON_EMPTY_STRING(entry.description) ??
      NON_EMPTY_STRING(entry.body) ??
      NON_EMPTY_STRING(entry.text)
    const badge = NON_EMPTY_STRING(entry.badge)
    const icon = NON_EMPTY_STRING(entry.icon)
    const link =
      NON_EMPTY_STRING(entry.link) ??
      NON_EMPTY_STRING(entry.href) ??
      NON_EMPTY_STRING(entry.url)
    const linkText =
      NON_EMPTY_STRING(entry.linkText) ??
      NON_EMPTY_STRING(entry.linkLabel)

    // Handle image field which can be string, object, or nested
    let image: string | undefined
    let imageAlt: string | undefined
    const imageField = entry.image

    if (typeof imageField === 'string') {
      image = normalizeAssetUrl(imageField, assetOrigin) ?? imageField
    } else if (isRecord(imageField)) {
      const rawUrl =
        extractUrlValue(imageField.src) ??
        extractUrlValue(imageField.url) ??
        extractUrlValue(imageField.originalUrl) ??
        extractUrlValue(imageField)
      if (rawUrl) {
        image = normalizeAssetUrl(rawUrl, assetOrigin) ?? rawUrl
      }
      imageAlt = NON_EMPTY_STRING(imageField.alt)
    }

    // Also check for imageUrl field (alternative naming)
    if (!image) {
      const imageUrlField = entry.imageUrl
      if (typeof imageUrlField === 'string') {
        image = normalizeAssetUrl(imageUrlField, assetOrigin) ?? imageUrlField
      } else if (isRecord(imageUrlField)) {
        const rawUrl =
          extractUrlValue(imageUrlField.src) ??
          extractUrlValue(imageUrlField.url) ??
          extractUrlValue(imageUrlField.originalUrl) ??
          extractUrlValue(imageUrlField)
        if (rawUrl) {
          image = normalizeAssetUrl(rawUrl, assetOrigin) ?? rawUrl
        }
      }
    }

    if (!imageAlt) {
      imageAlt = NON_EMPTY_STRING(entry.imageAlt) ?? NON_EMPTY_STRING(entry.alt)
    }

    // Handle metadata
    const metadata = isRecord(entry.metadata)
      ? {
          author: NON_EMPTY_STRING(entry.metadata.author),
          date: NON_EMPTY_STRING(entry.metadata.date),
          category: NON_EMPTY_STRING(entry.metadata.category),
          tags: Array.isArray(entry.metadata.tags)
            ? entry.metadata.tags.filter((t): t is string => typeof t === 'string')
            : undefined
        }
      : undefined

    // Handle actions
    const actions = Array.isArray(entry.actions)
      ? entry.actions
          .filter(isRecord)
          .map((action) => {
            const label = NON_EMPTY_STRING(action.label) ?? NON_EMPTY_STRING(action.text)
            const url = NON_EMPTY_STRING(action.url) ?? NON_EMPTY_STRING(action.href)
            if (!label || !url) return undefined
            const variant = NON_EMPTY_STRING(action.variant)
            return {
              label,
              url,
              ...(variant ? { variant } : {})
            }
          })
          .filter((a): a is { label: string; url: string; variant?: string } => Boolean(a))
      : undefined

    const content: Record<string, unknown> = { title }
    if (description) content.description = description
    if (image) content.image = image
    if (imageAlt) content.imageAlt = imageAlt
    if (link) content.link = link
    if (linkText) content.linkText = linkText
    if (badge) content.badge = badge
    if (icon) content.icon = icon
    if (metadata && Object.values(metadata).some(Boolean)) content.metadata = metadata
    if (actions && actions.length > 0) content.actions = actions

    return {
      type: ComponentType.CardItem,
      category: ComponentCategory.Content,
      theme: 'auto',
      variant: 'default',
      content
    }
  },
  'sidemenu': ({ entry }) => {
    const title = NON_EMPTY_STRING(entry.title)
    const currentPath = NON_EMPTY_STRING(entry.currentPath)
    const showExpandIcons =
      typeof entry.showExpandIcons === 'boolean' ? entry.showExpandIcons : undefined
    const defaultCollapsed =
      typeof entry.defaultCollapsed === 'boolean' ? entry.defaultCollapsed : undefined

    // Preserve sections if they exist
    const sections = Array.isArray(entry.sections) ? entry.sections : undefined

    // Preserve items if they exist
    const items = Array.isArray(entry.items) ? entry.items : undefined

    const content: Record<string, unknown> = {}
    if (title) content.title = title
    if (sections) content.sections = sections
    if (items) content.items = items
    if (currentPath) content.currentPath = currentPath
    if (showExpandIcons !== undefined) content.showExpandIcons = showExpandIcons
    if (defaultCollapsed !== undefined) content.defaultCollapsed = defaultCollapsed

    return {
      type: ComponentType.SideMenu,
      category: ComponentCategory.Navigation,
      theme: 'auto',
      variant: 'default',
      content
    }
  },
  'card-grid': ({ entry, assetOrigin }) => {
    const heading = NON_EMPTY_STRING(entry.heading) ?? NON_EMPTY_STRING(entry.title)
    const subheading = NON_EMPTY_STRING(entry.subheading) ?? NON_EMPTY_STRING(entry.description)
    const columns =
      typeof entry.columns === 'number' && entry.columns >= 1 && entry.columns <= 6
        ? entry.columns
        : undefined
    const gap = NON_EMPTY_STRING(entry.gap)

    // Process cards array
    const cards = Array.isArray(entry.cards)
      ? entry.cards
          .filter(isRecord)
          .map((card) => {
            const cardTitle = NON_EMPTY_STRING(card.title) ?? NON_EMPTY_STRING(card.heading)
            const cardDescription =
              NON_EMPTY_STRING(card.description) ?? NON_EMPTY_STRING(card.body)

            let cardImage: string | undefined
            let cardImageAlt: string | undefined
            const imageField = card.image

            if (typeof imageField === 'string') {
              cardImage = normalizeAssetUrl(imageField, assetOrigin) ?? imageField
            } else if (isRecord(imageField)) {
              const rawUrl = extractUrlValue(imageField.src) ?? extractUrlValue(imageField)
              if (rawUrl) {
                cardImage = normalizeAssetUrl(rawUrl, assetOrigin) ?? rawUrl
              }
              cardImageAlt = NON_EMPTY_STRING(imageField.alt)
            }

            const cardLink = NON_EMPTY_STRING(card.link) ?? NON_EMPTY_STRING(card.href)

            if (!cardTitle) return undefined

            return {
              title: cardTitle,
              ...(cardDescription ? { description: cardDescription } : {}),
              ...(cardImage ? { image: cardImage } : {}),
              ...(cardImageAlt ? { imageAlt: cardImageAlt } : {}),
              ...(cardLink ? { link: cardLink } : {})
            }
          })
          .filter(
            (c): c is { title: string; description?: string; image?: string; imageAlt?: string; link?: string } =>
              Boolean(c)
          )
      : undefined

    const content: Record<string, unknown> = {}
    if (heading) content.heading = heading
    if (subheading) content.subheading = subheading
    if (columns) content.columns = columns
    if (gap) content.gap = gap
    if (cards && cards.length > 0) content.cards = cards

    return {
      type: ComponentType.CardGrid,
      category: ComponentCategory.Content,
      theme: 'auto',
      variant: 'default',
      content
    }
  },
  'html-block': ({ entry }) => {
    // html-block PropsMeta expects 'bodyHtml', not 'html'
    // Check bodyHtml first (correct field), then fallback to legacy html/body fields
    const bodyHtml =
      NON_EMPTY_STRING(entry.bodyHtml) ??
      NON_EMPTY_STRING(entry.html) ??
      NON_EMPTY_STRING(entry.body) ??
      ''
    const title = NON_EMPTY_STRING(entry.title)

    return {
      type: ComponentType.HtmlBlock,
      category: ComponentCategory.Content,
      theme: 'auto',
      variant: 'default',
      content: {
        ...(title ? { title } : {}),
        bodyHtml
      }
    }
  },
  'image-gallery': ({ entry, assetOrigin }) => {
    const images = Array.isArray(entry.images)
      ? entry.images
          .map(imageEntry => {
            if (!isRecord(imageEntry)) {
              return undefined
            }
            const rawUrlCandidate =
              extractUrlValue(imageEntry.url) ??
              extractUrlValue(imageEntry.src) ??
              extractUrlValue(imageEntry)
            const url =
              rawUrlCandidate ? normalizeAssetUrl(rawUrlCandidate, assetOrigin) ?? rawUrlCandidate : undefined
            if (!url) {
              return undefined
            }
            const alt = NON_EMPTY_STRING(imageEntry.alt) ?? ''
            const caption = NON_EMPTY_STRING(imageEntry.caption)
            const width = typeof imageEntry.width === 'number' ? imageEntry.width : undefined
            const height = typeof imageEntry.height === 'number' ? imageEntry.height : undefined
            const mediaId =
              typeof imageEntry.mediaId === 'string' && imageEntry.mediaId.trim().length > 0
                ? imageEntry.mediaId.trim()
                : isRecord(imageEntry.url) && typeof imageEntry.url.mediaId === 'string'
                ? imageEntry.url.mediaId.trim()
                : undefined
            return {
              url,
              alt,
              ...(caption ? { caption } : {}),
              ...(width ? { width } : {}),
              ...(height ? { height } : {}),
              ...(mediaId ? { mediaId } : {})
            }
          })
          .filter(
            (
              value
            ): value is {
              url: string
              alt: string
              caption?: string
              width?: number
              height?: number
            } => Boolean(value)
          )
      : []

    if (images.length === 0) {
      return undefined
    }

    const displayMode = NON_EMPTY_STRING(entry.displayMode)
    const spacing = NON_EMPTY_STRING(entry.spacing)
    const columns =
      typeof entry.columns === 'number' && entry.columns >= 1 && entry.columns <= 6 ? entry.columns : undefined
    const showCaptions =
      typeof entry.showCaptions === 'boolean' ? entry.showCaptions : undefined
    const enableLightbox =
      typeof entry.enableLightbox === 'boolean' ? entry.enableLightbox : undefined
    const autoPlay = typeof entry.autoPlay === 'boolean' ? entry.autoPlay : undefined
    const autoPlayInterval =
      typeof entry.autoPlayInterval === 'number' ? entry.autoPlayInterval : undefined

    return {
      type: ComponentType.ImageGallery,
      category: ComponentCategory.Content,
      theme: 'auto',
      variant: 'default',
      content: {
        images,
        ...(displayMode ? { displayMode } : {}),
        ...(columns ? { columns } : {}),
        ...(spacing ? { spacing } : {}),
        ...(showCaptions !== undefined ? { showCaptions } : {}),
        ...(enableLightbox !== undefined ? { enableLightbox } : {}),
        ...(autoPlay !== undefined ? { autoPlay } : {}),
        ...(autoPlayInterval !== undefined ? { autoPlayInterval } : {})
      }
    }
  },
  'video-embed': ({ entry, assetOrigin }) => {
    const provider = NON_EMPTY_STRING(entry.provider) ?? 'iframe'

    const resolveUrl = (): string | undefined => {
      if (typeof entry.url === 'string') {
        return entry.url
      }
      if (isRecord(entry.url)) {
        const candidate =
          typeof entry.url.src === 'string'
            ? entry.url.src
            : typeof entry.url.originalUrl === 'string'
            ? entry.url.originalUrl
            : typeof entry.url.url === 'string'
            ? entry.url.url
            : typeof entry.url.href === 'string'
            ? entry.url.href
            : undefined
        return candidate
      }
      const directSrc = typeof entry.src === 'string' ? entry.src : undefined
      const originalUrl =
        typeof entry.originalUrl === 'string' ? entry.originalUrl : undefined
      return directSrc ?? originalUrl
    }

    const rawUrl = resolveUrl()
    if (!rawUrl) {
      return undefined
    }
    const normalizedUrl = normalizeAssetUrl(rawUrl, assetOrigin) ?? rawUrl
    const title = NON_EMPTY_STRING(entry.title)
    const description = NON_EMPTY_STRING(entry.description)
    const allowFullScreen =
      typeof entry.allowFullScreen === 'boolean' ? entry.allowFullScreen : undefined
    const autoPlay = typeof entry.autoPlay === 'boolean' ? entry.autoPlay : undefined
    const muted = typeof entry.muted === 'boolean' ? entry.muted : undefined
    const aspectRatio = NON_EMPTY_STRING(entry.aspectRatio)
    const caption = NON_EMPTY_STRING(entry.caption)

    const content: Record<string, unknown> = {
      provider,
      url: normalizedUrl
    }

    if (title) content.title = title
    if (description) content.description = description
    if (allowFullScreen !== undefined) content.allowFullScreen = allowFullScreen
    if (autoPlay !== undefined) content.autoPlay = autoPlay
    if (muted !== undefined) content.muted = muted
    if (aspectRatio) content.aspectRatio = aspectRatio
    if (caption) content.caption = caption

    return {
      type: ComponentType.VideoEmbed,
      category: ComponentCategory.Content,
      theme: 'auto',
      variant: 'default',
      content
    }
  },
  'cta-simple': ({ entry, assetOrigin }) => {
    const normalizeButton = (
      raw: unknown
    ): { text: string; url: string; variant?: string } | undefined => {
      if (!isRecord(raw)) {
        return undefined
      }
      const text =
        NON_EMPTY_STRING(raw.text) ??
        NON_EMPTY_STRING(raw.label) ??
        NON_EMPTY_STRING(raw.title)
      const rawUrlCandidate =
        extractUrlValue(raw.url) ??
        extractUrlValue(raw.href) ??
        extractUrlValue(raw.link) ??
        extractUrlValue(raw.to) ??
        extractUrlValue(raw.path) ??
        extractUrlValue(raw)
      if (!text || !rawUrlCandidate) {
        return undefined
      }
      const url = normalizeAssetUrl(rawUrlCandidate, assetOrigin) ?? rawUrlCandidate
      const variant = NON_EMPTY_STRING(raw.variant)
      return {
        text,
        url,
        ...(variant ? { variant } : {})
      }
    }

    const primaryButton =
      normalizeButton(entry.primaryButton) ??
      normalizeButton(entry.primaryCta) ??
      normalizeButton(entry.cta)

    if (!primaryButton) {
      return undefined
    }

    const secondaryButton = normalizeButton(entry.secondaryButton)
    const eyebrow = NON_EMPTY_STRING(entry.eyebrow)
    const heading = NON_EMPTY_STRING(entry.heading) ?? primaryButton.text
    const body = NON_EMPTY_STRING(entry.body) ?? NON_EMPTY_STRING(entry.description)
    const alignment = NON_EMPTY_STRING(entry.alignment)
    const backgroundVariant = NON_EMPTY_STRING(entry.backgroundVariant)

    const content: Record<string, unknown> = {
      heading,
      primaryButton
    }
    if (eyebrow) content.eyebrow = eyebrow
    if (body) content.body = body
    if (secondaryButton) content.secondaryButton = secondaryButton
    if (alignment) content.alignment = alignment
    if (backgroundVariant) content.backgroundVariant = backgroundVariant

    return {
      type: ComponentType.CTASimple,
      category: ComponentCategory.CTA,
      theme: 'auto',
      variant: 'default',
      content
    }
  },
  'cta-banner': ({ entry, assetOrigin }) => {
    // cta-banner is similar to cta-simple but displayed as a full-width banner
    const normalizeButton = (
      raw: unknown
    ): { text: string; url: string; variant?: string } | undefined => {
      if (!isRecord(raw)) {
        return undefined
      }
      const text =
        NON_EMPTY_STRING(raw.text) ??
        NON_EMPTY_STRING(raw.label) ??
        NON_EMPTY_STRING(raw.title)
      const rawUrlCandidate =
        extractUrlValue(raw.url) ??
        extractUrlValue(raw.href) ??
        extractUrlValue(raw.link) ??
        extractUrlValue(raw)
      if (!text || !rawUrlCandidate) {
        return undefined
      }
      const url = normalizeAssetUrl(rawUrlCandidate, assetOrigin) ?? rawUrlCandidate
      const variant = NON_EMPTY_STRING(raw.variant)
      return {
        text,
        url,
        ...(variant ? { variant } : {})
      }
    }

    const heading =
      NON_EMPTY_STRING(entry.heading) ??
      NON_EMPTY_STRING(entry.title) ??
      NON_EMPTY_STRING(entry.label)
    const subheading =
      NON_EMPTY_STRING(entry.subheading) ??
      NON_EMPTY_STRING(entry.description) ??
      NON_EMPTY_STRING(entry.body)
    const primaryButton =
      normalizeButton(entry.primaryButton) ??
      normalizeButton(entry.primaryCta) ??
      normalizeButton(entry.cta)
    const secondaryButton = normalizeButton(entry.secondaryButton)
    const alignment = NON_EMPTY_STRING(entry.alignment)

    const content: Record<string, unknown> = {}
    if (heading) content.heading = heading
    if (subheading) content.subheading = subheading
    if (primaryButton) content.primaryButton = primaryButton
    if (secondaryButton) content.secondaryButton = secondaryButton
    if (alignment) content.alignment = alignment

    return {
      type: ComponentType.CTABanner,
      category: ComponentCategory.CTA,
      theme: 'auto',
      variant: 'default',
      content
    }
  },
  'breadcrumbs': ({ entry }) => {
    // Normalize breadcrumb items
    const items = Array.isArray(entry.items)
      ? entry.items
          .filter(isRecord)
          .map((item) => {
            const label =
              NON_EMPTY_STRING(item.label) ??
              NON_EMPTY_STRING(item.text) ??
              NON_EMPTY_STRING(item.title)
            const href =
              NON_EMPTY_STRING(item.href) ??
              NON_EMPTY_STRING(item.url) ??
              NON_EMPTY_STRING(item.link)
            if (!label) return undefined
            return {
              label,
              ...(href ? { href } : {})
            }
          })
          .filter((item): item is { label: string; href?: string } => Boolean(item))
      : []

    const separator = NON_EMPTY_STRING(entry.separator)
    const showHomeIcon =
      typeof entry.showHomeIcon === 'boolean' ? entry.showHomeIcon : undefined

    const content: Record<string, unknown> = {
      items
    }
    if (separator) content.separator = separator
    if (showHomeIcon !== undefined) content.showHomeIcon = showHomeIcon

    return {
      type: ComponentType.Breadcrumbs,
      category: ComponentCategory.Navigation,
      theme: 'auto',
      variant: 'default',
      content
    }
  },
  'cta-button-group': ({ entry, assetOrigin }) => {
    // Normalize button items
    const buttons = Array.isArray(entry.buttons)
      ? entry.buttons
          .filter(isRecord)
          .map((btn) => {
            const text =
              NON_EMPTY_STRING(btn.text) ??
              NON_EMPTY_STRING(btn.label) ??
              NON_EMPTY_STRING(btn.title)
            const rawUrl =
              extractUrlValue(btn.url) ??
              extractUrlValue(btn.href) ??
              extractUrlValue(btn.link)
            if (!text || !rawUrl) return undefined
            const url = normalizeAssetUrl(rawUrl, assetOrigin) ?? rawUrl
            const variant = NON_EMPTY_STRING(btn.variant)
            const size = NON_EMPTY_STRING(btn.size)
            const icon = NON_EMPTY_STRING(btn.icon)
            const iconPosition = NON_EMPTY_STRING(btn.iconPosition)
            const backgroundColor = NON_EMPTY_STRING(btn.backgroundColor)
            return {
              text,
              url,
              ...(variant ? { variant } : {}),
              ...(size ? { size } : {}),
              ...(icon ? { icon } : {}),
              ...(iconPosition ? { iconPosition } : {}),
              ...(backgroundColor ? { backgroundColor } : {})
            }
          })
          .filter((btn): btn is { text: string; url: string; variant?: string; size?: string; icon?: string; iconPosition?: string; backgroundColor?: string } => Boolean(btn))
      : []

    if (buttons.length === 0) {
      return undefined
    }

    const heading = NON_EMPTY_STRING(entry.heading)
    const subheading = NON_EMPTY_STRING(entry.subheading)
    const alignment = NON_EMPTY_STRING(entry.alignment)
    const orientation = NON_EMPTY_STRING(entry.orientation)
    const spacing = NON_EMPTY_STRING(entry.spacing)
    const fullWidthOnMobile =
      typeof entry.fullWidthOnMobile === 'boolean' ? entry.fullWidthOnMobile : undefined

    const content: Record<string, unknown> = { buttons }
    if (heading) content.heading = heading
    if (subheading) content.subheading = subheading
    if (alignment) content.alignment = alignment
    if (orientation) content.orientation = orientation
    if (spacing) content.spacing = spacing
    if (fullWidthOnMobile !== undefined) content.fullWidthOnMobile = fullWidthOnMobile

    return {
      type: ComponentType.CTAButtonGroup,
      category: ComponentCategory.CTA,
      theme: 'auto',
      variant: 'default',
      content
    }
  }
}

/**
 * Escapes HTML special characters for safe insertion into HTML.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/**
 * Converts specific unmapped component types to HTML instead of raw JSON.
 * Handles nav-menu-item, content-feed items, and other structured data.
 */
function convertUnmappedComponentToHtml(entry: Record<string, unknown>): string | undefined {
  const entryType = typeof entry.type === 'string' ? entry.type : undefined

  // Handle nav-menu-item
  if (entryType === 'nav-menu-item' || entryType === 'nav-item' || entryType === 'menu-item') {
    const label = NON_EMPTY_STRING(entry.label) ?? NON_EMPTY_STRING(entry.text) ?? NON_EMPTY_STRING(entry.title)
    const url = NON_EMPTY_STRING(entry.url) ?? NON_EMPTY_STRING(entry.href) ?? NON_EMPTY_STRING(entry.link)

    if (label && url) {
      return `<p><a href="${escapeHtml(url)}">${escapeHtml(label)}</a></p>`
    } else if (label) {
      return `<p>${escapeHtml(label)}</p>`
    }
  }

  // Handle content-feed items / card items
  if (entryType === 'content-feed-item' || entryType === 'card-item' || entryType === 'feed-item') {
    const title = NON_EMPTY_STRING(entry.title) ?? NON_EMPTY_STRING(entry.heading)
    const summary = NON_EMPTY_STRING(entry.summary) ?? NON_EMPTY_STRING(entry.description) ?? NON_EMPTY_STRING(entry.excerpt)
    const url = NON_EMPTY_STRING(entry.url) ?? NON_EMPTY_STRING(entry.href) ?? NON_EMPTY_STRING(entry.link)

    let html = ''
    if (title) {
      if (url) {
        html += `<h3><a href="${escapeHtml(url)}">${escapeHtml(title)}</a></h3>`
      } else {
        html += `<h3>${escapeHtml(title)}</h3>`
      }
    }
    if (summary) {
      html += `<p>${escapeHtml(summary)}</p>`
    }

    if (html) {
      return html
    }
  }

  // Handle content-feed type (container with items array)
  if (entryType === 'content-feed') {
    const heading = NON_EMPTY_STRING(entry.heading) ?? NON_EMPTY_STRING(entry.title)
    const items = Array.isArray(entry.items) ? entry.items : undefined

    if (items && items.length > 0) {
      let html = ''
      if (heading) {
        html += `<h3>${escapeHtml(heading)}</h3>`
      }
      html += '<ul>'

      for (const item of items) {
        if (isRecord(item)) {
          const itemHtml = convertUnmappedComponentToHtml(item)
          if (itemHtml) {
            html += `<li>${itemHtml}</li>`
          }
        }
      }

      html += '</ul>'
      return html
    }
  }

  // Handle containers with "items" array (e.g., { "title": "In this section", "items": [{nav-menu-item}, ...] })
  if (Array.isArray(entry.items) && entry.items.length > 0) {
    const containerTitle = NON_EMPTY_STRING(entry.title) ?? NON_EMPTY_STRING(entry.heading)
    let html = ''

    if (containerTitle) {
      html += `<h3>${escapeHtml(containerTitle)}</h3>`
    }

    html += '<ul>'
    for (const item of entry.items) {
      if (isRecord(item)) {
        const itemHtml = convertUnmappedComponentToHtml(item)
        if (itemHtml) {
          html += `<li>${itemHtml}</li>`
        } else {
          // Fallback: extract label/url from item directly
          const label = NON_EMPTY_STRING(item.label) ?? NON_EMPTY_STRING(item.text) ?? NON_EMPTY_STRING(item.title)
          const url = NON_EMPTY_STRING(item.url) ?? NON_EMPTY_STRING(item.href) ?? NON_EMPTY_STRING(item.link)

          if (label && url) {
            html += `<li><a href="${escapeHtml(url)}">${escapeHtml(label)}</a></li>`
          } else if (label) {
            html += `<li>${escapeHtml(label)}</li>`
          }
        }
      }
    }
    html += '</ul>'

    if (html !== '<ul></ul>') {
      return html
    }
  }

  // Handle containers with "cards" array (e.g., { "heading": "", "cards": [{card-item}, ...] })
  if (Array.isArray(entry.cards) && entry.cards.length > 0) {
    const containerHeading = NON_EMPTY_STRING(entry.heading) ?? NON_EMPTY_STRING(entry.title)
    let html = ''

    if (containerHeading) {
      html += `<h3>${escapeHtml(containerHeading)}</h3>`
    }

    html += '<ul>'
    for (const card of entry.cards) {
      if (isRecord(card)) {
        const cardTitle = NON_EMPTY_STRING(card.title) ?? NON_EMPTY_STRING(card.heading)
        const cardSummary = NON_EMPTY_STRING(card.summary) ?? NON_EMPTY_STRING(card.description) ?? NON_EMPTY_STRING(card.excerpt)
        const cardUrl = NON_EMPTY_STRING(card.url) ?? NON_EMPTY_STRING(card.href) ?? NON_EMPTY_STRING(card.link)

        if (cardTitle) {
          let itemHtml = '<li>'

          if (cardUrl) {
            itemHtml += `<h4><a href="${escapeHtml(cardUrl)}">${escapeHtml(cardTitle)}</a></h4>`
          } else {
            itemHtml += `<h4>${escapeHtml(cardTitle)}</h4>`
          }

          if (cardSummary) {
            itemHtml += `<p>${escapeHtml(cardSummary)}</p>`
          }

          itemHtml += '</li>'
          html += itemHtml
        }
      }
    }
    html += '</ul>'

    if (html !== '<ul></ul>') {
      return html
    }
  }

  return undefined
}

function createFallbackTwoColumnComponent(context: LegacyTwoColumnMapperContext): CMSComponentProps | undefined {
  const { entry, component, side, index } = context
  const heading =
    NON_EMPTY_STRING(entry.heading) ??
    NON_EMPTY_STRING(entry.title) ??
    NON_EMPTY_STRING(entry.label)
  const bodyCandidate =
    NON_EMPTY_STRING(entry.body) ??
    NON_EMPTY_STRING(entry.description) ??
    NON_EMPTY_STRING(entry.text)

  // Try to convert unmapped component types to HTML first
  let body: string
  if (bodyCandidate) {
    body = bodyCandidate
  } else {
    const convertedHtml = convertUnmappedComponentToHtml(entry)
    if (convertedHtml) {
      body = convertedHtml
    } else {
      // No usable content found - skip creating component
      // This is better than showing raw JSON which confuses users
      // The entry either has no content or content we can't display
      return undefined
    }
  }

  const content: Record<string, unknown> = {
    body
  }
  if (heading) {
    content.heading = heading
  }

  return {
    id: createSlotComponentId(component.id, side, index, entry.id),
    type: ComponentType.TextBlock,
    category: ComponentCategory.Content,
    theme: 'auto',
    variant: 'default',
    content
  }
}

function convertLegacyTwoColumnEntry(context: LegacyTwoColumnMapperContext): CMSComponentProps | undefined {
  const rawType = typeof context.entry.type === 'string' ? context.entry.type : undefined
  if (!rawType) {
    return undefined
  }
  const normalizedKey = normalizeComponentKey(rawType)
  const mapper = LEGACY_TWO_COLUMN_MAPPERS[normalizedKey] ?? LEGACY_TWO_COLUMN_MAPPERS[rawType]
  if (!mapper) {
    return undefined
  }
  const mapped = mapper(context)
  if (!mapped) {
    return undefined
  }
  const id = createSlotComponentId(context.component.id, context.side, context.index, context.entry.id)
  return {
    id,
    ...mapped
  }
}

function upgradeTwoColumnContent(
  content: Record<string, unknown>,
  component: ComponentInstance,
  assetOrigin?: string
): Record<string, unknown> {
  const result = { ...content }
  const existingAreasRaw = isRecord(content.areas) ? content.areas : undefined

  const initializeExisting = (side: TwoColumnSide): CMSComponentProps[] | undefined => {
    if (!existingAreasRaw) {
      return undefined
    }
    const raw = side === 'left' ? (existingAreasRaw.left as unknown) : (existingAreasRaw.right as unknown)
    if (!Array.isArray(raw)) {
      return undefined
    }
    const filtered = raw.filter(isCmsComponentPropsCandidate)
    return filtered.length > 0 ? filtered.map(entry => cloneJson(entry)) : undefined
  }

  const nextAreas: { left?: CMSComponentProps[]; right?: CMSComponentProps[] } = {
    left: initializeExisting('left'),
    right: initializeExisting('right')
  }

  let mutated = false

  const processSide = (columnKey: 'leftColumn' | 'rightColumn', side: TwoColumnSide): void => {
    const rawColumn = result[columnKey]
    if (!Array.isArray(rawColumn)) {
      return
    }

    const migrated: CMSComponentProps[] = []

    rawColumn.forEach((entry, index) => {
      if (!isRecord(entry)) {
        return
      }

      // Check if entry already has the full CMS shape
      const hasFullShape =
        typeof entry.id === 'string' &&
        typeof entry.type === 'string' &&
        typeof entry.category === 'string' &&
        isRecord(entry.content)

      if (hasFullShape) {
        // Already in CMS format, just clone and use
        migrated.push(cloneJson(entry) as unknown as CMSComponentProps)
        return
      }

      // Check if entry has partial shape (id, type, content but missing category/theme/variant)
      const hasPartialShape =
        typeof entry.type === 'string' &&
        (typeof entry.id === 'string' || isRecord(entry.content))

      if (hasPartialShape) {
        // Normalize to full CMS format by adding defaults
        const entryType = String(entry.type)
        const entryId = typeof entry.id === 'string'
          ? entry.id
          : createSlotComponentId(component.id, side, index)

        // Determine content: use existing content wrapper, or wrap top-level props
        let entryContent: Record<string, unknown>
        if (isRecord(entry.content)) {
          entryContent = entry.content
        } else {
          // Extract content fields from entry (excluding meta fields)
          const { id: _id, type: _type, category: _cat, theme: _th, variant: _var, ...rest } = entry
          entryContent = rest
        }

        // Resolve category from type
        const resolvedCategory = resolveCategoryFromType(entryType)

        migrated.push({
          id: entryId,
          type: entryType as ComponentType,
          category: resolvedCategory,
          theme: 'auto',
          variant: 'default',
          content: entryContent
        })
        return
      }

      // Fall back to legacy mapper for truly legacy shapes
      let upgraded = convertLegacyTwoColumnEntry({
        entry,
        component,
        side,
        index,
        assetOrigin
      })

      if (!upgraded) {
        upgraded = createFallbackTwoColumnComponent({
          entry,
          component,
          side,
          index,
          assetOrigin
        })
      }

      if (upgraded) {
        migrated.push(upgraded)
      }
    })

    if (migrated.length > 0) {
      mutated = true
      if (side === 'left') {
        nextAreas.left = migrated
      } else {
        nextAreas.right = migrated
      }
    }

    // Clear the column key since we've moved data to areas
    if (rawColumn.length > 0) {
      delete result[columnKey]
      mutated = true
    }
  }

  processSide('leftColumn', 'left')
  processSide('rightColumn', 'right')

  if (mutated) {
    const areas: Record<string, unknown> = {}
    if (nextAreas.left && nextAreas.left.length > 0) {
      areas.left = nextAreas.left
    }
    if (nextAreas.right && nextAreas.right.length > 0) {
      areas.right = nextAreas.right
    }
    if (Object.keys(areas).length > 0) {
      result.areas = areas
    } else {
      delete result.areas
    }
  }

  return mutated ? result : content
}

function enrichComponentFromShared(
  component: ComponentInstance,
  sharedComponents: SnapshotSharedComponent[] | undefined,
  options?: { assetOrigin?: string }
): ComponentInstance {
  const props = normalizeProps(component.props)
  const normalizedType = normalizeComponentKey(component.type)
  const sharedComponentId = typeof props.sharedComponentId === 'string' ? props.sharedComponentId : undefined
  const assetOrigin = options?.assetOrigin

  let normalizedContent = isRecord(component.content) ? component.content : {}

  if (sharedComponentId && sharedComponents) {
    const shared = sharedComponents.find(entry => entry.id === sharedComponentId)
    if (shared && isRecord(shared.content)) {
      if (normalizedType === 'navigation' || normalizedType === 'navbar') {
        normalizedContent = normalizeNavBarContent(shared.content, assetOrigin)
      } else if (
        normalizedType === 'cta' ||
        normalizedType === 'cta-banner' ||
        normalizedType === 'cta-simple' ||
        normalizedType === 'cta-button-group'
      ) {
        normalizedContent = normalizeCtaContent(shared.content)
      } else if (
        normalizedType === 'feature-grid' ||
        normalizedType === 'feature-list' ||
        normalizedType === 'feature-showcase'
      ) {
        normalizedContent = normalizeFeatureGridContent(shared.content, assetOrigin)
      } else {
        normalizedContent = shared.content as Record<string, unknown>
      }
    }
  }

  const propsContent = isRecord(props.content) ? props.content : undefined

  if (normalizedType === 'two-column') {
    // Check if propsContent is already enriched with areas structure (from page-builder)
    // If so, use it directly to preserve columnRatio and nested content (bodyHtml, etc.)
    const propsHasEnrichedAreas =
      isRecord(propsContent) &&
      isRecord(propsContent.areas) &&
      (Array.isArray((propsContent.areas as Record<string, unknown>).left) ||
        Array.isArray((propsContent.areas as Record<string, unknown>).right))

    if (propsHasEnrichedAreas) {
      // propsContent already has the correct enriched data from page-builder
      // Use it directly without running through upgradeTwoColumnContent again
      normalizedContent = cloneJson(propsContent) as Record<string, unknown>
    } else {
      // Check if props.text contains the actual column data as JSON string (from LLM detection)
      let parsedTextContent: Record<string, unknown> | undefined
      if (typeof props.text === 'string' && props.text.includes('leftColumn')) {
        try {
          const parsed = JSON.parse(props.text)
          if (isRecord(parsed) && (Array.isArray(parsed.leftColumn) || Array.isArray(parsed.rightColumn))) {
            // Transform LLM tuple format [[type, confidence, props]] to entry format
            // The mapper expects entry.heading, entry.body, etc. at the top level
            const transformColumn = (column: unknown[]): unknown[] => {
              if (!Array.isArray(column)) return []

              // Handle double-nesting: [[[tuples]]] -> [[tuples]]
              let items = column
              while (items.length === 1 && Array.isArray(items[0])) {
                items = items[0] as unknown[]
              }

              return items.map((item) => {
                if (Array.isArray(item) && item.length >= 3) {
                  const [type, , itemProps] = item
                  // Flatten itemProps to entry level for mapper compatibility
                  return {
                    type: String(type),
                    ...(isRecord(itemProps) ? itemProps : {})
                  }
                }
                return item
              })
            }
            parsedTextContent = {
              leftColumn: transformColumn(parsed.leftColumn as unknown[]),
              rightColumn: transformColumn(parsed.rightColumn as unknown[]),
              // Preserve columnRatio if present (e.g., "25-75", "50-50")
              ...(typeof parsed.columnRatio === 'string' ? { columnRatio: parsed.columnRatio } : {})
            }
          }
        } catch {
          // Invalid JSON, ignore
        }
      }

      // Use parsedTextContent if available and normalizedContent is empty
      const hasNonEmptyContent =
        isRecord(normalizedContent) &&
        ((Array.isArray(normalizedContent.leftColumn) && normalizedContent.leftColumn.length > 0) ||
          (Array.isArray(normalizedContent.rightColumn) && normalizedContent.rightColumn.length > 0))

      const sourceContent = hasNonEmptyContent
        ? normalizedContent
        : parsedTextContent ?? propsContent ?? (isRecord(normalizedContent) ? normalizedContent : {})

      if (isRecord(sourceContent)) {
        normalizedContent = upgradeTwoColumnContent(cloneJson(sourceContent), component, assetOrigin)
      }
    }
  }

  component.content = cloneJson(normalizedContent)

  const defaultClassName = getDefaultClassName(normalizedType)
  const existingClassName = typeof props.className === 'string' ? props.className : undefined
  const className = mergeClassNames(defaultClassName, existingClassName)

  const nextProps: Record<string, unknown> = {
    ...props,
    className
  }

  if (Object.keys(normalizedContent).length > 0) {
    nextProps.content = cloneJson(normalizedContent)
  }

  if ((normalizedType === 'navigation' || normalizedType === 'navbar') && typeof nextProps.sticky !== 'boolean') {
    nextProps.sticky = true
  }

  component.props = nextProps

  return component
}

export interface BuildSnapshotOptions {
  prisma?: PrismaClient
  websiteId: string
  templateOverrideKey?: string
  designConcept?: string
  /**
   * When true, resolves mediaId references to actual URLs.
   * This enables images and media to load correctly at runtime.
   * Defaults to true.
   */
  resolveMedia?: boolean
  /**
   * When true, skips loading page content during snapshot build.
   * Use this for UCS providers where pages are loaded at runtime via resolvePageBySlug().
   * Structure, shared components, and design system are still loaded.
   * Defaults to false.
   */
  skipPageContent?: boolean
}

export async function buildUcsSiteSnapshot(
  options: BuildSnapshotOptions
): Promise<{ snapshot: SiteSnapshot; diagnostics: GeneratorDiagnostic[] }> {
  const prisma = options.prisma ?? new PrismaClient()
  let shouldDisconnect = false

  if (!options.prisma) {
    shouldDisconnect = true
  }

  try {
    const builder = new PrismaSiteSnapshotBuilder(
      prisma,
      options.websiteId,
      options.templateOverrideKey,
      options.designConcept,
      options.skipPageContent
    )
    const result = await builder.build()

    // Resolve media references to actual URLs (default: enabled)
    // Skip media resolution when skipPageContent is true (no pages to resolve)
    const shouldResolveMedia = options.resolveMedia !== false && !options.skipPageContent
    if (shouldResolveMedia) {
      const mediaItems: Array<{ data: unknown; label?: string }> = []

      // Collect all pages' components and metadata
      for (const page of result.snapshot.pages) {
        mediaItems.push({ data: page.components, label: `page-${page.id}` })
        mediaItems.push({ data: page.metadata, label: `page-meta-${page.id}` })
      }

      // Collect all shared components
      for (const shared of result.snapshot.sharedComponents) {
        mediaItems.push({ data: shared.content, label: `shared-${shared.id}` })
        mediaItems.push({ data: shared.config, label: `shared-config-${shared.id}` })
      }

      if (mediaItems.length > 0) {
        const mediaResult = await resolveRuntimeMediaBatch(mediaItems, options.websiteId, prisma)

        if (mediaResult.totalUnresolved > 0) {
          result.diagnostics.push({
            level: 'warn',
            code: 'UCS_SNAPSHOT_MEDIA_PARTIALLY_RESOLVED',
            message: `Snapshot media resolution: ${mediaResult.totalResolved} resolved, ${mediaResult.totalUnresolved} unresolved`,
            context: {
              resolved: mediaResult.totalResolved,
              unresolved: mediaResult.totalUnresolved,
              errors: mediaResult.errors.slice(0, 10)
            }
          })
        } else if (mediaResult.totalResolved > 0) {
          result.diagnostics.push({
            level: 'info',
            code: 'UCS_SNAPSHOT_MEDIA_RESOLVED',
            message: `Successfully resolved ${mediaResult.totalResolved} media references in snapshot`,
            context: { resolved: mediaResult.totalResolved }
          })
        }
      }
    }

    return result
  } finally {
    if (shouldDisconnect) {
      await prisma.$disconnect().catch(() => {})
    }
  }
}

export {
  PrismaSiteSnapshotBuilder,
  enrichComponentFromShared,
  normalizeComponent,
  normalizeComponents,
  normalizeRegionSummary,
  normalizeTemplateProps,
  normalizeMetadata
}
