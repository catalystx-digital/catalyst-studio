/**
 * URL Hashing Utility
 *
 * Provides consistent URL hashing for checkpoint file naming.
 * Uses MD5 to produce filesystem-safe filenames from URLs.
 *
 * @module url-hash
 */

import { createHash } from 'crypto'

/**
 * Normalize a URL for consistent hashing.
 *
 * - Removes trailing slashes (except for root)
 * - Removes fragment identifiers (#section)
 * - Preserves query parameters
 * - Preserves case for paths
 *
 * @param url - The URL to normalize
 * @returns Normalized URL string
 */
export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url)

    // Remove fragment
    parsed.hash = ''

    // Get the full URL without fragment
    let normalized = parsed.toString()

    // Remove trailing slash (except for root path)
    if (normalized.endsWith('/') && parsed.pathname !== '/') {
      normalized = normalized.slice(0, -1)
    }

    return normalized
  } catch {
    // If URL parsing fails, just return the original
    return url
  }
}

/**
 * Hash a URL to produce a filesystem-safe filename.
 *
 * Uses MD5 to produce a 16-character hex string that is:
 * - Consistent: Same URL always produces same hash
 * - Collision-resistant: Different URLs extremely unlikely to collide
 * - Filesystem-safe: Only contains [a-f0-9]
 * - Compact: 16 chars fits well in file paths
 *
 * @param url - The URL to hash
 * @returns 16-character hex string
 *
 * @example
 * ```ts
 * hashUrl('https://example.com/about')  // 'a1b2c3d4e5f6a7b8'
 * hashUrl('https://example.com/about/') // Same hash (trailing slash normalized)
 * hashUrl('https://example.com/about#section') // Same hash (fragment ignored)
 * ```
 */
export function hashUrl(url: string): string {
  const normalized = normalizeUrl(url)
  const hash = createHash('md5').update(normalized, 'utf8').digest('hex')
  // Take first 16 characters for reasonable uniqueness
  return hash.slice(0, 16)
}

/**
 * Create a URL-to-hash mapping for a list of URLs.
 *
 * @param urls - Array of URLs
 * @returns Map of URL to hash
 */
export function createUrlHashMap(urls: string[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const url of urls) {
    map.set(url, hashUrl(url))
  }
  return map
}

/**
 * Verify a URL matches its expected hash.
 *
 * Useful for validating checkpoint file integrity.
 *
 * @param url - The URL to verify
 * @param expectedHash - The expected hash
 * @returns true if hash matches
 */
export function verifyUrlHash(url: string, expectedHash: string): boolean {
  return hashUrl(url) === expectedHash
}
