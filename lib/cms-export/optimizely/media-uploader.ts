/**
 * Optimizely Media Uploader Service
 *
 * Handles uploading media assets to Optimizely CMS as part of the export flow.
 * Uploads media blobs from local storage (FILE or S3) to Optimizely's media library.
 *
 * Key responsibilities:
 * 1. Read media assets for a website from local storage
 * 2. Upload to Optimizely media library
 * 3. Track mapping: localMediaId -> optimizelyAssetId
 * 4. Handle duplicates via checksum matching
 *
 * NOTE: This module is server-only due to Node.js stream dependencies.
 * It should only be imported in server-side code paths via dynamic import.
 */

import type { PrismaClient, WebsiteMedia } from '@/lib/generated/prisma'
import type { MediaStorageProvider } from '@/lib/studio/media/storage/media-storage-provider'
import { OptimizelyClient } from './client'
import type { MediaUploadResult, MediaUploadOptions } from './media-uploader.types'

// Re-export types from the types file
export type { MediaUploadResult, MediaUploadOptions } from './media-uploader.types'

/**
 * Tracks already-uploaded assets to prevent duplicates
 */
interface UploadedAssetCache {
  /** checksum -> optimizelyAssetId */
  byChecksum: Map<string, string>
}

/**
 * Service for uploading media assets to Optimizely CMS
 *
 * This service requires a MediaStorageProvider to be passed in.
 * Use getMediaStorageProvider() from the caller in server-side code.
 */
export class OptimizelyMediaUploader {
  private client: OptimizelyClient
  private storageProvider: MediaStorageProvider
  private prisma: PrismaClient

  constructor(params: {
    client: OptimizelyClient
    prisma: PrismaClient
    storageProvider: MediaStorageProvider
  }) {
    this.client = params.client
    this.prisma = params.prisma
    this.storageProvider = params.storageProvider
  }

  /**
   * Upload all media assets for a website to Optimizely
   *
   * @param websiteId - The website ID to upload media for
   * @param options - Upload options including container ID and progress callback
   * @returns MediaUploadResult with mapping and statistics
   */
  async uploadMediaAssets(
    websiteId: string,
    options?: MediaUploadOptions
  ): Promise<MediaUploadResult> {
    const result: MediaUploadResult = {
      mediaIdMapping: new Map(),
      uploadedCount: 0,
      skippedCount: 0,
      failedCount: 0,
      errors: []
    }

    // Cache to track already-uploaded assets by checksum
    const uploadedCache: UploadedAssetCache = {
      byChecksum: new Map()
    }

    // Fetch all media assets for the website
    const mediaAssets = await this.getWebsiteMedia(websiteId)

    if (mediaAssets.length === 0) {
      console.log('  [MediaUpload] No media assets to upload')
      return result
    }

    console.log(`\n📷 Uploading ${mediaAssets.length} media assets to Optimizely...`)

    for (let i = 0; i < mediaAssets.length; i++) {
      const media = mediaAssets[i]

      // Report progress
      options?.onProgress?.(i + 1, mediaAssets.length, `Uploading ${media.storageKey}`)

      try {
        // Check for duplicate by checksum
        const existingAssetId = uploadedCache.byChecksum.get(media.checksum)
        if (existingAssetId) {
          // Same asset already uploaded, reuse the ID
          result.mediaIdMapping.set(media.id, existingAssetId)
          result.skippedCount++
          console.log(`  [MediaUpload] Skipped duplicate: ${media.storageKey} (checksum match)`)
          continue
        }

        // Read media blob from storage
        const blob = await this.readMediaBlob(media)
        if (!blob) {
          result.errors.push({
            mediaId: media.id,
            error: `Failed to read blob from storage: ${media.storageKey}`
          })
          result.failedCount++
          continue
        }

        // Upload to Optimizely
        const optimizelyAssetId = await this.uploadToOptimizely(media, blob, options)

        if (optimizelyAssetId) {
          // Track the mapping
          result.mediaIdMapping.set(media.id, optimizelyAssetId)
          uploadedCache.byChecksum.set(media.checksum, optimizelyAssetId)
          result.uploadedCount++
          console.log(`  ✓ Uploaded: ${media.storageKey} -> ${optimizelyAssetId}`)
        } else {
          result.errors.push({
            mediaId: media.id,
            error: 'Upload returned no asset ID'
          })
          result.failedCount++
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        console.error(`  ✗ Failed to upload ${media.storageKey}:`, errorMsg)
        result.errors.push({
          mediaId: media.id,
          error: errorMsg
        })
        result.failedCount++
      }
    }

    console.log(`  [MediaUpload] Complete: ${result.uploadedCount} uploaded, ${result.skippedCount} skipped, ${result.failedCount} failed`)

    return result
  }

  /**
   * Fetch all WebsiteMedia records for a website
   */
  private async getWebsiteMedia(websiteId: string): Promise<WebsiteMedia[]> {
    return this.prisma.websiteMedia.findMany({
      where: { websiteId },
      orderBy: { createdAt: 'asc' }
    })
  }

  /**
   * Read media blob from storage (FILE or S3)
   */
  private async readMediaBlob(media: WebsiteMedia): Promise<Buffer | null> {
    try {
      const { stream } = await this.storageProvider.get({ key: media.storageKey })
      return await this.streamToBuffer(stream)
    } catch (error) {
      console.error(`  [MediaUpload] Failed to read blob: ${media.storageKey}`, error)
      return null
    }
  }

  /**
   * Convert a readable stream to a Buffer
   * Uses AsyncIterable to avoid node:stream import
   */
  private async streamToBuffer(stream: AsyncIterable<Uint8Array | Buffer>): Promise<Buffer> {
    const chunks: Buffer[] = []
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    }
    return Buffer.concat(chunks)
  }

