import { describe, expect, it } from "vitest";
import { createInMemoryRateLimiter } from "../src/rate-limit.js";

describe("in-memory rate limiter", () => {
  it("allows up to the limit then blocks within the window", () => {
    const now = 1000;
    const limiter = createInMemoryRateLimiter({
      limit: 3,
      windowMs: 1000,
      now: () => now,
    });
    expect(limiter.check("k").allowed).toBe(true);
    expect(limiter.check("k").allowed).toBe(true);
    expect(limiter.check("k").allowed).toBe(true);
    const blocked = limiter.check("k");
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it("resets after the window elapses", () => {
    let now = 1000;
    const limiter = createInMemoryRateLimiter({
      limit: 1,
      windowMs: 1000,
      now: () => now,
    });
    expect(limiter.check("k").allowed).toBe(true);
    expect(limiter.check("k").allowed).toBe(false);
    now += 1001;
    expect(limiter.check("k").allowed).toBe(true);
  });

  it("isolates budgets by key", () => {
    const now = 1000;
    const limiter = createInMemoryRateLimiter({
      limit: 1,
      windowMs: 1000,
      now: () => now,
    });
    expect(limiter.check("a").allowed).toBe(true);
    expect(limiter.check("b").allowed).toBe(true);
    expect(limiter.check("a").allowed).toBe(false);
  });
});
