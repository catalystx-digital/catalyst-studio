import type { UniversalMediaAsset, UniversalMediaService as UniversalMediaServiceContract } from '@/lib/cms-export/universal/types'
import { prisma } from '@/lib/prisma'
import { registerUniversalMediaServiceLoader } from '@/lib/services/export/helpers/media-service-loader'
import { monitoring } from '@/lib/monitoring'
import { MediaRepository } from './media-repository'
import type { MediaRenditionMetadata } from './rendition-resolver'
import { getMediaStorageProvider } from './storage/media-storage-factory'
import type { MediaStorageProvider } from './storage/media-storage-provider'

interface AssetContext {
  altTextByMediaId?: Map<string, string | null | undefined>
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

export class UniversalMediaService implements UniversalMediaServiceContract {
  private readonly repository: MediaRepository
  private readonly storageProvider: MediaStorageProvider
  private readonly providerEnum: string

  constructor(params?: { repository?: MediaRepository; storageProvider?: MediaStorageProvider; providerEnum?: string }) {
    this.repository = params?.repository ?? new MediaRepository(prisma)
    const factoryResult = getMediaStorageProvider()
    this.storageProvider = params?.storageProvider ?? factoryResult.provider
    this.providerEnum = params?.providerEnum ?? factoryResult.backend
  }

  async getAssetsForWebsiteByIds(
    websiteId: string,
    mediaIds: Set<string>,
    context?: AssetContext
  ): Promise<Map<string, UniversalMediaAsset>> {
    if (mediaIds.size === 0) {
      return new Map()
    }

    const rows = await this.repository.listMediaByIds(websiteId, Array.from(mediaIds))
    const results = new Map<string, UniversalMediaAsset>()

    for (const media of rows) {
      let signedUrl: string | null = null
      let publicUrl: string | null = null

      try {
        signedUrl = await this.storageProvider.getSignedUrl({ key: media.storageKey })
      } catch (error) {
        monitoring.logError('media.universal.signed_url', error as Error, {
          mediaId: media.id,
          websiteId
        })
      }

      try {
        publicUrl = await this.storageProvider.getPublicUrl({ key: media.storageKey })
      } catch (error) {
        monitoring.logError('media.universal.public_url', error as Error, {
          mediaId: media.id,
          websiteId
        })
      }

      const metadata = isRecord(media.metadata) ? media.metadata : undefined
      const renditionMetadata = Array.isArray(metadata?.renditions) ? metadata?.renditions : []
      const renditionAssets = await this.buildRenditionSources(renditionMetadata)
      const source = media.sources?.[0]
      const sourceMetadata = source && isRecord(source.metadata) ? source.metadata : undefined

      const contextAlt = context?.altTextByMediaId?.get(media.id)
      const metadataAlt = typeof metadata?.altText === 'string' ? metadata.altText : undefined
      const sourceAlt = typeof sourceMetadata?.altText === 'string' ? sourceMetadata.altText : undefined
      const altText = contextAlt || metadataAlt || sourceAlt || null

      const providerHints: Record<string, unknown> = {
        provider: media.provider,
        storageKey: media.storageKey,
        checksum: media.checksum
      }

      if (media.sources?.length) {
        providerHints.sources = media.sources.map(src => ({
          id: src.id,
          originalUrl: src.originalUrl,
          contentId: src.contentId,
          metadata: src.metadata
        }))
      }

      results.set(media.id, {
        id: media.id,
        contentId: media.contentId ?? null,
        mimeType: media.contentType ?? undefined,
        width: media.width ?? null,
        height: media.height ?? null,
        duration: media.duration ?? null,
        altText,
        originalUrl: source?.originalUrl ?? null,
        signedUrl,
        publicUrl,
        providerHints,
        metadata,
        renditions: renditionAssets.length > 0 ? renditionAssets : undefined
      })
    }

    return results
  }

  private async buildRenditionSources(entries: unknown): Promise<NonNullable<UniversalMediaAsset['renditions']>> {
    if (!Array.isArray(entries)) {
      return []
    }

    const renditions: NonNullable<UniversalMediaAsset['renditions']> = []
    for (const entry of entries) {
      if (!isRecord(entry)) {
        continue
      }
      const storageKey = typeof entry.storageKey === 'string' ? entry.storageKey : null
      if (!storageKey) {
        continue
      }
      let publicUrl: string | null = null
      let signedUrl: string | null = null
      try {
        publicUrl = await this.storageProvider.getPublicUrl({ key: storageKey })
      } catch (error) {
        monitoring.logError('media.universal.rendition_public_url', error as Error, {
          storageKey,
          mediaStorageProvider: this.providerEnum
        })
      }
      try {
        signedUrl = await this.storageProvider.getSignedUrl({ key: storageKey })
      } catch (error) {
        monitoring.logError('media.universal.rendition_signed_url', error as Error, {
          storageKey,
          mediaStorageProvider: this.providerEnum
        })
      }
      renditions.push({
        storageKey,
        width: typeof entry.width === 'number' ? entry.width : null,
        height: typeof entry.height === 'number' ? entry.height : null,
        publicUrl,
        signedUrl
      })
    }

    return renditions
  }
}

registerUniversalMediaServiceLoader(async () => new UniversalMediaService());
