/**
 * URL Transformer Utility
 *
 * Transforms absolute URLs from source site to relative paths or new target origin.
 * Used during import to ensure links point to the imported site, not the source.
 *
 * @module url-transformer
 */

/**
 * URL transformation mode.
 */
export type UrlTransformMode = 'relative' | 'absolute' | 'none'

/**
 * Context for URL transformation.
 */
export interface UrlTransformContext {
  /** Source origin to transform from (e.g., 'https://old-site.com') */
  sourceOrigin: string

  /** Target origin to transform to (only used in 'absolute' mode) */
  targetOrigin?: string

  /** Transformation mode */
  mode: UrlTransformMode

  /** Whether to preserve external links (links to different domains) */
  preserveExternal?: boolean
}

/**
 * Result of URL transformation.
 */
export interface UrlTransformResult {
  /** Transformed URL */
  url: string

  /** Whether the URL was transformed */
  transformed: boolean

  /** Reason if not transformed */
  reason?: 'external' | 'anchor' | 'special-protocol' | 'relative' | 'mode-none' | 'parse-error'
}

/**
 * Checks if a URL is processable (HTTP/HTTPS, not data URL).
 *
 * @param value - Value to check
 * @returns True if processable URL
 */
export function isProcessableUrl(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false
  }
  const trimmed = value.trim()
  if (!trimmed) {
    return false
  }
  // Data URLs should not be processed
  if (/^data:/i.test(trimmed)) {
    return false
  }
  // Only HTTP/HTTPS URLs are processable
  return /^https?:\/\//i.test(trimmed)
}

/**
 * Common image file extensions.
 */
const IMAGE_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.ico', '.bmp', '.tiff', '.tif', '.avif'
])

/**
 * Common image-related URL path segments that indicate an image even without extension.
 */
const IMAGE_PATH_PATTERNS = [
  /\/images?\//i,
  /\/img\//i,
  /\/assets?\//i,
  /\/media\//i,
  /\/uploads?\//i,
  /\/photos?\//i,
  /\/pictures?\//i,
  /\/thumbnails?\//i,
  /\/gallery\//i,
  /\/_next\/image/i,
  /\/cdn-cgi\/image/i,
]

const TRUSTED_EXTENSIONLESS_IMAGE_HOSTS: Array<string | RegExp> = [
  /^cdn\./i,
  /^assets\./i,
  /^assets[-.]/i,
  /^images\./i,
  /^media\./i,
  /^static\./i,
  /(^|\.)kc-usercontent\.com$/i,
  /(^|\.)cloudfront\.net$/i,
  /(^|\.)akamaihd\.net$/i,
  /(^|\.)storage\.googleapis\.com$/i,
  /(^|\.)cdn\.shopify\.com$/i,
]

function matchesHostPattern(hostname: string, pattern: string | RegExp): boolean {
  return typeof pattern === 'string' ? hostname === pattern.toLowerCase() : pattern.test(hostname)
}

function isTrustedExtensionlessImageHost(url: string): boolean {
  try {
    const parsed = new URL(url)
    const hostname = parsed.hostname.toLowerCase()
    return TRUSTED_EXTENSIONLESS_IMAGE_HOSTS.some(pattern => matchesHostPattern(hostname, pattern))
  } catch {
    return false
  }
}

/**
 * Checks if a URL looks like an image URL based on extension or path patterns.
 *
 * This helps distinguish actual image URLs from page URLs that might be
 * mistakenly used as image sources by LLM detection.
 *
 * @param url - URL to check
 * @returns True if the URL appears to be an image
 *
 * @example
 * isLikelyImageUrl('https://example.com/images/photo.jpg') // true
 * isLikelyImageUrl('https://example.com/SiteAssets/images/home/hero.png') // true
 * isLikelyImageUrl('https://example.com/info/') // false - page URL
 * isLikelyImageUrl('https://example.com/kidsinfo/') // false - page URL
 */
