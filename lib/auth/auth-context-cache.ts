/**
 * Auth Context Cache
 *
 * In-memory cache for auth context to avoid redundant database queries
 * on repeated requests from the same user.
 *
 * @see docs/prd-prisma-query-optimization.md - Solution 1
 */

type AuthContextCacheEntry = {
  accountId: string;
  userId: string;
  expiresAt: number;
};

type AuthContextCacheMetrics = {
  hits: number;
  misses: number;
  stores: number;
  evictions: number;
};

declare global {
  var __authContextCache: Map<string, AuthContextCacheEntry> | undefined;
  var __authContextMetrics: AuthContextCacheMetrics | undefined;
}

const DEFAULT_TTL_MS = 60_000; // 60 seconds default
const CACHE_TTL_MS = Number.parseInt(
  process.env.AUTH_CONTEXT_CACHE_TTL_MS ?? String(DEFAULT_TTL_MS),
  10
);

const metrics: AuthContextCacheMetrics = globalThis.__authContextMetrics ?? {
  hits: 0,
  misses: 0,
  stores: 0,
  evictions: 0,
};
globalThis.__authContextMetrics = metrics;

function getCache(): Map<string, AuthContextCacheEntry> {
  if (!globalThis.__authContextCache) {
    globalThis.__authContextCache = new Map();
  }
  return globalThis.__authContextCache;
}

const LOG_ENABLED = process.env.PRISMA_QUERY_LOG === 'true';

/**
 * Get cached auth context for a user.
 * Returns null if not cached or expired.
 */
export function getCachedAuthContext(userId: string): { accountId: string; userId: string } | null {
  const cache = getCache();
  const entry = cache.get(userId);

  if (!entry) {
    metrics.misses += 1;
    if (LOG_ENABLED) {
      console.log('[auth-context-cache] MISS', { userId: userId.slice(0, 8), metrics });
    }
    return null;
  }

  if (Date.now() > entry.expiresAt) {
    cache.delete(userId);
    metrics.evictions += 1;
    if (LOG_ENABLED) {
      console.log('[auth-context-cache] EXPIRED', { userId: userId.slice(0, 8), metrics });
    }
    return null;
  }

  metrics.hits += 1;
  if (LOG_ENABLED) {
    console.log('[auth-context-cache] HIT', { userId: userId.slice(0, 8), metrics });
  }
  return { accountId: entry.accountId, userId: entry.userId };
}

/**
 * Store auth context in cache.
 */
export function storeAuthContext(
  userId: string,
  accountId: string,
  ttlMs: number = CACHE_TTL_MS
): void {
  const cache = getCache();
  cache.set(userId, {
    accountId,
    userId,
    expiresAt: Date.now() + Math.max(ttlMs, 1_000),
  });
  metrics.stores += 1;
  if (LOG_ENABLED) {
    console.log('[auth-context-cache] STORE', { userId: userId.slice(0, 8), accountId: accountId.slice(0, 8), ttlMs, metrics });
  }
}

/**
 * Invalidate auth context cache for a user.
 * Call this when user's account/membership changes.
 */
export function invalidateAuthContext(userId: string): void {
  const cache = getCache();
  if (cache.delete(userId)) {
    metrics.evictions += 1;
  }
}

/**
 * Clear all cached auth contexts.
 */
export function clearAuthContextCache(): void {
  getCache().clear();
}

/**
 * Get cache metrics for monitoring.
 */
export function getAuthContextCacheMetrics(): AuthContextCacheMetrics {
  return { ...metrics };
}
