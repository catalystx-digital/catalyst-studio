/**
 * @jest-environment node
 */

const mockGenerateObject = jest.fn()

jest.mock('@/lib/studio/ai/ai-sdk-provider', () => ({
  createWorkflowRouterModel: jest.fn(() => ({ provider: 'test' }))
}))

jest.mock('ai', () => ({
  generateObject: (...args: unknown[]) => mockGenerateObject(...args)
}))

import { POST } from '../route'

describe('workflow route', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns the LLM workflow decision', async () => {
    mockGenerateObject.mockResolvedValue({
      object: {
        workflow: 'import',
        importUrl: 'example.com',
        reasoning: 'User asked to import a URL.',
        confidence: 0.95
      }
    })

    const response = await POST(new Request('http://localhost/api/studio/workflow-route', {
      method: 'POST',
      body: JSON.stringify({ userPrompt: 'import example.com' })
    }))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.workflow).toBe('import')
    expect(payload.importUrl).toBe('https://example.com')
  })

  it('returns an error instead of falling back when routing fails', async () => {
    mockGenerateObject.mockRejectedValue(Object.assign(new Error('provider rejected'), {
      statusCode: 403,
      responseBody: 'spending limit reached'
    }))

    const response = await POST(new Request('http://localhost/api/studio/workflow-route', {
      method: 'POST',
      body: JSON.stringify({ userPrompt: 'build a portfolio site' })
    }))
    const payload = await response.json()

    expect(response.status).toBe(503)
    expect(payload).toEqual({
      error: 'Workflow routing failed',
      reason: 'AI provider rejected the workflow routing request because credits or spending limits are unavailable.'
    })
    expect(payload.workflow).toBeUndefined()
  })
})
