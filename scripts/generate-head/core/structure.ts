import type { SlugRegistryEntry, SnapshotStructureNode } from './types'
import type {
  GeneratorDiagnostic,
  MappedPageDefinition,
  RouteDefinition,
  SiteSnapshot
} from './types'

interface StructureNode extends SnapshotStructureNode {
  children: StructureNode[]
}

function buildStructureTree(structure: SnapshotStructureNode[]): StructureNode[] {
  const nodeMap = new Map<string, StructureNode>()
  structure.forEach(node => {
    nodeMap.set(node.id, { ...node, children: [] })
  })

  const roots: StructureNode[] = []

  nodeMap.forEach(node => {
    if (node.parentId && nodeMap.has(node.parentId)) {
      nodeMap.get(node.parentId)!.children.push(node)
    } else {
      roots.push(node)
    }
  })

  const sortNodes = (nodes: StructureNode[]) => {
    nodes.sort((a, b) => a.position - b.position)
    nodes.forEach(child => sortNodes(child.children))
  }

  sortNodes(roots)
  return roots
}

function fullPathToSegments(fullPath: string): string[] {
  const trimmed = fullPath.replace(/^\/+|\/+$/g, '')
  if (!trimmed) {
    return []
  }
  return trimmed.split('/').filter(Boolean)
}

function toCanonicalSegments(segments: string[]): string[] {
  return segments.map(segment => segment.toLowerCase())
}

function toCanonicalFullPath(segments: string[]): string {
  if (segments.length === 0) {
    return '/'
  }
  return `/${segments.join('/')}`
}

export function buildRouteDefinitions(
  snapshot: SiteSnapshot,
  mappedPages: MappedPageDefinition[]
): RouteDefinition[] {
  const pageById = new Map(mappedPages.map(page => [page.pageId, page]))
  const snapshotPageById = new Map(snapshot.pages.map(page => [page.id, page]))
  const seenPageIds = new Set<string>()
  const routes: RouteDefinition[] = []

  const tree = buildStructureTree(snapshot.structure)

  // When pages are loaded (static provider), match structure nodes to mapped pages
  // When pages are NOT loaded (UCS provider with skipPageContent), build routes directly from structure
  const hasLoadedPages = mappedPages.length > 0

  const visit = (nodes: StructureNode[]) => {
    for (const node of nodes) {
      if (node.websitePageId) {
        if (hasLoadedPages) {
          // Static provider: match structure to loaded pages
          const page = pageById.get(node.websitePageId)
          if (page) {
            const segments = fullPathToSegments(node.fullPath)
            const routePath = segments.join('/')
            const canonicalSegments = toCanonicalSegments(segments)
            const sourcePage = snapshotPageById.get(page.pageId)
            routes.push({
              pageId: page.pageId,
              fullPath: page.fullPath,
              canonicalFullPath: toCanonicalFullPath(canonicalSegments),
              routePath,
              canonicalRoutePath: canonicalSegments.join('/'),
              segments,
              canonicalSegments,
              title: sourcePage?.title ?? page.template?.name ?? page.fullPath,
              templateKey: page.templateKey
            })
            seenPageIds.add(page.pageId)
          }
        } else {
          // UCS provider: build routes directly from structure (pages loaded at runtime)
          const segments = fullPathToSegments(node.fullPath)
          const routePath = segments.join('/')
          const canonicalSegments = toCanonicalSegments(segments)
          routes.push({
            pageId: node.websitePageId,
            fullPath: node.fullPath,
            canonicalFullPath: toCanonicalFullPath(canonicalSegments),
            routePath,
            canonicalRoutePath: canonicalSegments.join('/'),
            segments,
            canonicalSegments,
            title: node.title ?? node.fullPath,
            templateKey: null
          })
          seenPageIds.add(node.websitePageId)
        }
      }

      if (node.children.length > 0) {
        visit(node.children)
      }
    }
  }

  visit(tree)

  mappedPages.forEach(page => {
    if (!seenPageIds.has(page.pageId)) {
      const segments = fullPathToSegments(page.fullPath)
      const sourcePage = snapshotPageById.get(page.pageId)
      const canonicalSegments = toCanonicalSegments(segments)
      routes.push({
        pageId: page.pageId,
        fullPath: page.fullPath,
        canonicalFullPath: toCanonicalFullPath(canonicalSegments),
        routePath: segments.join('/'),
        canonicalRoutePath: canonicalSegments.join('/'),
        segments,
        canonicalSegments,
        title: sourcePage?.title ?? page.template?.name ?? page.fullPath,
        templateKey: page.templateKey
      })
    }
  })

  return routes
}

