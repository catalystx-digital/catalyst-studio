/**
 * Server-side Design System Cache Utilities
 *
 * Server-only caching utilities that use Next.js unstable_cache
 * These functions can only be used on the server side.
 *
 * @module DesignSystemCacheUtilsServer
 */

import { unstable_cache, revalidateTag } from 'next/cache'
import { DesignSystem } from '../import/types/design-system.types'
import { generateDesignSystemCSSVariables } from './generate-css-variables'

// Cache key patterns
const CACHE_KEYS = {
  DESIGN_SYSTEM: (websiteId: string, conceptId = 'default') =>
    `design-system:${websiteId}:${conceptId}`,
  CSS_VARIABLES: (websiteId: string, conceptId = 'default', version = 'latest') =>
    `css-variables:${websiteId}:${conceptId}:${version}`
}

// Cache durations in seconds
export const CACHE_DURATIONS = {
  DESIGN_SYSTEM: 3600, // 1 hour
  CSS_VARIABLES: 7200, // 2 hours
  STYLESHEET: 1800 // 30 minutes
}

// Cache tags for invalidation
export const CACHE_TAGS = {
  DESIGN_SYSTEM: (websiteId: string, conceptId = 'default') =>
    `design-system-${websiteId}-${conceptId}`,
  CSS_VARIABLES: (websiteId: string, conceptId = 'default') =>
    `css-variables-${websiteId}-${conceptId}`,
  TEMPLATE: (websiteId: string) => `design-system-template-${websiteId}`,
  DESIGN_SYSTEM_ALL: 'design-system-all'
}

/**
 * Create a cached design system fetcher function
 * Server-side only - uses Next.js unstable_cache
 */
export function createCachedDesignSystemFetcher() {
  return unstable_cache(
    async (websiteId: string) => {
      const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/website/${websiteId}/design-system`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        cache: 'no-store' // Don't use browser cache since we're caching manually
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch design system: ${response.statusText}`)
      }

      const result = await response.json()
      return result.data?.designSystem || null
    },
    ['design-system-fetch'],
    {
      revalidate: CACHE_DURATIONS.DESIGN_SYSTEM
      // Note: Tags can't be dynamic here, we'll use manual invalidation
    }
  )
}

/**
 * Create a cached CSS variables generator function
 * Server-side only - uses Next.js unstable_cache
 */
export function createCachedCSSVariablesGenerator() {
  return unstable_cache(
    async (designSystem: DesignSystem) => {
      return generateDesignSystemCSSVariables(
        designSystem,
        designSystem.aliases?.cssVariables ?? null
      )
    },
    ['css-variables-generator'],
    {
      revalidate: CACHE_DURATIONS.CSS_VARIABLES
    }
  )
}

/**
 * Invalidate design system cache for a website
 */
export function invalidateDesignSystemCache(websiteId: string, conceptId?: string) {
  try {
    revalidateTag(CACHE_TAGS.DESIGN_SYSTEM(websiteId, conceptId))
    revalidateTag(CACHE_TAGS.CSS_VARIABLES(websiteId, conceptId))
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('Skipping cache revalidation outside of request context', {
        websiteId,
        conceptId,
        error: error instanceof Error ? error.message : error
      })
    }
  }
}

/**
 * Add caching headers to a response
 */
export function addCachingHeaders(
  response: Response,
  websiteId: string,
  maxAge: number = CACHE_DURATIONS.DESIGN_SYSTEM,
  conceptId?: string
): Response {
  response.headers.set(
    'Cache-Control',
    `public, s-maxage=${maxAge}, stale-while-revalidate=${maxAge * 2}`
  )
  const suffix = conceptId ? `${websiteId}-${conceptId}` : websiteId
  response.headers.set('ETag', `"${suffix}-${Date.now()}"`)
  return response
}

/**
 * Server-side design system validation
 * Supports both new ShadcnDesignSystemTokens format and legacy DesignSystem format
 */
export function validateDesignSystem(designSystem: any): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!designSystem || typeof designSystem !== 'object') {
    errors.push('Design system must be an object')
    return { valid: false, errors }
  }

  // Check if it's the new ShadcnDesignSystemTokens format
  if ('variables' in designSystem && typeof designSystem.variables === 'object') {
    // New format validation
    if ('extraction' in designSystem && typeof designSystem.extraction === 'object') {
      // Valid new format
      return { valid: true, errors: [] }
    }
    // Has variables but no extraction - still accept it
    return { valid: true, errors: [] }
  }

  // Legacy format validation
  // Check required top-level properties
  if (!designSystem.palette || typeof designSystem.palette !== 'object') {
    errors.push('Palette is required and must be an object')
  }

  if (!designSystem.typography || typeof designSystem.typography !== 'object') {
    errors.push('Typography is required and must be an object')
  }

  if (!designSystem.metadata || typeof designSystem.metadata !== 'object') {
    errors.push('Metadata is required and must be an object')
  }

  if (!designSystem.version || typeof designSystem.version !== 'string') {
    errors.push('Version is required and must be a string')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}
