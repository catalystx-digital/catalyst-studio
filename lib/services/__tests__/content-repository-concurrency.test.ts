import { PageContentNormalizationError } from '@/lib/studio/page-content'
import { ContentRepository } from '../unified-content-repository'

// Mock prisma and shape a transactional client
jest.mock('@/lib/prisma', () => {
  const prismaMock = {
    websiteSharedComponent: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    websitePage: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(async (fn: any) => {
      // Pass the same client shape inside the transaction
      const tx = {
        websiteSharedComponent: prismaMock.websiteSharedComponent,
      } as any
      return fn(tx)
    }),
  } as any
  return { prisma: prismaMock }
})

// Use the same prisma object the module uses
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { prisma } = require('@/lib/prisma')

describe('ContentRepository.saveSharedComponentContent concurrency', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('updates shared content transactionally without mutating config', async () => {
    const sharedId = 'sc-1'
    const existing = {
      id: sharedId,
      websiteId: 'w1',
      content: { a: 1 },
      config: { defaultProps: { a: 1 }, other: 1 },
      lastModified: new Date('2025-01-01T00:00:00Z'),
    }
    ;(prisma.websiteSharedComponent.findUnique as jest.Mock).mockResolvedValue(existing)
    ;(prisma.websiteSharedComponent.update as jest.Mock).mockResolvedValue({ ...existing, content: { a: 2 } })

    await ContentRepository.saveSharedComponentContent(sharedId, { a: 2 })

    expect(prisma.$transaction).toHaveBeenCalled()
    expect(prisma.websiteSharedComponent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: sharedId },
        data: {
          content: { a: 2 },
        },
      })
    )
    const dataArg = (prisma.websiteSharedComponent.update as jest.Mock).mock.calls[0][0].data
    expect(dataArg).not.toHaveProperty('config')
  })

  it('throws conflict when lastModified is newer than ifUnchangedSince', async () => {
    const sharedId = 'sc-2'
    const existing = {
      id: sharedId,
      websiteId: 'w1',
      content: { a: 1 },
      config: { defaultProps: { a: 1 } },
      lastModified: new Date('2025-09-12T01:00:00Z'),
    }
    ;(prisma.websiteSharedComponent.findUnique as jest.Mock).mockResolvedValue(existing)

    await expect(
      ContentRepository.saveSharedComponentContent(sharedId, { a: 2 }, { ifUnchangedSince: new Date('2025-09-12T00:00:00Z') })
    ).rejects.toThrow('Conflict: component modified since')
  })

  it('rejects shared content updates outside the requested website scope', async () => {
    ;(prisma.websiteSharedComponent.findUnique as jest.Mock).mockResolvedValue({
      id: 'sc-1',
      websiteId: 'w2',
      content: { a: 1 },
      config: { defaultProps: { a: 1 } },
      lastModified: new Date('2025-01-01T00:00:00Z'),
    })

    await expect(
      ContentRepository.saveSharedComponentContent('sc-1', { a: 2 }, { websiteId: 'w1' })
    ).rejects.toThrow('Shared component not found')

    expect(prisma.websiteSharedComponent.update).not.toHaveBeenCalled()
  })
})

describe('ContentRepository.getPageWithResolvedComponents scope', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('only resolves shared component rows from the page website', async () => {
    ;(prisma.websitePage.findUnique as jest.Mock).mockResolvedValue({
      id: 'page-1',
      websiteId: 'w1',
      title: 'Page',
      content: {
        components: [
          {
            id: 'inst-1',
            type: 'shared',
            position: 0,
            props: { sharedComponentId: 'sc-foreign' },
          },
        ],
      },
    })
    ;(prisma.websiteSharedComponent.findMany as jest.Mock).mockResolvedValue([])

    const result = await ContentRepository.getPageWithResolvedComponents('w1', 'page-1')

    expect(prisma.websiteSharedComponent.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['sc-foreign'] }, websiteId: 'w1' },
    })
    expect(result.components[0]).toEqual(expect.objectContaining({
      sharedId: 'sc-foreign',
      effectiveProps: {},
    }))
  })

  it('does not use config.defaultProps when shared component content is missing', async () => {
    ;(prisma.websitePage.findUnique as jest.Mock).mockResolvedValue({
      id: 'page-1',
      websiteId: 'w1',
      title: 'Page',
      content: {
        components: [
          {
            id: 'inst-1',
            type: 'shared',
            position: 0,
            props: {
              sharedComponentId: 'sc-1',
              overrides: { title: 'Override title' },
            },
          },
        ],
      },
    })
    ;(prisma.websiteSharedComponent.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'sc-1',
        websiteId: 'w1',
        content: null,
        config: { defaultProps: { title: 'Legacy fallback title', body: 'Legacy body' } },
      },
    ])

    const result = await ContentRepository.getPageWithResolvedComponents('w1', 'page-1')

    expect(result.components[0]).toEqual(expect.objectContaining({
      sharedId: 'sc-1',
      hasOverrides: true,
      effectiveProps: { title: 'Override title' },
    }))
    expect(result.components[0].effectiveProps).not.toHaveProperty('body')
  })

  it('does not resolve root sharedComponentId fallback references', async () => {
    ;(prisma.websitePage.findUnique as jest.Mock).mockResolvedValue({
      id: 'page-1',
      websiteId: 'w1',
      title: 'Page',
      content: {
        components: [
          {
            id: 'inst-1',
            type: 'shared',
            position: 0,
            sharedComponentId: 'sc-root',
            props: {},
          },
        ],
      },
    })
    ;(prisma.websiteSharedComponent.findMany as jest.Mock).mockResolvedValue([])

    const result = await ContentRepository.getPageWithResolvedComponents('w1', 'page-1')

    expect(prisma.websiteSharedComponent.findMany).not.toHaveBeenCalled()
    expect(result.components[0]).toEqual(expect.objectContaining({
      sharedId: undefined,
      isShared: false,
      effectiveProps: {},
    }))
  })
})

