import { NextRequest } from 'next/server'
import { POST } from '../route'
import { prisma } from '@/lib/prisma'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    website: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}))

const ORIGINAL_ENV = process.env

const saveResultBody = {
  operation: 'save_result',
  websiteId: 'website-1',
  accountId: 'account-1',
  jobId: 'job-1',
  data: {
    pagesCreated: 3,
    populatedPages: 2,
    errors: ['minor warning'],
  },
}

const cleanupBody = {
  operation: 'cleanup',
  websiteId: 'website-1',
  accountId: 'account-1',
  jobId: 'job-1',
}

function useProductionAuthEnv() {
  process.env.NODE_ENV = 'production'
  process.env.VERCEL_URL = 'example.vercel.app'
  process.env.WORKFLOW_INTERNAL_SECRET = 'workflow-secret'
  process.env.VERCEL_AUTOMATION_BYPASS_SECRET = 'bypass-secret'
}

function makeRequest({
  url = 'https://example.vercel.app/api/internal/greenfield-persist',
  host = 'example.vercel.app',
  headers = {},
  body = saveResultBody,
}: {
  url?: string
  host?: string
  headers?: Record<string, string>
  body?: unknown
} = {}) {
  return new NextRequest(url, {
    method: 'POST',
    headers: {
      host,
      'content-type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  })
}

describe('/api/internal/greenfield-persist', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env = { ...ORIGINAL_ENV }
    delete process.env.WORKFLOW_INTERNAL_SECRET
    delete process.env.VERCEL_AUTOMATION_BYPASS_SECRET
    delete process.env.VERCEL_URL
    ;(prisma.website.findUnique as jest.Mock).mockResolvedValue({ accountId: 'account-1' })
    ;(prisma.website.update as jest.Mock).mockResolvedValue({})
  })

  afterAll(() => {
    process.env = ORIGINAL_ENV
  })

  it('rejects production requests with only a Vercel automation bypass token', async () => {
    useProductionAuthEnv()

    const response = await POST(
      makeRequest({
        url: 'https://example.vercel.app/api/internal/greenfield-persist?x-vercel-protection-bypass=bypass-secret',
      }),
    )

    expect(response.status).toBe(403)
    expect(prisma.website.findUnique).not.toHaveBeenCalled()
    expect(prisma.website.update).not.toHaveBeenCalled()
  })

  it('rejects same-origin Origin spoofing in production', async () => {
    useProductionAuthEnv()

    const response = await POST(makeRequest({ headers: { origin: 'https://example.vercel.app' } }))

    expect(response.status).toBe(403)
    expect(prisma.website.findUnique).not.toHaveBeenCalled()
  })

  it.each(['localhost.evil.com', '127.0.0.1.evil.com', 'localhost', 'localhost:3000'])(
    'rejects production localhost host spoofing for %s',
    async (host) => {
      useProductionAuthEnv()

      const response = await POST(makeRequest({ host }))

      expect(response.status).toBe(403)
      expect(prisma.website.findUnique).not.toHaveBeenCalled()
    },
  )

  it('allows valid workflow auth to save greenfield results', async () => {
    useProductionAuthEnv()

    const response = await POST(
      makeRequest({
        headers: { 'x-workflow-internal': 'workflow-secret' },
      }),
    )
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({ success: true })
    expect(prisma.website.findUnique).toHaveBeenCalledWith({
      where: { id: 'website-1' },
      select: { accountId: true },
    })
    expect(prisma.website.update).toHaveBeenCalledWith({
      where: { id: 'website-1' },
      data: {
        metadata: {
          bootstrapResult: expect.objectContaining({
            jobId: 'job-1',
            pagesCreated: 3,
            populatedPages: 2,
            errors: ['minor warning'],
            completedAt: expect.any(String),
          }),
        },
      },
    })
  })

  it('does not write when the website belongs to another account', async () => {
    useProductionAuthEnv()
    ;(prisma.website.findUnique as jest.Mock).mockResolvedValue({ accountId: 'other-account' })

    const response = await POST(
      makeRequest({
        headers: { 'x-workflow-internal': 'workflow-secret' },
      }),
    )
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toBe('Website not found or not accessible')
    expect(prisma.website.update).not.toHaveBeenCalled()
  })

  it('rejects invalid bodies before database writes', async () => {
    useProductionAuthEnv()

    const response = await POST(
      makeRequest({
        headers: { 'x-workflow-internal': 'workflow-secret' },
        body: { operation: 'save_result', websiteId: 'website-1' },
      }),
    )

    expect(response.status).toBe(400)
    expect(prisma.website.findUnique).not.toHaveBeenCalled()
    expect(prisma.website.update).not.toHaveBeenCalled()
  })

  it.each([
    ['negative counts', { pagesCreated: -1, populatedPages: 0 }],
    ['fractional counts', { pagesCreated: 1.5, populatedPages: 1 }],
    ['populated pages greater than created pages', { pagesCreated: 1, populatedPages: 2 }],
  ])('rejects save_result data with %s', async (_name, data) => {
    useProductionAuthEnv()

    const response = await POST(
      makeRequest({
        headers: { 'x-workflow-internal': 'workflow-secret' },
        body: {
          ...saveResultBody,
          data: {
            ...saveResultBody.data,
            ...data,
          },
        },
      }),
    )

    expect(response.status).toBe(400)
    expect(prisma.website.findUnique).not.toHaveBeenCalled()
    expect(prisma.website.update).not.toHaveBeenCalled()
  })

  it('allows valid workflow auth to run cleanup without writing metadata', async () => {
    useProductionAuthEnv()

    const response = await POST(
      makeRequest({
        headers: { 'x-workflow-internal': 'workflow-secret' },
        body: cleanupBody,
      }),
    )
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({ success: true })
    expect(prisma.website.findUnique).toHaveBeenCalledWith({
      where: { id: 'website-1' },
      select: { accountId: true },
    })
    expect(prisma.website.update).not.toHaveBeenCalled()
  })

  it('rejects cleanup for a website in another account', async () => {
    useProductionAuthEnv()
    ;(prisma.website.findUnique as jest.Mock).mockResolvedValue({ accountId: 'other-account' })

    const response = await POST(
      makeRequest({
        headers: { 'x-workflow-internal': 'workflow-secret' },
        body: cleanupBody,
      }),
    )

    expect(response.status).toBe(404)
    expect(prisma.website.update).not.toHaveBeenCalled()
  })
})
