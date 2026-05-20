import type { Node, Edge } from 'reactflow'
import type { ProfessionalNodeData } from '@/lib/studio/components/site-builder/professional-nodes'

export type PlaceholderImportStatus = 'pending' | 'processing' | 'ready' | 'failed' | 'skipped' | 'invalid'

export interface PlaceholderPageInput {
  url: string
  status?: string
  order?: number
  normalizedPageUrl?: string
  title?: string | null
  rawStatus?: string
}

export interface PlaceholderNodeDescriptor {
  id: string
  url: string
  normalizedUrl: string
  label: string
  status: PlaceholderImportStatus
  order: number
  depth: number
  position: { x: number; y: number }
  parentNormalizedUrl: string | null
}

export interface PlaceholderEdgeDescriptor {
  id: string
  sourceId: string
  targetId: string
}

export interface PlaceholderGraphDescriptor {
  nodes: PlaceholderNodeDescriptor[]
  edges: PlaceholderEdgeDescriptor[]
}

export interface PlaceholderGraphOptions {
  existingUrls?: Iterable<string>
}

const COLUMN_WIDTH = 320
const ROW_HEIGHT = 220
const TRACKING_PARAMS = new Set(['fbclid', 'gclid', 'msclkid'])
const TRACKING_PARAM_PREFIXES = ['utm_']

const STATUS_MAP: Record<string, PlaceholderImportStatus> = {
  pending: 'pending',
  queued: 'pending',
  waiting: 'pending',
  processing: 'processing',
  detecting: 'processing',
  detected: 'processing',
  analyzing: 'processing',
  normalizing: 'processing',
  normalized: 'processing',
  staged: 'processing',
  committing: 'processing',
  ready: 'ready',
  committed: 'ready',
  completed: 'ready',
  success: 'ready',
  failed: 'failed',
  failed_retryable: 'failed',
  failed_terminal: 'failed',
  recoverable_stuck: 'invalid',
  unknown: 'invalid',
  skipped: 'skipped',
  invalid: 'invalid',
}

const normalizeStatus = (raw?: string | null): PlaceholderImportStatus => {
  if (!raw) return 'pending'
  const key = raw.trim().toLowerCase()
  return STATUS_MAP[key] ?? 'pending'
}

const labelFromUrl = (url: string, normalizedUrl: string): string => {
  try {
    const parsed = new URL(url)
    const pathname = parsed.pathname === '/' ? '' : parsed.pathname
    return `${parsed.hostname}${pathname}` || normalizedUrl
  } catch {
    return normalizedUrl
  }
}

const stablePlaceholderId = (normalizedUrl: string): string => {
  let hash = 0
  for (let index = 0; index < normalizedUrl.length; index += 1) {
    hash = ((hash << 5) - hash + normalizedUrl.charCodeAt(index)) | 0
  }
  return `import-placeholder-${Math.abs(hash).toString(36)}`
}

const depthFromNormalizedUrl = (normalizedUrl: string): number => {
  try {
    const parsed = new URL(normalizedUrl)
    return parsed.pathname.split('/').filter(Boolean).length
  } catch {
    return normalizedUrl.split('/').filter(Boolean).length
  }
}

const parentFromNormalizedUrl = (normalizedUrl: string): string | null => {
  try {
    const parsed = new URL(normalizedUrl)
    const segments = parsed.pathname.split('/').filter(Boolean)
    if (segments.length <= 0) {
      return null
    }
    const parentSegments = segments.slice(0, -1)
    const parentPath = parentSegments.length > 0 ? `/${parentSegments.join('/')}` : '/'
    return `${parsed.origin}${parentPath}`
  } catch {
    const parts = normalizedUrl.split('/').filter(Boolean)
    if (parts.length <= 0) {
      return null
    }
    const parentParts = parts.slice(0, -1)
    return parentParts.length > 0 ? parentParts.join('/') : '/'
  }
}

export const normalizeImportUrl = (raw: string): string | null => {
  if (!raw || typeof raw !== 'string') {
    return null
  }
  const trimmed = raw.trim()
  if (!trimmed) {
    return null
  }
  try {
    const parsed = new URL(trimmed)
    parsed.hash = ''
    parsed.hostname = parsed.hostname.toLowerCase()
    parsed.pathname = parsed.pathname && parsed.pathname !== '/' ? parsed.pathname.replace(/\/+$/, '') : '/'
    for (const key of Array.from(parsed.searchParams.keys())) {
      const lower = key.toLowerCase()
      if (TRACKING_PARAMS.has(lower) || TRACKING_PARAM_PREFIXES.some(prefix => lower.startsWith(prefix))) {
        parsed.searchParams.delete(key)
      }
    }
    const sorted = Array.from(parsed.searchParams.entries()).sort(([a], [b]) => a.localeCompare(b))
    parsed.search = ''
    sorted.forEach(([key, value]) => parsed.searchParams.append(key, value))
    return `${parsed.origin}${parsed.pathname}${parsed.search}`
  } catch {
    const [withoutHash] = trimmed.split('#')
    const [pathPart, queryPart] = withoutHash.split('?')
    const normalizedPath = pathPart.replace(/\/+$/, '') || '/'
    const normalized = queryPart ? `${normalizedPath}?${queryPart}` : normalizedPath
    if (normalized.startsWith('http://') || normalized.startsWith('https://')) {
      return normalized
    }
    return normalized.startsWith('/') ? normalized : `/${normalized}`
  }
}