describe('ContentRepository.savePageOverrides contract', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('rejects existing props.text mirrors instead of cleaning them before saving overrides', async () => {
    const page = {
      id: 'page-1',
      websiteId: 'w1',
      title: 'T',
      type: 'page',
      content: {
        components: [
          {
            id: 'inst-1',
            type: 'shared',
            position: 0,
            props: {
              sharedComponentId: 'sc-1',
              text: { title: 'Stale mirror', body: 'Old body' },
            },
            content: { title: 'Canonical title', body: 'Canonical body' },
          },
        ],
      },
      updatedAt: new Date('2025-09-12T00:00:00Z'),
    }
    ;(prisma.websitePage.findUnique as jest.Mock).mockResolvedValue(page)
    ;(prisma.websiteSharedComponent.findUnique as jest.Mock).mockResolvedValue({ id: 'sc-1', websiteId: 'w1' })
    ;(prisma.websitePage.update as jest.Mock).mockResolvedValue({ ...page })

    await expect(
      ContentRepository.savePageOverrides('page-1', 'inst-1', { title: 'Edited title' })
    ).rejects.toBeInstanceOf(PageContentNormalizationError)

    expect(prisma.websitePage.update).not.toHaveBeenCalled()
  })

  it('saves canonical page mutations without legacy mirrors', async () => {
    const page = {
      id: 'page-1',
      websiteId: 'w1',
      title: 'T',
      type: 'page',
      content: {
        components: [
          {
            id: 'inst-1',
            type: 'button',
            position: 0,
            props: {},
            content: { label: 'Click me', href: '/old' },
          },
        ],
      },
      updatedAt: new Date('2025-09-12T00:00:00Z'),
    }
    ;(prisma.websitePage.findUnique as jest.Mock).mockResolvedValue(page)
    ;(prisma.websitePage.update as jest.Mock).mockResolvedValue({ ...page })

    await ContentRepository.savePageOverrides('page-1', 'inst-1', { href: '/new' })

    const updateCall = (prisma.websitePage.update as jest.Mock).mock.calls[0][0]
    const component = updateCall.data.content.components[0]

    expect(component.content).toEqual({
      label: 'Click me',
      href: '/new',
    })
    expect(component.props).not.toHaveProperty('content')
  })

  it('rejects mirror-shaped props.text when overrides are removed', async () => {
    const page = {
      id: 'page-1',
      websiteId: 'w1',
      title: 'T',
      type: 'page',
      content: {
        components: [
          {
            id: 'inst-1',
            type: 'shared',
            position: 0,
            props: {
              sharedComponentId: 'sc-1',
              text: JSON.stringify({ title: 'Override title' }),
              content: { title: 'Override title' },
              overrides: { title: 'Override title' },
              hasOverrides: true,
            },
            content: { title: 'Override title' },
          },
        ],
      },
      updatedAt: new Date('2025-09-12T00:00:00Z'),
    }
    ;(prisma.websitePage.findUnique as jest.Mock).mockResolvedValue(page)
    ;(prisma.websitePage.update as jest.Mock).mockResolvedValue({ ...page })

    await expect(
      ContentRepository.savePageOverrides('page-1', 'inst-1', null)
    ).rejects.toBeInstanceOf(PageContentNormalizationError)

    expect(prisma.websitePage.update).not.toHaveBeenCalled()
  })

  it('rejects stale legacy mirrors when clearing overrides from missing canonical content', async () => {
    const page = {
      id: 'page-1',
      websiteId: 'w1',
      title: 'T',
      type: 'page',
      content: {
        components: [
          {
            id: 'inst-1',
            type: 'shared',
            position: 0,
            props: {
              sharedComponentId: 'sc-1',
              text: { title: 'Stale mirror title' },
              content: { title: 'Stale props.content title' },
              overrides: { title: 'Override title' },
              hasOverrides: true,
            },
          },
        ],
      },
      updatedAt: new Date('2025-09-12T00:00:00Z'),
    }
    ;(prisma.websitePage.findUnique as jest.Mock).mockResolvedValue(page)
    ;(prisma.websitePage.update as jest.Mock).mockResolvedValue({ ...page })

    await expect(
      ContentRepository.savePageOverrides('page-1', 'inst-1', null)
    ).rejects.toBeInstanceOf(PageContentNormalizationError)

    expect(prisma.websitePage.update).not.toHaveBeenCalled()
  })

  it.each([
    ['array', []],
    ['string', '{"title":"Legacy"}'],
    ['legacy props.content wrapper', { props: { content: JSON.stringify({ title: 'Legacy' }) } }],
    ['legacy props.text wrapper', { props: { text: { title: 'Legacy' } } }],
  ])('throws before reading the page for %s overrides', async (_name, overrides) => {
    await expect(
      ContentRepository.savePageOverrides('page-1', 'inst-1', overrides as any)
    ).rejects.toThrow(/plain object or null|Legacy wrapped page overrides/)

    expect(prisma.websitePage.findUnique).not.toHaveBeenCalled()
    expect(prisma.websitePage.update).not.toHaveBeenCalled()
  })
})

