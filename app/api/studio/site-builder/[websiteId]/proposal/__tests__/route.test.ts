/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server'

process.env.OPENROUTER_API_KEY = 'test-key'

const mockBuild = jest.fn()
const mockGenerate = jest.fn()

jest.mock('@/lib/auth/context', () => ({
  getAuthContext: jest.fn()
}))

jest.mock('@/lib/prisma', () => ({
  prisma: {
    website: {
      findUnique: jest.fn()
    }
  }
}))

jest.mock('@/lib/studio/site-builder/proposal/proposal-context-builder', () => ({
  ProposalContextBuilder: jest.fn().mockImplementation(() => ({
    build: mockBuild
  }))
}))

jest.mock('@openrouter/ai-sdk-provider', () => ({
  createOpenRouter: jest.fn(() => jest.fn(() => ({})))
}))

jest.mock('ai', () => ({
  generateObject: (...args: unknown[]) => mockGenerate(...args)
}))

import { getAuthContext } from '@/lib/auth/context'
import { prisma } from '@/lib/prisma'
import { POST } from '../route'

describe('Proposal export route', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockBuild.mockResolvedValue({
      context: {
        website: { id: 'website-1', name: 'Demo', conceptId: 'concept-1', proposalTitle: 'Demo Proposal', tagline: 'Tagline' },
        sitemap: { nodes: [], stats: { total: 0, published: 0, draft: 0, depthMax: 0 } },
        contentTypes: [],
        importBrief: null,
        designConcepts: [
          {
            id: 'concept-1',
            name: 'Aurora',
            palette: { primary: '#111', secondary: '#222', accent: '#333', neutral: '#444', surface: '#555' },
            typography: { heading: 'Sora', body: 'Inter' }
          }
        ]
      },
      llmContext: { website: { name: 'Demo' } },
      designConcepts: []
    })
    mockGenerate.mockResolvedValue({
      object: {
        project_summary: 'Summary',
        ia_highlights: [],
        content_type_notes: [],
        uplift_plan: [],
        design_concepts: [],
        call_to_action: 'Meet with Catalyst Studio.'
      },
      usage: { totalTokens: 123 }
    })
    ;(getAuthContext as jest.Mock).mockResolvedValue({ accountId: 'account-1' })
    ;(prisma.website.findUnique as jest.Mock).mockResolvedValue({ id: 'website-1', accountId: 'account-1' })
  })

  it('returns proposal payload on success', async () => {
    const request = new NextRequest('http://localhost/api', {
      method: 'POST',
      body: JSON.stringify({ conceptId: 'concept-1' })
    })
    const response = await POST(request, { params: Promise.resolve({ websiteId: 'website-1' }) })
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.context.website.name).toBe('Demo')
    expect(payload.narrative.call_to_action).toContain('Catalyst')
    expect(mockBuild).toHaveBeenCalled()
    expect(mockGenerate).toHaveBeenCalled()
  })

  it('blocks unauthorized access', async () => {
    ;(prisma.website.findUnique as jest.Mock).mockResolvedValue({ id: 'website-1', accountId: 'other-account' })
    const request = new NextRequest('http://localhost/api', { method: 'POST' })
    const response = await POST(request, { params: Promise.resolve({ websiteId: 'website-1' }) })
    expect(response.status).toBe(403)
  })

  it('bubbles OpenRouter errors', async () => {
    mockGenerate.mockRejectedValue(new Error('LLM failure'))
    const request = new NextRequest('http://localhost/api', { method: 'POST' })
    const response = await POST(request, { params: Promise.resolve({ websiteId: 'website-1' }) })
    expect(response.status).toBe(500)
  })

  it('surfaces context builder validation errors', async () => {
    mockBuild.mockRejectedValue(new Error('No design concepts are available for this website'))
    const request = new NextRequest('http://localhost/api', { method: 'POST' })
    const response = await POST(request, { params: Promise.resolve({ websiteId: 'website-1' }) })
    const payload = await response.json()
    expect(response.status).toBe(400)
    expect(payload.error).toMatch(/No design concepts/)
  })
})
