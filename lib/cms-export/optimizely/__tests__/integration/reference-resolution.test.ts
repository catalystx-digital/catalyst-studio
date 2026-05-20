import { OptimizelyProvider } from '../../provider'
import { OptimizelyClient } from '../../client'

jest.mock('../../client')

const compiled = {
  byKey: {
    page: { key: 'page', name: 'Page', baseType: 'page', fields: [
      { name: 'image', valueType: 'contentReference' },
      { name: 'blocks', valueType: 'array<contentReference>' },
    ]},
    image: { key: 'image', name: 'Image', baseType: 'component', fields: [] },
    block: { key: 'block', name: 'Block', baseType: 'component', fields: [] },
  },
  all: []
} as any

describe('OptimizelyProvider integration: reference resolution gating', () => {
  let provider: OptimizelyProvider
  let mockClient: jest.Mocked<OptimizelyClient>

  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
    provider = new OptimizelyProvider()
    mockClient = (provider as any).client as jest.Mocked<OptimizelyClient>
    const support = provider.getCompiledTypeSupport()
    support.configure(compiled as any)
    mockClient.retryWithBackoff.mockImplementation(async (fn: any) => fn())
    mockClient.createContent.mockResolvedValue({ contentLink: { guidValue: 'main-1' } } as any)
  })

  const makeUnified = () => ({
    id: 'page-1',
    title: 'Page',
    contentTypeId: 'page',
    content: {
      image: { type: 'image', props: { alt: 'x' } },
      blocks: [ { type: 'block', properties: {} } ]
    },
    status: 'draft',
    metadata: {}
  }) as any

  it('processBatchUnifiedContent creates main item successfully', async () => {
    const result = await provider.processBatchUnifiedContent([makeUnified()])
    expect(result.failed.length).toBe(0)
    expect(result.successful.length).toBe(1)
    expect(mockClient.createContent).toHaveBeenCalled()
  })
})

