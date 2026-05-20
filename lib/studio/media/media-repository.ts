import { Prisma } from '@/lib/generated/prisma'
import type { PrismaClient, WebsiteMedia, WebsiteMediaSource, WebsiteMediaUsage } from '@/lib/generated/prisma'
import type {
  MediaAssetCreateInput,
  MediaSourceLinkInput,
  MediaUsageRecordInput,
  MediaUsageRecordResult,
  MediaMetadata,
  ResolvedMediaSource
} from './types'

const toJsonInput = (metadata?: MediaMetadata | null) => {
  if (metadata === undefined) {
    return undefined
  }
  if (metadata === null) {
    return Prisma.JsonNull
  }
  return metadata as Prisma.InputJsonValue
}

export class MediaRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createMediaAsset(input: MediaAssetCreateInput): Promise<WebsiteMedia> {
    return this.prisma.websiteMedia.create({
      data: {
        websiteId: input.websiteId,
        contentId: input.contentId ?? null,
        provider: input.provider,
        storageKey: input.storageKey,
        checksum: input.checksum,
        contentType: input.contentType,
        width: input.width ?? null,
        height: input.height ?? null,
        duration: input.duration ?? null,
        metadata: toJsonInput(input.metadata)
      }
    })
  }

  async getById(mediaId: string): Promise<WebsiteMedia | null> {
    return this.prisma.websiteMedia.findUnique({ where: { id: mediaId } })
  }

  async findByChecksum(websiteId: string, checksum: string): Promise<WebsiteMedia | null> {
    return this.prisma.websiteMedia.findFirst({
      where: { websiteId, checksum }
    })
  }

  async findByStorageKey(websiteId: string, storageKey: string): Promise<WebsiteMedia | null> {
    return this.prisma.websiteMedia.findFirst({
      where: { websiteId, storageKey }
    })
  }

  async listMediaByIds(
    websiteId: string,
    mediaIds: string[]
  ): Promise<(WebsiteMedia & { sources: WebsiteMediaSource[] })[]> {
    if (mediaIds.length === 0) {
      return []
    }
    return this.prisma.websiteMedia.findMany({
      where: {
        websiteId,
        id: { in: mediaIds }
      },
      include: { sources: true }
    })
  }

  async resolveByOriginalUrl(websiteId: string, originalUrl: string): Promise<ResolvedMediaSource | null> {
    const source = await this.prisma.websiteMediaSource.findUnique({
      where: {
        websiteId_originalUrl: {
          websiteId,
          originalUrl
        }
      },
      include: { media: true }
    })

    if (!source?.media) {
      return null
    }

    return { media: source.media, source }
  }

  async listMediaForWebsite(
    websiteId: string,
    opts?: { search?: string; contentType?: string; limit?: number; cursor?: string }
  ): Promise<{ items: WebsiteMedia[]; nextCursor?: string }> {
    const take = Math.min(opts?.limit ?? 25, 100)
    const where: Prisma.WebsiteMediaWhereInput = { websiteId }

    if (opts?.contentType) {
      where.contentType = opts.contentType
    }

    const searchTerm = opts?.search?.trim()
    if (searchTerm) {
      where.OR = [
        { storageKey: { contains: searchTerm, mode: 'insensitive' } },
        { checksum: { contains: searchTerm, mode: 'insensitive' } }
      ]
    }

    const query: Prisma.WebsiteMediaFindManyArgs = {
      where,
      orderBy: { createdAt: 'desc' },
      take: take + 1
    }

    if (opts?.cursor) {
      query.cursor = { id: opts.cursor }
      query.skip = 1
    }

    const items = await this.prisma.websiteMedia.findMany(query)

    if (items.length > take) {
      const nextCursor = items[items.length - 1].id
      return { items: items.slice(0, take), nextCursor }
    }

    return { items }
  }

  async upsertSourceLink(input: MediaSourceLinkInput): Promise<WebsiteMediaSource> {
    return this.prisma.websiteMediaSource.upsert({
      where: {
        websiteId_originalUrl: {
          websiteId: input.websiteId,
          originalUrl: input.originalUrl
        }
      },
      create: {
        websiteId: input.websiteId,
        mediaId: input.mediaId,
        originalUrl: input.originalUrl,
        contentId: input.contentId ?? null,
        metadata: toJsonInput(input.metadata)
      },
      update: {
        mediaId: input.mediaId,
        contentId: input.contentId ?? null,
        metadata: toJsonInput(input.metadata)
      }
    })
  }

  async recordUsage(input: MediaUsageRecordInput): Promise<MediaUsageRecordResult> {
    const existing = await this.prisma.websiteMediaUsage.findFirst({
      where: {
        websiteId: input.websiteId,
        mediaId: input.mediaId,
        usageType: input.usageType,
        pageId: input.pageId ?? null,
        componentInstanceId: input.componentInstanceId ?? null,
        contentId: input.contentId ?? null
      }
    })

    if (existing) {
      const usage = await this.prisma.websiteMediaUsage.update({
        where: { id: existing.id },
        data: {
          metadata: toJsonInput(input.metadata),
          pageId: input.pageId ?? null,
          componentInstanceId: input.componentInstanceId ?? null,
          contentId: input.contentId ?? null
        }
      })
      return { usage, created: false }
    }

    const usage = await this.prisma.websiteMediaUsage.create({
      data: {
        websiteId: input.websiteId,
        mediaId: input.mediaId,
        usageType: input.usageType,
        metadata: toJsonInput(input.metadata),
        pageId: input.pageId ?? null,
        componentInstanceId: input.componentInstanceId ?? null,
        contentId: input.contentId ?? null
      }
    })

    return { usage, created: true }
  }

  async removeUsageForComponent(websiteId: string, mediaId: string, componentInstanceId: string): Promise<number> {
    const result = await this.prisma.websiteMediaUsage.deleteMany({
      where: {
        websiteId,
        mediaId,
        componentInstanceId
      }
    })
    return result.count
  }

  async removeUsageForPage(websiteId: string, pageId: string): Promise<number> {
    const result = await this.prisma.websiteMediaUsage.deleteMany({
      where: {
        websiteId,
        pageId
      }
    })
    return result.count
  }

  async removeMediaAsset(websiteId: string, mediaId: string): Promise<void> {
    await this.prisma.websiteMedia.deleteMany({
      where: {
        id: mediaId,
        websiteId
      }
    })
  }
}
