// Build-time guard: this module wires the SERVICE-ROLE Supabase client and must
// never be bundled into client code. `server-only` fails the build if it is ever
// imported from a Client Component. (Kept to the Next route layer — the
// @trustip/payments package itself stays framework-agnostic for workers/tests.)
import "server-only";
import { getEscrowContractId } from "@trustip/config";
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