  /**
   * Upload a media asset to Optimizely CMS
   *
   * Note: Optimizely SaaS CMS uses the Content API for media uploads.
   * Media is uploaded as a content item with binary data.
   */
  private async uploadToOptimizely(
    media: WebsiteMedia,
    blob: Buffer,
    options?: MediaUploadOptions
  ): Promise<string | null> {
    // Build the asset name from storage key (filename)
    const assetName = this.extractAssetName(media.storageKey)

    // Optimizely SaaS CMS media upload via Content API
    // Media assets are created as content items with the blob attached
    const request = {
      name: assetName,
      displayName: assetName,
      contentType: this.getOptimizelyMediaContentType(media.contentType),
      container: options?.mediaContainerId,
      locale: 'en',
      properties: {
        // Media metadata
        altText: this.extractAltText(media),
        mimeType: media.contentType,
        ...(media.width && { width: media.width }),
        ...(media.height && { height: media.height })
      },
      status: 'published'
    }

    try {
      // Use a specialized media upload endpoint or content API
      // For now, we'll use the content API with binary handling
      const response = await this.client.uploadMedia({
        name: assetName,
        contentType: media.contentType,
        blob,
        container: options?.mediaContainerId
      })

      return response?.key || response?.contentLink?.id?.toString() || null
    } catch (error) {
      // If uploadMedia is not implemented, log and return null
      console.error(`  [MediaUpload] API error for ${assetName}:`, error)
      return null
    }
  }

  /**
   * Extract a clean asset name from storage key
   * E.g., "websiteId/checksum.jpg" -> "checksum.jpg"
   */
  private extractAssetName(storageKey: string): string {
    const parts = storageKey.split('/')
    return parts[parts.length - 1] || storageKey
  }

  /**
   * Extract alt text from media metadata if available
   */
  private extractAltText(media: WebsiteMedia): string | undefined {
    const metadata = media.metadata as Record<string, unknown> | null
    if (metadata && typeof metadata.altText === 'string') {
      return metadata.altText
    }
    if (metadata && typeof metadata.filename === 'string') {
      return metadata.filename
    }
    return undefined
  }

  /**
   * Map MIME type to Optimizely media content type
   * Optimizely has built-in types for images, videos, etc.
   */
  private getOptimizelyMediaContentType(mimeType: string): string {
    if (mimeType.startsWith('image/')) {
      return 'ImageMedia'
    }
    if (mimeType.startsWith('video/')) {
      return 'VideoMedia'
    }
    if (mimeType.startsWith('audio/')) {
      return 'AudioMedia'
    }
    // Default to generic media
    return 'GenericMedia'
  }
}
