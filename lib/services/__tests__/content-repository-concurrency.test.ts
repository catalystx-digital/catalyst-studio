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
