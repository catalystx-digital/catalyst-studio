export interface RateLimitStatus {
  allowed: boolean;
  remaining: number;
  limit: number;
  retryAfterMs?: number;
}

interface BucketState {
  tokens: number;
  lastRefill: number;
}

export class TokenBucketRateLimiter {
  private readonly buckets = new Map<string, BucketState>();
  private readonly refillRate: number;

  constructor(private readonly capacity: number, private readonly windowMs: number) {
    if (capacity <= 0 || windowMs <= 0) {
      throw new Error('TokenBucketRateLimiter requires positive capacity and window');
    }
    this.refillRate = capacity / windowMs;
  }

  take(key: string, now: number = Date.now()): RateLimitStatus {
    const bucket = this.buckets.get(key) ?? { tokens: this.capacity, lastRefill: now };
    const elapsed = Math.max(0, now - bucket.lastRefill);
    bucket.tokens = Math.min(this.capacity, bucket.tokens + elapsed * this.refillRate);
    bucket.lastRefill = now;

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      this.buckets.set(key, bucket);
      return {
        allowed: true,
        remaining: Math.floor(bucket.tokens),
        limit: this.capacity,
      };
    }

    this.buckets.set(key, bucket);
    const deficit = 1 - bucket.tokens;
    const retryAfterMs = Math.ceil(deficit / this.refillRate);
    return {
      allowed: false,
      remaining: 0,
      limit: this.capacity,
      retryAfterMs,
    };
  }

  reset() {
    this.buckets.clear();
  }
}
