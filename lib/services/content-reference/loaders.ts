import { createPagePathLoader, PagePathLoader } from './page-path-loader';
import { createMediaUrlLoader, MediaUrlLoader } from './media-url-loader';

export interface ContentLoaders {
  pagePath: PagePathLoader;
  mediaUrl: MediaUrlLoader;
}

/**
 * Create all loaders for a request context
 * Call this ONCE per request - loaders cache within a single request
 *
 * @example
 * ```typescript
 * // In API route handler
 * const loaders = createContentLoaders();
 *
 * // Use throughout request
 * const pageInfo = await loaders.pagePath.load(pageId);
 * const mediaInfo = await loaders.mediaUrl.load(mediaId);
 * ```
 */
export function createContentLoaders(): ContentLoaders {
  return {
    pagePath: createPagePathLoader(),
    mediaUrl: createMediaUrlLoader()
  };
}

// Re-export types for convenience
export type { PagePathLoader, PagePathInfo } from './page-path-loader';
export type { MediaUrlLoader, MediaUrlInfo } from './media-url-loader';
