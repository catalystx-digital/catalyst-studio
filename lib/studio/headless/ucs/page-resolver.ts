import { Prisma, PrismaClient } from '@/lib/generated/prisma'
import { ComponentType } from '@/lib/studio/components/cms/_core/types'
import {
  enrichComponentFromShared,
  normalizeMetadata,
  normalizeTemplateProps,
  extractSiteOriginFromMetadata
} from '@/lib/studio/headless/ucs/snapshot-builder'
import { normalizePageContent, type PageContentDiagnostic } from '@/lib/studio/page-content'
import type {
  SnapshotPage,
  SnapshotSharedComponent,
  SnapshotStructureNode
} from '@/lib/studio/headless/site-snapshot/types'
import {
  canonicalSlugKey,
  canonicalizeSlugSegments,
  sanitizeSlugSegments,
  slugSegmentsToPath
} from '@/lib/studio/utils/slug-canonicalizer'
import { resolveSharedComponentReference } from '@/lib/studio/types/site-builder/component-instance'
import { resolveRuntimeMediaBatch } from './runtime-media-resolver'

export type ResolverDiagnosticLevel = 'info' | 'warn' | 'error'

export interface ResolverDiagnostic {
  level: ResolverDiagnosticLevel
  code: string
  message: string
  context?: Record<string, unknown>
}

export interface ResolverStructurePayload {
  current: SnapshotStructureNode | null
  ancestors: SnapshotStructureNode[]
  children: SnapshotStructureNode[]
}

export interface ResolverPagePayload {
  page: SnapshotPage
  structure?: ResolverStructurePayload
  sharedComponents: SnapshotSharedComponent[]
  diagnostics: ResolverDiagnostic[]
}

