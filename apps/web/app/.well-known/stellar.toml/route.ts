import {
  currentNetwork,
  getSep10JwtSecret,
  getUsdcContractId,
} from "@trustip/config";
import { getOperatorPublicKey } from "@trustip/stellar";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * SEP-1 — stellar.toml (Roadmap A1 + A2).
 * Published at /.well-known/stellar.toml so Stellar wallets, anchors, and
 * explorers can discover Trustip's on-chain identity. Derived entirely from
 * config so it never drifts from the deployed network / asset. Served as
 * text/plain with `Access-Control-Allow-Origin: *` (SEP-1 REQUIRES CORS so
 * cross-origin clients can fetch it).
 *
 * Declares only what exists: network + org + USDC currency (A1), and — when the
 * operator key + SEP-10 JWT secret are configured — the SIGNING_KEY and
 * WEB_AUTH_ENDPOINT for SEP-10 Web-Auth (A2). Both A2 fields are emitted
 * together so the toml never advertises an auth endpoint without a signing key
 * (or vice-versa).
 */

const ORG_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

function buildStellarToml(): string {
  const lines: string[] = [
    'VERSION="2.0.0"',
    `NETWORK_PASSPHRASE="${currentNetwork.networkPassphrase}"`,
  ];

  // SEP-10 Web-Auth (A2): only advertised when both the signing account and the
  // JWT secret are configured, i.e. the /api/auth endpoint can actually issue
  // tokens. Otherwise omit both so no client tries a dead endpoint.
  const signingKey = getOperatorPublicKey();
  if (signingKey && getSep10JwtSecret()) {
    lines.push(`SIGNING_KEY="${signingKey}"`);
    lines.push(`WEB_AUTH_ENDPOINT="${ORG_URL}/api/auth"`);
  }

  lines.push(
    "",
    "[DOCUMENTATION]",
    'ORG_NAME="Trustip"',
    `ORG_URL="${ORG_URL}"`,
    'ORG_DESCRIPTION="Protected USDC checkout for social commerce. Buyer payments are held in a Soroban escrow and released to the seller only after the order is received."',
  );

  // USDC — the asset Trustip accepts. Trustip does NOT issue it
  // (is_asset_anchored = false); the issuer is Circle's USDC. The SAC contract
  // id is included when configured. Declaration/transparency, not an anchoring
  // claim.
  const currency: string[] = [
    "",
    "[[CURRENCIES]]",
    `code="${currentNetwork.usdcAssetCode}"`,
    `issuer="${currentNetwork.usdcIssuer}"`,
  ];
  try {
    currency.push(`contract="${getUsdcContractId()}"`);
  } catch {
    // USDC SAC id not configured — omit the optional contract field.
  }
  currency.push(
    'status="live"',
    "is_asset_anchored=false",
    "display_decimals=7",
    'name="USD Coin"',
    'desc="USDC on Stellar, used to pay for protected checkouts. Trustip does not issue this asset."',
  );
  lines.push(...currency);

  return lines.join("\n") + "\n";
}

export function GET(): NextResponse {
  return new NextResponse(buildStellarToml(), {
    status: 200,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      // SEP-1 requires the toml be fetchable cross-origin.
      "access-control-allow-origin": "*",
      "cache-control": "public, max-age=3600",
    },
  });
}
