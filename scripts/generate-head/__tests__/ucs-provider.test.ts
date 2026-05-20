import { createUcsProvider } from '../providers/ucs-provider'

jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    setVerbose: jest.fn()
  }
}))

jest.mock('@/lib/studio/headless/ucs/snapshot-builder', () => ({
  buildUcsSiteSnapshot: jest.fn().mockResolvedValue({
    snapshot: {
      site: { id: 'site-1', name: 'Test Site' },
      pages: [],
      structure: [],
      sharedComponents: [],
      capturedAt: new Date().toISOString(),
      designSystem: null
    },
    diagnostics: []
  })
}))

const { buildUcsSiteSnapshot } = jest.requireMock('@/lib/studio/headless/ucs/snapshot-builder') as {
  buildUcsSiteSnapshot: jest.Mock
}

describe('ucs provider', () => {
  beforeEach(() => {
    buildUcsSiteSnapshot.mockClear()
  })

  it('passes design concept selector to snapshot builder', async () => {
    const provider = createUcsProvider({
      websiteId: 'site-123',
      templateOverrideKey: undefined,
      designConcept: 'Design Concept 2'
    })

    await provider.loadSnapshot()

    expect(buildUcsSiteSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        websiteId: 'site-123',
        designConcept: 'Design Concept 2'
      })
    )
  })

  it('creates the GraphQL provider when data source is graphql', () => {
    const provider = createUcsProvider({
      websiteId: 'site-graph',
      dataSource: 'graphql',
      graphql: {
        endpoint: 'https://studio.catalyst.dev/api/studio/ucs/graphql',
        apiKey: 'test-key'
      }
    })
    expect(provider.constructor.name).toBe('UcsGraphqlHeadDataProvider')
  })
})