export interface ResolvePageBySlugOptions {
  prisma: PrismaClient
  websiteId: string
  slug: string[]
  originalSlug?: string[]
  sharedComponentCache?: Map<string, SnapshotSharedComponent>
  assetOrigin?: string
  /**
   * When true, resolves mediaId references to actual URLs.
   * This enables images and media to load correctly at runtime.
   * Defaults to true.
   */
  resolveMedia?: boolean
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function cloneNode<T>(value: T): T {
  return value ? JSON.parse(JSON.stringify(value)) as T : value
}

function mapNormalizerDiagnosticToResolver(
  diagnostic: PageContentDiagnostic,
  context: Record<string, unknown>
): ResolverDiagnostic {
  return {
    code: diagnostic.code,
    level: diagnostic.severity,
    message: diagnostic.message,
    context: {
      ...context,
      ...(diagnostic.path ? { path: diagnostic.path } : {}),
      ...(diagnostic.componentId ? { componentId: diagnostic.componentId } : {}),
      ...(diagnostic.context ?? {}),
    },
  }
}

const structureChildSelect = Prisma.validator<Prisma.WebsiteStructureSelect>()({
  id: true,
  parentId: true,
  slug: true,
  fullPath: true,
  position: true,
  websitePageId: true
})

const websitePageSelect = Prisma.validator<Prisma.WebsitePageSelect>()({
  id: true,
  title: true,
  content: true,
  templateKey: true,
  templateProps: true,
  metadata: true
})

type StructureChildRecord = Prisma.WebsiteStructureGetPayload<{
  select: typeof structureChildSelect
}>

type StructureRecordWithChildren = Prisma.WebsiteStructureGetPayload<{
  include: {
    websitePage: {
      select: typeof websitePageSelect
    }
    children: {
      select: typeof structureChildSelect
    }
  }
}>

interface StructureBundle {
  current: StructureRecordWithChildren | null
  ancestors: StructureChildRecord[]
}

function toSnapshotStructureNodeFromRecord(
  record: StructureRecordWithChildren | StructureChildRecord
): SnapshotStructureNode {
  return {
    id: record.id,
    parentId: record.parentId ?? null,
    slug: record.slug,
    fullPath: record.fullPath,
    position: record.position,
    websitePageId: record.websitePageId ?? null,
    isFolder: !record.websitePageId
  }
}

function sortAncestors(ancestors: StructureChildRecord[], currentId: string | null): StructureChildRecord[] {
  const filtered = ancestors.filter(ancestor => ancestor.id !== currentId)
  return filtered.sort((a, b) => {
    const aDepth = a.fullPath.split('/').filter(Boolean).length
    const bDepth = b.fullPath.split('/').filter(Boolean).length
    if (aDepth === bDepth) {
      return a.position - b.position
    }
    return aDepth - bDepth
  })
}

async function fetchStructureBundle(
  prisma: PrismaClient,
  websiteId: string,
  slugSegments: string[]
): Promise<StructureBundle> {
  /**
   * Query layout is documented in docs/studio/ucs-slug-resolver.md.
   * Keep the selection focused on routing fields so Prisma only transfers
   * structure metadata plus the page payload required for rendering.
   */
  const canonical = canonicalizeSlugSegments(slugSegments)

  if (canonical.length === 0) {
    // Query by exact fullPath '/' to find the homepage
    // This matches how the static registry identifies the root page
    const current = await prisma.websiteStructure.findFirst({
      where: { websiteId, fullPath: '/' },
      include: {
        websitePage: {
          select: websitePageSelect
        },
        children: {
          orderBy: [{ position: 'asc' }],
          select: structureChildSelect
        }
      }
    })

    return { current, ancestors: [] }
  }

  const fullPath = slugSegmentsToPath(canonical)
  const ancestorFullPaths: string[] = []
  for (let index = 0; index < canonical.length - 1; index += 1) {
    const slice = canonical.slice(0, index + 1)
    ancestorFullPaths.push(slugSegmentsToPath(slice))
  }

  const [current, ancestorRecords] = await Promise.all([
    prisma.websiteStructure.findFirst({
      where: { websiteId, fullPath },
      include: {
        websitePage: {
          select: websitePageSelect
        },
        children: {
          orderBy: [{ position: 'asc' }],
          select: structureChildSelect
        }
      }
    }),
    ancestorFullPaths.length > 0
      ? prisma.websiteStructure.findMany({
          where: {
            websiteId,
            fullPath: { in: ancestorFullPaths }
          },
          select: structureChildSelect
        })
      : Promise.resolve([])
  ])

  const ancestors = sortAncestors(ancestorRecords, current?.id ?? null)

  return { current, ancestors }
}

function buildStructurePayloadFromBundle(bundle: StructureBundle): ResolverStructurePayload {
  if (!bundle.current) {
    return { current: null, ancestors: [], children: [] }
  }

  const children = bundle.current.children
    .slice()
    .sort((a, b) => a.position - b.position)
    .map(child => toSnapshotStructureNodeFromRecord(child))

  const ancestors = bundle.ancestors.map(ancestor => toSnapshotStructureNodeFromRecord(ancestor))

  return {
    current: cloneNode(toSnapshotStructureNodeFromRecord(bundle.current)),
    ancestors: cloneNode(ancestors),
    children: cloneNode(children)
  }
}

export async function loadSharedComponentsById(
  prisma: PrismaClient,
  websiteId: string,
  ids: string[],
  cache: Map<string, SnapshotSharedComponent>
): Promise<SnapshotSharedComponent[]> {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)))
  const missing = uniqueIds.filter(id => !cache.has(id))

  if (missing.length > 0) {
    const sharedComponents = await prisma.websiteSharedComponent.findMany({
      where: { websiteId, id: { in: missing } },
      include: {
        websiteComponentType: {
          select: {
            type: true
          }
        }
      }
    })

    sharedComponents.forEach(component => {
      const payload: SnapshotSharedComponent = {
        id: component.id,
        name: component.name,
        componentType: (component.websiteComponentType?.type as ComponentType) ?? ComponentType.TextBlock,
        content: isRecord(component.content) ? cloneNode(component.content) : null,
        config: isRecord(component.config) ? cloneNode(component.config) : {}
      }
      cache.set(component.id, payload)
    })
  }

  return uniqueIds
    .map(id => cache.get(id))
    .filter((value): value is SnapshotSharedComponent => Boolean(value))
    .map(component => cloneNode(component))
}

