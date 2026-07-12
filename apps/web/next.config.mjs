/** @type {import('next').NextConfig} */

const isDev = process.env.NODE_ENV !== "production";

/** Origin of a URL env var, or null when unset/invalid. */
function originOf(url) {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/** ws(s) equivalent of an http(s) origin (Supabase realtime / auth sockets). */
function wsOrigin(origin) {
  if (!origin) return null;
  if (origin.startsWith("https://")) return "wss://" + origin.slice(8);
  if (origin.startsWith("http://")) return "ws://" + origin.slice(7);
  return null;
}

// The browser talks to same-origin /api for everything payment-related, plus:
// the Supabase client (seller auth/session, realtime socket) and — defensively —
// the public Stellar RPC. These are derived from the NEXT_PUBLIC_* env so the
// policy is correct per environment (local vs cloud) instead of hardcoded.
const supabaseOrigin = originOf(process.env.NEXT_PUBLIC_SUPABASE_URL);
const rpcOrigin = originOf(process.env.NEXT_PUBLIC_STELLAR_RPC_URL);

const connectSrc = [
  "'self'",
  supabaseOrigin,
  wsOrigin(supabaseOrigin),
  rpcOrigin,
  // Dev only: Next.js HMR websocket + dev server on localhost.
  ...(isDev ? ["ws://localhost:*", "ws://127.0.0.1:*", "http://localhost:*"] : []),
].filter(Boolean);

// ponytail: script-src uses 'unsafe-inline' (not nonces). Next App Router emits
// inline hydration scripts and this app has no per-request nonce middleware
// (middleware is scoped to /api by design). 'unsafe-inline' still blocks
// external/injected script SOURCES; upgrade to nonce+'strict-dynamic' if a
// stricter script policy is needed. 'unsafe-eval' is dev-only (Turbopack/HMR).
const scriptSrc = ["'self'", "'unsafe-inline'", ...(isDev ? ["'unsafe-eval'"] : [])];

const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  // Inline styles: next/font, Tailwind, and React inline `style=` attributes
  // (the landing sets inline transition delays) require 'unsafe-inline'.
  "style-src 'self' 'unsafe-inline'",
  `script-src ${scriptSrc.join(" ")}`,
  `connect-src ${connectSrc.join(" ")}`,
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Belt-and-suspenders with frame-ancestors for older browsers.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  // HSTS only in production (ignored over http anyway, but keep dev clean).
  ...(isDev
    ? []
    : [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ]),
];

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@trustip/config",
    "@trustip/database",
    "@trustip/stellar",
    "@trustip/validators",
    "@trustip/ui"
  ],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  }
};

export default nextConfig;
