import { NextRequest } from 'next/server'
import { POST } from '../bootstrap/route'
import { getAuthContext } from '@/lib/auth/context'
import { prisma } from '@/lib/prisma'
import { greenfieldBootstrapper } from '@/lib/studio/ai/greenfield-bootstrapper'

jest.mock('@/lib/auth/context', () => ({
  getAuthContext: jest.fn(),
}))

jest.mock('@/lib/prisma', () => ({
  prisma: {
    website: {
      findUnique: jest.fn(),
    },
  },
}))

jest.mock('@/lib/studio/ai/greenfield-bootstrapper', () => ({
  greenfieldBootstrapper: {
    bootstrapWebsite: jest.fn(),
  },
}))

const getAuthContextMock = getAuthContext as jest.Mock
const prismaMock = prisma as unknown as {
  website: { findUnique: jest.Mock }
}
const bootstrapperMock = greenfieldBootstrapper as unknown as {
  bootstrapWebsite: jest.Mock
}

describe('POST /api/studio/site-builder/bootstrap', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 404 when website is missing or unauthorized', async () => {
    getAuthContextMock.mockResolvedValue({ accountId: 'acct-1' })
    prismaMock.website.findUnique.mockResolvedValue(null)

    const payload = {
      websiteId: 'missing',
      originalPrompt: 'Build a site',
      processedPrompt: {
        websiteName: 'Test',
        description: 'desc',
        category: 'page',
        suggestedFeatures: [],
        technicalRequirements: [],
        targetAudience: 'audience'
      }
    }

    const request = new NextRequest('http://localhost:3000/api/studio/site-builder/bootstrap', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' }
    })

    const response = await POST(request)

    expect(response.status).toBe(404)
    expect(bootstrapperMock.bootstrapWebsite).not.toHaveBeenCalled()
  })

  it('invokes bootstrapper and returns result', async () => {
    getAuthContextMock.mockResolvedValue({ accountId: 'acct-1' })
    prismaMock.website.findUnique.mockResolvedValue({ id: 'site-1', accountId: 'acct-1' })
    bootstrapperMock.bootstrapWebsite.mockResolvedValue({
      pagesCreated: 4,
      populatedPages: 3,
      fallbackApplied: false
    })

    const payload = {
      websiteId: 'site-1',
      originalPrompt: 'Photography portfolio',
      processedPrompt: {
        websiteName: 'My Portfolio',
        description: 'A modern photography showcase',
        category: 'page',
        suggestedFeatures: ['gallery'],
        technicalRequirements: ['responsive'],
        targetAudience: 'prospect clients'
      }
    }

    const request = new NextRequest('http://localhost:3000/api/studio/site-builder/bootstrap', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' }
    })

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(bootstrapperMock.bootstrapWebsite).toHaveBeenCalledWith({
      websiteId: 'site-1',
      accountId: 'acct-1',
      originalPrompt: 'Photography portfolio',
      processedPrompt: payload.processedPrompt
    })
    expect(body.data).toEqual({
      pagesCreated: 4,
      populatedPages: 3,
      fallbackApplied: false
    })
  })
})
