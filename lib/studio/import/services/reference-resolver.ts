/**
 * Post-Import Reference Resolution Service
 *
 * After import completes, resolves all URL references to content references:
 * - Image URLs → MediaReference { mediaId, mediaType, url }
 * - Internal page links → PageReference { type: 'internal', pageId, path }
 * - External links → preserved as-is (or ExternalLink { type: 'external', url })
 *
 * Uses existing media-ingest to download external images if needed.
 *
 * NOTE: All reference formats match the ValueObjectRegistry schemas:
 * - MediaReference: { mediaId, mediaType: 'image'|'video'|'file', url? }
 * - PageReference: { type: 'internal', pageId, path }
 * - ExternalLink: { type: 'external', url }
 * See TKT-033 for the schema alignment work.
 */

import { prisma } from '@/lib/prisma';
import { MediaRepository } from '@/lib/studio/media/media-repository';
import { getMediaStorageProvider } from '@/lib/studio/media/storage/media-storage-factory';
import { MediaIngestService } from './media-ingest-service';

/**
 * Media reference format - matches MediaReferenceSchema from value-objects
 */
interface MediaReference {
  mediaId: string;
  mediaType: 'image' | 'video' | 'file';
  url?: string;
  alt?: string;
  title?: string;
  width?: number;
  height?: number;
}

/**
 * Internal page link - SmartLink format
 * Matches PageReferenceSchema from value-objects
 */
interface InternalLink {
  type: 'internal';
  pageId: string;
  path: string;
  label?: string;
}

/**
 * External link - SmartLink format
 * Matches ExternalLinkSchema from value-objects
 */
interface ExternalLink {
  type: 'external';
  url: string;
  label?: string;
  openInNewTab?: boolean;
}

type ResolvedReference = MediaReference | InternalLink | ExternalLink;

/**
 * Reason for reference resolution failure
 */
export type FailureReason = 'download_failed' | 'invalid_mime' | 'timeout' | 'not_found';

/**
 * Failed reference record for tracking
 */
interface FailedReferenceRecord {
  sourceType: 'page' | 'component';
  sourceId: string;
  sourcePath: string;
  originalUrl: string;
  reason: FailureReason;
}

/**
 * Context for tracking failures during resolution walk
 */
interface ResolutionContext {
  failures: FailedReferenceRecord[];
  currentSourceId: string;
  currentSourceType: 'page' | 'component';
  currentPath: string[];
}

/**
 * Infer failure reason from error
 */
function inferFailureReason(error: unknown): FailureReason {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (message.includes('timeout') || message.includes('timed out')) {
      return 'timeout';
    }
    if (message.includes('404') || message.includes('not found')) {
      return 'not_found';
    }
    if (message.includes('mime') || message.includes('content-type') || message.includes('invalid type')) {
      return 'invalid_mime';
    }
  }
  return 'download_failed';
}

/**
 * Resolves all imported references to content references
 * Called after page creation is complete
 */
