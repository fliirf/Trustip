// Server-only RELEASE-1 wiring: SERVICE-ROLE release store + live escrow
// gateway (operator signer stays server-side and fail-closed on mainnet) +
// the wallet-challenge secret for buyer confirm-received proofs.
import "server-only";
import { getWalletChallengeSecret } from "@trustip/config";
import { getServiceClient } from "@trustip/database";
import {
  createSupabaseReleaseStore,
  type ReleaseDeps,
} from "@trustip/payments";
import {
  createEscrowGateway,
  currentNetwork,
  networkName,
} from "@trustip/stellar";

export function getReleaseDeps(): ReleaseDeps {
  return {
    store: createSupabaseReleaseStore(getServiceClient()),
    gateway: createEscrowGateway(),
    config: {
      networkPassphrase: currentNetwork.networkPassphrase,
      networkName: networkName(),
      walletChallengeSecret: getWalletChallengeSecret(),
    },
  };
}