export interface StructureIndex {
  nodes: SnapshotStructureNode[]
  childrenByParent: Record<string, string[]>
  pageToStructure: Record<string, string | null>
  nodeById: Record<string, SnapshotStructureNode>
}

function normalizeParentKey(parentId: string | null): string {
  return parentId ?? '__root__'
}

export function buildStructureIndex(snapshot: SiteSnapshot): StructureIndex {
  const childrenByParent = new Map<string, string[]>()
  const nodeById = new Map<string, SnapshotStructureNode>()
  const pageToStructure: Record<string, string | null> = {}

  snapshot.structure.forEach(node => {
    nodeById.set(node.id, node)
    if (node.websitePageId) {
      pageToStructure[node.websitePageId] = node.id
    }

    const key = normalizeParentKey(node.parentId)
    const existing = childrenByParent.get(key) ?? []
    existing.push(node.id)
    childrenByParent.set(key, existing)
  })

  childrenByParent.forEach(ids => {
    ids.sort((a, b) => {
      const left = nodeById.get(a)
      const right = nodeById.get(b)
      const leftPos = left?.position ?? 0
      const rightPos = right?.position ?? 0
      return leftPos - rightPos
    })
  })

  snapshot.pages.forEach(page => {
    if (!pageToStructure[page.id]) {
      pageToStructure[page.id] = null
    }
  })

  return {
    nodes: snapshot.structure,
    childrenByParent: Object.fromEntries(childrenByParent.entries()),
    pageToStructure,
    nodeById: Object.fromEntries(Array.from(nodeById.entries()))
  }
}

export interface SlugRegistryResult {
  entries: SlugRegistryEntry[]
  diagnostics: GeneratorDiagnostic[]
}

export function buildSlugRegistry(
  routes: RouteDefinition[],
  structureIndex: StructureIndex
): SlugRegistryResult {
  function toSlugKey(segments: string[]): string {
    if (segments.length === 0) {
      return '__root__'
    }
    return segments.join('/')
  }

  const diagnostics: GeneratorDiagnostic[] = []
  const canonicalByFullPath = new Map<string, SlugRegistryEntry>()

  const entries = routes.map(route => {
    const structureId = structureIndex.pageToStructure[route.pageId] ?? null
    const structureNode = structureId ? structureIndex.nodeById[structureId] : undefined
    const entry: SlugRegistryEntry = {
      pageId: route.pageId,
      slug: route.canonicalSegments,
      canonicalSlug: route.canonicalSegments,
      canonicalFullPath: route.canonicalFullPath,
      originalSlug: route.segments,
      originalFullPath: route.fullPath,
      fullPath: route.fullPath,
      templateKey: route.templateKey,
      title: route.title,
      aliasOf: null,
      structureId,
      parentId: structureNode?.parentId ?? null
    }

    const existing = canonicalByFullPath.get(route.canonicalFullPath)
    if (existing && existing.pageId !== entry.pageId) {
      diagnostics.push({
        code: 'ROUTE_CASE_COLLISION',
        level: 'error',
        message: `Routes "${existing.originalFullPath}" and "${entry.originalFullPath}" resolve to the same canonical path "${route.canonicalFullPath}".`,
        context: {
          canonicalFullPath: route.canonicalFullPath,
          conflictedPageId: entry.pageId,
          existingPageId: existing.pageId,
          existingOriginalFullPath: existing.originalFullPath,
          conflictedOriginalFullPath: entry.originalFullPath
        }
      })
    } else if (!existing) {
      canonicalByFullPath.set(route.canonicalFullPath, entry)
    }

    return entry
  })

  const hasRootEntry = entries.some(entry => entry.slug.length === 0)
  if (!hasRootEntry && entries.length > 0) {
    const primary = entries[0]
    const canonicalKey = toSlugKey(primary.canonicalSlug)
    entries.unshift({
      slug: [],
      canonicalSlug: [],
      canonicalFullPath: '/',
      originalSlug: [],
      originalFullPath: '/',
      pageId: primary.pageId,
      fullPath: '/',
      templateKey: primary.templateKey,
      title: primary.title,
      aliasOf: canonicalKey,
      structureId: null,
      parentId: null
    })
  }

  return { entries, diagnostics }
}

