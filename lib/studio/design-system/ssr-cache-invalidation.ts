/**
 * SSR Cache Invalidation for Design Systems
 *
 * Provides utilities for managing SSR cache invalidation
 * when design systems are updated.
 *
 * @module SSRCacheInvalidation
 */

import { revalidateTag, revalidatePath } from 'next/cache'
import { CACHE_TAGS } from './cache-utils.server'

/**
 * Invalidate all caches related to a specific website's design system
 */
export function invalidateWebsiteDesignSystemCache(websiteId: string, conceptId?: string): void {
  try {
    // Invalidate design system cache
    revalidateTag(CACHE_TAGS.DESIGN_SYSTEM(websiteId, conceptId))

    // Invalidate template cache
    revalidateTag(CACHE_TAGS.TEMPLATE(websiteId))

    // Invalidate CSS variables cache
    revalidateTag(CACHE_TAGS.CSS_VARIABLES(websiteId, conceptId))

    // Revalidate specific paths that might use the design system
    revalidatePath(`/`)
    revalidatePath(`/studio/site-builder`)
    revalidatePath(`/studio/site-builder?websiteId=${websiteId}`)

    // Revalidate API routes
    revalidatePath(`/api/website/${websiteId}/design-system`)
    revalidatePath(`/api/website/${websiteId}`)
  } catch (error) {
    // Silently ignore cache invalidation errors when running outside Next.js context (e.g., CLI scripts)
    // This is expected when running import scripts via `npx tsx`
    if (process.env.NODE_ENV !== 'production') {
      console.debug('[SSR Cache] Skipping cache invalidation (not in Next.js context)');
    }
  }
}

/**
 * Invalidate all design system caches (for emergency use)
 */
export function invalidateAllDesignSystemCaches(): void {
  try {
    revalidateTag(CACHE_TAGS.DESIGN_SYSTEM_ALL)

    // Revalidate all site builder paths
    revalidatePath('/studio/site-builder')
    revalidatePath('/api/website')
  } catch (error) {
    // Silently ignore cache invalidation errors when running outside Next.js context
  }
}

/**
 * Create a cache invalidation hook for design system updates
 */
export function createDesignSystemCacheHook(websiteId: string, conceptId?: string) {
  return {
    /**
     * Call this after updating a design system
     */
    onUpdate: () => {
      invalidateWebsiteDesignSystemCache(websiteId, conceptId)
    },

    /**
     * Call this after deleting a design system
     */
    onDelete: () => {
      invalidateWebsiteDesignSystemCache(websiteId, conceptId)
    },

    /**
     * Call this after importing a new design system
     */
    onImport: () => {
      invalidateWebsiteDesignSystemCache(websiteId, conceptId)
    }
  }
}

/**
 * Server-side function to invalidate design system cache
 * Used in API routes and server actions
 */
export async function invalidateDesignSystemCacheServer(websiteId: string, conceptId?: string): Promise<void> {
  // This function should be called from server-side code
  invalidateWebsiteDesignSystemCache(websiteId, conceptId)
}

/**
 * Cache invalidation for design system imports
 */
export function invalidateImportRelatedCaches(websiteId: string, importJobId?: string, conceptId?: string): void {
  // Invalidate design system cache (this already has try-catch)
  invalidateWebsiteDesignSystemCache(websiteId, conceptId)

  try {
    // Invalidate import job related caches if provided
    if (importJobId) {
      revalidateTag(`import-job:${importJobId}`)
      revalidateTag(`import-job:${importJobId}:results`)
    }

    // Invalidate website-wide caches
    revalidateTag(`website:${websiteId}:pages`)
    revalidateTag(`website:${websiteId}:components`)
    revalidateTag(`website:${websiteId}:structure`)
  } catch (error) {
    // Silently ignore cache invalidation errors when running outside Next.js context
  }
}

/**
 * Get cache tags for design system operations
 */
