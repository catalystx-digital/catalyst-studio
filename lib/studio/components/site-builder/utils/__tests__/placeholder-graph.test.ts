import { buildPlaceholderGraph, normalizeImportUrl, toReactFlowPlaceholders } from '@/lib/studio/components/site-builder/utils/placeholder-graph'

const samplePages = [
  { url: 'https://example.com/', status: 'pending', order: 0 },
  { url: 'https://example.com/about', status: 'processing', order: 2 },
  { url: 'https://example.com/about/team', status: 'ready', order: 3 },
  { url: 'https://example.com/contact', status: 'pending', order: 1 },
]

describe('normalizeImportUrl', () => {
  it('normalizes trailing slashes and ensures absolute path', () => {
    expect(normalizeImportUrl('https://example.com/about/')).toBe('https://example.com/about')
    expect(normalizeImportUrl('https://example.com')).toBe('https://example.com/')
    expect(normalizeImportUrl('/relative/path/')).toBe('/relative/path')
    expect(normalizeImportUrl('')).toBeNull()
  })

  it('preserves meaningful query params while stripping tracking params', () => {
    expect(normalizeImportUrl('https://example.com/search?utm_source=x&q=b&page=2')).toBe('https://example.com/search?page=2&q=b')
    expect(normalizeImportUrl('https://example.com/search?q=a')).not.toBe(normalizeImportUrl('https://example.com/search?q=b'))
  })
})

describe('buildPlaceholderGraph', () => {
  it('builds hierarchical nodes and edges based on URL depth', () => {
    const graph = buildPlaceholderGraph(samplePages)
    expect(graph.nodes).toHaveLength(4)
    const ids = graph.nodes.map(node => node.id)
    expect(new Set(ids).size).toBe(4)
    expect(ids.every(id => id.startsWith('import-placeholder-'))).toBe(true)

    const rootNode = graph.nodes.find(node => node.normalizedUrl === 'https://example.com/')
    expect(rootNode?.depth).toBe(0)
    expect(rootNode?.parentNormalizedUrl).toBeNull()

    const aboutNode = graph.nodes.find(node => node.normalizedUrl === 'https://example.com/about')
    expect(aboutNode?.depth).toBe(1)
    expect(aboutNode?.parentNormalizedUrl).toBe('https://example.com/')

    const teamNode = graph.nodes.find(node => node.normalizedUrl === 'https://example.com/about/team')
    expect(teamNode?.depth).toBe(2)
    expect(teamNode?.parentNormalizedUrl).toBe('https://example.com/about')

    expect(graph.edges).toHaveLength(3)
    expect(graph.edges.every(edge => ids.includes(edge.sourceId) && ids.includes(edge.targetId))).toBe(true)
  })

  it('skips pages that already exist in the structure', () => {
    const graph = buildPlaceholderGraph(samplePages, {
      existingUrls: ['https://example.com/about'],
    })

    const normalizedUrls = graph.nodes.map(node => node.normalizedUrl)
    expect(normalizedUrls).not.toContain('https://example.com/about')
    expect(graph.nodes).toHaveLength(3)
  })

  it('deduplicates pages that normalize to the same placeholder id', () => {
    const graph = buildPlaceholderGraph([
      { url: 'https://example.com/about/?utm_source=newsletter', status: 'pending', order: 2 },
      { url: 'https://example.com/about', status: 'processing', order: 1 },
      { url: 'https://example.com/about/', status: 'ready', order: 3 },
    ])

    expect(graph.nodes).toHaveLength(1)
    expect(graph.nodes[0].normalizedUrl).toBe('https://example.com/about')
    expect(graph.nodes[0].status).toBe('processing')
  })

  it('keeps stable placeholder ids when sitemap order changes', () => {
    const first = buildPlaceholderGraph(samplePages)
    const reordered = buildPlaceholderGraph([...samplePages].reverse())

    const firstAbout = first.nodes.find(node => node.normalizedUrl === 'https://example.com/about')
    const reorderedAbout = reordered.nodes.find(node => node.normalizedUrl === 'https://example.com/about')

    expect(firstAbout?.id).toBe(reorderedAbout?.id)
  })

  it('maps backend page-stage statuses to non-queued placeholder states', () => {
    const graph = buildPlaceholderGraph([
      { url: 'https://example.com/a', status: 'detected', order: 0 },
      { url: 'https://example.com/b', status: 'normalized', order: 1 },
      { url: 'https://example.com/c', status: 'committed', order: 2 },
      { url: 'https://example.com/d', status: 'failed_retryable', order: 3 },
      { url: 'https://example.com/e', status: 'recoverable_stuck', order: 4 },
    ])

    expect(graph.nodes.map(node => node.status)).toEqual([
      'processing',
      'processing',
      'ready',
      'failed',
      'invalid',
    ])
  })
})

describe('toReactFlowPlaceholders', () => {
  it('creates ReactFlow nodes with placeholder metadata', () => {
    const graph = buildPlaceholderGraph(samplePages)
    const { nodes, edges } = toReactFlowPlaceholders(graph)
    expect(nodes).toHaveLength(graph.nodes.length)
    const placeholderNode = nodes.find(node => node.data.url === 'https://example.com/about')
    expect(placeholderNode?.data.metadata?.isPlaceholder).toBe(true)
    expect(placeholderNode?.data.metadata?.importStatus).toBe('processing')
    expect(placeholderNode?.data.metadata?.status).toBe('import-processing')
    expect(edges).toHaveLength(graph.edges.length)
    edges.forEach(edge => {
      expect(edge.animated).toBe(true)
      expect(edge.data).toEqual({ isPlaceholder: true })
    })
  })
})