export const buildPlaceholderGraph = (
  inputs: PlaceholderPageInput[] | undefined,
  options?: PlaceholderGraphOptions,
): PlaceholderGraphDescriptor => {
  if (!Array.isArray(inputs) || inputs.length === 0) {
    return { nodes: [], edges: [] }
  }

  const existingNormalized = new Set<string>()
  if (options?.existingUrls) {
    for (const value of options.existingUrls) {
      if (typeof value !== 'string') continue
      const normalized = normalizeImportUrl(value)
      if (normalized) {
        existingNormalized.add(normalized)
      }
    }
  }

  const candidates = inputs
    .map((page, index) => {
      if (!page || typeof page.url !== 'string') {
        return null
      }
      const normalizedUrl = normalizeImportUrl(page.normalizedPageUrl || page.url)
      if (!normalizedUrl || existingNormalized.has(normalizedUrl)) {
        return null
      }
      const order = typeof page.order === 'number' ? page.order : index
      const status = normalizeStatus(page.status)
      const depth = depthFromNormalizedUrl(normalizedUrl)
      const parentNormalizedUrl = parentFromNormalizedUrl(normalizedUrl)
      return {
        page,
        normalizedUrl,
        order,
        status,
        depth,
        parentNormalizedUrl,
      }
    })
    .filter((entry): entry is {
      page: PlaceholderPageInput
      normalizedUrl: string
      order: number
      status: PlaceholderImportStatus
      depth: number
      parentNormalizedUrl: string | null
    } => Boolean(entry))

  const dedupedByUrl = new Map<string, (typeof candidates)[number]>()
  candidates.forEach((entry) => {
    const existing = dedupedByUrl.get(entry.normalizedUrl)
    if (!existing || entry.order < existing.order) {
      dedupedByUrl.set(entry.normalizedUrl, entry)
    }
  })

  const intermediate = Array.from(dedupedByUrl.values())
    .sort((a, b) => a.order - b.order)

  if (intermediate.length === 0) {
    return { nodes: [], edges: [] }
  }

  const urlToNodeId = new Map<string, string>()
  const depthCounts = new Map<number, number>()

  const nodes: PlaceholderNodeDescriptor[] = intermediate.map((entry, index) => {
    const id = stablePlaceholderId(entry.normalizedUrl)
    urlToNodeId.set(entry.normalizedUrl, id)

    const depthIndex = depthCounts.get(entry.depth) ?? 0
    depthCounts.set(entry.depth, depthIndex + 1)

    const label = entry.page.title?.trim() || labelFromUrl(entry.page.url, entry.normalizedUrl)

    return {
      id,
      url: entry.page.url,
      normalizedUrl: entry.normalizedUrl,
      label,
      status: entry.status,
      order: entry.order,
      depth: entry.depth,
      position: {
        x: entry.depth * COLUMN_WIDTH,
        y: depthIndex * ROW_HEIGHT,
      },
      parentNormalizedUrl: entry.parentNormalizedUrl,
    }
  })

  const edges: PlaceholderEdgeDescriptor[] = []
  for (const node of nodes) {
    if (!node.parentNormalizedUrl) continue
    const parentId = urlToNodeId.get(node.parentNormalizedUrl)
    if (!parentId || parentId === node.id) continue
    const edgeId = `${parentId}->${node.id}`
    edges.push({
      id: edgeId,
      sourceId: parentId,
      targetId: node.id,
    })
  }

  return { nodes, edges }
}

export const toReactFlowPlaceholders = (
  graph: PlaceholderGraphDescriptor,
): { nodes: Node<ProfessionalNodeData>[]; edges: Edge[] } => {
  const nodes: Node<ProfessionalNodeData>[] = graph.nodes.map((descriptor) => {
    const normalizedStatus = (descriptor.status === 'failed' ? 'error' : descriptor.status) as 'pending' | 'processing' | 'ready' | 'error' | 'skipped'
    const statusKey = `import-${normalizedStatus}` as 'import-pending' | 'import-processing' | 'import-ready' | 'import-error' | 'import-skipped'
    return {
      id: descriptor.id,
      type: 'page',
      position: descriptor.position,
      data: {
        label: descriptor.label,
        url: descriptor.url,
        components: [],
        metadata: {
          status: statusKey,
          importStatus: normalizedStatus,
          isPlaceholder: true,
          importSource: descriptor.url,
          importSourceNormalized: descriptor.normalizedUrl,
          importParentUrl: descriptor.parentNormalizedUrl ?? undefined,
          importOrder: descriptor.order,
        },
      },
    }
  })

  const edges: Edge[] = graph.edges.map((edge) => ({
    id: edge.id,
    source: edge.sourceId,
    target: edge.targetId,
    type: 'smoothstep',
    animated: true,
    data: { isPlaceholder: true },
  }))

  return { nodes, edges }
}
