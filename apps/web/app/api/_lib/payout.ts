// Server-only seller payout wiring: SERVICE-ROLE payout store. Payout-method
// config moves no money. The conversion deps add the classic-DEX path-payment
// gateway (the seller signs; the operator signs nothing).
import "server-only";
import { getWalletChallengeSecret } from "@trustip/config";
import { getServiceClient } from "@trustip/database";
import {
  type ConversionDeps,
  createSupabasePayoutStore,
  type PayoutMethodDeps,
} from "@trustip/payments";
import { createPathPaymentGateway, networkName } from "@trustip/stellar";

export function getPayoutDeps(): PayoutMethodDeps {
  return {
    store: createSupabasePayoutStore(getServiceClient()),
  };
}

export function getConversionDeps(): ConversionDeps {
  return {
    store: createSupabasePayoutStore(getServiceClient()),
    gateway: createPathPaymentGateway(),
    config: {
      networkName: networkName(),
      walletChallengeSecret: getWalletChallengeSecret(),
    },
  };
}