describe('ContentRepository page mutations canonical reads', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('rejects stale props.content, props.text, and data.content when adding a shared instance', async () => {
    const page = {
      id: 'page-1',
      websiteId: 'w1',
      title: 'T',
      type: 'page',
      content: {
        version: 1,
        components: [
          {
            id: 'existing-1',
            type: 'hero',
            parentId: null,
            position: 0,
            props: {
              content: { heading: 'Stale props.content' },
              text: JSON.stringify({ heading: 'Stale props.text' }),
              className: 'hero-shell',
            },
            data: {
              content: { heading: 'Stale data.content' },
            },
            content: {},
          },
        ],
      },
      updatedAt: new Date('2025-09-12T00:00:00Z'),
    }
    ;(prisma.websitePage.findUnique as jest.Mock).mockResolvedValue(page)
    ;(prisma.websitePage.update as jest.Mock).mockResolvedValue({ ...page })

    await expect(
      ContentRepository.addSharedInstanceToPage('page-1', 'sc-1', 1)
    ).rejects.toBeInstanceOf(PageContentNormalizationError)

    expect(prisma.websitePage.update).not.toHaveBeenCalled()
  })

  it('rejects adding a shared instance from another website', async () => {
    ;(prisma.websitePage.findUnique as jest.Mock).mockResolvedValue({
      id: 'page-1',
      websiteId: 'w1',
      title: 'T',
      type: 'page',
      content: { version: 1, components: [] },
      updatedAt: new Date('2025-09-12T00:00:00Z'),
    })
    ;(prisma.websiteSharedComponent.findUnique as jest.Mock).mockResolvedValue({ id: 'sc-1', websiteId: 'w2' })

    await expect(
      ContentRepository.addSharedInstanceToPage('page-1', 'sc-1', 0)
    ).rejects.toThrow('Shared component not found')

    expect(prisma.websitePage.update).not.toHaveBeenCalled()
  })

  it('rejects converting props to overrides against a shared component from another website', async () => {
    ;(prisma.websitePage.findUnique as jest.Mock).mockResolvedValue({
      id: 'page-1',
      websiteId: 'w1',
      title: 'T',
      type: 'page',
      content: {
        version: 1,
        components: [
          {
            id: 'inst-1',
            type: 'shared',
            position: 0,
            props: { sharedComponentId: 'sc-1', heading: 'Local' },
            content: {},
          },
        ],
      },
      updatedAt: new Date('2025-09-12T00:00:00Z'),
    })
    ;(prisma.websiteSharedComponent.findUnique as jest.Mock).mockResolvedValue({ id: 'sc-1', websiteId: 'w2' })

    await expect(
      ContentRepository.convertFullPropsToOverrides('page-1', 'inst-1', 'sc-1')
    ).rejects.toThrow('Shared component not found')

    expect(prisma.websitePage.update).not.toHaveBeenCalled()
  })

  it('does not diff full props against config.defaultProps when shared content is missing', async () => {
    const page = {
      id: 'page-1',
      websiteId: 'w1',
      title: 'T',
      type: 'page',
      content: {
        version: 1,
        components: [
          {
            id: 'inst-1',
            type: 'shared',
            position: 0,
            props: {
              sharedComponentId: 'sc-1',
              heading: 'Legacy default heading',
              body: 'Local body',
            },
            content: {},
          },
        ],
      },
      updatedAt: new Date('2025-09-12T00:00:00Z'),
    }
    ;(prisma.websitePage.findUnique as jest.Mock).mockResolvedValue(page)
    ;(prisma.websiteSharedComponent.findUnique as jest.Mock).mockResolvedValue({
      id: 'sc-1',
      websiteId: 'w1',
      content: null,
      config: {
        defaultProps: {
          heading: 'Legacy default heading',
          body: 'Legacy default body',
        },
      },
    })
    ;(prisma.websitePage.update as jest.Mock).mockResolvedValue({ ...page })

    await ContentRepository.convertFullPropsToOverrides('page-1', 'inst-1', 'sc-1')

    const updateCall = (prisma.websitePage.update as jest.Mock).mock.calls[0][0]
    const component = updateCall.data.content.components[0]

    expect(component.props.overrides).toEqual({
      heading: 'Legacy default heading',
      body: 'Local body',
    })
  })
})
