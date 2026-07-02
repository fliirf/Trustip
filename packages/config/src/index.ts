export const STELLAR_NETWORK =
  process.env.NEXT_PUBLIC_STELLAR_NETWORK ||
  process.env.STELLAR_NETWORK ||
  "testnet";

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
  rpcUrl: "https://soroban-testnet.stellar.org",
  horizonUrl: "https://horizon-testnet.stellar.org",
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
    rpcUrl: process.env.STELLAR_RPC_URL || "https://mainnet.sorobanrpc.com",
    horizonUrl: "https://horizon.stellar.org",
    usdcAssetCode: "USDC",
    usdcIssuer: requiredEnv("NEXT_PUBLIC_USDC_ISSUER"),
  };
}

export function getNetworkConfig(
  network: string = STELLAR_NETWORK,
): NetworkConfig {
  return network === "mainnet" ? getMainnetConfig() : TESTNET;
}

export const currentNetwork: NetworkConfig = getNetworkConfig();

/** Return the first defined env var among `names`, or undefined. */
function envAny(...names: string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name];
    if (value) return value;
  }
  return undefined;
}

/**
 * Deployed Soroban escrow contract id for the active network. Never hardcode
 * this in UI — it is supplied per-network via env (deploy script sets it).
 */
export function getEscrowContractId(): string {
  const value = envAny(
    "NEXT_PUBLIC_SOROBAN_ESCROW_CONTRACT_ID",
    "SOROBAN_ESCROW_CONTRACT_ID",
  );
  if (!value) {
    throw new Error(
      "Missing escrow contract id: set NEXT_PUBLIC_SOROBAN_ESCROW_CONTRACT_ID (or SOROBAN_ESCROW_CONTRACT_ID)",
    );
  }
  return value;
}

/** USDC token (Stellar Asset Contract) id for the active network. */
export function getUsdcContractId(): string {
  const value = envAny("NEXT_PUBLIC_USDC_CONTRACT_ID");
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
  return envAny("TRUSTIP_OPERATOR_SECRET_KEY", "STELLAR_OPERATOR_SECRET_KEY");
}

/**
 * SERVER-ONLY HMAC secret for signing short-lived checkout / create-order
 * authorization tokens (POST /api/escrows/create-order). Deliberately NOT a
 * NEXT_PUBLIC var. Returns undefined when unset — in that case the guest
 * (token) path fails closed and only an authenticated order owner (or admin)
 * may trigger operator-signed create_order. Never logged or returned to clients.
 */
export function getCheckoutTokenSecret(): string | undefined {
  return envAny("TRUSTIP_CHECKOUT_TOKEN_SECRET");
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
