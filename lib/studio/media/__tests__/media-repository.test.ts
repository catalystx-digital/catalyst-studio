import { MediaRepository } from '../media-repository'
import { MediaStorageProvider, MediaUsageType, PrismaClient } from '@/lib/generated/prisma'

const createMockPrisma = (): PrismaClient => ({
  websiteMedia: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    deleteMany: jest.fn()
  },
  websiteMediaSource: {
    findUnique: jest.fn(),
    upsert: jest.fn()
  },
  websiteMediaUsage: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    deleteMany: jest.fn()
  }
} as unknown as PrismaClient)

describe('MediaRepository', () => {
  let prisma: PrismaClient
  let repository: MediaRepository

  beforeEach(() => {
    prisma = createMockPrisma()
    repository = new MediaRepository(prisma)
    jest.clearAllMocks()
  })

  describe('createMediaAsset', () => {
    it('persists media asset with defaults', async () => {
      const mockMedia = { id: 'media-1' }
      ;(prisma.websiteMedia.create as jest.Mock).mockResolvedValue(mockMedia)

      const result = await repository.createMediaAsset({
        websiteId: 'site-1',
        provider: MediaStorageProvider.FILE,
        storageKey: 'uploads/asset.png',
        checksum: 'abc123',
        contentType: 'image/png'
      })

      expect(prisma.websiteMedia.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          websiteId: 'site-1',
          storageKey: 'uploads/asset.png',
          checksum: 'abc123',
          contentType: 'image/png'
        })
      })
      expect(result).toBe(mockMedia)
    })
  })

  describe('listMediaByIds', () => {
    it('returns empty array when no ids provided', async () => {
      const result = await repository.listMediaByIds('site-1', [])
      expect(result).toEqual([])
      expect(prisma.websiteMedia.findMany).not.toHaveBeenCalled()
    })

    it('fetches media with sources for provided ids', async () => {
      const rows = [{ id: 'media-1', sources: [] }]
      ;(prisma.websiteMedia.findMany as jest.Mock).mockResolvedValue(rows)

      const result = await repository.listMediaByIds('site-1', ['media-1'])

      expect(prisma.websiteMedia.findMany).toHaveBeenCalledWith({
        where: { websiteId: 'site-1', id: { in: ['media-1'] } },
        include: { sources: true }
      })
      expect(result).toBe(rows)
    })
  })
  describe('resolveByOriginalUrl', () => {
    it('returns null when no source mapping exists', async () => {
      ;(prisma.websiteMediaSource.findUnique as jest.Mock).mockResolvedValue(null)
      const result = await repository.resolveByOriginalUrl('site-1', 'https://example.com/img.png')
      expect(result).toBeNull()
    })

    it('returns media and source when mapping exists', async () => {
      const mapping = { id: 'source-1', media: { id: 'media-1' } }
      ;(prisma.websiteMediaSource.findUnique as jest.Mock).mockResolvedValue(mapping)

      const result = await repository.resolveByOriginalUrl('site-1', 'https://example.com/img.png')
      expect(result).toEqual({ media: mapping.media, source: mapping })
    })
  })

  describe('upsertSourceLink', () => {
    it('delegates to prisma upsert', async () => {
      const mockSource = { id: 'source-1' }
      ;(prisma.websiteMediaSource.upsert as jest.Mock).mockResolvedValue(mockSource)

      const result = await repository.upsertSourceLink({
        websiteId: 'site-1',
        mediaId: 'media-1',
        originalUrl: 'https://example.com/img.png'
      })

      expect(prisma.websiteMediaSource.upsert).toHaveBeenCalledWith({
        where: { websiteId_originalUrl: { websiteId: 'site-1', originalUrl: 'https://example.com/img.png' } },
        create: expect.objectContaining({ websiteId: 'site-1', mediaId: 'media-1' }),
        update: expect.objectContaining({ mediaId: 'media-1' })
      })
      expect(result).toBe(mockSource)
    })
  })

  describe('recordUsage', () => {
    it('creates new usage when none exists', async () => {
      ;(prisma.websiteMediaUsage.findFirst as jest.Mock).mockResolvedValue(null)
      const created = { id: 'usage-1' }
      ;(prisma.websiteMediaUsage.create as jest.Mock).mockResolvedValue(created)

      const result = await repository.recordUsage({
        websiteId: 'site-1',
        mediaId: 'media-1',
        usageType: MediaUsageType.page_component,
        pageId: 'page-1'
      })

      expect(prisma.websiteMediaUsage.create).toHaveBeenCalled()
      expect(result).toEqual({ usage: created, created: true })
    })

    it('updates existing usage when match found', async () => {
      const existing = { id: 'usage-1' }
      ;(prisma.websiteMediaUsage.findFirst as jest.Mock).mockResolvedValue(existing)
      const updated = { id: 'usage-1', metadata: { updated: true } }
      ;(prisma.websiteMediaUsage.update as jest.Mock).mockResolvedValue(updated)

      const result = await repository.recordUsage({
        websiteId: 'site-1',
        mediaId: 'media-1',
        usageType: MediaUsageType.page_component,
        pageId: 'page-1',
        metadata: { updated: true }
      })

      expect(prisma.websiteMediaUsage.update).toHaveBeenCalledWith({
        where: { id: existing.id },
        data: expect.objectContaining({ metadata: { updated: true } })
      })
      expect(result).toEqual({ usage: updated, created: false })
    })
  })

  describe('listMediaForWebsite', () => {
    it('supports pagination cursor behaviour', async () => {
      const items = [
        { id: 'media-1' },
        { id: 'media-2' },
        { id: 'media-3' }
      ]
      ;(prisma.websiteMedia.findMany as jest.Mock).mockResolvedValue(items)

      const result = await repository.listMediaForWebsite('site-1', { limit: 2 })

      expect(prisma.websiteMedia.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { websiteId: 'site-1' },
        take: 3
      }))
      expect(result.items).toHaveLength(2)
      expect(result.nextCursor).toBe('media-3')
    })
  })
})
