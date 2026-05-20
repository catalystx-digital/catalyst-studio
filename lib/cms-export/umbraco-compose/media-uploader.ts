/**
 * Umbraco Compose Media Uploader
 *
 * Handles media asset upload to Umbraco Compose.
 * Note: This is a skeleton implementation - full implementation in Task 7.
 *
 * Features (planned):
 * - Media asset upload
 * - Duplicate detection via checksum
 * - Reference update in content
 */

import type { UmbracoComposeClient } from './client';

export interface MediaAsset {
  id: string;
  src: string;
  alt?: string;
  filename?: string;
  contentType?: string;
  size?: number;
}

export interface MediaUploadResult {
  success: boolean;
  mediaId?: string;
  url?: string;
  error?: string;
}

export class UmbracoMediaUploader {
  private client: UmbracoComposeClient;
  private uploadedMedia: Map<string, string> = new Map();

  constructor(client: UmbracoComposeClient) {
    this.client = client;
  }

  /**
   * Upload a media asset
   * Note: Implementation pending Umbraco Compose media API research (Task 7)
   */
  async uploadMedia(_asset: MediaAsset): Promise<MediaUploadResult> {
    // TODO: Implement in Task 7 after researching Umbraco media API
    console.warn('[UmbracoMediaUploader] Media upload not yet implemented');
    return {
      success: false,
      error: 'Media upload not yet implemented',
    };
  }

  /**
   * Check if media has already been uploaded (by source URL)
   */
  isAlreadyUploaded(src: string): boolean {
    return this.uploadedMedia.has(src);
  }

  /**
   * Get uploaded media ID by source URL
   */
  getUploadedMediaId(src: string): string | undefined {
    return this.uploadedMedia.get(src);
  }

  /**
   * Upload multiple media assets
   */
  async uploadBatch(assets: MediaAsset[]): Promise<Map<string, MediaUploadResult>> {
    const results = new Map<string, MediaUploadResult>();

    for (const asset of assets) {
      // Skip if already uploaded
      if (this.isAlreadyUploaded(asset.src)) {
        results.set(asset.id, {
          success: true,
          mediaId: this.getUploadedMediaId(asset.src),
        });
        continue;
      }

      const result = await this.uploadMedia(asset);
      results.set(asset.id, result);

      if (result.success && result.mediaId) {
        this.uploadedMedia.set(asset.src, result.mediaId);
      }
    }

    return results;
  }

  /**
   * Extract media assets from content
   */
  extractMediaFromContent(content: unknown): MediaAsset[] {
    const assets: MediaAsset[] = [];
    this.findMediaInValue(content, assets);
    return assets;
  }

  /**
   * Recursively find media in content values
   */
  private findMediaInValue(value: unknown, assets: MediaAsset[]): void {
    if (!value) return;

    if (Array.isArray(value)) {
      for (const item of value) {
        this.findMediaInValue(item, assets);
      }
      return;
    }

    if (typeof value === 'object') {
      const obj = value as Record<string, unknown>;

      // Check if this is a media object
      if (obj.src && typeof obj.src === 'string') {
        assets.push({
          id: obj.id as string || `media-${assets.length}`,
          src: obj.src as string,
          alt: obj.alt as string,
          filename: obj.filename as string,
        });
        return;
      }

      // Recurse into object properties
      for (const prop of Object.values(obj)) {
        this.findMediaInValue(prop, assets);
      }
    }
  }

  /**
   * Clear upload cache
   */
  clearCache(): void {
    this.uploadedMedia.clear();
  }
}
