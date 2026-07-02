/**
 * Minimal, testable rate-limiter abstraction. The in-memory sliding-window
 * implementation is a per-instance guard suitable for MVP/guest checkout; a
 * distributed limiter (e.g. Redis/Upstash) is the production upgrade behind the
 * same interface. A `now` injector makes window behavior deterministic in tests.
 */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

export interface RateLimiter {
  check(key: string): RateLimitResult;
}

export interface RateLimiterOptions {
  limit: number;
  windowMs: number;
  now?: () => number;
}

export function createInMemoryRateLimiter(
  options: RateLimiterOptions,
): RateLimiter {
  const { limit, windowMs } = options;
  const now = options.now ?? (() => Date.now());
  const hits = new Map<string, number[]>();

  return {
    check(key: string): RateLimitResult {
      const t = now();
      const windowStart = t - windowMs;
      const recent = (hits.get(key) ?? []).filter((ts) => ts > windowStart);

      if (recent.length >= limit) {
        hits.set(key, recent);
        const retryAfterMs = Math.max(0, recent[0] + windowMs - t);
        return { allowed: false, remaining: 0, retryAfterMs };
      }

      recent.push(t);
      hits.set(key, recent);
      return {
        allowed: true,
        remaining: limit - recent.length,
        retryAfterMs: 0,
      };
    },
  };
}