export async function resolveImportedReferences(websiteId: string): Promise<{
  mediaReferencesResolved: number;
  pageReferencesResolved: number;
  externalLinksPreserved: number;
  failedReferences: number;
}> {
  let mediaReferencesResolved = 0;
  let pageReferencesResolved = 0;
  let externalLinksPreserved = 0;
  const allFailures: FailedReferenceRecord[] = [];

  // Get all pages in the website
  const pages = await prisma.websitePage.findMany({
    where: { websiteId },
    select: { id: true, content: true }
  });

  // Get website structure for URL mapping
  const structures = await prisma.websiteStructure.findMany({
    where: { websiteId },
    select: { websitePageId: true, fullPath: true }
  });
  const pageUrlMap = new Map(
    structures
      .filter(s => s.websitePageId)
      .map(s => [s.fullPath, s.websitePageId!])
  );

  // Initialize media ingest service for downloading external images
  const { backend, provider } = getMediaStorageProvider();
  const mediaRepository = new MediaRepository(prisma);
  const mediaIngestService = new MediaIngestService({
    repository: mediaRepository,
    storageProvider: provider,
    backend,
  });

  // Get website base URL from most recent import job for internal link detection
  // Note: Website model doesn't have baseUrl field - we derive it from ImportJob.url
  const latestImportJob = await prisma.importJob.findFirst({
    where: { websiteId },
    orderBy: { createdAt: 'desc' },
    select: { url: true }
  });

  // Extract base URL (origin) from the import job URL
  let baseUrl: string | null = null;
  if (latestImportJob?.url) {
    try {
      const url = new URL(latestImportJob.url);
      baseUrl = url.origin;
    } catch (error) {
      // This should not happen in normal operation - ImportJob.url should always be valid
      console.warn(`[ReferenceResolver] Invalid URL in ImportJob: ${latestImportJob.url}`, error);
    }
  } else {
    // No import job found - this can happen if reference resolution is called
    // outside the normal import flow (e.g., manual page creation)
    console.log(`[ReferenceResolver] No import job found for websiteId=${websiteId}, internal link detection disabled`);
  }

  // Process each page
  for (const page of pages) {
    if (!page.content) continue;

    let modified = false;
    const content = page.content as any;

    // Create resolution context for this page
    const context: ResolutionContext = {
      failures: [],
      currentSourceId: page.id,
      currentSourceType: 'page',
      currentPath: [],
    };

    // Walk and resolve references
    const stats = await walkAndResolveReferences(
      content,
      websiteId,
      baseUrl,
      pageUrlMap,
      mediaRepository,
      mediaIngestService,
      new WeakSet(),
      context
    );

    mediaReferencesResolved += stats.mediaReferences;
    pageReferencesResolved += stats.pageReferences;
    externalLinksPreserved += stats.externalLinks;
    allFailures.push(...context.failures);

    if (stats.mediaReferences > 0 || stats.pageReferences > 0) {
      modified = true;
    }

    // Update page if modified
    if (modified) {
      await prisma.websitePage.update({
        where: { id: page.id },
        data: { content }
      });
    }
  }

  // Persist failed references to database
  if (allFailures.length > 0) {
    await persistFailedReferences(websiteId, allFailures);
  }

  return {
    mediaReferencesResolved,
    pageReferencesResolved,
    externalLinksPreserved,
    failedReferences: allFailures.length
  };
}

/**
 * Persist failed references to database
 */
async function persistFailedReferences(
  websiteId: string,
  failures: FailedReferenceRecord[]
): Promise<void> {
  if (failures.length === 0) return;

  // Use upsert to handle duplicates and increment attempts
  for (const failure of failures) {
    try {
      await prisma.failedReference.upsert({
        where: {
          sourceId_sourcePath_originalUrl: {
            sourceId: failure.sourceId,
            sourcePath: failure.sourcePath,
            originalUrl: failure.originalUrl,
          },
        },
        create: {
          websiteId,
          sourceType: failure.sourceType,
          sourceId: failure.sourceId,
          sourcePath: failure.sourcePath,
          originalUrl: failure.originalUrl,
          reason: failure.reason,
          attempts: 1,
        },
        update: {
          reason: failure.reason,
          attempts: { increment: 1 },
          lastAttempt: new Date(),
        },
      });
    } catch (error) {
      console.warn(`[ReferenceResolver] Failed to persist failure record: ${failure.originalUrl}`, error);
    }
  }

  console.log(`[ReferenceResolver] Recorded ${failures.length} failed references for websiteId=${websiteId}`);
}

/**
 * Recursively walk content and resolve references in-place
 */
