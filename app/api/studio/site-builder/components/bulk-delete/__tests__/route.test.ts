import { NextRequest } from 'next/server'
import { DELETE } from '../route'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    websitePage: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}))

jest.mock('@/lib/auth/context', () => ({
  getAuthContext: jest.fn().mockResolvedValue({ accountId: 'account-1', userId: 'user-1' }),
}))

jest.mock('@/lib/auth/ownership', () => ({
  assertWebsiteOwnership: jest.fn().mockResolvedValue(undefined),
}))

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { prisma } = require('@/lib/prisma')

describe('/api/studio/site-builder/components/bulk-delete', () => {
  const tx = {
    websitePage: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(prisma.websitePage.findUnique as jest.Mock).mockResolvedValue({ websiteId: 'website-1' })
    ;(prisma.$transaction as jest.Mock).mockImplementation((callback) => callback(tx))
  })

  it('returns 400 diagnostics when current content contains legacy write mirrors', async () => {
    tx.websitePage.findUnique.mockResolvedValue({
      id: 'page-1',
      content: {
        version: 1,
        components: [
          {
            id: 'hero-1',
            type: 'hero',
            position: 0,
            props: {
              content: { heading: 'Legacy props content' },
              text: 'Legacy text',
            },
            content: {},
          },
        ],
      },
    })

    const request = new NextRequest('http://localhost/api/studio/site-builder/components/bulk-delete', {
      method: 'DELETE',
      body: JSON.stringify({
        componentIds: ['hero-1'],
        contentItemId: 'page-1',
        confirmDeletion: true,
      }),
    })

    const response = await DELETE(request)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBe('Invalid page content')
    expect(body.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'PAGE_CONTENT_COMPONENT_PROPS_CONTENT_LEGACY' }),
      expect.objectContaining({ code: 'PAGE_CONTENT_COMPONENT_PROPS_TEXT_LEGACY' }),
    ]))
    expect(tx.websitePage.update).not.toHaveBeenCalled()
  })

  it('returns 404 when contentItemId is not a WebsitePage id', async () => {
    ;(prisma.websitePage.findUnique as jest.Mock).mockResolvedValue(null)

    const request = new NextRequest('http://localhost/api/studio/site-builder/components/bulk-delete', {
      method: 'DELETE',
      body: JSON.stringify({
        componentIds: ['hero-1'],
        contentItemId: 'content-data-1',
        confirmDeletion: true,
      }),
    })

    const response = await DELETE(request)
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body.error).toBe('Content item not found')
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })
})
