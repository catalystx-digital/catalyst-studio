import { createMediaUrlLoader, type MediaUrlLoader } from '@/lib/services/content-reference/media-url-loader';
import { createPagePathLoader, type PagePathLoader } from '@/lib/services/content-reference/page-path-loader';

/**
 * Check if object is a media reference
 * Format: { mediaId: 'id', mediaType: 'image'|'video'|'file', ... }
 */
function isMediaReference(obj: Record<string, unknown>): boolean {
  return 'mediaId' in obj && typeof obj.mediaId === 'string';
}

/**
 * Check if object is a page reference (internal link)
 * Format: { type: 'internal', pageId: 'id', path: '/...' }
 */
function isPageReference(obj: Record<string, unknown>): boolean {
  return obj.type === 'internal' && 'pageId' in obj && typeof obj.pageId === 'string';
}

/**
 * Recursively resolve all content references in content tree
 * Uses DataLoader pattern to prevent N+1 queries
 *
 * Transforms:
 * - MediaReference: { mediaId: 'id', ... } → enriched with url, storageKey, etc.
 * - PageReference: { type: 'internal', pageId: 'id', ... } → enriched with path, title
 *
 * Missing references are handled gracefully (ref remains but url/path is null)
 */
export async function resolveContentReferences(
  content: unknown,
  loaders?: {
    mediaLoader?: MediaUrlLoader;
    pageLoader?: PagePathLoader;
  }
): Promise<void> {
  // Create loaders if not provided (for standalone use)
  const mediaLoader = loaders?.mediaLoader ?? createMediaUrlLoader();
  const pageLoader = loaders?.pageLoader ?? createPagePathLoader();

  await walkAndResolve(content, mediaLoader, pageLoader);
}

/**
 * Recursive walker that resolves references in-place
 */
async function walkAndResolve(
  value: unknown,
  mediaLoader: MediaUrlLoader,
  pageLoader: PagePathLoader,
  visited: WeakSet<object> = new WeakSet()
): Promise<void> {
  // Base cases
  if (value === null || value === undefined) {
    return;
  }
  if (typeof value !== 'object') {
    return;
  }

  // Prevent circular reference infinite loops
  if (visited.has(value as object)) {
    return;
  }
  visited.add(value as object);

  // Handle arrays
  if (Array.isArray(value)) {
    await Promise.all(
      value.map(item => walkAndResolve(item, mediaLoader, pageLoader, visited))
    );
    return;
  }

  // Handle objects
  const obj = value as Record<string, unknown>;

  // Check if this is a media reference: { mediaId, mediaType, ... }
  if (isMediaReference(obj)) {
    const mediaId = obj.mediaId as string;
    const mediaInfo = await mediaLoader.load(mediaId);
    // Enrich with resolved URL and metadata
    obj.url = mediaInfo.url;
    obj.storageKey = mediaInfo.storageKey;
    obj.contentType = mediaInfo.contentType;
    if (mediaInfo.metadata) {
      obj.metadata = mediaInfo.metadata;
    }
    // Don't recurse into resolved media refs (leaf nodes)
    return;
  }

  // Check if this is a page reference: { type: 'internal', pageId, path }
  if (isPageReference(obj)) {
    const pageId = obj.pageId as string;
    const pageInfo = await pageLoader.load(pageId);
    // Enrich with resolved path and title
    obj.path = pageInfo.path;
    obj.title = pageInfo.title;
    // Don't recurse into resolved page refs (leaf nodes)
    return;
  }

  // Recurse into all object properties
  await Promise.all(
    Object.values(obj).map(child =>
      walkAndResolve(child, mediaLoader, pageLoader, visited)
    )
  );
}

/**
 * Helper to batch-resolve all references in multiple content items
 * More efficient than calling resolveContentReferences individually
 */
export async function resolveContentReferencesInBatch(
  contentItems: Array<{ content?: unknown }>
): Promise<void> {
  // Create loaders once for entire batch (prevents N+1)
  const mediaLoader = createMediaUrlLoader();
  const pageLoader = createPagePathLoader();

  // Resolve all items in parallel
  await Promise.all(
    contentItems.map(item =>
      item.content ? resolveContentReferences(item.content, { mediaLoader, pageLoader }) : Promise.resolve()
    )
  );
}
