import {
  callInternalApi,
  getInternalApiHeaders,
  getInternalApiUrl,
} from '../internal-api'

const ORIGINAL_ENV = process.env
const ORIGINAL_FETCH = global.fetch

describe('internal workflow API client', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV }
    delete process.env.VERCEL_URL
    delete process.env.VERCEL_AUTOMATION_BYPASS_SECRET
    delete process.env.WORKFLOW_INTERNAL_SECRET
    global.fetch = jest.fn()
  })

  afterEach(() => {
    process.env = ORIGINAL_ENV
    global.fetch = ORIGINAL_FETCH
  })

  it('adds Vercel edge bypass to URLs without using it as app authorization', () => {
    process.env.VERCEL_URL = 'example.vercel.app'
    process.env.VERCEL_AUTOMATION_BYPASS_SECRET = 'bypass-secret'

    const url = new URL(getInternalApiUrl('/api/internal/greenfield-job'))

    expect(url.origin).toBe('https://example.vercel.app')
    expect(url.pathname).toBe('/api/internal/greenfield-job')
    expect(url.searchParams.get('x-vercel-protection-bypass')).toBe('bypass-secret')
  })

  it('adds the workflow internal secret header when configured', () => {
    process.env.WORKFLOW_INTERNAL_SECRET = 'workflow-secret'

    expect(getInternalApiHeaders()).toEqual({
      'Content-Type': 'application/json',
      'x-workflow-internal': 'workflow-secret',
    })
  })

  it('sends both the edge bypass URL and workflow auth header for POST calls', async () => {
    process.env.VERCEL_URL = 'example.vercel.app'
    process.env.VERCEL_AUTOMATION_BYPASS_SECRET = 'bypass-secret'
    process.env.WORKFLOW_INTERNAL_SECRET = 'workflow-secret'
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
      text: async () => JSON.stringify({ success: true }),
    })

    await expect(callInternalApi('/api/internal/greenfield-job', { action: 'updateProgress' })).resolves.toEqual({
      success: true,
    })

    const [url, init] = (global.fetch as jest.Mock).mock.calls[0]
    expect(new URL(url).searchParams.get('x-vercel-protection-bypass')).toBe('bypass-secret')
    expect(init).toEqual(
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-workflow-internal': 'workflow-secret',
        },
        body: JSON.stringify({ action: 'updateProgress' }),
      }),
    )
  })
})
