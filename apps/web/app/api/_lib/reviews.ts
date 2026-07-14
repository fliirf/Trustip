// Server-only Trust Profile & Reviews wiring: SERVICE-ROLE review store.
// Reviews/trust tables carry no client DML grants, so this adapter (behind the
// guarded service) is the only write path. No escrow gateway — reviews never
// touch money.
import "server-only";
import { getServiceClient } from "@trustip/database";
import { createSupabaseReviewStore, type ReviewDeps } from "@trustip/payments";

export function getReviewDeps(): ReviewDeps {
  return {
    store: createSupabaseReviewStore(getServiceClient()),
  };
}
