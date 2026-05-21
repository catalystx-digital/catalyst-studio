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
  it('normalizes legacy sections content into snapshot page components', async () => {
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

    const { snapshot } = await buildUcsSiteSnapshot({
      prisma: prisma as any,
      websiteId: 'site',
      resolveMedia: false
    })

    expect(snapshot.pages[0].components).toEqual([
      expect.objectContaining({
        id: 'section-1',
        type: 'text-block',
        props: expect.objectContaining({ content: { text: 'Hello' } })
      })
    ])
  })
})
