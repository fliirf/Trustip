// Build-time guard: this module wires the SERVICE-ROLE Supabase client and must
// never be bundled into client code. `server-only` fails the build if it is ever
// imported from a Client Component. (Kept to the Next route layer — the
// @trustip/payments package itself stays framework-agnostic for workers/tests.)
import "server-only";
import { getCheckoutTokenSecret, getEscrowContractId } from "@trustip/config";
import { getServiceClient, supabase } from "@trustip/database";
import {
  createInMemoryRateLimiter,
  createSupabasePaymentStore,
  type PaymentActor,
  type PaymentConfig,
  type PaymentDeps,
  PaymentError,
  type RateLimiter,
} from "@trustip/payments";
import {
  createEscrowGateway,
  currentNetwork,
  networkName,
} from "@trustip/stellar";
import { NextResponse } from "next/server";
import type { ZodSchema } from "zod";

/**
 * Build the payment service dependencies. Uses the SERVICE-ROLE Supabase client
 * (server-only; bypasses RLS to write money/escrow tables) and the live escrow
 * gateway. Constructed per-request so missing env fails loudly at call time
 * rather than at build time.
 */
export function getPaymentDeps(): PaymentDeps {
  const config: PaymentConfig = {
    networkPassphrase: currentNetwork.networkPassphrase,
    networkName: networkName(),
    escrowContractId: getEscrowContractId(),
    // Optional: when set, submit requires a valid prepare attempt token.
    attemptSecret: process.env.PAYMENT_ATTEMPT_SECRET,
    // Optional: when set, guest create-order requires a valid checkout token.
    checkoutTokenSecret: getCheckoutTokenSecret(),
  };
  return {
    store: createSupabasePaymentStore(getServiceClient()),
    gateway: createEscrowGateway(),
    config,
  };
}

/**
 * Resolve the requesting actor from a Bearer access token, if present.
 * Unauthenticated requests get `{ userId: null }` (guest checkout is allowed to
 * prepare/submit/sync; status reads fail closed for user-bound orders).
 */
export async function getActor(request: Request): Promise<PaymentActor> {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.toLowerCase().startsWith("bearer ")
    ? auth.slice(7).trim()
    : "";
  if (!token) return { userId: null };

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return { userId: null };
  const userId = data.user.id;

  // Resolve role + seller profile with the service client for status scoping.
  const service = getServiceClient();
  const [{ data: user }, { data: sellerProfile }] = await Promise.all([
    service.from("users").select("role").eq("id", userId).maybeSingle(),
    service
      .from("seller_profiles")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  return {
    userId,
    isAdmin: user?.role === "admin",
    sellerProfileId: sellerProfile?.id ?? null,
    email: data.user.email ?? null,
  };
}

/** Parse + validate a JSON body against a Zod schema (throws PaymentError). */
export async function parseJsonBody<T>(
  request: Request,
  schema: ZodSchema<T>,
): Promise<T> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new PaymentError("InvalidInput", "request body must be valid JSON");
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new PaymentError(
      "InvalidInput",
      result.error.issues.map((i) => i.message).join("; ") || "invalid input",
    );
  }
  return result.data;
}

/** Map any thrown value to a safe JSON response (no secrets, typed code). */
export function errorResponse(e: unknown): NextResponse {
  if (e instanceof PaymentError) {
    return NextResponse.json(
      { error: { code: e.code, message: e.message } },
      { status: e.httpStatus },
    );
  }
  // Unknown/unexpected: do not leak internals.
  return NextResponse.json(
    { error: { code: "InternalError", message: "internal server error" } },
    { status: 500 },
  );
}

// ---------------------------------------------------------------------------
// Rate limiting (MEDIUM-2). Per-instance in-memory guard suitable for guest
// checkout; swap for a distributed limiter (Redis/Upstash) behind the same
// interface in production. Keyed by client IP + route bucket.
// ---------------------------------------------------------------------------
// Mutating flow (prepare/submit/sync): conservative budget.
const writeLimiter: RateLimiter = createInMemoryRateLimiter({
  limit: 30,
  windowMs: 60_000,
});
// Read-only status polling: a higher budget so the checkout UI can poll smoothly
// (~1–2s cadence) without tripping, while still capping abuse.
const statusLimiter: RateLimiter = createInMemoryRateLimiter({
  limit: 120,
  windowMs: 60_000,
});
// create_order triggers operator-signed on-chain writes (spends operator XLM
// fees), so it gets a tighter, dedicated budget layered on top of the token /
// ownership authorization enforced in the service. Keyed by client IP.
const createOrderLimiter: RateLimiter = createInMemoryRateLimiter({
  limit: 12,
  windowMs: 60_000,
});
// Checkout-token issuance: no on-chain work, but this is the brute-force surface
// for order_no (a valid slug+order_no mints a token). A tight per-IP budget
// slows enumeration; the service still fails closed on every invalid lookup.
const checkoutIssueLimiter: RateLimiter = createInMemoryRateLimiter({
  limit: 20,
  windowMs: 60_000,
});
// Order creation from a public checkout link: each call inserts DB rows, so a
// tight per-IP budget bounds junk-order spam (orders are money-inert until the
// buyer actually funds them on-chain).
const orderCreateLimiter: RateLimiter = createInMemoryRateLimiter({
  limit: 10,
  windowMs: 60_000,
});

