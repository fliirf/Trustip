// Server-only REFUND-1/REFUND-2 wiring: SERVICE-ROLE refund store + live escrow
// gateway (operator signer stays server-side and fail-closed on mainnet).
import "server-only";
import { getServiceClient } from "@trustip/database";
import { createSupabaseRefundStore, type RefundDeps } from "@trustip/payments";
import { createEscrowGateway, networkName } from "@trustip/stellar";

export function getRefundDeps(): RefundDeps {
  return {
    store: createSupabaseRefundStore(getServiceClient()),
    gateway: createEscrowGateway(),
    config: {
      networkName: networkName(),
    },
  };
}
