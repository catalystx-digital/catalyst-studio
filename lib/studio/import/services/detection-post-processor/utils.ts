/**
 * Detection Post-Processor Utilities
 *
 * Common utility functions for component detection post-processing.
 *
 * @module utils
 */

import type { DetectedComponent } from '@/lib/studio/import/detection/types'
import { normalizeString } from '../page-builder/component-helpers/string-utils'

// Re-export normalizeString for consumers of this module
export { normalizeString }

/**
 * Deep clones a detected component.
 *
 * @param component - Component to clone
 * @returns Cloned component
 */
export function cloneComponent(component: DetectedComponent): DetectedComponent {
  return {
    ...component,
    metadata: component.metadata ? { ...component.metadata } : undefined,
    content: cloneValue(component.content)
  }
}

/**
 * Deep clones a value, handling arrays and objects.
 *
 * @param value - Value to clone
 * @returns Cloned value
 */
export function cloneValue<T>(value: T): T {
  if (value == null) {
    return value
  }
  if (Array.isArray(value)) {
    return value.map(entry => cloneValue(entry)) as unknown as T
  }
  if (typeof value === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      result[key] = cloneValue(entry)
    }
    return result as T
  }
  return value
}

/**
 * Checks if a value is a plain object.
 *
 * @param value - Value to check
 * @returns True if plain object
 */
export function isPlainObject(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

/**
 * Escapes special regex characters in a string.
 *
 * @param value - String to escape
 * @returns Escaped string
 */
export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Normalizes an href value, handling nested objects.
 *
 * @param value - Value to normalize
 * @param pageUrl - Base page URL for resolution
 * @returns Normalized href or undefined
 */
export function normalizeHref(value: unknown, pageUrl?: string): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed || trimmed === '#' || trimmed.startsWith('javascript:')) {
      return undefined
    }
    return trimmed
  }
  if (isPlainObject(value)) {
    const candidates = [value.href, value.url, value.link, value.path]
    for (const candidate of candidates) {
      const result = normalizeHref(candidate, pageUrl)
      if (result) {
        return result
      }
    }
  }
  return undefined
}

/**
 * Derives a common path prefix from a list of hrefs.
 *
 * @param hrefs - List of hrefs
 * @param pageUrl - Base page URL
 * @returns Common prefix or undefined
 */
export function derivePathPrefix(hrefs: string[], pageUrl?: string): string | undefined {
  if (hrefs.length === 0) {
    return undefined
  }

  // Parse URLs and extract paths
  const paths: string[] = []
  for (const href of hrefs) {
    try {
      const url = new URL(href, pageUrl || 'https://example.com')
      const path = url.pathname
      if (path && path !== '/') {
        paths.push(path)
      }
    } catch {
      // If it's a relative path, use it directly
      if (href.startsWith('/')) {
        paths.push(href)
      }
    }
  }

  if (paths.length === 0) {
    return undefined
  }

  // Find common prefix
  const segments = paths.map(p => p.split('/').filter(Boolean))
  if (segments.length === 0) {
    return undefined
  }

  const commonSegments: string[] = []
  const firstSegments = segments[0]
  for (let i = 0; i < firstSegments.length; i++) {
    const segment = firstSegments[i]
    const allMatch = segments.every(s => s[i] === segment)
    if (allMatch) {
      commonSegments.push(segment)
    } else {
      break
    }
  }

  if (commonSegments.length === 0) {
    return undefined
  }

  return '/' + commonSegments.join('/') + '/'
}

/**
 * Resolves an asset URL relative to a page URL.
 *
 * @param value - Asset URL or path
 * @param pageUrl - Base page URL
 * @returns Resolved URL
 */
export function resolveAssetUrl(value: string, pageUrl?: string): string {
  if (!value) {
    return value
  }

  // Already absolute URL
  if (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('//')) {
    return value
  }

  // Data URL or blob
  if (value.startsWith('data:') || value.startsWith('blob:')) {
    return value
  }

  // Resolve relative to page URL
  if (pageUrl) {
    try {
      return new URL(value, pageUrl).href
    } catch {
      // Failed to resolve
    }
  }

  return value
}
