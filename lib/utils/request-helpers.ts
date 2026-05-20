/**
 * Utility functions for request processing
 */

/**
 * Checks if the request path looks like a static asset request.
 * These requests should be handled by Next.js static file serving rather than dynamic page rendering.
 *
 * Note: Next.js App Router catch-all routes ([...slug]) can intercept requests meant for /public/.
 * This function ensures we return notFound() early so Next.js falls through to static file serving.
 */
export function isAssetLikeRequest(slugSegments: string[]): boolean {
  if (slugSegments.length === 0) {
    return false;
  }
  const [first] = slugSegments;
  if (!first) {
    return false;
  }
  const lower = first.toLowerCase();

  // Known static asset prefixes/files
  if (
    lower === '_next' ||
    lower === 'favicon.ico' ||
    lower === 'favicon.png' ||
    lower === 'robots.txt' ||
    lower === 'sitemap.xml' ||
    lower === 'sitemap.txt' ||
    lower === 'static'
  ) {
    return true;
  }

  // Files with extensions that should be served from /public/
  // These are typically static assets, not CMS pages
  const staticExtensions = ['.tar.gz', '.gz', '.zip', '.pdf', '.json', '.xml', '.txt', '.ico', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.woff', '.woff2', '.ttf', '.eot'];
  const fullPath = slugSegments.join('/').toLowerCase();
  return staticExtensions.some(ext => fullPath.endsWith(ext));
}