async function walkAndResolveReferences(
  value: unknown,
  websiteId: string,
  baseUrl: string | null | undefined,
  pageUrlMap: Map<string, string>,
  mediaRepository: MediaRepository,
  mediaIngestService: MediaIngestService,
  visited: WeakSet<object> = new WeakSet(),
  context?: ResolutionContext,
  currentKey?: string
): Promise<{ mediaReferences: number; pageReferences: number; externalLinks: number }> {
  let stats = { mediaReferences: 0, pageReferences: 0, externalLinks: 0 };

  // Base cases
  if (value === null || value === undefined) {
    return stats;
  }
  if (typeof value !== 'object') {
    return stats;
  }

  // Prevent circular references
  if (visited.has(value as object)) {
    return stats;
  }
  visited.add(value as object);

  // Handle arrays
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      // Track array index in path
      if (context) context.currentPath.push(String(i));
      const itemStats = await walkAndResolveReferences(
        value[i],
        websiteId,
        baseUrl,
        pageUrlMap,
        mediaRepository,
        mediaIngestService,
        visited,
        context
      );
      if (context) context.currentPath.pop();
      stats.mediaReferences += itemStats.mediaReferences;
      stats.pageReferences += itemStats.pageReferences;
      stats.externalLinks += itemStats.externalLinks;
    }
    return stats;
  }

  // Handle objects
  const obj = value as Record<string, unknown>;

  // Skip already resolved references

  // MediaReference format: { mediaId, mediaType, ... }
  if ('mediaId' in obj && typeof obj.mediaId === 'string') {
    return stats;
  }
  // SmartLink internal format: { type: 'internal', pageId, path }
  if (obj.type === 'internal' && obj.pageId) {
    return stats;
  }
  // SmartLink external format: { type: 'external', url }
  if (obj.type === 'external' && obj.url) {
    return stats;
  }

  // Check for image URLs that need conversion
  for (const [key, val] of Object.entries(obj)) {
    if (typeof val === 'string' && isImageUrl(key, val)) {
      // Try to resolve to existing media
      const existing = await mediaRepository.resolveByOriginalUrl(websiteId, val);
      if (existing) {
        // Convert to MediaReference (schema-aligned format)
        obj[key] = {
          mediaId: existing.media.id,
          mediaType: inferMediaType(val),
          url: val,  // Original URL for reference
        } satisfies MediaReference;
        stats.mediaReferences++;
      } else if (isExternalImageUrl(val, baseUrl)) {
        // Download external image via media ingest
        try {
          const result = await mediaIngestService.ingest({
            websiteId,
            detectionResults: [{
              pageUrl: '',
              components: [{ content: { [key]: val } }],
              pageMetadata: {}
            } as any],
            designTokens: null
          });

          if (result.mediaAssets.length > 0) {
            const asset = result.mediaAssets[0];
            obj[key] = {
              mediaId: asset.mediaId,
              mediaType: inferMediaType(val),
              url: val,  // Original URL for reference
            } satisfies MediaReference;
            stats.mediaReferences++;
          }
        } catch (error) {
          console.warn(`[ReferenceResolver] Failed to download external image: ${val}`, error);
          // Track the failure
          if (context) {
            const sourcePath = [...context.currentPath, key].join('.');
            context.failures.push({
              sourceType: context.currentSourceType,
              sourceId: context.currentSourceId,
              sourcePath,
              originalUrl: val,
              reason: inferFailureReason(error),
            });
          }
          // Keep original URL
        }
      }
    } else if (typeof val === 'string' && isLinkUrl(key, val)) {
      // Check if this is an internal page link
      let path: string | null = null;

      if (val.startsWith('/')) {
        // Relative path - use directly
        path = val;
      } else if (baseUrl && val.startsWith(baseUrl)) {
        // Absolute URL matching our base - extract path
        path = val.substring(baseUrl.length);
      }

      if (path) {
        // Normalize path: remove trailing slash for lookup (except for root)
        const normalizedPath = path === '/' ? path : path.replace(/\/$/, '');
        const pageId = pageUrlMap.get(normalizedPath) || pageUrlMap.get(path);

        if (pageId) {
          // Convert to SmartLink internal format (matches PageReferenceSchema)
          obj[key] = {
            type: 'internal',
            pageId,
            path: normalizedPath || '/',
          } satisfies InternalLink;
          stats.pageReferences++;
        } else {
          // Path not found in our pages - keep as string URL
          // Don't convert to SmartLink external since it's still an internal-looking path
          stats.externalLinks++;
        }
      } else {
        // Absolute URL to different domain - external
        stats.externalLinks++;
      }
    } else if (typeof val === 'object' && val !== null) {
      // Track key in path before recursing
      if (context) context.currentPath.push(key);
      // Recurse into nested objects
      const nestedStats = await walkAndResolveReferences(
        val,
        websiteId,
        baseUrl,
        pageUrlMap,
        mediaRepository,
        mediaIngestService,
        visited,
        context
      );
      if (context) context.currentPath.pop();
      stats.mediaReferences += nestedStats.mediaReferences;
      stats.pageReferences += nestedStats.pageReferences;
      stats.externalLinks += nestedStats.externalLinks;
    }
  }

  return stats;
}

