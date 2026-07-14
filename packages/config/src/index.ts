export type StellarNetwork = "testnet" | "mainnet";

const DEFAULT_NETWORK: StellarNetwork = "testnet";

// Browser bundles can only read NEXT_PUBLIC_*. Node workers use
// STELLAR_NETWORK. Production validation requires both values and rejects a
// mismatch before build/start.
export const STELLAR_NETWORK =
  (typeof window === "undefined"
    ? (process.env.STELLAR_NETWORK ?? process.env.NEXT_PUBLIC_STELLAR_NETWORK)
    : process.env.NEXT_PUBLIC_STELLAR_NETWORK) ?? DEFAULT_NETWORK;

// Production-hardening utilities (Phase 19). Edge-safe, no Node builtins.
export * from "./logger.js";
export * from "./request-context.js";
export * from "./rate-limit-store.js";
export * from "./validate.js";

/**
 * Read a required environment variable. Throws if it is missing so that
 * misconfiguration fails loudly instead of silently falling back to a wrong
 * (and potentially unsafe) production value.
 */
export function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export interface NetworkConfig {
  networkPassphrase: string;
  rpcUrl: string;
  horizonUrl: string;
  usdcAssetCode: string;
  usdcIssuer: string;
}

const TESTNET: NetworkConfig = {
  networkPassphrase: "Test SDF Network ; September 2015",
  rpcUrl:
    process.env.NEXT_PUBLIC_STELLAR_RPC_URL ||
    "https://soroban-testnet.stellar.org",
  horizonUrl:
    process.env.NEXT_PUBLIC_STELLAR_HORIZON_URL ||
    "https://horizon-testnet.stellar.org",
  usdcAssetCode: "USDC",
  // Circle USDC testnet issuer (checksum-validated). Verify against
  // https://developers.circle.com/stablecoins/usdc-on-testing-networks
  usdcIssuer:
    process.env.NEXT_PUBLIC_USDC_ISSUER ||
    "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
};

/**
 * Mainnet config is resolved lazily. The USDC issuer has no hardcoded fallback:
 * it MUST be supplied via NEXT_PUBLIC_USDC_ISSUER so we never silently target a
 * wrong asset on mainnet.
 */
function getMainnetConfig(): NetworkConfig {
  return {
    networkPassphrase: "Public Global Stellar Network ; September 2015",
    // SDF does not operate a public Mainnet RPC. Production validation requires
    // an explicitly selected provider; an empty value fails closed at use.
    rpcUrl: process.env.NEXT_PUBLIC_STELLAR_RPC_URL || "",
    horizonUrl:
      process.env.NEXT_PUBLIC_STELLAR_HORIZON_URL ||
      "https://horizon.stellar.org",
    usdcAssetCode: "USDC",
    usdcIssuer: requiredEnv("NEXT_PUBLIC_USDC_ISSUER"),
  };
}

export function getNetworkConfig(
  network: string = STELLAR_NETWORK,
): NetworkConfig {
  if (network === "mainnet") return getMainnetConfig();
  if (network === "testnet") return TESTNET;
  throw new Error("Invalid Stellar network: expected testnet or mainnet");
}

export const currentNetwork: NetworkConfig = getNetworkConfig();

/**
 * Deployed Soroban escrow contract id for the active network. Never hardcode
 * this in UI — it is supplied per-network via env (deploy script sets it).
 */
export function getEscrowContractId(): string {
  const value = process.env.NEXT_PUBLIC_SOROBAN_ESCROW_CONTRACT_ID;
  if (!value) {
    throw new Error(
      "Missing escrow contract id: set NEXT_PUBLIC_SOROBAN_ESCROW_CONTRACT_ID",
    );
  }
  return value;
}

/** USDC token (Stellar Asset Contract) id for the active network. */
export function getUsdcContractId(): string {
  const value = process.env.NEXT_PUBLIC_USDC_CONTRACT_ID;
  if (!value) {
    throw new Error(
      "Missing USDC contract id: set NEXT_PUBLIC_USDC_CONTRACT_ID",
    );
  }
  return value;
}

/**
 * SERVER-ONLY admin/operator secret seed used to sign escrow `create_order`
 * (and future admin actions). Deliberately NOT a NEXT_PUBLIC var, so it is never
 * inlined into a client bundle. Returns undefined when unset — callers must fail
 * closed. The value is never logged or returned to clients.
 */
export function getOperatorSecretKey(): string | undefined {
  return process.env.TRUSTIP_OPERATOR_SECRET_KEY;
}

/**
 * SERVER-ONLY HMAC secret for signing short-lived checkout / create-order
 * authorization tokens (POST /api/escrows/create-order). Deliberately NOT a
 * NEXT_PUBLIC var. Returns undefined when unset — in that case the guest
 * (token) path fails closed and only an authenticated order owner (or admin)
 * may trigger operator-signed create_order. Never logged or returned to clients.
 */
export function getCheckoutTokenSecret(): string | undefined {
  return process.env.TRUSTIP_CHECKOUT_TOKEN_SECRET;
}

/**
 * SERVER-ONLY HMAC secret for signing short-lived seller wallet-ownership
 * challenge tokens (POST /api/seller/wallets/challenge → verify). Deliberately
 * NOT a NEXT_PUBLIC var. Returns undefined when unset — challenge issuance and
 * verification then fail closed and `verified_at` can never be set. Never
 * logged or returned to clients.
 */
export function getWalletChallengeSecret(): string | undefined {
  return process.env.TRUSTIP_WALLET_CHALLENGE_SECRET;
}

/**
 * SERVER-ONLY secret for signing SEP-10 session JWTs (POST /api/auth). NOT a
 * NEXT_PUBLIC var. Returns undefined when unset — the web-auth endpoint then
 * fails closed (no token is issued). Never logged or returned to clients.
 */
export function getSep10JwtSecret(): string | undefined {
  return process.env.TRUSTIP_SEP10_JWT_SECRET;
}

/**
 * Domain hosting stellar.toml + serving SEP-10 web-auth (the `home_domain` /
 * `web_auth_domain`). Derived from NEXT_PUBLIC_APP_URL's host so it matches the
 * deployed origin; localhost fallback for dev.
 */
export function getHomeDomain(): string {
  try {
    return new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000")
      .host;
  } catch {
    return "localhost:3000";
  }
}

/**
 * Whether an env-secret operator signer is explicitly permitted on mainnet.
 * Defaults to false: on mainnet the env-key signer is refused unless an approved
 * signer strategy is deliberately enabled (e.g. after wiring KMS/multisig).
 */
export function isMainnetOperatorAllowed(): boolean {
  return (
    (process.env.TRUSTIP_ALLOW_MAINNET_OPERATOR || "").toLowerCase() === "true"
  );
}
