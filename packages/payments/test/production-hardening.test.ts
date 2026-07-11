import { afterEach, describe, expect, it } from "vitest";
import { clientIp } from "../../config/src/request-context.js";
import {
  checkRateLimit,
  createMemoryRateLimitStore,
} from "../../config/src/rate-limit-store.js";
import { collectConfigProblems } from "../../config/src/validate.js";

// Restore any env we poke between cases so ordering can't leak state.
const SAVED = { ...process.env };
afterEach(() => {
  process.env = { ...SAVED };
});

function headers(map: Record<string, string>): Headers {
  return new Headers(map);
}

describe("trusted client IP (X-Forwarded-For spoofing)", () => {
  it("ignores a client-spoofed leftmost entry, using the trusted hop from the right", () => {
    process.env.TRUSTIP_TRUSTED_PROXY_HOPS = "1";
    // Attacker prepends 6.6.6.6; our single proxy appended the real 9.9.9.9.
    const ip = clientIp(headers({ "x-forwarded-for": "6.6.6.6, 9.9.9.9" }));
    expect(ip).toBe("9.9.9.9");
  });

  it("prefers a configured platform true-IP header over XFF", () => {
    process.env.TRUSTIP_CLIENT_IP_HEADER = "x-real-ip";
    const ip = clientIp(
      headers({ "x-forwarded-for": "1.1.1.1, 2.2.2.2", "x-real-ip": "9.9.9.9" }),
    );
    expect(ip).toBe("9.9.9.9");
  });

  it("falls back to 'unknown' with no usable header", () => {
    expect(clientIp(headers({}))).toBe("unknown");
  });
});

describe("distributed rate limiter (burst + sustained)", () => {
  it("allows up to the burst limit, then blocks with a Retry-After", async () => {
    let t = 0;
    const store = createMemoryRateLimitStore(() => t);
    const windows = [
      { limit: 3, windowMs: 1_000 }, // burst
      { limit: 100, windowMs: 60_000 }, // sustained (not the binding one here)
    ];
    const results = [];
    for (let i = 0; i < 4; i++) {
      results.push(await checkRateLimit(store, "ip:1.2.3.4", windows));
    }
    expect(results.slice(0, 3).every((r) => r.allowed)).toBe(true);
    expect(results[3]!.allowed).toBe(false);
    expect(results[3]!.retryAfterMs).toBeGreaterThan(0);

    // After the burst window elapses, requests are allowed again.
    t += 1_001;
    const after = await checkRateLimit(store, "ip:1.2.3.4", windows);
    expect(after.allowed).toBe(true);
  });

  it("keys are isolated per identity", async () => {
    const store = createMemoryRateLimitStore();
    const windows = [{ limit: 1, windowMs: 1_000 }];
    expect((await checkRateLimit(store, "a", windows)).allowed).toBe(true);
    expect((await checkRateLimit(store, "b", windows)).allowed).toBe(true);
    expect((await checkRateLimit(store, "a", windows)).allowed).toBe(false);
  });
});

describe("production config validation (fail closed)", () => {
  it("is permissive in development", () => {
    process.env.NODE_ENV = "development";
    expect(collectConfigProblems()).toEqual([]);
  });

  it("reports missing production requirements", () => {
    process.env.NODE_ENV = "production";
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.TRUSTIP_CHECKOUT_TOKEN_SECRET;
    const keys = collectConfigProblems().map((p) => p.key);
    expect(keys).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(keys).toContain("UPSTASH_REDIS_REST_URL");
    expect(keys).toContain("TRUSTIP_CHECKOUT_TOKEN_SECRET");
  });
});
