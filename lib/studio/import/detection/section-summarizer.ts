type DomNode = Record<string, unknown>

export interface SectionSummarizerResult {
  nodes: unknown
  enabled: boolean
  originalBytes: number
  summarizedBytes: number
  reductionRatio: number
}

const PRESERVED_ATTRS = new Set([
  'href',
  'src',
  'alt',
  'title',
  'aria-label',
  'aria-labelledby',
  'aria-describedby',
  'role',
  'type',
  'name',
  'value',
  'placeholder',
  'datetime',
  'data-src',
  'data-href'
])

function byteLength(value: unknown): number {
  return JSON.stringify(value).length
}

function compactWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function summarizeNode(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return value
  }

  const node = value as DomNode
  const summarized: DomNode = {}
  for (const key of ['tag', 'role']) {
    if (typeof node[key] === 'string' && node[key]) {
      summarized[key] = node[key]
    }
  }
  for (const key of ['text', 'label', 'name', 'value', 'alt', 'title']) {
    if (typeof node[key] === 'string') {
      const text = compactWhitespace(node[key])
      if (text) summarized[key] = text
    }
  }

  const attrs = node.attrs
  if (attrs && typeof attrs === 'object' && !Array.isArray(attrs)) {
    const keptAttrs: Record<string, unknown> = {}
    for (const [key, attrValue] of Object.entries(attrs as Record<string, unknown>)) {
      if (!PRESERVED_ATTRS.has(key) && !key.startsWith('aria-')) {
        continue
      }
      keptAttrs[key] = typeof attrValue === 'string' ? compactWhitespace(attrValue) : attrValue
    }
    if (Object.keys(keptAttrs).length > 0) {
      summarized.attrs = keptAttrs
    }
  }

  for (const key of ['children', 'items', 'links', 'images', 'media']) {
    const children = node[key]
    if (Array.isArray(children)) {
      const summarizedChildren = children.map(summarizeNode).filter(child => {
        if (!child || typeof child !== 'object' || Array.isArray(child)) return Boolean(child)
        return Object.keys(child as DomNode).length > 0
      })
      if (summarizedChildren.length > 0) {
        summarized[key] = summarizedChildren
      }
    }
  }

  return summarized
}

export function summarizeSectionNodes(nodes: unknown, enabled: boolean): SectionSummarizerResult {
  const originalBytes = byteLength(nodes)
  if (!enabled) {
    return {
      nodes,
      enabled: false,
      originalBytes,
      summarizedBytes: originalBytes,
      reductionRatio: 0
    }
  }

  const summarizedNodes = Array.isArray(nodes) ? nodes.map(summarizeNode) : summarizeNode(nodes)
  const summarizedBytes = byteLength(summarizedNodes)
  if (summarizedBytes >= originalBytes) {
    return {
      nodes,
      enabled: true,
      originalBytes,
      summarizedBytes: originalBytes,
      reductionRatio: 0
    }
  }

  return {
    nodes: summarizedNodes,
    enabled: true,
    originalBytes,
    summarizedBytes,
    reductionRatio: originalBytes > 0 ? 1 - summarizedBytes / originalBytes : 0
  }
}
