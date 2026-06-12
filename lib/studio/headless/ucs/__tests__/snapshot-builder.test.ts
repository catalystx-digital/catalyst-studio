import { ComponentType } from '@/lib/studio/components/cms/_core/types'
import type { ComponentInstance } from '@/lib/studio/types/site-builder/component-instance'
import { buildUcsSiteSnapshot, enrichComponentFromShared, normalizeAssetUrl } from '../snapshot-builder'

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
  const createPrisma = (overrides: Record<string, unknown> = {}) => ({
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
      findMany: jest.fn().mockResolvedValue([])
    },
    websiteStructure: {
      findMany: jest.fn().mockResolvedValue([])
    },
    websiteDesignConcept: {
      findFirst: jest.fn().mockResolvedValue(null)
    },
    websiteDesignSystem: {
      findFirst: jest.fn().mockResolvedValue(null)
    },
    redirect: {
      findMany: jest.fn().mockResolvedValue([])
    },
    ...overrides
  })

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

  it('rejects legacy sections without including a snapshot page', async () => {
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

    expect(snapshot.pages).toEqual([])
    expect(diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'PAGE_CONTENT_LEGACY_SECTIONS',
        level: 'error',
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

  it('rejects malformed two-column props.text instead of including a snapshot page', async () => {
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

    expect(snapshot.pages).toEqual([])
    expect(diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'PAGE_CONTENT_COMPONENT_PROPS_TEXT_JSON_PARSE_FAILED',
        level: 'error',
        context: expect.objectContaining({
          websiteId: 'site',
          pageId: 'page-1',
          source: 'page.content',
          path: 'components[0].props.text'
        })
      })
    ]))
  })

  it('rejects malformed page content with normalizer parse diagnostics', async () => {
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

    expect(snapshot.pages).toEqual([])
    expect(diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'PAGE_CONTENT_JSON_PARSE_FAILED',
        level: 'error',
        context: expect.objectContaining({
          websiteId: 'site',
          pageId: 'page-1',
          path: '$',
          source: 'page.content'
        })
      })
    ]))
  })

  it('exports only valid current shadcn design-system tokens', async () => {
    const tokens = {
      variables: { '--primary': '240 5.9% 10%' },
      darkVariables: { '--primary': '0 0% 98%' },
      extraction: {
        timestamp: '2024-01-01T00:00:00.000Z',
        confidence: 1,
        source: 'detected',
        detectedCount: 1,
        defaultCount: 0
      }
    }
    const prisma = createPrisma({
      websiteDesignSystem: {
        findFirst: jest.fn().mockResolvedValue({ id: 'design-system-1', tokens })
      }
    })

    const { snapshot, diagnostics } = await buildUcsSiteSnapshot({
      prisma: prisma as any,
      websiteId: 'site',
      resolveMedia: false
    })

    expect(snapshot.designSystem).toEqual({
      tokens,
      conceptId: undefined,
      conceptName: undefined
    })
    expect(diagnostics).not.toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: expect.stringMatching(/^DESIGN_SYSTEM_(LEGACY|INVALID)_PAYLOAD$/)
      })
    ]))
  })

  it('diagnoses legacy design-system payloads instead of exporting converted defaults', async () => {
    const prisma = createPrisma({
      websiteDesignSystem: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'design-system-1',
          tokens: {
            palette: {
              primary: [{ value: '#ff0000', confidence: 1, source: 'css-var' }],
              secondary: [],
              accent: [],
              neutral: [],
              surface: []
            }
          }
        })
      }
    })

    const { snapshot, diagnostics } = await buildUcsSiteSnapshot({
      prisma: prisma as any,
      websiteId: 'site',
      resolveMedia: false
    })

    expect(snapshot.designSystem).toBeNull()
    expect(diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'DESIGN_SYSTEM_LEGACY_PAYLOAD',
        level: 'error',
        message: 'Legacy palette design-system payloads are not valid runtime shadcn tokens.',
        context: expect.objectContaining({
          websiteId: 'site',
          designSystemId: 'design-system-1'
        })
      })
    ]))
  })

  it('diagnoses malformed current design-system payloads instead of exporting defaults', async () => {
    const prisma = createPrisma({
      websiteDesignSystem: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'design-system-1',
          tokens: {
            variables: { '--primary': 123 },
            extraction: {
              timestamp: '2024-01-01T00:00:00.000Z',
              confidence: 1,
              source: 'detected',
              detectedCount: 1,
              defaultCount: 0
            }
          }
        })
      }
    })

    const { snapshot, diagnostics } = await buildUcsSiteSnapshot({
      prisma: prisma as any,
      websiteId: 'site',
      resolveMedia: false
    })

    expect(snapshot.designSystem).toBeNull()
    expect(diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'DESIGN_SYSTEM_INVALID_PAYLOAD',
        level: 'error',
        message: 'Design-system payload is not valid current shadcn token data.',
        context: expect.objectContaining({
          websiteId: 'site',
          designSystemId: 'design-system-1'
        })
      })
    ]))
  })

  it('does not report missing design-system records as default fallback', async () => {
    const prisma = createPrisma()

    const { snapshot, diagnostics } = await buildUcsSiteSnapshot({
      prisma: prisma as any,
      websiteId: 'site',
      resolveMedia: false
    })

    expect(snapshot.designSystem).toBeNull()
    expect(diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'DESIGN_SYSTEM_MISSING',
        message: 'No design system tokens were found for this website.'
      })
    ]))
    expect(diagnostics.map(diagnostic => diagnostic.message).join('\n')).not.toContain('fall back to Catalyst defaults')
  })

  it('does not fall back to the default concept when a requested design concept is missing', async () => {
    const designSystemFindFirst = jest.fn().mockResolvedValue({
      id: 'design-system-1',
      tokens: {
        variables: { '--primary': '240 5.9% 10%' },
        extraction: {
          timestamp: '2024-01-01T00:00:00.000Z',
          confidence: 1,
          source: 'detected',
          detectedCount: 1,
          defaultCount: 0
        }
      }
    })
    const prisma = createPrisma({
      websiteDesignConcept: {
        findFirst: jest.fn().mockResolvedValue(null)
      },
      websiteDesignSystem: {
        findFirst: designSystemFindFirst
      }
    })

    const { snapshot, diagnostics } = await buildUcsSiteSnapshot({
      prisma: prisma as any,
      websiteId: 'site',
      designConcept: 'missing-concept',
      resolveMedia: false
    })

    expect(snapshot.designSystem).toBeNull()
    expect(designSystemFindFirst).not.toHaveBeenCalled()
    expect(diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'DESIGN_CONCEPT_NOT_FOUND',
        level: 'error',
        message: 'Design concept "missing-concept" was not found.'
      })
    ]))
    expect(diagnostics.map(diagnostic => diagnostic.message).join('\n')).not.toContain('Falling back')
  })
})