export function isLikelyImageUrl(url: unknown): boolean {
  if (typeof url !== 'string') {
    return false
  }

  const trimmed = url.trim().toLowerCase()
  if (!trimmed) {
    return false
  }

  // Remove query string and fragment for extension check
  const cleanUrl = trimmed.split(/[?#]/)[0]

  // Check for image extension
  for (const ext of IMAGE_EXTENSIONS) {
    if (cleanUrl.endsWith(ext)) {
      return true
    }
  }

  // Check for image-related path patterns
  for (const pattern of IMAGE_PATH_PATTERNS) {
    if (pattern.test(cleanUrl)) {
      return true
    }
  }

  if (isTrustedExtensionlessImageHost(trimmed)) {
    const pathname = cleanUrl.replace(/^https?:\/\/[^/]+/, '')
    const lastSegment = pathname.split('/').filter(Boolean).pop() || ''
    if (lastSegment && !cleanUrl.endsWith('/')) {
      return true
    }
  }

  // Check for data: URLs with image MIME types
  if (/^data:image\//i.test(trimmed)) {
    return true
  }

  return false
}

/**
 * Checks if a URL is definitely NOT an image (i.e., it's a page URL).
 *
 * Returns true for URLs that:
 * - End with a trailing slash (directory/page)
 * - Have no extension and no image-related path segments
 * - End with common page extensions (.html, .htm, .aspx, .php)
 *
 * @param url - URL to check
 * @returns True if the URL is definitely a page, not an image
 *
 * @example
 * isDefinitelyPageUrl('https://example.com/info/') // true - trailing slash
 * isDefinitelyPageUrl('https://example.com/page.html') // true - page extension
 * isDefinitelyPageUrl('https://example.com/images/photo.jpg') // false - image
 */
export function isDefinitelyPageUrl(url: unknown): boolean {
  if (typeof url !== 'string') {
    return false
  }

  const trimmed = url.trim().toLowerCase()
  if (!trimmed) {
    return false
  }

  // Remove query string and fragment
  const cleanUrl = trimmed.split(/[?#]/)[0]

  // Trailing slash is a strong indicator of a page/directory
  if (cleanUrl.endsWith('/')) {
    return true
  }

  // Common page extensions
  const pageExtensions = ['.html', '.htm', '.aspx', '.php', '.jsp', '.asp']
  for (const ext of pageExtensions) {
    if (cleanUrl.endsWith(ext)) {
      return true
    }
  }

  // Check if it's an image - if so, not a page
  if (isLikelyImageUrl(url)) {
    return false
  }

  // URLs without extension and without image patterns are likely pages
  // e.g., https://example.com/about or https://example.com/kidsinfo
  const pathname = cleanUrl.replace(/^https?:\/\/[^/]+/, '')
  const lastSegment = pathname.split('/').filter(Boolean).pop() || ''

  // If the last segment has no dot (no extension), it's likely a page
  if (!lastSegment.includes('.')) {
    return true
  }

  return false
}

/**
 * Special URL protocols that should not be transformed.
 */
const SPECIAL_PROTOCOLS = new Set([
  'mailto:',
  'tel:',
  'sms:',
  'javascript:',
  'data:',
  'blob:',
  'file:',
  'ftp:',
])

/**
 * Extracts origin (protocol + host) from a URL string.
 *
 * @param url - URL to extract origin from
 * @returns Origin string or null if invalid
 *
 * @example
 * extractOrigin('https://example.com/path') // 'https://example.com'
 * extractOrigin('/relative/path') // null
 */
export function extractOrigin(url: string | undefined): string | null {
  if (!url) {
    return null
  }

  try {
    const parsed = new URL(url)
    return parsed.origin
  } catch {
    return null
  }
}

/**
 * Checks if a URL is an anchor link (starts with #).
 *
 * @param url - URL to check
 * @returns True if anchor link
 */
export function isAnchorLink(url: string): boolean {
  return url.trim().startsWith('#')
}

/**
 * Checks if a URL uses a special protocol that shouldn't be transformed.
 *
 * @param url - URL to check
 * @returns True if special protocol
 */
export function isSpecialProtocol(url: string): boolean {
  const lower = url.trim().toLowerCase()
  return Array.from(SPECIAL_PROTOCOLS).some(protocol => lower.startsWith(protocol))
}

/**
 * Checks if a URL is a protocol-relative URL (starts with //).
 *
 * @param url - URL to check
 * @returns True if protocol-relative
 */
export function isProtocolRelative(url: string): boolean {
  return url.trim().startsWith('//')
}

/**
 * Checks if a URL is already a relative path.
 *
 * @param url - URL to check
 * @returns True if relative path
 */
export function isRelativePath(url: string): boolean {
  const trimmed = url.trim()
  if (!trimmed) {
    return false
  }

  // Starts with / but not // (protocol-relative)
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return true
  }

  // Relative paths like './path' or '../path' or 'path'
  if (!trimmed.includes('://') && !trimmed.startsWith('//')) {
    return true
  }

  return false
}

/**
 * Checks if a URL is from the same origin as the source.
 *
 * @param url - URL to check
 * @param sourceOrigin - Source origin to compare against
 * @returns True if same origin
 */
export function isSameOrigin(url: string, sourceOrigin: string): boolean {
  try {
    const urlOrigin = extractOrigin(url)
    if (!urlOrigin) {
      return false
    }

    // Normalize origins for comparison (remove trailing slashes, lowercase)
    const normalizedUrl = urlOrigin.toLowerCase().replace(/\/$/, '')
    const normalizedSource = sourceOrigin.toLowerCase().replace(/\/$/, '')

    return normalizedUrl === normalizedSource
  } catch {
    return false
  }
}

/**
 * Transforms a single URL based on the context.
 *
 * @param url - URL to transform
 * @param ctx - Transformation context
 * @returns Transformation result
 *
 * @example
 * transformUrl('https://old-site.com/about', {
 *   sourceOrigin: 'https://old-site.com',
 *   mode: 'relative'
 * })
 * // { url: '/about', transformed: true }
 *
 * transformUrl('https://external.com/page', {
 *   sourceOrigin: 'https://old-site.com',
 *   mode: 'relative',
 *   preserveExternal: true
 * })
 * // { url: 'https://external.com/page', transformed: false, reason: 'external' }
 */
export function transformUrl(url: string | undefined | null, ctx: UrlTransformContext): UrlTransformResult {
  // Handle null/undefined/empty
  if (!url || typeof url !== 'string') {
    return { url: url ?? '', transformed: false, reason: 'parse-error' }
  }

  const trimmed = url.trim()
  if (!trimmed) {
    return { url: '', transformed: false, reason: 'parse-error' }
  }

  // Mode 'none' - no transformation
  if (ctx.mode === 'none') {
    return { url: trimmed, transformed: false, reason: 'mode-none' }
  }

  // Anchor links - preserve as-is
  if (isAnchorLink(trimmed)) {
    return { url: trimmed, transformed: false, reason: 'anchor' }
  }

  // Special protocols (mailto:, tel:, etc.) - preserve as-is
  if (isSpecialProtocol(trimmed)) {
    return { url: trimmed, transformed: false, reason: 'special-protocol' }
  }

  // Already relative path - preserve as-is
  if (isRelativePath(trimmed)) {
    return { url: trimmed, transformed: false, reason: 'relative' }
  }

  // Protocol-relative URLs - check if same host
  if (isProtocolRelative(trimmed)) {
    try {
      const fullUrl = `https:${trimmed}`
      if (isSameOrigin(fullUrl, ctx.sourceOrigin)) {
        const parsed = new URL(fullUrl)
        const relativePath = parsed.pathname + parsed.search + parsed.hash
        return { url: relativePath || '/', transformed: true }
      }
    } catch {
      // Fall through to preserve as-is
    }
    return { url: trimmed, transformed: false, reason: 'external' }
  }

  // Check if URL is from source origin
  if (!isSameOrigin(trimmed, ctx.sourceOrigin)) {
    // External link - preserve if configured
    if (ctx.preserveExternal !== false) {
      return { url: trimmed, transformed: false, reason: 'external' }
    }
  }

  // Transform the URL
  try {
    const parsed = new URL(trimmed)
    const relativePath = parsed.pathname + parsed.search + parsed.hash

    if (ctx.mode === 'relative') {
      return { url: relativePath || '/', transformed: true }
    }

    if (ctx.mode === 'absolute' && ctx.targetOrigin) {
      const targetUrl = new URL(relativePath, ctx.targetOrigin)
      return { url: targetUrl.href, transformed: true }
    }

    // Fallback to relative
    return { url: relativePath || '/', transformed: true }
  } catch {
    // Parse error - preserve as-is
    return { url: trimmed, transformed: false, reason: 'parse-error' }
  }
}

/**
 * Transforms URLs embedded in HTML content.
 *
 * @param html - HTML string containing links
 * @param ctx - Transformation context
 * @returns Transformed HTML and count of transformations
 *
 * @example
 * transformHtmlUrls('<a href="https://old-site.com/about">About</a>', {
 *   sourceOrigin: 'https://old-site.com',
 *   mode: 'relative'
 * })
 * // { html: '<a href="/about">About</a>', transformedCount: 1 }
 */
export function transformHtmlUrls(
  html: string | undefined | null,
  ctx: UrlTransformContext
): { html: string; transformedCount: number } {
  if (!html || typeof html !== 'string') {
    return { html: html ?? '', transformedCount: 0 }
  }

  if (ctx.mode === 'none') {
    return { html, transformedCount: 0 }
  }

  let transformedCount = 0

  // Transform href attributes
  const transformedHtml = html.replace(
    /\b(href|src|action)=(["'])([^"']*)\2/gi,
    (match, attr, quote, url) => {
      const result = transformUrl(url, ctx)
      if (result.transformed) {
        transformedCount++
        return `${attr}=${quote}${result.url}${quote}`
      }
      return match
    }
  )

  return { html: transformedHtml, transformedCount }
}

/**
 * Recursively transforms all URL fields in an object.
 *
 * @param obj - Object to transform
 * @param ctx - Transformation context
 * @param stats - Optional stats object to track transformations
 * @returns Transformed object
 */
export function transformObjectUrls<T>(
  obj: T,
  ctx: UrlTransformContext,
  stats?: { transformed: number; total: number }
): T {
  if (ctx.mode === 'none') {
    return obj
  }

  if (obj === null || obj === undefined) {
    return obj
  }

  if (typeof obj === 'string') {
    return obj as T
  }

  if (Array.isArray(obj)) {
    return obj.map(item => transformObjectUrls(item, ctx, stats)) as T
  }

  if (typeof obj === 'object') {
    const record = obj as Record<string, unknown>

    // Skip transformation for media-ingested objects (they have mediaId and need absolute URLs)
    // These objects are created by media-ingest-service and their URLs must remain absolute
    // for normalizeImage to process them correctly
    if (typeof record.mediaId === 'string' && record.mediaId.length > 0) {
      return obj
    }

    const result: Record<string, unknown> = {}

    for (const [key, value] of Object.entries(record)) {
      const keyLower = key.toLowerCase()

      // URL-like fields that should be transformed
      if (isUrlField(keyLower) && typeof value === 'string') {
        const transformResult = transformUrl(value, ctx)
        result[key] = transformResult.url
        if (stats) {
          stats.total++
          if (transformResult.transformed) {
            stats.transformed++
          }
        }
      }
      // HTML content fields that may contain embedded URLs
      else if (isHtmlField(keyLower) && typeof value === 'string') {
        const htmlResult = transformHtmlUrls(value, ctx)
        result[key] = htmlResult.html
        if (stats) {
          stats.total += htmlResult.transformedCount
          stats.transformed += htmlResult.transformedCount
        }
      }
      // Recurse into nested objects/arrays
      else {
        result[key] = transformObjectUrls(value, ctx, stats)
      }
    }

    return result as T
  }

  return obj
}

/**
 * Checks if a field name is likely to contain a URL.
 */
function isUrlField(fieldName: string): boolean {
  const urlFields = new Set([
    'href',
    'url',
    'link',
    'src',
    'source',
    'originalurl',
    'imageurl',
    'videourl',
    'mediaurl',
    'backgroundimage',
    'logourl',
    'logohref',
    'brandurl',
    'permalink',
    'canonical',
    'action',
  ])

  return urlFields.has(fieldName)
}

/**
 * Checks if a field name is likely to contain HTML content.
 */
function isHtmlField(fieldName: string): boolean {
  const htmlFields = new Set([
    'bodyhtml',
    'html',
    'richtext',
    'content',
    'description',
    'body',
    'summary',
    'excerpt',
    'text',
    'bio',
    'consenthtml',
    'subheadinghtml',
    'subheadingrichtext',
  ])

  return htmlFields.has(fieldName)
}

/**
 * Transforms all URLs in an array of components.
 *
 * @param components - Array of detected components
 * @param sourceOrigin - Source origin to transform from
 * @param mode - Transformation mode
 * @returns Components with transformed URLs and stats
 */
export function transformComponentUrls(
  components: Array<{ content?: Record<string, unknown>; [key: string]: unknown }>,
  sourceOrigin: string,
  mode: UrlTransformMode = 'relative'
): { components: typeof components; stats: { transformed: number; total: number } } {
  if (mode === 'none' || !sourceOrigin) {
    return { components, stats: { transformed: 0, total: 0 } }
  }

  const ctx: UrlTransformContext = {
    sourceOrigin,
    mode,
    preserveExternal: true,
  }

  const stats = { transformed: 0, total: 0 }

  const transformedComponents = components.map(component => {
    if (!component.content) {
      return component
    }

    return {
      ...component,
      content: transformObjectUrls(component.content, ctx, stats),
    }
  })

  return { components: transformedComponents, stats }
}
