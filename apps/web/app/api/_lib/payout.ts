// Server-only seller payout-methods wiring: SERVICE-ROLE payout store.
// Config only — no escrow gateway, no money movement.
import "server-only";
import { getServiceClient } from "@trustip/database";
import {
  createSupabasePayoutStore,
  type PayoutMethodDeps,
} from "@trustip/payments";

export function getPayoutDeps(): PayoutMethodDeps {
  return {
    store: createSupabasePayoutStore(getServiceClient()),
  };
}
