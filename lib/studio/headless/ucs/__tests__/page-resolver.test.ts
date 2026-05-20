import type { PrismaClient } from '@/lib/generated/prisma'
import { resolveUcsPageBySlug } from '@/lib/studio/headless/ucs/page-resolver'

function createPrismaMock(overrides: Partial<PrismaClient>): PrismaClient {
  return overrides as unknown as PrismaClient
}

const basePage = {
  templateKey: 'marketing/home-default',
  templateProps: {},
  content: {
    regions: [],
    components: []
  },
  metadata: {}
}

describe('resolveUcsPageBySlug', () => {
  it('resolves root slug without ancestor query', async () => {
    const findFirst = jest.fn().mockResolvedValue({
      id: 'struct-home',
      parentId: null,
      slug: 'home',
      fullPath: '/home',
      position: 0,
      websitePageId: 'page-home',
      websitePage: {
        id: 'page-home',
        title: 'Home',
        ...basePage
      },
      children: []
    })
    const findMany = jest.fn().mockResolvedValue([])
    const prisma = createPrismaMock({
      websiteStructure: {
        findFirst,
        findMany
      },
      websiteSharedComponent: {
        findMany: jest.fn().mockResolvedValue([])
      }
    })

    const result = await resolveUcsPageBySlug({
      prisma,
      websiteId: 'site',
      slug: [],
      sharedComponentCache: new Map()
    })

    expect(result.payload?.page.id).toBe('page-home')
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { websiteId: 'site', parentId: null },
        orderBy: [{ position: 'asc' }],
        include: {
          websitePage: {
            select: {
              id: true,
              title: true,
              content: true,
              templateKey: true,
              templateProps: true,
              metadata: true
            }
          },
          children: {
            orderBy: [{ position: 'asc' }],
            select: {
              id: true,
              parentId: true,
              slug: true,
              fullPath: true,
              position: true,
              websitePageId: true
            }
          }
        }
      })
    )
    expect(findMany).not.toHaveBeenCalled()
    expect(result.diagnostics).toHaveLength(0)
  })

  it('resolves nested slug with single ancestor query', async () => {
    const findFirst = jest.fn().mockResolvedValue({
      id: 'struct-about',
      parentId: 'struct-home',
      slug: 'about',
      fullPath: '/home/about',
      position: 0,
      websitePageId: 'page-about',
      websitePage: {
        id: 'page-about',
        title: 'About',
        ...basePage
      },
      children: []
    })
    const findMany = jest.fn().mockResolvedValue([
      {
        id: 'struct-home',
        parentId: null,
        slug: 'home',
        fullPath: '/home',
        position: 0,
        websitePageId: 'page-home',
        websitePage: {
          id: 'page-home',
          title: 'Home',
          ...basePage
        }
      }
    ])
    const prisma = createPrismaMock({
      websiteStructure: {
        findFirst,
        findMany
      },
      websiteSharedComponent: {
        findMany: jest.fn().mockResolvedValue([])
      }
    })

    const result = await resolveUcsPageBySlug({
      prisma,
      websiteId: 'site',
      slug: ['home', 'about'],
      sharedComponentCache: new Map()
    })

    expect(findMany).toHaveBeenCalledTimes(1)
    const ancestorArgs = findMany.mock.calls[0][0]
    expect(ancestorArgs).toMatchObject({
      where: {
        websiteId: 'site',
        fullPath: { in: ['/home'] }
      },
      select: {
        id: true,
        parentId: true,
        slug: true,
        fullPath: true,
        position: true,
        websitePageId: true
      }
    })
    expect(result.payload?.structure?.ancestors).toHaveLength(1)
    expect(result.payload?.structure?.ancestors[0].id).toBe('struct-home')
    expect(result.diagnostics).toHaveLength(0)
  })

  it('returns diagnostics when slug not found', async () => {
    const prisma = createPrismaMock({
      websiteStructure: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn()
      },
      websiteSharedComponent: {
        findMany: jest.fn()
      }
    })

    const result = await resolveUcsPageBySlug({
      prisma,
      websiteId: 'site',
      slug: ['Missing'],
      originalSlug: ['Missing'],
      sharedComponentCache: new Map()
    })

    expect(result.payload).toBeNull()
    expect(result.diagnostics).toHaveLength(1)
    expect(result.diagnostics[0]).toMatchObject({
      code: 'UCS_SLUG_NOT_FOUND',
      context: {
        requestedSlug: ['Missing'],
        canonicalSlug: ['missing'],
        canonicalPath: '/missing'
      }
    })
  })
})
