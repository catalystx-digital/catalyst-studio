/**
 * Server-only media URL resolution utilities.
 *
 * This file imports Node.js dependencies and MUST only be used in:
 * - API routes
 * - Server components
 * - Server actions
 * - Scripts
 *
 * DO NOT import this in client components or shared code that may be
 * bundled for the client.
 */

import { getMediaStorageProvider } from '@/lib/studio/media/storage/media-storage-factory';
import type { MediaStorageProvider as DbMediaStorageProvider } from '@prisma/client';
import { buildMediaApiUrl, type MediaUrlInfo } from './media-url-loader';

/**
 * Resolve a storage key to a full servable URL using the storage provider.
 *
 * @param storageKey - The storage key from WebsiteMedia
 * @param websiteId - The website ID for fallback API route URL
 * @param dbProvider - The provider type from database (FILE or S3), if known
 * @returns The servable URL
 *
 * Resolution strategy:
 * 1. Try to get public URL from storage provider (CDN or direct URL)
 * 2. Fall back to API route URL: /api/media/{websiteId}/{storageKey}
 */
export async function resolveMediaUrl(
  storageKey: string,
  websiteId: string,
  dbProvider?: DbMediaStorageProvider | null
): Promise<string> {
  const { provider } = getMediaStorageProvider();

  // Try to get public URL from the storage provider
  try {
    const publicUrl = await provider.getPublicUrl({ key: storageKey });
    if (publicUrl) {
      return publicUrl;
    }
  } catch (error) {
    // If getPublicUrl fails, fall back to API route
    console.warn('[resolveMediaUrl] Failed to get public URL, using fallback:', error);
  }

  // Fallback: Generate API route URL
  return buildMediaApiUrl(websiteId, storageKey);
}

/**
 * Resolve a MediaUrlInfo to a full servable URL.
 *
 * @param mediaInfo - The media info from the DataLoader
 * @returns The servable URL, or null if media info is incomplete
 */
export async function resolveMediaUrlFromInfo(
  mediaInfo: MediaUrlInfo
): Promise<string | null> {
  if (!mediaInfo.storageKey || !mediaInfo.websiteId) {
    return null;
  }

  return resolveMediaUrl(
    mediaInfo.storageKey,
    mediaInfo.websiteId,
    mediaInfo.provider
  );
}

/**
 * Batch resolve multiple storage keys to URLs.
 *
 * @param items - Array of { storageKey, websiteId, provider? }
 * @returns Map of storageKey to resolved URL
 */
export async function batchResolveMediaUrls(
  items: Array<{
    storageKey: string;
    websiteId: string;
    provider?: DbMediaStorageProvider | null;
  }>
): Promise<Map<string, string>> {
  const { provider } = getMediaStorageProvider();
  const results = new Map<string, string>();

  await Promise.all(
    items.map(async (item) => {
      try {
        const publicUrl = await provider.getPublicUrl({ key: item.storageKey });
        if (publicUrl) {
          results.set(item.storageKey, publicUrl);
          return;
        }
      } catch {
        // Fall through to API route
      }
      results.set(item.storageKey, buildMediaApiUrl(item.websiteId, item.storageKey));
    })
  );

  return results;
}
