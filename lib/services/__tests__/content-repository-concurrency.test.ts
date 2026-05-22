import { ContentRepository } from '../unified-content-repository'

// Mock prisma and shape a transactional client
jest.mock('@/lib/prisma', () => {
  const prismaMock = {
    websiteSharedComponent: {
      findUnique: jest.fn(),
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

describe('ContentRepository.saveSharedComponentContent concurrency + mirroring', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('updates content and mirrors defaultProps transactionally', async () => {
    const sharedId = 'sc-1'
    const existing = {
      id: sharedId,
      content: { a: 1 },
      config: { defaultProps: { a: 1 }, other: 1 },
      lastModified: new Date('2025-01-01T00:00:00Z'),
    }
    ;(prisma.websiteSharedComponent.findUnique as jest.Mock).mockResolvedValue(existing)
    ;(prisma.websiteSharedComponent.update as jest.Mock).mockResolvedValue({ ...existing, content: { a: 2 } })

    await ContentRepository.saveSharedComponentContent(sharedId, { a: 2 }, { mirrorDefaultProps: true })

    expect(prisma.$transaction).toHaveBeenCalled()
    expect(prisma.websiteSharedComponent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: sharedId },
        data: expect.objectContaining({
          content: expect.anything(),
          config: expect.anything(),
        }),
      })
    )
    const dataArg = (prisma.websiteSharedComponent.update as jest.Mock).mock.calls[0][0].data
    expect(dataArg.config).toBeTruthy()
  })

  it('throws conflict when lastModified is newer than ifUnchangedSince', async () => {
    const sharedId = 'sc-2'
    const existing = {
      id: sharedId,
      content: { a: 1 },
      config: { defaultProps: { a: 1 } },
      lastModified: new Date('2025-09-12T01:00:00Z'),
    }
    ;(prisma.websiteSharedComponent.findUnique as jest.Mock).mockResolvedValue(existing)

    await expect(
      ContentRepository.saveSharedComponentContent(sharedId, { a: 2 }, { ifUnchangedSince: new Date('2025-09-12T00:00:00Z') })
    ).rejects.toThrow('Conflict: component modified since')
  })
})

describe('ContentRepository.savePageOverrides contract', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('saves canonical content and override props without content mirrors', async () => {
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
    ;(prisma.websitePage.update as jest.Mock).mockResolvedValue({ ...page })

    await ContentRepository.savePageOverrides('page-1', 'inst-1', { title: 'Edited title' })

    const updateCall = (prisma.websitePage.update as jest.Mock).mock.calls[0][0]
    const component = updateCall.data.content.components[0]

    expect(component.content).toEqual({
      title: 'Edited title',
      body: 'Canonical body',
    })
    expect(component.props).toEqual({
      sharedComponentId: 'sc-1',
      overrides: { title: 'Edited title' },
      hasOverrides: true,
    })
    expect(component.props).not.toHaveProperty('text')
  })

  it('preserves legitimate scalar props.text while removing only mirror-shaped text', async () => {
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
            props: {
              text: 'Click me',
            },
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
    expect(component.props.text).toBe('Click me')
    expect(component.props).not.toHaveProperty('content')
  })

  it('clears mirror-shaped props.text when overrides are removed', async () => {
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

    await ContentRepository.savePageOverrides('page-1', 'inst-1', null)

    const updateCall = (prisma.websitePage.update as jest.Mock).mock.calls[0][0]
    const component = updateCall.data.content.components[0]

    expect(component.content).toEqual({})
    expect(component.props).toEqual({
      sharedComponentId: 'sc-1',
    })
    expect(component.props).not.toHaveProperty('text')
    expect(component.props).not.toHaveProperty('content')
    expect(component.props).not.toHaveProperty('overrides')
    expect(component.props).not.toHaveProperty('hasOverrides')
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
