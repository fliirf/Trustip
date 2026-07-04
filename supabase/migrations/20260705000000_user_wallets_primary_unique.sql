-- =============================================================================
-- Trustip v1.1 — single primary wallet per (user, network) (Phase 7B-1)
--
-- WHY: escrow creation derives the seller's on-chain payout wallet from the
-- user's primary verified wallet on the configured network (Phase 6.1
-- resolveSellerWalletId). The resolver fails CLOSED when several primaries
-- exist; this partial unique index makes that ambiguous state structurally
-- impossible, so a checkout link can never go dark because of duplicate
-- primary flags.
--
-- SAFETY: no grants changed (authenticated still has NO DML on user_wallets —
-- all seller writes flow through service-role API routes), RLS untouched.
-- The pre-index cleanup demotes duplicate primaries deterministically, keeping
-- the most recently verified (then newest) wallet per user+network.
-- =============================================================================

with ranked as (
  select id,
         row_number() over (
           partition by user_id, network
           order by verified_at desc nulls last, created_at desc, id
         ) as rn
  from user_wallets
  where is_primary
)
update user_wallets w
set is_primary = false
from ranked r
where w.id = r.id and r.rn > 1;

create unique index if not exists uq_user_wallets_primary_per_network
  on user_wallets (user_id, network)
  where is_primary;
