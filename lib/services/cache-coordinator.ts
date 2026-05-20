/**
 * Cache Coordinator
 *
 * Provides coordinated cache invalidation across multiple cache systems.
 * This prevents stale data issues when propsMeta or component definitions change.
 *
 * Usage:
 * ```typescript
 * import { cacheCoordinator } from '@/lib/services/cache-coordinator'
 *
 * // Register a cache
 * cacheCoordinator.register({
 *   name: 'my-cache',
 *   clearCache: () => { myCache = null }
 * })
 *
 * // Invalidate all caches
 * cacheCoordinator.invalidateAll()
 * ```
 */

// ============================================================================
// TYPES
// ============================================================================

export interface CacheSubscriber {
  name: string
  clearCache: () => void
}

export interface CacheCoordinator {
  register(subscriber: CacheSubscriber): void
  unregister(name: string): void
  invalidateAll(): void
  invalidateForWebsite(websiteId: string): void
  getRegisteredCaches(): string[]
}

// ============================================================================
// INTERNAL STATE
// ============================================================================

const subscribers = new Map<string, CacheSubscriber>()

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Register a cache for coordinated invalidation
 */
function register(subscriber: CacheSubscriber): void {
  if (!subscriber.name || typeof subscriber.clearCache !== 'function') {
    throw new Error('Invalid cache subscriber: must have name and clearCache function')
  }
  subscribers.set(subscriber.name, subscriber)
}

/**
 * Unregister a cache
 */
function unregister(name: string): void {
  subscribers.delete(name)
}

/**
 * Invalidate all registered caches
 */
function invalidateAll(): void {
  for (const subscriber of subscribers.values()) {
    try {
      subscriber.clearCache()
    } catch (error) {
      console.error(`[CacheCoordinator] Failed to clear cache "${subscriber.name}":`, error)
    }
  }
}

/**
 * Invalidate caches for a specific website
 * Currently delegates to invalidateAll() as we don't have per-website cache granularity yet
 */
function invalidateForWebsite(websiteId: string): void {
  // Future: implement per-website cache invalidation when caches support it
  // For now, invalidate all caches to ensure consistency
  invalidateAll()
}

/**
 * Get list of registered cache names
 */
function getRegisteredCaches(): string[] {
  return Array.from(subscribers.keys()).sort()
}

// ============================================================================
// EXPORTS
// ============================================================================

export const cacheCoordinator: CacheCoordinator = {
  register,
  unregister,
  invalidateAll,
  invalidateForWebsite,
  getRegisteredCaches
}
