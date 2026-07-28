export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
};

export interface TenantRateLimiter {
  check(key: string, limit: number, windowMs: number): Promise<RateLimitResult>;
}

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

export class InMemoryTenantRateLimiter implements TenantRateLimiter {
  async check(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
    const now = Date.now();
    const existing = buckets.get(key);

    if (!existing || existing.resetAt <= now) {
      const resetAt = now + windowMs;
      buckets.set(key, { count: 1, resetAt });
      return { allowed: true, remaining: limit - 1, resetAt: new Date(resetAt) };
    }

    if (existing.count >= limit) {
      return { allowed: false, remaining: 0, resetAt: new Date(existing.resetAt) };
    }

    existing.count += 1;
    buckets.set(key, existing);
    return {
      allowed: true,
      remaining: limit - existing.count,
      resetAt: new Date(existing.resetAt),
    };
  }
}

export function createTenantRateLimiter(): TenantRateLimiter {
  return new InMemoryTenantRateLimiter();
}

export function resetTenantRateLimiterForTests(): void {
  buckets.clear();
}