export function getDesignSystemCacheTags(websiteId: string, conceptId?: string): {
  designSystem: string
  templates: string
  cssVariables: string
  website: string
} {
  return {
    designSystem: CACHE_TAGS.DESIGN_SYSTEM(websiteId, conceptId),
    templates: CACHE_TAGS.TEMPLATE(websiteId),
    cssVariables: CACHE_TAGS.CSS_VARIABLES(websiteId, conceptId),
    website: `website:${websiteId}`
  }
}

/**
 * Validate cache key format
 */
export function validateCacheKey(key: string): boolean {
  // Basic validation for cache keys
  if (!key || typeof key !== 'string') return false

  // Check for valid characters (alphanumeric, hyphens, colons, underscores)
  return /^[a-zA-Z0-9:_-]+$/.test(key)
}

/**
 * Generate a unique cache key for design system operations
 */
export function generateDesignSystemCacheKey(
  operation: string,
  websiteId: string,
  additionalParams: Record<string, any> = {}
): string {
  const timestamp = Date.now()
  const params = Object.entries(additionalParams)
    .filter(([_, value]) => value !== undefined && value !== null)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('&')

  const key = `design-system:${operation}:${websiteId}:${timestamp}`

  return params ? `${key}:${params}` : key
}

/**
 * Cache warming utility for design systems
 */
export async function warmDesignSystemCache(websiteId: string, conceptId?: string): Promise<void> {
  try {
    // Warm design system data
    const conceptQuery = conceptId ? `?conceptId=${conceptId}` : ''
    await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/website/${websiteId}/design-system${conceptQuery}`, {
      method: 'GET',
      headers: {
        'Cache-Control': 'no-cache',
        'X-Cache-Warm': 'true'
      }
    })

    // Warm related pages that use the design system
    await Promise.all([
      fetch(`${process.env.NEXT_PUBLIC_APP_URL}/studio/deployment?websiteId=${websiteId}`),
      fetch(`${process.env.NEXT_PUBLIC_APP_URL}/studio/site-builder?websiteId=${websiteId}`)
    ])

    console.log(`Warmed design system cache for website: ${websiteId}`)
  } catch (error) {
    console.error(`Failed to warm design system cache for website ${websiteId}:`, error)
  }
}

/**
 * Cache statistics and monitoring
 */
export interface DesignSystemCacheStats {
  totalHits: number
  totalMisses: number
  hitRate: number
  cacheSize: number
  lastInvalidation: Date | null
}

// Simple in-memory stats tracking (in production, use a proper monitoring system)
const cacheStats = new Map<string, {
  hits: number
  misses: number
  lastInvalidation: Date | null
}>()

export function recordCacheHit(key: string): void {
  const stats = cacheStats.get(key) || { hits: 0, misses: 0, lastInvalidation: null }
  stats.hits++
  cacheStats.set(key, stats)
}

export function recordCacheMiss(key: string): void {
  const stats = cacheStats.get(key) || { hits: 0, misses: 0, lastInvalidation: null }
  stats.misses++
  cacheStats.set(key, stats)
}

export function recordCacheInvalidation(key: string): void {
  const stats = cacheStats.get(key) || { hits: 0, misses: 0, lastInvalidation: null }
  stats.lastInvalidation = new Date()
  cacheStats.set(key, stats)
}

export function getDesignSystemCacheStats(websiteId: string): DesignSystemCacheStats {
  const key = CACHE_TAGS.DESIGN_SYSTEM(websiteId)
  const stats = cacheStats.get(key) || { hits: 0, misses: 0, lastInvalidation: null }

  const total = stats.hits + stats.misses
  const hitRate = total > 0 ? (stats.hits / total) * 100 : 0

  return {
    totalHits: stats.hits,
    totalMisses: stats.misses,
    hitRate,
    cacheSize: cacheStats.size,
    lastInvalidation: stats.lastInvalidation
  }
}
