/**
 * External Link Helper
 *
 * Safely opens external links with security best practices.
 * Validates URLs and uses noopener/noreferrer to prevent security issues.
 *
 * Story 10.10: Contact & Forms Components
 */

import { validateUrl } from './security'

/**
 * Opens an external link with security best practices
 *
 * Features:
 * - URL validation (http/https only)
 * - Security attributes (noopener, noreferrer)
 * - Error handling for invalid URLs and blocked popups
 *
 * @param url - The URL to open (must be http/https or relative)
 * @param target - Where to open the link ('_blank' or '_self', default: '_blank')
 * @throws Error if URL is invalid or popup is blocked
 *
 * @example
 * ```typescript
 * // Open in new tab (default)
 * openExternalLink('https://example.com')
 *
 * // Open in same tab
 * openExternalLink('https://example.com', '_self')
 *
 * // Relative URLs are also supported
 * openExternalLink('/contact')
 * ```
 */
export function openExternalLink(
  url: string,
  target: '_blank' | '_self' = '_blank'
): void {
  // Validate input
  if (!url || typeof url !== 'string') {
    if (process.env.NODE_ENV === 'development') {
    console.error('openExternalLink: Invalid URL provided:', url)
    }
    throw new Error('Invalid URL: URL must be a non-empty string')
  }

  const trimmedUrl = url.trim()

  // Allow relative URLs (start with /)
  const isRelative = trimmedUrl.startsWith('/')

  // Validate absolute URLs
  if (!isRelative && !validateUrl(trimmedUrl)) {
    if (process.env.NODE_ENV === 'development') {
    console.error('openExternalLink: URL validation failed:', trimmedUrl)
    }
    throw new Error('Invalid URL: Must be a valid http/https URL or relative path')
  }

  // Open link with security attributes
  try {
    if (target === '_blank') {
      // For new tab, use window.open with security features
      const newWindow = window.open(trimmedUrl, '_blank', 'noopener,noreferrer')

      if (!newWindow) {
        if (process.env.NODE_ENV === 'development') {
        console.warn('openExternalLink: Popup blocked by browser')
        }
        throw new Error('Popup blocked: Please allow popups for this site')
      }

      // Additional security: prevent access to window.opener
      if (newWindow) {
        newWindow.opener = null
      }
    } else {
      // For same tab, use location.href (simpler, no popup issues)
      window.location.href = trimmedUrl
    }
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
    console.error('openExternalLink: Failed to open URL:', error)
    }
    throw error
  }
}

/**
 * Check if a URL is external (not relative or same-origin)
 *
 * @param url - The URL to check
 * @returns true if URL is external, false otherwise
 *
 * @example
 * ```typescript
 * isExternalUrl('https://example.com') // true
 * isExternalUrl('/contact') // false
 * isExternalUrl(window.location.origin + '/page') // false
 * ```
 */
export function isExternalUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false

  const trimmedUrl = url.trim()

  // Relative URLs are not external
  if (trimmedUrl.startsWith('/')) return false

  // Hash links are not external
  if (trimmedUrl.startsWith('#')) return false

  // Check if URL has different origin
  try {
    const urlObject = new URL(trimmedUrl, window.location.origin)
    return urlObject.origin !== window.location.origin
  } catch {
    // Invalid URL
    return false
  }
}

export default {
  openExternalLink,
  isExternalUrl,
}
