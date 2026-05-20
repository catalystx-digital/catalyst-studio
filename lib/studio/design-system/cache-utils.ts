/**
 * Design System Cache Utilities
 *
 * Provides caching utilities for design system data with proper invalidation
 * based on design system update timestamps.
 *
 * @module DesignSystemCacheUtils
 */

import { unstable_cache } from 'next/cache'
import { useState, useEffect } from 'react'
import { DesignSystem } from '../import/types/design-system.types'
import type { GeneratedCSSVariables } from './generate-css-variables'

// Cache key patterns
const CACHE_KEYS = {
  DESIGN_SYSTEM: (websiteId: string, conceptId = 'default') => `design-system:${websiteId}:${conceptId}`,
  DESIGN_SYSTEM_LIST: (websiteIds: string[]) => `design-systems:${websiteIds.sort().join(',')}`,
  DESIGN_SYSTEM_DEPENDENCIES: (websiteId: string) => `design-system-deps:${websiteId}`,
  TEMPLATE_STYLES: (websiteId: string) => `template-styles:${websiteId}`,
  CSS_VARIABLES: (websiteId: string, conceptId = 'default') => `css-variables:${websiteId}:${conceptId}`,
}

// Cache tags for invalidation
const CACHE_TAGS = {
  DESIGN_SYSTEM: (websiteId: string, conceptId = 'default') => `design-system:${websiteId}:${conceptId}`,
  DESIGN_SYSTEM_ALL: 'design-system:all',
  TEMPLATE: (websiteId: string) => `template:${websiteId}`,
  CSS_VARIABLES: (websiteId: string, conceptId = 'default') => `css-variables:${websiteId}:${conceptId}`,
}

// Cache durations (in seconds)
const CACHE_DURATIONS = {
  DESIGN_SYSTEM: 3600, // 1 hour
  DESIGN_SYSTEM_LIST: 1800, // 30 minutes
  TEMPLATE_STYLES: 7200, // 2 hours
  CSS_VARIABLES: 3600, // 1 hour
  STATIC_ASSETS: 86400, // 24 hours
}

/**
 * Cache configuration for design system operations
 */
export interface DesignSystemCacheConfig {
  websiteId: string
  revalidate?: number
  tags?: string[]
}

/**
 * Cache entry with metadata
 */
export interface CacheEntry<T = any> {
  data: T
  timestamp: Date
  designSystemVersion: string
  etag?: string
}

/**
 * Design System Cache Manager
 */
export class DesignSystemCacheManager {
  private static instance: DesignSystemCacheManager
  private cache = new Map<string, CacheEntry>()
  private readonly maxSize = 100 // Maximum number of entries in memory cache

  static getInstance(): DesignSystemCacheManager {
    if (!DesignSystemCacheManager.instance) {
      DesignSystemCacheManager.instance = new DesignSystemCacheManager()
    }
    return DesignSystemCacheManager.instance
  }

  /**
   * Get cached design system data
   */
  get<T = any>(key: string): T | null {
    const entry = this.cache.get(key)
    if (!entry) return null

    // Check if entry is expired (simple TTL based on age)
    const age = Date.now() - entry.timestamp.getTime()
    const maxAge = CACHE_DURATIONS.DESIGN_SYSTEM * 1000

    if (age > maxAge) {
      this.cache.delete(key)
      return null
    }

    return entry.data as T
  }

  /**
   * Set cache entry with metadata
   */
  set<T = any>(key: string, data: T, designSystemVersion: string, etag?: string): void {
    // Ensure cache doesn't exceed max size
    if (this.cache.size >= this.maxSize) {
      // Delete oldest entry (simple FIFO)
      const firstKey = this.cache.keys().next().value
      if (firstKey) {
        this.cache.delete(firstKey)
      }
    }

    this.cache.set(key, {
      data,
      timestamp: new Date(),
      designSystemVersion,
      etag,
    })
  }

  /**
   * Delete cache entry
   */
  delete(key: string): boolean {
    return this.cache.delete(key)
  }

  /**
   * Clear all cache entries for a specific website
   */
  clearWebsite(websiteId: string): void {
    const keysToDelete = Array.from(this.cache.keys()).filter(key =>
      key.includes(websiteId)
    )

    keysToDelete.forEach(key => this.cache.delete(key))
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; entries: Array<{ key: string; age: number; version: string }> } {
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      age: Date.now() - entry.timestamp.getTime(),
      version: entry.designSystemVersion,
    }))

    return {
      size: this.cache.size,
      entries,
    }
  }
}

/**
 * Create a cached design system fetcher
 */
