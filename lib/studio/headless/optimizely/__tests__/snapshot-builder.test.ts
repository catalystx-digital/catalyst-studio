import { buildOptimelySiteSnapshot } from '../snapshot-builder'

const mockRequest = jest.fn()

jest.mock('../graphql-client', () => ({
  OptimizelyGraphqlClient: jest.fn().mockImplementation(() => ({
    getLocale: () => 'en',
    request: (...args: unknown[]) => mockRequest(...args),
  })),
}))

describe('buildOptimelySiteSnapshot design system strictness', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRequest.mockResolvedValue({
      _Content: {
        items: [
          {
            __typename: 'Page',
            _metadata: {
              key: 'page-1',
              displayName: 'Home',
              types: ['HomePage'],
              url: { default: '/en/' },
              locale: 'en',
              status: 'Published',
            },
          },
        ],
        cursor: null,
      },
    })
  })

  it('bakes valid current shadcn design-system tokens into the snapshot', async () => {
    const designSystem = {
      variables: { '--primary': '240 5.9% 10%' },
      extraction: {
        timestamp: '2024-01-01T00:00:00.000Z',
        confidence: 1,
        source: 'detected',
        detectedCount: 1,
        defaultCount: 0,
      },
    }

    const { snapshot, diagnostics } = await buildOptimelySiteSnapshot({
      gateway: 'https://example.com/content/v2',
      singleKey: 'key',
      designSystem,
    })

    expect(snapshot.designSystem).toEqual({ tokens: designSystem })
    expect(diagnostics).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'DESIGN_SYSTEM_INVALID_PAYLOAD' }),
    ]))
  })

  it('omits missing design-system tokens without synthesizing defaults', async () => {
    const { snapshot } = await buildOptimelySiteSnapshot({
      gateway: 'https://example.com/content/v2',
      singleKey: 'key',
    })

    expect(snapshot.designSystem).toBeNull()
  })

  it('diagnoses legacy design-system tokens without exporting them', async () => {
    const { snapshot, diagnostics } = await buildOptimelySiteSnapshot({
      gateway: 'https://example.com/content/v2',
      singleKey: 'key',
      designSystem: {
        palette: { primary: [], secondary: [], accent: [], neutral: [], surface: [] },
        typography: { heading: [], body: [], ui: [] },
        version: '1.0.0',
      },
    })

    expect(snapshot.designSystem).toBeNull()
    expect(diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'DESIGN_SYSTEM_LEGACY_PAYLOAD',
        level: 'error',
        message: 'Legacy palette design-system payloads are not valid runtime shadcn tokens.',
      }),
    ]))
  })

  it('diagnoses malformed current design-system tokens without exporting them', async () => {
    const { snapshot, diagnostics } = await buildOptimelySiteSnapshot({
      gateway: 'https://example.com/content/v2',
      singleKey: 'key',
      designSystem: {
        variables: { '--primary': '240 5.9% 10%' },
        typography: 'bad',
        extraction: {
          timestamp: '2024-01-01T00:00:00.000Z',
          confidence: 1,
          source: 'detected',
          detectedCount: 1,
          defaultCount: 0,
        },
      },
    })

    expect(snapshot.designSystem).toBeNull()
    expect(diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'DESIGN_SYSTEM_INVALID_PAYLOAD',
        level: 'error',
        context: expect.objectContaining({ invalidPath: 'typography' }),
      }),
    ]))
  })
})
