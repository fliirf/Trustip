import { currentNetwork, type NetworkConfig } from "./network.js";

/** Whether an account can RECEIVE the configured USDC asset. */
export interface UsdcReceiveReadiness {
  /** Account exists (is funded) on the network. */
  accountExists: boolean;
  /** Account holds a trustline to the configured USDC asset (code+issuer). */
  usdcTrustline: boolean;
}

/**
 * Probe whether `publicKey` can receive the configured USDC on the active
 * network: the account must exist AND hold a trustline to USDC:{issuer}.
 * Classic trustlines back the Stellar Asset Contract, so a Horizon
 * `/accounts` balances read is the source of truth for "can receive USDC".
 *
 * A missing account is a normal answer (accountExists=false), not an error.
 * Any other Horizon failure throws — callers decide fail-open/closed.
 */
export async function checkUsdcReceiveReadiness(
  publicKey: string,
  cfg: NetworkConfig = currentNetwork,
  fetchImpl: typeof fetch = fetch,
): Promise<UsdcReceiveReadiness> {
  const res = await fetchImpl(
    `${cfg.horizonUrl}/accounts/${encodeURIComponent(publicKey)}`,
    { headers: { accept: "application/json" } },
  );
  if (res.status === 404) {
    return { accountExists: false, usdcTrustline: false };
  }
  if (!res.ok) {
    throw new Error(`horizon account lookup failed (${res.status})`);
  }
  const body = (await res.json()) as { balances?: unknown };
  const balances = Array.isArray(body.balances) ? body.balances : [];
  const usdcTrustline = balances.some((b) => {
    const bal = b as { asset_code?: unknown; asset_issuer?: unknown };
    return (
      bal.asset_code === cfg.usdcAssetCode &&
      bal.asset_issuer === cfg.usdcIssuer
    );
  });
  return { accountExists: true, usdcTrustline };
}
