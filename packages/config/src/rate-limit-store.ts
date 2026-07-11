/**
 * Distributed rate-limit storage (Part 2). The existing per-route
 * `createInMemoryRateLimiter` in @trustip/payments stays untouched (synchronous,
 * per-instance) so no route changes; this adds an ASYNC, pluggable store so a
 * production deployment behind multiple instances shares one counter via Redis /
 * Upstash. Falls back to an in-process Map in development.
 *
 * Storage is abstracted behind `RateLimitStore.incr` (a fixed-window counter).
 * The limiter composes two windows — a short BURST window and a longer SUSTAINED
 * window — and a request must satisfy both. Retry-After comes from the blocking
 * window's remaining TTL. Edge-safe: Upstash is called over its REST API with
 * `fetch`, so there is no native `redis`/`ioredis` dependency to bundle.
 */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

export interface RateLimitWindow {
  limit: number;
  windowMs: number;
}

export interface RateLimitStore {
  /** Increment the counter for `key` in a window of `windowMs`, returning the
   * new count and the window's remaining TTL. Idempotent per call. */
  incr(key: string, windowMs: number): Promise<{ count: number; ttlMs: number }>;
}

// --- in-memory (dev / single instance) --------------------------------------

export function createMemoryRateLimitStore(
  now: () => number = () => Date.now(),
): RateLimitStore {
  const buckets = new Map<string, { count: number; expiresAt: number }>();
  return {
    async incr(key, windowMs) {
      const t = now();
      const existing = buckets.get(key);
      if (!existing || existing.expiresAt <= t) {
        const fresh = { count: 1, expiresAt: t + windowMs };
        buckets.set(key, fresh);
        // Opportunistic sweep so the Map does not grow unbounded on a long-lived
        // process. ponytail: O(n) sweep on write, fine for dev/single-instance.
        if (buckets.size > 10_000)
          for (const [k, v] of buckets) if (v.expiresAt <= t) buckets.delete(k);
        return { count: 1, ttlMs: windowMs };
      }
      existing.count += 1;
      return { count: existing.count, ttlMs: existing.expiresAt - t };
    },
  };
}

// --- Upstash Redis over REST (production) -----------------------------------

export function createUpstashRateLimitStore(
  url: string,
  token: string,
): RateLimitStore {
  return {
    async incr(key, windowMs) {
      // Pipeline: INCR, then set expiry only if not already set (NX) so the
      // window is anchored to the FIRST hit, then read remaining TTL.
      const res = await fetch(`${url}/pipeline`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify([
          ["INCR", key],
          ["PEXPIRE", key, windowMs, "NX"],
          ["PTTL", key],
        ]),
      });
      if (!res.ok) throw new Error(`upstash ${res.status}`);
      const out = (await res.json()) as Array<{ result: number }>;
      const count = Number(out[0]?.result ?? 0);
      const ttl = Number(out[2]?.result ?? windowMs);
      // PTTL returns -1 (no expiry) / -2 (missing) in edge cases; treat as full.
      return { count, ttlMs: ttl > 0 ? ttl : windowMs };
    },
  };
}

/**
 * Select the store from env. Returns null when no distributed store is
 * configured, so callers can decide to skip distributed limiting (dev) rather
 * than fail. Production config validation (see `validate.ts`) requires this to
 * be present on mainnet.
 */
export function getRateLimitStore(): RateLimitStore | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) return createUpstashRateLimitStore(url, token);
  if (process.env.NODE_ENV !== "production")
    return createMemoryRateLimitStore();
  return null;
}

/**
 * Check `key` against every window. A request must satisfy ALL windows; the
 * first window it exceeds decides the Retry-After. A store error is surfaced to
 * the caller (middleware chooses fail-open so a Redis blip never 500s the API).
 */
export async function checkRateLimit(
  store: RateLimitStore,
  key: string,
  windows: RateLimitWindow[],
): Promise<RateLimitResult> {
  let allowed = true;
  let retryAfterMs = 0;
  let remaining = Number.POSITIVE_INFINITY;
  // Windows are independent counters — increment them concurrently so the store
  // round-trips overlap instead of adding up per request.
  const results = await Promise.all(
    windows.map(async (w) => ({
      w,
      ...(await store.incr(`${key}:${w.windowMs}`, w.windowMs)),
    })),
  );
  for (const { w, count, ttlMs } of results) {
    remaining = Math.min(remaining, Math.max(0, w.limit - count));
    if (count > w.limit) {
      allowed = false;
      retryAfterMs = Math.max(retryAfterMs, ttlMs);
    }
  }
  return {
    allowed,
    remaining: Number.isFinite(remaining) ? remaining : 0,
    retryAfterMs,
  };
}