export function createCachedDesignSystemFetcher<T = any>(
  fetcher: (websiteId: string) => Promise<T>,
  config: DesignSystemCacheConfig
): (websiteId: string) => Promise<T> {
  const cacheManager = DesignSystemCacheManager.getInstance()

  return async (websiteId: string): Promise<T> => {
    const cacheKey = CACHE_KEYS.DESIGN_SYSTEM(websiteId)

    // Try memory cache first
    const cachedData = cacheManager.get<T>(cacheKey)
    if (cachedData) {
      return cachedData
    }

    // Use Next.js unstable_cache for persistent caching
    const cachedFetcher = unstable_cache(
      async (id: string) => {
        const data = await fetcher(id)

        // Cache in memory as well with version info
        const version = extractDesignSystemVersion(data)
        cacheManager.set(cacheKey, data, version)

        return data
      },
      [cacheKey],
      {
        revalidate: config.revalidate || CACHE_DURATIONS.DESIGN_SYSTEM,
        tags: config.tags || [CACHE_TAGS.DESIGN_SYSTEM(websiteId)],
      }
    )

    return cachedFetcher(websiteId)
  }
}

/**
 * Create a cached CSS variables generator
 */
export function createCachedCSSVariablesGenerator(
  generator: (designSystem: DesignSystem) => Promise<GeneratedCSSVariables>,
  config: DesignSystemCacheConfig
): (designSystem: DesignSystem) => Promise<GeneratedCSSVariables> {
  const cacheManager = DesignSystemCacheManager.getInstance()

  return async (designSystem: DesignSystem): Promise<GeneratedCSSVariables> => {
    const version = designSystem.metadata?.version || '1.0.0'
    const cacheKey = `${CACHE_KEYS.CSS_VARIABLES(config.websiteId)}:${version}`

    // Try memory cache first
    const cachedCSS = cacheManager.get<GeneratedCSSVariables>(cacheKey)
    if (cachedCSS) {
      return cachedCSS
    }

    // Generate CSS variables
    const css = await generator(designSystem)

    // Cache with version-specific key
    cacheManager.set(cacheKey, css, version)

    return css
  }
}

/**
 * Invalidate cache for a specific website
 */
export function invalidateDesignSystemCache(websiteId: string, conceptId?: string): void {
  const cacheManager = DesignSystemCacheManager.getInstance()
  const scope = conceptId ? `${websiteId}:${conceptId}` : websiteId

  // Clear memory cache
  cacheManager.clearWebsite(scope)

  // In a real implementation, you would also call Next.js revalidation APIs
  // This is a placeholder for the actual invalidation logic
  console.log(`Invalidated cache for website: ${scope}`)
}

/**
 * Extract design system version from data
 */
function extractDesignSystemVersion(data: any): string {
  if (typeof data === 'object' && data !== null) {
    return data.version || data.metadata?.version || 'unknown'
  }
  return 'unknown'
}

/**
 * Generate ETag for cache validation
 */
export function generateETag(data: any): string {
  if (!data) return '"empty"'

  const str = typeof data === 'string' ? data : JSON.stringify(data)
  const hash = Buffer.from(str).toString('base64').slice(0, 16)
  return `"${hash}"`
}

/**
 * Check if cache entry is still valid based on ETag
 */
export function isCacheValid(cachedETag: string, currentETag: string): boolean {
  return cachedETag === currentETag
}

/**
 * Design System Cache Hook for React components
 */
export function useDesignSystemCache<T = any>(
  key: string,
  fetcher: () => Promise<T>,
  dependencies: any[] = []
) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let cancelled = false

    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)

        const cacheManager = DesignSystemCacheManager.getInstance()
        const cachedData = cacheManager.get<T>(key)

        if (cachedData) {
          if (!cancelled) {
            setData(cachedData)
            setLoading(false)
          }
          return
        }

        const result = await fetcher()

        if (!cancelled) {
          setData(result)
          // Cache the result
          const version = extractDesignSystemVersion(result)
          cacheManager.set(key, result, version)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err as Error)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    fetchData()

    return () => {
      cancelled = true
    }
  }, [key, ...dependencies])

  return { data, loading, error }
}

/**
 * Middleware to add caching headers to API responses
 */
export function addCachingHeaders(
  response: Response,
  websiteId: string,
  maxAge: number = CACHE_DURATIONS.DESIGN_SYSTEM
): Response {
  const etag = generateETag(response.body)

  const headers = new Headers(response.headers)
  headers.set('Cache-Control', `public, max-age=${maxAge}, stale-while-revalidate=${maxAge * 2}`)
  headers.set('ETag', etag)
  headers.set('Vary', 'Accept-Encoding')

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

/**
 * Create cache key for design system operations
 */
export function createCacheKey(
  operation: string,
  websiteId: string,
  additionalParams: Record<string, any> = {}
): string {
  const params = Object.entries(additionalParams)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('&')

  return `ds:${operation}:${websiteId}${params ? `:${params}` : ''}`
}

// Export constants for external use
export { CACHE_KEYS, CACHE_TAGS, CACHE_DURATIONS }
