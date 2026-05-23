import { NextRequest } from 'next/server'
import { DELETE } from '../route'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    websiteSharedComponent: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
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

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { prisma } = require('@/lib/prisma')

describe('/api/studio/site-builder/global-components/[id]/usage DELETE', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(prisma.websiteSharedComponent.findUnique as jest.Mock).mockResolvedValue({
      id: 'shared-1',
      websiteId: 'website-1',
      usageCount: 1,
    })
  })

  it('returns 400 diagnostics when page content contains legacy write mirrors', async () => {
    ;(prisma.websitePage.findUnique as jest.Mock).mockResolvedValue({
      id: 'page-1',
      content: {
        version: 1,
        components: [
          {
            id: 'inst-1',
            type: 'shared',
            position: 0,
            props: {
              sharedComponentId: 'shared-1',
              text: { title: 'Legacy text mirror' },
            },
            content: {},
          },
        ],
      },
    })

    const request = new NextRequest(
      'http://localhost/api/studio/site-builder/global-components/shared-1/usage?pageId=page-1',
      { method: 'DELETE' }
    )

    const response = await DELETE(request, { params: Promise.resolve({ id: 'shared-1' }) })
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBe('Invalid page content')
    expect(body.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'PAGE_CONTENT_COMPONENT_PROPS_TEXT_LEGACY',
        path: 'components[0].props.text',
      }),
    ]))
    expect(prisma.websitePage.update).not.toHaveBeenCalled()
  })
})
