-- =============================================================================
-- Trustip v1.1 — Atomic payment confirmation RPC (Phase 4.6 hardening)
-- Source of truth: Security & Risk Spec v1.1, Phase 4.5 audit (MEDIUM-1).
--
-- Confirms a chain-verified funded payment in a SINGLE transaction so a crash
-- can never leave payment=confirmed while escrow/order lag (or vice versa):
--   payments               -> confirmed  (guarded: only if not already confirmed)
--   escrows                -> funded     (guarded: only if not already funded)
--   orders                 -> escrow_locked (guarded: only from pre-funded states)
--   blockchain_transactions-> confirmed
--   escrow_events(fund)    -> inserted idempotently (unique tx_hash)
--
-- Idempotent: a repeat/heal call is a no-op. Returns TRUE only when THIS call
-- caused the payment to newly transition to confirmed.
--
-- SECURITY: security definer + locked search_path; EXECUTE granted to
-- service_role ONLY (called by the server-side payment backend, never clients).
-- The caller is trusted to have already verified on-chain truth (get_order ==
-- Funded, matching amount) before invoking this.
-- =============================================================================

create or replace function public.confirm_funded_payment(
  p_payment_id      uuid,
  p_order_id        uuid,
  p_escrow_id       uuid,
  p_tx_hash         text,
  p_ledger          bigint,
  p_buyer_public_key text,
  p_amount_usdc     numeric,
  p_network         network
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_applied boolean;
begin
  update payments
     set status = 'confirmed', confirmed_at = now(), ledger = p_ledger
   where id = p_payment_id
     and status <> 'confirmed';
  v_applied := found;

  update escrows
     set status = 'funded', funded_at = now(), funded_tx_hash = p_tx_hash
   where id = p_escrow_id
     and status <> 'funded';

  update orders
     set status = 'escrow_locked', paid_at = now()
   where id = p_order_id
     and status in ('awaiting_payment', 'payment_submitted', 'payment_confirmed');

  update blockchain_transactions
     set status = 'confirmed', confirmed_at = now(), ledger = p_ledger
   where tx_hash = p_tx_hash;

  insert into escrow_events (
    escrow_id, event_type, tx_hash, ledger, from_public_key, amount_usdc
  )
  values (
    p_escrow_id, 'fund', p_tx_hash, p_ledger, p_buyer_public_key, p_amount_usdc
  )
  on conflict (tx_hash) where tx_hash is not null do nothing;

  return v_applied;
end;
$$;

-- Restrict execution to the backend service role only.
revoke all on function public.confirm_funded_payment(
  uuid, uuid, uuid, text, bigint, text, numeric, network
) from public, anon, authenticated;

grant execute on function public.confirm_funded_payment(
  uuid, uuid, uuid, text, bigint, text, numeric, network
) to service_role;
