import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  checkRateLimit,
  clientIp,
  getRateLimitStore,
  log,
  requestId,
} from "@trustip/config";

/**
 * API edge middleware (Phase 19, Part 1). Runs before every /api route. It
 * hardens and normalizes — it does NOT replace per-route authorization or the
 * per-route rate limiters (those stay as defense-in-depth). Specifically it:
 *   - rejects unsupported HTTP methods early (before any handler runs);
 *   - attaches a request id (reused from upstream or freshly minted) and
 *     forwards it to the route + echoes it on the response for tracing;
 *   - applies a coarse, distributed rate limit keyed by trusted client IP when a
 *     shared store is configured (fail-OPEN: a store blip never 500s the API).
 *
 * It deliberately does not call Supabase or read the DB — auth stays in routes
 * where the service-role client and RLS-aware checks live.
 */

const ALLOWED_METHODS = new Set([
  "GET",
  "HEAD",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "OPTIONS",
]);

// Coarse, IP-wide budget layered above the tight per-route limiters. Burst +
// sustained so a short spike and a slow grind are both bounded.
const API_WINDOWS = [
  { limit: 60, windowMs: 10_000 }, // burst
  { limit: 600, windowMs: 60_000 }, // sustained
];

// Module-level singleton so the in-memory dev fallback keeps state across
// requests within an isolate (a fresh call each request would reset it).
const rateStore = getRateLimitStore();

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const id = requestId(request.headers);
  const { method } = request;
  const route = request.nextUrl.pathname;

  if (!ALLOWED_METHODS.has(method)) {
    log.warn("method not allowed", { requestId: id, route, method, result: 405 });
    return json(405, "MethodNotAllowed", "method not allowed", id, {
      allow: [...ALLOWED_METHODS].join(", "),
    });
  }

  if (rateStore && method !== "OPTIONS") {
    try {
      const result = await checkRateLimit(
        rateStore,
        `api:${clientIp(request.headers)}`,
        API_WINDOWS,
      );
      if (!result.allowed) {
        log.warn("rate limited", { requestId: id, route, method, result: 429 });
        return json(429, "RateLimited", "too many requests", id, {
          "retry-after": String(Math.ceil(result.retryAfterMs / 1000)),
        });
      }
    } catch (err) {
      // Fail-open: never let a limiter outage take down the API surface.
      log.error("rate limiter unavailable, allowing", {
        requestId: id,
        route,
        errorClass: "unexpected",
        detail: (err as Error).message,
      });
    }
  }

  // Forward the request id to the route (and downstream logs) + echo on response.
  const headers = new Headers(request.headers);
  headers.set("x-request-id", id);
  const res = NextResponse.next({ request: { headers } });
  res.headers.set("x-request-id", id);
  return res;
}

function json(
  status: number,
  code: string,
  message: string,
  id: string,
  extraHeaders: Record<string, string> = {},
): NextResponse {
  return NextResponse.json(
    { error: { code, message } },
    { status, headers: { "x-request-id": id, ...extraHeaders } },
  );
}

// Scope strictly to the API namespace — pages/assets keep zero middleware cost.
export const config = {
  matcher: ["/api/:path*"],
};
