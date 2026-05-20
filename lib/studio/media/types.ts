import type { MediaStorageProvider, MediaUsageType, WebsiteMedia, WebsiteMediaSource, WebsiteMediaUsage } from '@/lib/generated/prisma'
import type { UniversalMediaAsset } from '@/lib/cms-export/universal/types'

export type MediaMetadata = Record<string, unknown>

export interface MediaAssetCreateInput {
  websiteId: string
  contentId?: string | null
  provider: MediaStorageProvider
  storageKey: string
  checksum: string
  contentType: string
  width?: number | null
  height?: number | null
  duration?: number | null
  metadata?: MediaMetadata | null
}

export interface MediaSourceLinkInput {
  websiteId: string
  mediaId: string
  originalUrl: string
  contentId?: string | null
  metadata?: MediaMetadata | null
}

export interface MediaUsageRecordInput {
  websiteId: string
  mediaId: string
  usageType: MediaUsageType
  contentId?: string | null
  pageId?: string | null
  componentInstanceId?: string | null
  metadata?: MediaMetadata | null
}

export interface ResolvedMediaSource {
  media: WebsiteMedia
  source: WebsiteMediaSource
}

export interface MediaUsageRecordResult {
  usage: WebsiteMediaUsage
  created: boolean
}

export interface MediaLibraryItem extends Pick<WebsiteMedia, 'id' | 'websiteId' | 'provider' | 'storageKey' | 'checksum' | 'contentType' | 'width' | 'height' | 'duration' | 'metadata' | 'createdAt' | 'updatedAt'> {
  mediaId: string
  signedUrl: string | null
  publicUrl: string | null
  originalUrl: string | null
  altText: string | null
}

export const mapToMediaLibraryItem = (
  media: WebsiteMedia,
  asset?: UniversalMediaAsset
): MediaLibraryItem => ({
  id: media.id,
  mediaId: media.id,
  websiteId: media.websiteId,
  provider: media.provider,
  storageKey: media.storageKey,
  checksum: media.checksum,
  contentType: media.contentType ?? null,
  width: media.width ?? null,
  height: media.height ?? null,
  duration: media.duration ?? null,
  metadata: media.metadata ?? null,
  createdAt: media.createdAt,
  updatedAt: media.updatedAt,
  signedUrl: asset?.signedUrl ?? null,
  publicUrl: asset?.publicUrl ?? null,
  originalUrl: asset?.originalUrl ?? null,
  altText: asset?.altText ?? null
})
