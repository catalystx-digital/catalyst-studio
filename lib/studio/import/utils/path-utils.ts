/**
 * Path Normalization Utilities
 *
 * Centralized path handling for import operations.
 * Consolidates duplicate implementations from:
 * - detection/response-parser.ts
 * - import-pipeline.ts
 * - services/page-builder/template-resolver.ts
 *
 * @module path-utils
 */

/**
 * Normalizes a URL to extract and clean the pathname.
 *
 * @param url - Full URL or pathname string
 * @returns Normalized pathname starting with '/'
 *
 * @example
 * normalizePath('https://example.com/blog/post?id=1') // '/blog/post'
 * normalizePath('/about//us/') // '/about/us'
 */
export function normalizePath(url: string | undefined): string {
  if (!url) {
    return '/'
  }

  try {
    const parsed = new URL(url)
    return normalizePathname(parsed.pathname)
  } catch {
    // Not a valid URL, treat as pathname
    return normalizePathname(url)
  }
}

/**
 * Normalizes a pathname by removing query strings, hash fragments,
 * duplicate slashes, and trailing slashes.
 *
 * @param pathname - Raw pathname string
 * @returns Normalized pathname
 *
 * @example
 * normalizePathname('/blog//post/?query=1#hash') // '/blog/post'
 * normalizePathname('about/us') // '/about/us'
 */
export function normalizePathname(pathname: string): string {
  if (!pathname) return '/'

  // Remove query strings and hash fragments
  let normalized = pathname.replace(/[?#].*$/, '')

  // Collapse duplicate slashes
  while (normalized.includes('//')) {
    normalized = normalized.replace('//', '/')
  }

  // Ensure leading slash
  if (!normalized.startsWith('/')) {
    normalized = `/${normalized}`
  }

  // Remove trailing slashes (but keep root '/')
  while (normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1)
  }

  return normalized || '/'
}

/**
 * Checks if a path represents the home/root page.
 *
 * @param path - Pathname to check
 * @returns True if path is home/root
 *
 * @example
 * isHomePath('/') // true
 * isHomePath('') // true
 * isHomePath('/about') // false
 */
export function isHomePath(path: string): boolean {
  const normalized = normalizePathname(path)
  return normalized === '/'
}

/**
 * Extracts the hostname from a URL.
 *
 * @param url - Full URL string
 * @returns Hostname or empty string if invalid
 *
 * @example
 * getHostname('https://www.example.com/path') // 'www.example.com'
 */
export function getHostname(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return ''
  }
}

/**
 * Extracts the origin (protocol + hostname + port) from a URL.
 *
 * @param url - Full URL string
 * @returns Origin or empty string if invalid
 *
 * @example
 * getOrigin('https://example.com:8080/path') // 'https://example.com:8080'
 */
export function getOrigin(url: string): string {
  try {
    return new URL(url).origin
  } catch {
    return ''
  }
}

/**
 * Joins URL segments safely, handling slashes correctly.
 *
 * @param base - Base URL or path
 * @param segments - Additional path segments to join
 * @returns Joined URL path
 *
 * @example
 * joinPath('/api', 'users', '123') // '/api/users/123'
 * joinPath('https://example.com/', '/api/', '/users') // 'https://example.com/api/users'
 */
export function joinPath(base: string, ...segments: string[]): string {
  const parts = [base, ...segments]
    .map(part => part.replace(/^\/+|\/+$/g, ''))
    .filter(Boolean)

  const hasProtocol = /^https?:\/\//.test(base)
  const prefix = hasProtocol ? '' : '/'

  return prefix + parts.join('/')
}

/**
 * Extracts the last segment of a path (the "slug").
 *
 * @param path - URL or pathname
 * @returns Last path segment or empty string
 *
 * @example
 * getPathSlug('/blog/my-article') // 'my-article'
 * getPathSlug('/') // ''
 */
export function getPathSlug(path: string): string {
  const normalized = normalizePath(path)
  const segments = normalized.split('/').filter(Boolean)
  return segments.length > 0 ? segments[segments.length - 1] : ''
}

/**
 * Converts a path slug to a human-readable title.
 *
 * @param slug - URL slug (e.g., 'my-blog-post')
 * @returns Title case string (e.g., 'My Blog Post')
 *
 * @example
 * slugToTitle('my-blog-post') // 'My Blog Post'
 * slugToTitle('about_us') // 'About Us'
 */
export function slugToTitle(slug: string): string {
  if (!slug) return ''

  return slug
    .replace(/[-_]+/g, ' ')
    .replace(/%20/g, ' ')
    .trim()
    .replace(/\b\w/g, char => char.toUpperCase())
}

/**
 * Derives a page title from a URL.
 *
 * @param url - Full URL or pathname
 * @returns Derived title or 'Home' for root paths
 *
 * @example
 * deriveTitleFromUrl('https://example.com/about-us') // 'About Us'
 * deriveTitleFromUrl('/') // 'Home'
 */
export function deriveTitleFromUrl(url: string): string {
  const path = normalizePath(url)

  if (isHomePath(path)) {
    return 'Home'
  }

  const slug = getPathSlug(path)
  return slugToTitle(slug) || 'Page'
}

/**
 * Checks if a path matches a pattern (supports prefix matching with trailing slash).
 *
 * @param path - Path to check
 * @param pattern - Pattern to match (trailing slash means prefix match)
 * @returns True if path matches pattern
 *
 * @example
 * matchPath('/blog/post', '/blog/') // true (prefix match)
 * matchPath('/blog', '/blog') // true (exact match)
 * matchPath('/about', '/blog/') // false
 */
export function matchPath(path: string, pattern: string): boolean {
  const normalizedPath = normalizePathname(path)
  const trimmedPattern = (pattern || '').trim()

  if (!trimmedPattern) return false

  const isPrefix = trimmedPattern.endsWith('/') && trimmedPattern !== '/'
  const normalizedPattern = normalizePathname(trimmedPattern)

  // Handle home path pattern
  if (normalizedPattern === '/' && isHomePath(normalizedPath)) {
    return true
  }

  if (isPrefix) {
    // Prefix match: pattern '/' matches any non-home path
    if (normalizedPattern === '/') {
      return !isHomePath(normalizedPath)
    }
    // Path must equal pattern or start with pattern/
    return normalizedPath === normalizedPattern || normalizedPath.startsWith(`${normalizedPattern}/`)
  }

  // Exact match
  return normalizedPath === normalizedPattern
}
