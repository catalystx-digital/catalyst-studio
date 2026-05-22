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
        where: { websiteId: 'site', fullPath: '/' },
        include: expect.objectContaining({
          websitePage: expect.any(Object),
          children: expect.any(Object)
        })
      })
    )
    expect(findMany).not.toHaveBeenCalled()
    expect(result.diagnostics).toHaveLength(0)
  })

  it('rejects legacy sections without promoting data.content into snapshot page components', async () => {
    const findFirst = jest.fn().mockResolvedValue({
      id: 'struct-home',
      parentId: null,
      slug: 'home',
      fullPath: '/',
      position: 0,
      websitePageId: 'page-home',
      websitePage: {
        id: 'page-home',
        title: 'Home',
        ...basePage,
        content: {
          sections: [
            {
              id: 'section-1',
              componentType: 'text-block',
              data: { content: { text: 'Hello' } }
            }
          ]
        }
      },
      children: []
    })
    const prisma = createPrismaMock({
      websiteStructure: {
        findFirst,
        findMany: jest.fn().mockResolvedValue([])
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

    expect(result.payload?.page.components).toEqual([])
    expect(result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'PAGE_CONTENT_LEGACY_SECTIONS',
        level: 'warn',
        context: expect.objectContaining({
          websiteId: 'site',
          pageId: 'page-home',
          path: 'sections',
          source: 'page.content',
          fullPath: '/'
        })
      })
    ]))
  })

  it('keeps canonical component content out of resolved page component props', async () => {
    const findFirst = jest.fn().mockResolvedValue({
      id: 'struct-home',
      parentId: null,
      slug: 'home',
      fullPath: '/',
      position: 0,
      websitePageId: 'page-home',
      websitePage: {
        id: 'page-home',
        title: 'Home',
        ...basePage,
        content: {
          regions: [],
          components: [
            {
              id: 'hero-1',
              type: 'hero-banner',
              props: {
                theme: 'dark'
              },
              content: {
                heading: 'Canonical heading',
                subheading: 'Canonical subheading'
              }
            }
          ]
        }
      },
      children: []
    })
    const prisma = createPrismaMock({
      websiteStructure: {
        findFirst,
        findMany: jest.fn().mockResolvedValue([])
      },
      websiteSharedComponent: {
        findMany: jest.fn().mockResolvedValue([])
      }
    })

    const result = await resolveUcsPageBySlug({
      prisma,
      websiteId: 'site',
      slug: [],
      sharedComponentCache: new Map(),
      resolveMedia: false
    })

    expect(result.payload?.page.components[0].content).toEqual({
      heading: 'Canonical heading',
      subheading: 'Canonical subheading'
    })
    expect(result.payload?.page.components[0].props).toEqual(
      expect.objectContaining({
        theme: 'dark'
      })
    )
    expect(result.payload?.page.components[0].props).not.toHaveProperty('content')
  })

  it('ignores malformed two-column props.text during canonical enrichment', async () => {
    const findFirst = jest.fn().mockResolvedValue({
      id: 'struct-home',
      parentId: null,
      slug: 'home',
      fullPath: '/',
      position: 0,
      websitePageId: 'page-home',
      websitePage: {
        id: 'page-home',
        title: 'Home',
        ...basePage,
        content: {
          regions: [],
          components: [
            {
              id: 'two-column-1',
              type: 'two-column',
              props: {
                text: '{"leftColumn":'
              },
              content: {}
            }
          ]
        }
      },
      children: []
    })
    const prisma = createPrismaMock({
      websiteStructure: {
        findFirst,
        findMany: jest.fn().mockResolvedValue([])
      },
      websiteSharedComponent: {
        findMany: jest.fn().mockResolvedValue([])
      }
    })

    const result = await resolveUcsPageBySlug({
      prisma,
      websiteId: 'site',
      slug: [],
      sharedComponentCache: new Map(),
      resolveMedia: false
    })

    expect(result.diagnostics.map(diagnostic => diagnostic.code)).not.toContain('UCS_TWO_COLUMN_PROPS_TEXT_INVALID_JSON')
    expect(result.diagnostics.map(diagnostic => diagnostic.code)).not.toContain('PAGE_CONTENT_COMPONENT_PROPS_TEXT_JSON_PARSE_FAILED')
    expect(result.payload?.page.components[0].content).toEqual({})
    expect(result.payload?.page.components[0].props).not.toHaveProperty('text')
  })

  it('returns normalizer parse diagnostics for malformed page content', async () => {
    const findFirst = jest.fn().mockResolvedValue({
      id: 'struct-home',
      parentId: null,
      slug: 'home',
      fullPath: '/',
      position: 0,
      websitePageId: 'page-home',
      websitePage: {
        id: 'page-home',
        title: 'Home',
        ...basePage,
        content: '{"components":'
      },
      children: []
    })
    const prisma = createPrismaMock({
      websiteStructure: {
        findFirst,
        findMany: jest.fn().mockResolvedValue([])
      },
      websiteSharedComponent: {
        findMany: jest.fn().mockResolvedValue([])
      }
    })

    const result = await resolveUcsPageBySlug({
      prisma,
      websiteId: 'site',
      slug: [],
      sharedComponentCache: new Map(),
      resolveMedia: false
    })

    expect(result.payload?.page.components).toEqual([])
    expect(result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'PAGE_CONTENT_JSON_PARSE_FAILED',
        level: 'warn',
        context: expect.objectContaining({
          websiteId: 'site',
          pageId: 'page-home',
          path: '$',
          source: 'page.content',
          fullPath: '/'
        })
      })
    ]))
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
