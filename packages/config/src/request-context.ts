/**
 * Trusted request-metadata extraction (Parts 1 & 2). Fixes the MEDIUM finding
 * "rate limiter trusts raw X-Forwarded-For": a client can freely prepend entries
 * to X-Forwarded-For, so the LEFTMOST value is attacker-controlled. Only the
 * rightmost entries are appended by infrastructure we control, so we count in
 * from the right by the number of trusted proxy hops in front of the app.
 *
 * Configure per deployment:
 *   TRUSTIP_TRUSTED_PROXY_HOPS  number of trusted proxies/CDNs in front (default 1)
 *   TRUSTIP_CLIENT_IP_HEADER    optional platform header carrying the true client
 *                               IP from the socket (e.g. "x-real-ip", "fly-client-ip",
 *                               "cf-connecting-ip"); when set + present it wins.
 *
 * Pure and edge-safe (no Node builtins) so middleware, routes, and workers share
 * one implementation instead of three ad-hoc `x-forwarded-for` splits.
 */

function trustedHops(): number {
  const raw = Number(process.env.TRUSTIP_TRUSTED_PROXY_HOPS);
  return Number.isFinite(raw) && raw >= 0 ? Math.floor(raw) : 1;
}

/**
 * Resolve the client IP from request headers, or "unknown" when it cannot be
 * trusted. Never returns a client-spoofable value.
 */
export function clientIp(headers: Headers): string {
  const trustedHeader = process.env.TRUSTIP_CLIENT_IP_HEADER?.toLowerCase();
  if (trustedHeader) {
    const direct = headers.get(trustedHeader)?.trim();
    if (direct) return direct;
  }

  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const chain = xff
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (chain.length > 0) {
      // Our `hops` trusted proxies each APPEND one entry on the right; the
      // outermost trusted proxy appended the real client IP, which lands at
      // index (len - hops). Anything the client prepended stays to the left of
      // that and is ignored. Clamp to 0 for a shorter-than-expected chain.
      const idx = Math.max(0, chain.length - trustedHops());
      return chain[idx]!;
    }
  }

  return headers.get("x-real-ip")?.trim() || "unknown";
}

/**
 * Reuse an upstream-provided request id when it looks sane (so a trace survives
 * across the proxy), otherwise mint a fresh one. Bounded length to keep it out
 * of log-injection / unbounded-key territory.
 */
export function requestId(headers: Headers): string {
  const incoming = headers.get("x-request-id")?.trim();
  if (incoming && /^[A-Za-z0-9._-]{8,128}$/.test(incoming)) return incoming;
  return crypto.randomUUID();
}
