import { buildUcsSiteSnapshot, normalizeAssetUrl } from '../snapshot-builder'

describe('normalizeAssetUrl', () => {
  const origin = 'https://example.com'

  it('converts root-relative paths using the provided origin', () => {
    expect(normalizeAssetUrl('/themes/custom/tio/logo.svg', origin)).toBe(
      'https://example.com/themes/custom/tio/logo.svg'
    )
  })

  it('converts host-relative asset paths without a leading slash', () => {
    expect(normalizeAssetUrl('sites/default/files/image.jpg', origin)).toBe(
      'https://example.com/sites/default/files/image.jpg'
    )
  })

  it('normalizes protocol-relative URLs against the origin scheme', () => {
    expect(normalizeAssetUrl('//cdn.example.com/asset.png', origin)).toBe(
      'https://cdn.example.com/asset.png'
    )
  })

  it('leaves absolute URLs untouched', () => {
    const absolute = 'https://media.example.com/image.png'
    expect(normalizeAssetUrl(absolute, origin)).toBe(absolute)
  })

  it('returns the original value when no origin is available', () => {
    const relative = '/sites/default/files/icon.png'
    expect(normalizeAssetUrl(relative, undefined)).toBe(relative)
  })
})

describe('buildUcsSiteSnapshot', () => {
  it('skips pages when structures are empty', async () => {
    const prisma = {
      website: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'site',
          name: 'Site',
          description: null,
          metadata: {},
          settings: {}
        })
      },
      websiteSharedComponent: {
        findMany: jest.fn().mockResolvedValue([])
      },
      websitePage: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'page-1',
            title: 'Home',
            content: {
              regions: [],
              components: []
            },
            templateKey: null,
            templateProps: {},
            metadata: {},
            structures: []
          }
        ])
      },
      websiteStructure: {
        findMany: jest.fn().mockResolvedValue([])
      },
      websiteDesignConcept: {
        findFirst: jest.fn().mockResolvedValue(null)
      },
      redirect: {
        findMany: jest.fn().mockResolvedValue([])
      }
    }

    const { snapshot, diagnostics } = await buildUcsSiteSnapshot({
      prisma: prisma as any,
      websiteId: 'site',
      resolveMedia: false
    })

    expect(snapshot.pages).toEqual([])
    expect(diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'MISSING_STRUCTURE_ENTRY',
        level: 'error',
        message: 'Page page-1 skipped because WebsiteStructure.fullPath is missing',
        context: expect.objectContaining({
          websiteId: 'site',
          pageId: 'page-1'
        })
      })
    ]))
  })

  it('does not use metadata.fullPath when structure fullPath is missing', async () => {
    const prisma = {
      website: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'site',
          name: 'Site',
          description: null,
          metadata: {},
          settings: {}
        })
      },
      websiteSharedComponent: {
        findMany: jest.fn().mockResolvedValue([])
      },
      websitePage: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'page-1',
            title: 'Home',
            content: {
              regions: [],
              components: []
            },
            templateKey: null,
            templateProps: {},
            metadata: {
              fullPath: '/metadata-path'
            },
            structures: [
              {
                id: 'structure-1',
                fullPath: null,
                slug: 'home',
                parentId: null,
                position: 0
              }
            ]
          }
        ])
      },
      websiteStructure: {
        findMany: jest.fn().mockResolvedValue([])
      },
      websiteDesignConcept: {
        findFirst: jest.fn().mockResolvedValue(null)
      },
      redirect: {
        findMany: jest.fn().mockResolvedValue([])
      }
    }

    const { snapshot, diagnostics } = await buildUcsSiteSnapshot({
      prisma: prisma as any,
      websiteId: 'site',
      resolveMedia: false
    })

    expect(snapshot.pages).toEqual([])
    expect(snapshot.pages.find(page => page.fullPath === '/metadata-path')).toBeUndefined()
    expect(diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'MISSING_STRUCTURE_ENTRY',
        level: 'error',
        message: 'Page page-1 skipped because WebsiteStructure.fullPath is missing',
        context: expect.objectContaining({
          websiteId: 'site',
          pageId: 'page-1'
        })
      })
    ]))
  })

  it('rejects legacy sections without promoting data.content into snapshot page components', async () => {
    const prisma = {
      website: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'site',
          name: 'Site',
          description: null,
          metadata: {},
          settings: {}
        })
      },
      websiteSharedComponent: {
        findMany: jest.fn().mockResolvedValue([])
      },
      websitePage: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'page-1',
            title: 'Home',
            content: {
              sections: [
                {
                  id: 'section-1',
                  componentType: 'text-block',
                  data: { content: { text: 'Hello' } }
                }
              ]
            },
            templateKey: null,
            templateProps: {},
            metadata: {},
            structures: [
              {
                id: 'structure-1',
                fullPath: '/',
                slug: 'home',
                parentId: null,
                position: 0
              }
            ]
          }
        ])
      },
      websiteStructure: {
        findMany: jest.fn().mockResolvedValue([])
      },
      websiteDesignConcept: {
        findFirst: jest.fn().mockResolvedValue(null)
      },
      redirect: {
        findMany: jest.fn().mockResolvedValue([])
      }
    }

    const { snapshot, diagnostics } = await buildUcsSiteSnapshot({
      prisma: prisma as any,
      websiteId: 'site',
      resolveMedia: false
    })

    expect(snapshot.pages[0].components).toEqual([])
    expect(diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'PAGE_CONTENT_LEGACY_SECTIONS',
        level: 'warn',
        context: expect.objectContaining({
          websiteId: 'site',
          pageId: 'page-1',
          path: 'sections',
          source: 'page.content'
        })
      })
    ]))
  })

  it('keeps canonical component content out of snapshot component props', async () => {
    const prisma = {
      website: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'site',
          name: 'Site',
          description: null,
          metadata: {},
          settings: {}
        })
      },
      websiteSharedComponent: {
        findMany: jest.fn().mockResolvedValue([])
      },
      websitePage: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'page-1',
            title: 'Home',
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
            },
            templateKey: null,
            templateProps: {},
            metadata: {},
            structures: [
              {
                id: 'structure-1',
                fullPath: '/',
                slug: 'home',
                parentId: null,
                position: 0
              }
            ]
          }
        ])
      },
      websiteStructure: {
        findMany: jest.fn().mockResolvedValue([])
      },
      websiteDesignConcept: {
        findFirst: jest.fn().mockResolvedValue(null)
      },
      redirect: {
        findMany: jest.fn().mockResolvedValue([])
      }
    }

    const { snapshot } = await buildUcsSiteSnapshot({
      prisma: prisma as any,
      websiteId: 'site',
      resolveMedia: false
    })

    expect(snapshot.pages[0].components[0].content).toEqual({
      heading: 'Canonical heading',
      subheading: 'Canonical subheading'
    })
    expect(snapshot.pages[0].components[0].props).toEqual(
      expect.objectContaining({
        theme: 'dark'
      })
    )
    expect(snapshot.pages[0].components[0].props).not.toHaveProperty('content')
  })

  it('ignores malformed two-column props.text during canonical enrichment', async () => {
    const prisma = {
      website: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'site',
          name: 'Site',
          description: null,
          metadata: {},
          settings: {}
        })
      },
      websiteSharedComponent: {
        findMany: jest.fn().mockResolvedValue([])
      },
      websitePage: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'page-1',
            title: 'Home',
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
            },
            templateKey: null,
            templateProps: {},
            metadata: {},
            structures: [
              {
                id: 'structure-1',
                fullPath: '/',
                slug: 'home',
                parentId: null,
                position: 0
              }
            ]
          }
        ])
      },
      websiteStructure: {
        findMany: jest.fn().mockResolvedValue([])
      },
      websiteDesignConcept: {
        findFirst: jest.fn().mockResolvedValue(null)
      },
      redirect: {
        findMany: jest.fn().mockResolvedValue([])
      }
    }

    const { snapshot, diagnostics } = await buildUcsSiteSnapshot({
      prisma: prisma as any,
      websiteId: 'site',
      resolveMedia: false
    })

    expect(diagnostics.map(diagnostic => diagnostic.code)).not.toContain('UCS_TWO_COLUMN_PROPS_TEXT_INVALID_JSON')
    expect(diagnostics.map(diagnostic => diagnostic.code)).not.toContain('PAGE_CONTENT_COMPONENT_PROPS_TEXT_JSON_PARSE_FAILED')
    expect(snapshot.pages[0].components[0].content).toEqual({})
    expect(snapshot.pages[0].components[0].props).not.toHaveProperty('text')
  })

  it('returns normalizer parse diagnostics for malformed page content', async () => {
    const prisma = {
      website: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'site',
          name: 'Site',
          description: null,
          metadata: {},
          settings: {}
        })
      },
      websiteSharedComponent: {
        findMany: jest.fn().mockResolvedValue([])
      },
      websitePage: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'page-1',
            title: 'Home',
            content: '{"components":',
            templateKey: null,
            templateProps: {},
            metadata: {},
            structures: [
              {
                id: 'structure-1',
                fullPath: '/',
                slug: 'home',
                parentId: null,
                position: 0
              }
            ]
          }
        ])
      },
      websiteStructure: {
        findMany: jest.fn().mockResolvedValue([])
      },
      websiteDesignConcept: {
        findFirst: jest.fn().mockResolvedValue(null)
      },
      redirect: {
        findMany: jest.fn().mockResolvedValue([])
      }
    }

    const { snapshot, diagnostics } = await buildUcsSiteSnapshot({
      prisma: prisma as any,
      websiteId: 'site',
      resolveMedia: false
    })

    expect(snapshot.pages[0].components).toEqual([])
    expect(diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'PAGE_CONTENT_JSON_PARSE_FAILED',
        level: 'warn',
        context: expect.objectContaining({
          websiteId: 'site',
          pageId: 'page-1',
          path: '$',
          source: 'page.content'
        })
      })
    ]))
  })
})
