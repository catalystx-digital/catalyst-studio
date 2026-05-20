import {
  deleteCachedUser,
  getAuthCacheMetrics,
  getCachedUser,
  recordCacheBypass,
  resetAuthCache,
  storeCachedUser,
} from '@/lib/supabase/auth-cache';

const sampleUser = {
  id: 'user-123',
  email: 'user@example.com',
};

describe('auth-cache', () => {
  let nowSpy: jest.SpyInstance<number, []>;

  beforeEach(() => {
    resetAuthCache();
    nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1_000);
  });

  afterEach(() => {
    nowSpy.mockRestore();
    resetAuthCache();
  });

  it('returns null when cache miss occurs and tracks metrics', () => {
    expect(getCachedUser('token')).toBeNull();
    const metrics = getAuthCacheMetrics();
    expect(metrics.misses).toBeGreaterThanOrEqual(1);
  });

  it('stores and retrieves cached users within TTL', () => {
    storeCachedUser('token', sampleUser, 60_000);
    expect(getCachedUser('token')).toEqual(sampleUser);
    const metrics = getAuthCacheMetrics();
    expect(metrics.hits).toBe(1);
    expect(metrics.stores).toBe(1);
  });

  it('evicts expired entries on access', () => {
    storeCachedUser('token', sampleUser, 10_000);
    nowSpy.mockReturnValue(25_000);

    expect(getCachedUser('token')).toBeNull();

    const metrics = getAuthCacheMetrics();
    expect(metrics.evictions).toBe(1);
    expect(metrics.stale).toBe(1);
  });

  it('removes entries when delete is invoked', () => {
    storeCachedUser('token', sampleUser, 60_000);
    deleteCachedUser('token');
    expect(getCachedUser('token')).toBeNull();
    const metrics = getAuthCacheMetrics();
    expect(metrics.evictions).toBeGreaterThanOrEqual(1);
  });

  it('captures bypass metrics when cache is skipped', () => {
    recordCacheBypass();
    const metrics = getAuthCacheMetrics();
    expect(metrics.bypasses).toBeGreaterThanOrEqual(1);
  });
});