describe('enrichComponentFromShared', () => {
  it('preserves shared navbar row styles for preview rendering', () => {
    const component: ComponentInstance = {
      id: 'navbar-instance',
      type: 'navbar',
      componentType: ComponentType.NavBar,
      parentId: null,
      position: 0,
      props: { sharedComponentId: 'shared-navbar' },
      content: {},
      styles: {},
      metadata: {}
    }

    const enriched = enrichComponentFromShared(component, [
      {
        id: 'shared-navbar',
        name: 'Shared Navbar',
        componentType: ComponentType.NavBar,
        content: {
          layout: 'multi-row',
          utilityNav: [
            { label: 'About', href: { type: 'internal', path: '/about/' } },
            { label: 'Donate', href: 'https://example.com/donate' }
          ],
          menuItems: [
            { label: 'Insights', href: '/insights' },
            { label: 'Careers', href: { type: 'internal', path: '/careers/' } },
            { label: 'External', href: 'https://example.com/news' }
          ],
          logo: {
            alt: 'Example logo',
            src: {
              url: '/assets/logo.svg',
              mediaId: 'logo-media',
              mediaType: 'image'
            },
            originalUrl: '/assets/logo.svg'
          },
          styles: {
            rootRow: {
              backgroundColor: '#ffffff',
              textColor: '#111827',
              borderColor: '#e5e7eb',
              ignored: 'drop me'
            },
            ignoredRow: {
              backgroundColor: '#000000'
            },
            primaryItems: [
              {
                label: 'Insights',
                backgroundColor: '#000000',
                color: '#ffffff',
                ignored: 'drop me'
              },
              {
                label: 'Invalid',
                backgroundColor: 'red; color: white'
              }
            ]
          }
        },
        config: {}
      }
    ], { assetOrigin: 'https://example.com' })

    expect(enriched.content).toMatchObject({
      layout: 'multi-row',
      logo: {
        alt: 'Example logo',
        src: {
          url: 'https://example.com/assets/logo.svg',
          mediaId: 'logo-media',
          mediaType: 'image'
        },
        originalUrl: '/assets/logo.svg'
      },
      utilityNav: [
        { label: 'About', href: { type: 'internal', path: '/about/' } },
        { label: 'Donate', href: { type: 'external', url: 'https://example.com/donate' } }
      ],
      menuItems: [
        { label: 'Insights', href: { type: 'internal', path: '/insights' } },
        { label: 'Careers', href: { type: 'internal', path: '/careers/' } },
        { label: 'External', href: { type: 'external', url: 'https://example.com/news' } }
      ],
      styles: {
        rootRow: {
          backgroundColor: '#ffffff',
          textColor: '#111827',
          borderColor: '#e5e7eb'
        },
        primaryItems: [
          {
            label: 'Insights',
            backgroundColor: '#000000',
            textColor: '#ffffff'
          }
        ]
      }
    })
    expect((enriched.content as Record<string, any>).styles).not.toHaveProperty('ignoredRow')
    expect(enriched.type).toBe(ComponentType.NavBar)
  })
})
