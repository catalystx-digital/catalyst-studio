/**
 * Is this image the site's own branding rather than content?
 *
 * Used to keep logos and wordmarks out of blog thumbnails and card images.
 * This predicate previously existed as three byte-identical copies, in
 * blog-index-consolidation-processor, image-enrichment-processor and
 * blog-normalizers. They are now one.
 *
 * Known limits, unchanged by the merge so the behaviour is identical:
 *  - `brandmark` and `wordmark` are unbounded substrings, so a file called
 *    `wordmark-awards-2025.jpg` matches.
 *  - `logo` only counts in a filename when the extension is `.svg`, so a
 *    raster site logo such as `header-logo.png` is NOT caught — which is the
 *    common WordPress case this was written for.
 *
 * @module import/utils/brand-assets
 */
export function isLikelyBrandAssetImage(src: string): boolean {
  const lowerSrc = src.toLowerCase()
  const pathname = (() => {
    try {
      return new URL(src, 'https://example.invalid').pathname.toLowerCase()
    } catch {
      return lowerSrc.split(/[?#]/, 1)[0] || lowerSrc
    }
  })()
  const filename = pathname.split('/').filter(Boolean).pop() || pathname
  const pathSegments = pathname.split('/').filter(Boolean)
  const directorySegments = pathSegments.slice(0, -1)
  const extension = filename.match(/\.[a-z0-9]+$/i)?.[0] ?? ''

  return (
    directorySegments.some(segment => segment === 'logos' || segment === 'logo' || /^logo[-_]\d/.test(segment)) ||
    filename.includes('brandmark') ||
    filename.includes('wordmark') ||
    (filename.includes('logo') && extension === '.svg')
  )
}
