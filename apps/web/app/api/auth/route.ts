import {
  currentNetwork,
  getHomeDomain,
  getOperatorSecretKey,
  getSep10JwtSecret,
} from "@trustip/config";
import { createSep10Jwt } from "@trustip/payments";
import {
  buildSep10Challenge,
  getOperatorPublicKey,
  verifySep10Challenge,
} from "@trustip/stellar";
import {
  sep10ChallengeQuerySchema,
  sep10TokenSchema,
} from "@trustip/validators";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * SEP-10 Stellar Web Authentication (Roadmap A2).
 *   GET  /api/auth?account=G...  → server-signed challenge transaction
 *   POST /api/auth {transaction} → verifies the client signature, returns a JWT
 *
 * The server signs challenges with the operator key (published as stellar.toml
 * SIGNING_KEY) and issues a short-lived HS256 session JWT. CORS is open so any
 * standard Stellar wallet / SEP-10 client can authenticate. Fails closed (503)
 * when the operator or JWT secret is not configured.
 */

const ISSUER =
  (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000") + "/api/auth";

const CORS = { "access-control-allow-origin": "*" };

function json(status: number, body: unknown): NextResponse {
  return NextResponse.json(body, { status, headers: CORS });
}

export function OPTIONS(): NextResponse {
  return new NextResponse(null, {
    status: 204,
    headers: {
      ...CORS,
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "content-type",
    },
  });
}

export function GET(request: Request): NextResponse {
  const secret = getOperatorSecretKey();
  if (!secret) return json(503, { error: "web authentication is not configured" });

  const url = new URL(request.url);
  const parsed = sep10ChallengeQuerySchema.safeParse({
    account: url.searchParams.get("account") ?? undefined,
    home_domain: url.searchParams.get("home_domain") ?? undefined,
  });
  if (!parsed.success) return json(400, { error: "invalid or missing account" });

  const home = getHomeDomain();
  if (parsed.data.home_domain && parsed.data.home_domain !== home) {
    return json(400, { error: "unknown home_domain" });
  }

  try {
    const transaction = buildSep10Challenge({
      serverSigningSecret: secret,
      clientAccount: parsed.data.account,
      homeDomain: home,
      webAuthDomain: home,
      networkPassphrase: currentNetwork.networkPassphrase,
    });
    return json(200, {
      transaction,
      network_passphrase: currentNetwork.networkPassphrase,
    });
  } catch {
    return json(400, { error: "could not build challenge for that account" });
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const jwtSecret = getSep10JwtSecret();
  const serverAccount = getOperatorPublicKey();
  if (!jwtSecret || !serverAccount) {
    return json(503, { error: "web authentication is not configured" });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json(400, { error: "request body must be valid JSON" });
  }
  const parsed = sep10TokenSchema.safeParse(body);
  if (!parsed.success) return json(400, { error: "invalid transaction" });

  const home = getHomeDomain();
  let verified;
  try {
    verified = verifySep10Challenge({
      challengeXdr: parsed.data.transaction,
      serverAccountId: serverAccount,
      homeDomain: home,
      webAuthDomain: home,
      networkPassphrase: currentNetwork.networkPassphrase,
    });
  } catch {
    // SEP-10 uses 400 for an invalid/expired/unsigned challenge.
    return json(400, { error: "challenge validation failed" });
  }

  const token = createSep10Jwt(jwtSecret, {
    issuer: ISSUER,
    account: verified.account,
    jti: verified.jti,
  });
  return json(200, { token });
}
