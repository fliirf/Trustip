-- =============================================================================
-- Trustip v1.1 — record a DIRECT (USDC-wallet) payout at release
--
-- In Trustip's model the escrow release_to_recipient already delivers USDC
-- straight to the seller's on-chain payout wallet. So for the direct route the
-- "payout" IS the release — this RPC records that fact as a reconciliation
-- payout_request (+ its escrow_release payout_transaction) so the seller has a
-- unified payout history. It moves NO money; it only mirrors what the on-chain
-- release already did.
--
-- Called best-effort after a confirmed release (release.ts). Idempotent on a
-- deterministic idempotency_key ('release:<order_id>') and on the release tx
-- hash, so a retry/heal is a no-op. Non-direct routes (XLM convert / MoneyGram
-- cash-out) are a later execution layer and are NOT created here.
--
-- SECURITY: security definer + locked search_path; EXECUTE granted to
-- service_role ONLY. Reads order/escrow truth; writes only payout ledger rows.
-- =============================================================================

create or replace function public.record_direct_payout(
  p_order_id uuid,
  p_network  payout_transaction_network
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seller     uuid;
  v_escrow_id  uuid;
  v_status     escrow_status;
  v_tx         text;
  v_amount     numeric;
  v_key        text := 'release:' || p_order_id::text;
  v_payout_id  uuid;
begin
  select o.seller_profile_id, e.id, e.status, e.release_tx_hash, e.amount_usdc
    into v_seller, v_escrow_id, v_status, v_tx, v_amount
  from orders o
  join escrows e on e.order_id = o.id
  where o.id = p_order_id;

  -- Only a truly released escrow with a known release tx is a direct payout.
  if v_escrow_id is null or v_status <> 'released' or v_tx is null then
    return;
  end if;

  insert into payout_requests (
    order_id, escrow_id, seller_profile_id, route_type, status, amount_usdc,
    release_mode, idempotency_key, requested_at, processed_at, completed_at
  )
  values (
    p_order_id, v_escrow_id, v_seller, 'usdc_wallet', 'completed', v_amount,
    'direct_wallet', v_key, now(), now(), now()
  )
  on conflict (idempotency_key) do nothing
  returning id into v_payout_id;

  -- On conflict (already recorded) fetch the existing id so the tx row can be
  -- backfilled if it is somehow missing; both inserts are independently idempotent.
  if v_payout_id is null then
    select id into v_payout_id from payout_requests where idempotency_key = v_key;
  end if;

  insert into payout_transactions (
    payout_request_id, transaction_type, network, asset_code, amount, tx_hash, status
  )
  values (
    v_payout_id, 'escrow_release', p_network, 'USDC', v_amount, v_tx, 'confirmed'
  )
  on conflict (tx_hash) where tx_hash is not null do nothing;
end;
$$;

revoke all on function public.record_direct_payout(uuid, payout_transaction_network)
  from public, anon, authenticated;

grant execute on function public.record_direct_payout(uuid, payout_transaction_network)
  to service_role;
