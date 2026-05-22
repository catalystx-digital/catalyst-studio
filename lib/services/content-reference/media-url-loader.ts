import DataLoader from 'dataloader';
import { prisma } from '@/lib/prisma';
import type { MediaStorageProvider as DbMediaStorageProvider } from '@/lib/generated/prisma';

export interface MediaUrlInfo {
  mediaId: string;
  url: string | null;
  storageKey: string | null;
  contentType: string | null;
  metadata: Record<string, unknown> | null;
  /** Storage provider type for URL resolution (FILE or S3) */
  provider: DbMediaStorageProvider | null;
  /** Website ID for API route URL construction */
  websiteId: string | null;
}

/**
 * Construct a servable URL from media info.
 *
 * For FILE provider without configured publicBaseUrl:
 *   Returns API route URL: /api/media/{websiteId}/{storageKey}
 *
 * For S3 provider or FILE with publicBaseUrl:
 *   Call getMediaStorageProvider().provider.getPublicUrl() in server-only code.
 *
 * This function is safe for client bundles - no Node.js dependencies.
 * For full URL resolution with storage provider, use resolveMediaUrl() from
 * lib/services/content-reference/media-url-resolver.ts (server-only).
 */
export function buildMediaApiUrl(websiteId: string, storageKey: string): string {
  const encodedKey = storageKey.split('/').map(encodeURIComponent).join('/');
  return `/api/media/${encodeURIComponent(websiteId)}/${encodedKey}`;
}

/**
 * Create a DataLoader for batched media URL resolution
 * Create ONE instance per request
 *
 * Prevents N+1 queries when resolving multiple media references.
 * Returns media info including provider type for URL resolution.
 *
 * For full URL resolution, use the server-only resolveMediaUrl() helper
 * or call getMediaStorageProvider().provider.getPublicUrl() in server code.
 */
export function createMediaUrlLoader() {
  return new DataLoader<string, MediaUrlInfo>(
    async (mediaIds: readonly string[]) => {
      const media = await prisma.websiteMedia.findMany({
        where: { id: { in: [...mediaIds] } },
        select: {
          id: true,
          websiteId: true,
          storageKey: true,
          contentType: true,
          metadata: true,
          provider: true
        }
      });

      // Build lookup map
      const urlMap = new Map<string, MediaUrlInfo>();
      for (const m of media) {
        // Use API route URL as default - this is safe for all providers
        // Server-side code can use the storage provider for CDN URLs
        const url = buildMediaApiUrl(m.websiteId, m.storageKey);
        urlMap.set(m.id, {
          mediaId: m.id,
          url,
          storageKey: m.storageKey,
          contentType: m.contentType,
          metadata: m.metadata as Record<string, unknown> | null,
          provider: m.provider,
          websiteId: m.websiteId
        });
      }

      return mediaIds.map(id => urlMap.get(id) ?? {
        mediaId: id,
        url: null,
        storageKey: null,
        contentType: null,
        metadata: null,
        provider: null,
        websiteId: null
      });
    },
    { maxBatchSize: 50 }
  );
}

export type MediaUrlLoader = ReturnType<typeof createMediaUrlLoader>;
