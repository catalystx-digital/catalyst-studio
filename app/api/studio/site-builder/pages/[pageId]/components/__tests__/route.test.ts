jest.mock('@/lib/prisma', () => ({
  prisma: {
    websitePage: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}))

jest.mock('@/lib/auth/context', () => ({
  getAuthContext: jest.fn().mockResolvedValue({ accountId: 'account-1' }),
}))

jest.mock('@/lib/auth/ownership', () => ({
  assertWebsiteOwnership: jest.fn().mockResolvedValue(undefined),
}))

import { NextRequest } from 'next/server'
import { PATCH } from '@/app/api/studio/site-builder/pages/[pageId]/components/route'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { prisma } = require('@/lib/prisma')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { assertWebsiteOwnership } = require('@/lib/auth/ownership')

describe('PATCH page structural components', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('writes canonical WebsitePage.content components with ownership check', async () => {
    const components = [
      {
        id: 'component-1',
        type: 'hero',
        parentId: null,
        position: 0,
        props: {},
        content: { title: 'Hero' },
        styles: {},
        metadata: {},
      },
      {
        id: 'component-2',
        type: 'cta',
        parentId: null,
        position: 1,
        props: {},
        content: {},
        styles: {},
        metadata: {},
      },
    ]
    ;(prisma.websitePage.findUnique as jest.Mock).mockResolvedValue({
      id: 'page-1',
      websiteId: 'website-1',
      updatedAt: new Date('2026-05-22T00:00:00.000Z'),
      content: {
        version: 1,
        metadata: { theme: 'dark' },
        components: [],
      },
    })
    ;(prisma.websitePage.update as jest.Mock).mockResolvedValue({
      updatedAt: new Date('2026-05-22T00:05:00.000Z'),
    })

    const req = new NextRequest('http://localhost:3000/api/studio/site-builder/pages/page-1/components', {
      method: 'PATCH',
      body: JSON.stringify({ pageId: 'page-1', components }),
    })

    const res = await PATCH(req, { params: Promise.resolve({ pageId: 'page-1' }) })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true, updatedAt: '2026-05-22T00:05:00.000Z' })
    expect(assertWebsiteOwnership).toHaveBeenCalledWith(prisma, 'account-1', 'website-1')
    const expectedComponents = [
      {
        ...components[0],
        props: { content: { title: 'Hero' } },
      },
      components[1],
    ]
    expect(prisma.websitePage.update).toHaveBeenCalledWith({
      where: { id: 'page-1' },
      data: {
        content: {
          version: 1,
          components: expectedComponents,
          metadata: { theme: 'dark' },
        },
      },
      select: { updatedAt: true },
    })
  })

  it('rejects requests without a components array before writing', async () => {
    const req = new NextRequest('http://localhost:3000/api/studio/site-builder/pages/page-1/components', {
      method: 'PATCH',
      body: JSON.stringify({ pageId: 'page-1' }),
    })

    const res = await PATCH(req, { params: Promise.resolve({ pageId: 'page-1' }) })

    expect(res.status).toBe(400)
    expect(prisma.websitePage.findUnique).not.toHaveBeenCalled()
    expect(prisma.websitePage.update).not.toHaveBeenCalled()
  })

  it('returns 409 for stale structural writes', async () => {
    ;(prisma.websitePage.findUnique as jest.Mock).mockResolvedValue({
      id: 'page-1',
      websiteId: 'website-1',
      updatedAt: new Date('2026-05-22T01:00:00.000Z'),
      content: { components: [] },
    })

    const req = new NextRequest('http://localhost:3000/api/studio/site-builder/pages/page-1/components', {
      method: 'PATCH',
      body: JSON.stringify({
        pageId: 'page-1',
        ifUnchangedSince: '2026-05-22T00:00:00.000Z',
        components: [],
      }),
    })

    const res = await PATCH(req, { params: Promise.resolve({ pageId: 'page-1' }) })

    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'Conflict: page modified since' })
    expect(prisma.websitePage.update).not.toHaveBeenCalled()
  })

  it('returns 400 for strict-write component validation errors', async () => {
    ;(prisma.websitePage.findUnique as jest.Mock).mockResolvedValue({
      id: 'page-1',
      websiteId: 'website-1',
      updatedAt: new Date('2026-05-22T00:00:00.000Z'),
      content: { components: [] },
    })

    const req = new NextRequest('http://localhost:3000/api/studio/site-builder/pages/page-1/components', {
      method: 'PATCH',
      body: JSON.stringify({
        pageId: 'page-1',
        components: [
          {
            type: 'hero',
            parentId: null,
            position: 0,
            props: {},
            content: {},
            styles: {},
            metadata: {},
          },
        ],
      }),
    })

    const res = await PATCH(req, { params: Promise.resolve({ pageId: 'page-1' }) })
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBe('Invalid page components')
    expect(prisma.websitePage.update).not.toHaveBeenCalled()
  })
})