/**
 * Common image file extensions
 */
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.avif', '.ico', '.bmp', '.tiff'];

/**
 * Known image CDN patterns - URLs matching these are always treated as images
 */
const IMAGE_CDN_PATTERNS = [
  'pixabay.com/get/',
  'pixabay.com/static/',
  'images.unsplash.com/',
  'unsplash.com/photos/',
  'images.pexels.com/',
  'cloudinary.com/',
  'imgix.net/',
  'imagekit.io/',
  'wp.com/',
  'githubusercontent.com/',
  'googleusercontent.com/',
  '/image',
];

/**
 * Check if a URL points to a media resource based on URL patterns alone
 * (extension or known CDN)
 */
export function isMediaUrl(value: unknown): boolean {
  if (typeof value !== 'string') {
    return false;
  }

  // Must be a valid URL format
  if (!value.startsWith('http://') && !value.startsWith('https://') && !value.startsWith('/')) {
    return false;
  }

  const lowerValue = value.toLowerCase();

  // Check image extensions (handle query strings by checking before ?)
  const urlPath = lowerValue.split('?')[0].split('#')[0];
  if (IMAGE_EXTENSIONS.some(ext => urlPath.endsWith(ext))) {
    return true;
  }

  // Check known image CDN patterns
  if (IMAGE_CDN_PATTERNS.some(pattern => lowerValue.includes(pattern))) {
    return true;
  }

  return false;
}

/**
 * Check if a field contains an image URL
 * Uses both field name hints AND URL pattern detection for comprehensive coverage
 */
function isImageUrl(key: string, value: string): boolean {
  const imageKeys = ['src', 'image', 'img', 'icon', 'logo', 'thumbnail', 'photo', 'picture', 'background', 'banner', 'media', 'asset', 'avatar', 'cover'];
  const lowerKey = key.toLowerCase();

  // Check if value is a valid URL
  if (!value.startsWith('http://') && !value.startsWith('https://') && !value.startsWith('/')) {
    return false;
  }

  // Strategy 1: Field name suggests image - apply relaxed URL check
  const fieldSuggestsImage = imageKeys.some(k => lowerKey.includes(k));
  if (fieldSuggestsImage) {
    // For image-related fields, accept any URL that looks like it could be an image
    const lowerValue = value.toLowerCase();
    return IMAGE_EXTENSIONS.some(ext => lowerValue.includes(ext)) ||
           IMAGE_CDN_PATTERNS.some(pattern => lowerValue.includes(pattern));
  }

  // Strategy 2: URL pattern strongly suggests image - accept regardless of field name
  // This catches images in arbitrary fields like 'data', 'content', 'url', etc.
  return isMediaUrl(value);
}

/**
 * Check if a field contains a link URL (absolute or relative)
 */
function isLinkUrl(key: string, value: string): boolean {
  const linkKeys = ['href', 'url', 'link'];
  const lowerKey = key.toLowerCase();

  // Check if key suggests link
  if (!linkKeys.some(k => lowerKey === k)) {
    return false;
  }

  // Check if value is a valid URL (absolute or relative path)
  return value.startsWith('http://') || value.startsWith('https://') || value.startsWith('/');
}

/**
 * Check if URL is an external image (not already ingested)
 */
function isExternalImageUrl(url: string, baseUrl: string | null | undefined): boolean {
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return false;
  }

  // External if it doesn't match base URL
  if (baseUrl && url.startsWith(baseUrl)) {
    return false;
  }

  return true;
}

/**
 * Infer media type from URL extension
 */
function inferMediaType(url: string): 'image' | 'video' | 'file' {
  // Extract extension, handling query strings and fragments
  const urlPath = url.split('?')[0].split('#')[0];
  const ext = urlPath.split('.').pop()?.toLowerCase() || '';

  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'ico', 'avif', 'bmp', 'tiff'].includes(ext)) {
    return 'image';
  }
  if (['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv', 'm4v'].includes(ext)) {
    return 'video';
  }
  return 'file';
}
