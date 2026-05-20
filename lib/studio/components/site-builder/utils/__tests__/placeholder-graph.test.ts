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
})

describe('buildPlaceholderGraph', () => {
  it('builds hierarchical nodes and edges based on URL depth', () => {
    const graph = buildPlaceholderGraph(samplePages)
    expect(graph.nodes).toHaveLength(4)
    const ids = graph.nodes.map(node => node.id)
    expect(ids).toEqual(['import-placeholder-0', 'import-placeholder-1', 'import-placeholder-2', 'import-placeholder-3'])

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
    expect(graph.edges).toEqual(expect.arrayContaining([
      { id: 'import-placeholder-0->import-placeholder-1', sourceId: 'import-placeholder-0', targetId: 'import-placeholder-1' },
      { id: 'import-placeholder-0->import-placeholder-2', sourceId: 'import-placeholder-0', targetId: 'import-placeholder-2' },
      { id: 'import-placeholder-2->import-placeholder-3', sourceId: 'import-placeholder-2', targetId: 'import-placeholder-3' },
    ]))
  })

  it('skips pages that already exist in the structure', () => {
    const graph = buildPlaceholderGraph(samplePages, {
      existingUrls: ['https://example.com/about'],
    })

    const normalizedUrls = graph.nodes.map(node => node.normalizedUrl)
    expect(normalizedUrls).not.toContain('https://example.com/about')
    expect(graph.nodes).toHaveLength(3)
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


