import type { SerializedSupabaseUser } from './user-header';

type AuthCacheEntry = {
  user: SerializedSupabaseUser;
  expiresAt: number;
};

type AuthCacheMetrics = {
  hits: number;
  misses: number;
  stores: number;
  bypasses: number;
  evictions: number;
  stale: number;
};

declare global {
  // eslint-disable-next-line no-var
  var __supabaseAuthCache: Map<string, AuthCacheEntry> | undefined;
  // eslint-disable-next-line no-var
  var __supabaseAuthMetrics: AuthCacheMetrics | undefined;
}

const metrics: AuthCacheMetrics =
  globalThis.__supabaseAuthMetrics ??
  {
    hits: 0,
    misses: 0,
    stores: 0,
    bypasses: 0,
    evictions: 0,
    stale: 0,
  };

globalThis.__supabaseAuthMetrics = metrics;

function getCache(): Map<string, AuthCacheEntry> {
  if (!globalThis.__supabaseAuthCache) {
    globalThis.__supabaseAuthCache = new Map();
  }

  return globalThis.__supabaseAuthCache;
}

export function getCachedUser(token: string): SerializedSupabaseUser | null {
  const cache = getCache();
  const entry = cache.get(token);

  if (!entry) {
    metrics.misses += 1;
    return null;
  }

  if (Date.now() > entry.expiresAt) {
    cache.delete(token);
    metrics.evictions += 1;
    metrics.stale += 1;
    return null;
  }

  metrics.hits += 1;
  return entry.user;
}

export function storeCachedUser(token: string, user: SerializedSupabaseUser, ttlMs: number): void {
  const cache = getCache();
  cache.set(token, {
    user,
    expiresAt: Date.now() + Math.max(ttlMs, 1_000),
  });
  metrics.stores += 1;
}

export function deleteCachedUser(token: string): void {
  const cache = getCache();
  if (cache.delete(token)) {
    metrics.evictions += 1;
  }
}

export function recordCacheBypass(): void {
  metrics.bypasses += 1;
}

export function resetAuthCache(): void {
  getCache().clear();
}

export function getAuthCacheMetrics(): AuthCacheMetrics {
  return metrics;
}
