jest.mock('@/lib/prisma', () => ({
  prisma: {
    websitePage: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}))

import { NextRequest } from 'next/server'
import { PATCH as patchOverrides } from '@/app/api/studio/site-builder/page-components/[instanceId]/route'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { prisma } = require('@/lib/prisma')

describe('PATCH page overrides - concurrency and limits', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  const basePage = (updatedAt: Date) => ({
    id: 'page-1',
    websiteId: 'w1',
    title: 'T',
    type: 'page',
    content: {
      components: [
        { id: 'inst-1', type: 'shared', position: 0, props: { sharedComponentId: 'sc-1' } },
      ],
    },
    updatedAt,
  })

  it('saves overrides and returns success', async () => {
    const page = basePage(new Date('2025-09-12T00:00:00Z'))
    ;(prisma.websitePage.findUnique as jest.Mock).mockResolvedValue(page)
    ;(prisma.websitePage.update as jest.Mock).mockResolvedValue({ ...page, updatedAt: new Date('2025-09-12T00:01:00Z') })

    const req = new NextRequest('http://localhost:3000/api/studio/site-builder/page-components/inst-1', {
      method: 'PATCH',
      body: JSON.stringify({ pageId: 'page-1', overrides: { title: 'New' } }),
    })
    const res = await patchOverrides(req, { params: Promise.resolve({ instanceId: 'inst-1' }) })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
  })

  it('returns 409 when If-Unmodified-Since is stale', async () => {
    const page = basePage(new Date('2025-09-12T01:00:00Z'))
    ;(prisma.websitePage.findUnique as jest.Mock).mockResolvedValue(page)

    const headers = new Headers({ 'If-Unmodified-Since': '2025-09-12T00:00:00Z' })
    const req = new NextRequest('http://localhost:3000/api/studio/site-builder/page-components/inst-1', {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ pageId: 'page-1', overrides: { title: 'New' }, ifUnchangedSince: '2025-09-12T00:00:00Z' }),
    })
    const res = await patchOverrides(req, { params: Promise.resolve({ instanceId: 'inst-1' }) })
    expect(res.status).toBe(409)
  })

  it('returns 413 when depth exceeds limit', async () => {
    const page = basePage(new Date('2025-09-12T00:00:00Z'))
    ;(prisma.websitePage.findUnique as jest.Mock).mockResolvedValue(page)

    const deep = { a: { b: { c: { d: { e: { f: { g: { h: { i: 1 } } } } } } } } } // depth 9
    const req = new NextRequest('http://localhost:3000/api/studio/site-builder/page-components/inst-1', {
      method: 'PATCH',
      body: JSON.stringify({ pageId: 'page-1', overrides: deep }),
    })
    const res = await patchOverrides(req, { params: Promise.resolve({ instanceId: 'inst-1' }) })
    expect(res.status).toBe(413)
  })
})