function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

function tooManyRequests(retryAfterMs: number): NextResponse {
  return NextResponse.json(
    {
      error: {
        code: "RateLimited",
        message: "too many requests, please retry shortly",
      },
    },
    {
      status: 429,
      headers: { "retry-after": String(Math.ceil(retryAfterMs / 1000)) },
    },
  );
}

/** Returns a 429 response if the caller is over budget for `bucket`, else null.
 * Used by the mutating payment routes (prepare/submit/sync). */
export function enforceRateLimit(
  request: Request,
  bucket: string,
): NextResponse | null {
  const result = writeLimiter.check(`${bucket}:${clientIp(request)}`);
  return result.allowed ? null : tooManyRequests(result.retryAfterMs);
}

/** Rate-limit the read-only status endpoint (higher budget than writes so
 * polling stays usable). Returns a 429 response when over budget, else null. */
export function enforceStatusRateLimit(request: Request): NextResponse | null {
  const result = statusLimiter.check(`status:${clientIp(request)}`);
  return result.allowed ? null : tooManyRequests(result.retryAfterMs);
}

/** Rate-limit create_order (operator-fee abuse guard). Tighter than the generic
 * write budget because each call can trigger operator-signed on-chain writes.
 * Returns a 429 response when over budget, else null. */
export function enforceCreateOrderRateLimit(
  request: Request,
): NextResponse | null {
  const result = createOrderLimiter.check(`create-order:${clientIp(request)}`);
  return result.allowed ? null : tooManyRequests(result.retryAfterMs);
}

/** Rate-limit order creation from a checkout link (junk-order spam guard).
 * Returns a 429 response when over budget, else null. */
export function enforceOrderCreateRateLimit(
  request: Request,
): NextResponse | null {
  const result = orderCreateLimiter.check(`order-create:${clientIp(request)}`);
  return result.allowed ? null : tooManyRequests(result.retryAfterMs);
}

// Seller onboarding routes (profile/wallets/challenge/verify/primary): one
// modest shared per-IP budget — low-frequency, interactive traffic.
const sellerLimiter: RateLimiter = createInMemoryRateLimiter({
  limit: 30,
  windowMs: 60_000,
});

/** Rate-limit the seller onboarding routes. Returns a 429 response when over
 * budget, else null. */
export function enforceSellerRateLimit(request: Request): NextResponse | null {
  const result = sellerLimiter.check(`seller:${clientIp(request)}`);
  return result.allowed ? null : tooManyRequests(result.retryAfterMs);
}

/** Rate-limit checkout-token issuance (order_no enumeration guard). Returns a
 * 429 response when over budget, else null. */
export function enforceCheckoutIssueRateLimit(
  request: Request,
): NextResponse | null {
  const result = checkoutIssueLimiter.check(
    `checkout-issue:${clientIp(request)}`,
  );
  return result.allowed ? null : tooManyRequests(result.retryAfterMs);
}

// Buyer confirm-received / release (RELEASE-1): each confirm can trigger an
// operator-signed on-chain release, so it gets the tightest budget; the
// challenge route doubles as the order_no probe surface, so it stays tight too.
const confirmReceivedLimiter: RateLimiter = createInMemoryRateLimiter({
  limit: 10,
  windowMs: 60_000,
});

/** Rate-limit confirm-received challenge + confirm routes. Returns a 429
 * response when over budget, else null. */
export function enforceConfirmReceivedRateLimit(
  request: Request,
): NextResponse | null {
  const result = confirmReceivedLimiter.check(
    `confirm-received:${clientIp(request)}`,
  );
  return result.allowed ? null : tooManyRequests(result.retryAfterMs);
}
