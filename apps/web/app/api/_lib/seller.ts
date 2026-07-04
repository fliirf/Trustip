// Server-only seller-onboarding wiring: SERVICE-ROLE store + challenge secret.
// Authenticated clients hold no DML grants on users/seller_profiles/
// user_wallets — these routes are the only write path, so verified_at and
// is_primary can never be set from the browser.
import "server-only";
import { getWalletChallengeSecret } from "@trustip/config";
import { getServiceClient } from "@trustip/database";
import { createSupabaseSellerStore, type SellerDeps } from "@trustip/payments";
import { currentNetwork, networkName } from "@trustip/stellar";

export function getSellerDeps(): SellerDeps {
  return {
    store: createSupabaseSellerStore(getServiceClient()),
    config: {
      networkName: networkName(),
      networkPassphrase: currentNetwork.networkPassphrase,
      walletChallengeSecret: getWalletChallengeSecret(),
    },
  };
}