export async function resolveUcsPageBySlug(
  options: ResolvePageBySlugOptions
): Promise<{ payload: ResolverPagePayload | null; diagnostics: ResolverDiagnostic[] }> {
  /**
   * Query batching mirrors the flow documented in docs/studio/ucs-slug-resolver.md.
   * Changes here should be reflected there so the operational runbook stays accurate.
   */
  const diagnostics: ResolverDiagnostic[] = []
  const requestedSlug = sanitizeSlugSegments(options.originalSlug ?? options.slug)
  const canonicalSlug = canonicalizeSlugSegments(options.slug)
  const slugKey = canonicalSlugKey(options.slug)
  const canonicalPath = slugSegmentsToPath(canonicalSlug)

  const bundle = await fetchStructureBundle(options.prisma, options.websiteId, canonicalSlug)

  const structureRecord = bundle.current

  if (!structureRecord) {
    diagnostics.push({
      level: 'warn',
      code: 'UCS_SLUG_NOT_FOUND',
      message: `No structure found for slug ${slugKey}`,
      context: {
        requestedSlug,
        canonicalSlug,
        canonicalPath,
        slugKey
      }
    })
    return { payload: null, diagnostics }
  }

  // Handle folder slugs - structure nodes without attached pages
  if (!structureRecord.websitePage) {
    diagnostics.push({
      level: 'info',
      code: 'UCS_FOLDER_SLUG_RESOLVED',
      message: `Folder slug resolved with ${structureRecord.children.length} children`,
      context: {
        requestedSlug,
        canonicalSlug,
        canonicalPath,
        slugKey,
        childCount: structureRecord.children.length,
        folderPath: structureRecord.fullPath
      }
    })

    // Create a minimal folder page payload
    const structurePayload = buildStructurePayloadFromBundle(bundle)
    const folderPage: SnapshotPage = {
      id: `folder-${structureRecord.id}`,
      title: structureRecord.slug ? structureRecord.slug.charAt(0).toUpperCase() + structureRecord.slug.slice(1) : 'Folder',
      fullPath: structureRecord.fullPath || '/',
      templateKey: null,
      templateProps: {},
      regions: [],
      components: [],
      metadata: {
        isFolder: true,
        childCount: structureRecord.children.length
      }
    }

    return {
      payload: {
        page: folderPage,
        structure: structurePayload,
        sharedComponents: [],
        diagnostics: []
      },
      diagnostics
    }
  }

  const pageRecord = structureRecord.websitePage
  const { pageContent, diagnostics: normalizerDiagnostics } = normalizePageContent(pageRecord.content)
  normalizerDiagnostics.forEach(diagnostic => {
    diagnostics.push(mapNormalizerDiagnosticToResolver(diagnostic, {
      websiteId: options.websiteId,
      pageId: pageRecord.id,
      source: 'page.content',
      fullPath: structureRecord.fullPath ?? canonicalPath,
    }))
  })
  const regions = pageContent.regions ?? []
  const components = pageContent.components
  const sharedComponentIds = Array.from(
    new Set(
      components
        .map(component => resolveSharedComponentReference(component))
        .filter((value): value is string => typeof value === 'string' && value.length > 0)
    )
  )

  const sharedComponentCache = options.sharedComponentCache ?? new Map<string, SnapshotSharedComponent>()
  const sharedComponents = await loadSharedComponentsById(
    options.prisma,
    options.websiteId,
    sharedComponentIds,
    sharedComponentCache
  )

  const metadata = normalizeMetadata(pageRecord.metadata)
  const templateProps = normalizeTemplateProps(pageRecord.templateProps)
  let assetOrigin =
    extractSiteOriginFromMetadata(metadata) ??
    extractSiteOriginFromMetadata(pageRecord.metadata) ??
    options.assetOrigin

  const hydratedComponents = components.map(component =>
    enrichComponentFromShared(component, sharedComponents, { assetOrigin, diagnostics })
  )
  const metadataRecord = metadata as Record<string, unknown>
  const metadataFullPath = typeof metadataRecord.fullPath === 'string' ? metadataRecord.fullPath : undefined
  const fullPath = structureRecord.fullPath ?? metadataFullPath ?? `/${pageRecord.id}`

  const page: SnapshotPage = {
    id: pageRecord.id,
    title: pageRecord.title,
    fullPath,
    templateKey: pageRecord.templateKey,
    templateProps: templateProps,
    regions,
    components: hydratedComponents,
    metadata,
    sharedComponentIds
  }

  const structurePayload = buildStructurePayloadFromBundle(bundle)

  // Resolve media references to actual URLs (default: enabled)
  const shouldResolveMedia = options.resolveMedia !== false
  if (shouldResolveMedia) {
    const mediaItems: Array<{ data: unknown; label?: string }> = [
      { data: page.components, label: 'page-components' },
      { data: page.metadata, label: 'page-metadata' }
    ]
    // Also resolve media in shared components
    for (const shared of sharedComponents) {
      mediaItems.push({ data: shared.content, label: `shared-${shared.id}` })
      mediaItems.push({ data: shared.config, label: `shared-config-${shared.id}` })
    }

    const mediaResult = await resolveRuntimeMediaBatch(mediaItems, options.websiteId, options.prisma)

    if (mediaResult.totalUnresolved > 0) {
      diagnostics.push({
        level: 'warn',
        code: 'UCS_MEDIA_PARTIALLY_RESOLVED',
        message: `Media resolution: ${mediaResult.totalResolved} resolved, ${mediaResult.totalUnresolved} unresolved`,
        context: {
          resolved: mediaResult.totalResolved,
          unresolved: mediaResult.totalUnresolved,
          errors: mediaResult.errors.slice(0, 5) // Limit error messages
        }
      })
    } else if (mediaResult.totalResolved > 0) {
      diagnostics.push({
        level: 'info',
        code: 'UCS_MEDIA_RESOLVED',
        message: `Successfully resolved ${mediaResult.totalResolved} media references`,
        context: { resolved: mediaResult.totalResolved }
      })
    }
  }

  return {
    payload: {
      page: cloneNode(page),
      structure: structurePayload,
      sharedComponents,
      diagnostics: []
    },
    diagnostics
  }
}
