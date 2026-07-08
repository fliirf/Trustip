-- =============================================================================
-- Trustip v1.1 — Atomic escrow release confirmation RPC (RELEASE-1)
-- Mirror of confirm_funded_payment: records a CHAIN-VERIFIED release in a
-- single transaction so a crash can never leave escrow=released while the
-- order lags (or vice versa):
--   escrows                 -> released   (guarded: only from funded)
--   orders                  -> completed  (guarded: only from delivered)
--   blockchain_transactions -> escrow_release, confirmed (idempotent on tx_hash)
--   escrow_events(release)  -> inserted idempotently (unique tx_hash)
--   order_status_events     -> system 'completed' row (only when newly applied)
--
-- Idempotent on tx hash: a repeat/heal call with the same release tx is a
-- no-op returning FALSE. Any other state (not funded and not already released
-- by THIS tx, or order not delivered/completed) raises, rolling back all
-- writes. payments is never touched — it stays confirmed.
--
-- SECURITY: security definer + locked search_path; EXECUTE granted to
-- service_role ONLY. The caller is trusted to have already verified on-chain
-- truth (get_order == Released) before invoking this.
-- =============================================================================

create or replace function public.confirm_released_payment(
  p_order_id      uuid,
  p_escrow_id     uuid,
  p_tx_hash       text,
  p_ledger        bigint,
  p_to_public_key text,
  p_amount_usdc   numeric,
  p_network       network
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_applied boolean;
begin
  update escrows
     set status = 'released', released_at = now(), release_tx_hash = p_tx_hash
   where id = p_escrow_id
     and status = 'funded';
  v_applied := found;

  if not v_applied then
    -- Only a heal/repeat of the SAME release tx is a legal no-op.
    perform 1 from escrows
      where id = p_escrow_id
        and status = 'released'
        and release_tx_hash = p_tx_hash;
    if not found then
      raise exception 'escrow % is not releasable', p_escrow_id;
    end if;
  end if;

  update orders
     set status = 'completed', completed_at = now()
   where id = p_order_id
     and status = 'delivered';

  -- After the guarded update the order must be completed (fresh or healed).
  perform 1 from orders where id = p_order_id and status = 'completed';
  if not found then
    raise exception 'order % is not in a completable state', p_order_id;
  end if;

  insert into blockchain_transactions (
    order_id, escrow_id, tx_hash, tx_type, network, status, ledger,
    destination_account, amount, asset_code, confirmed_at
  )
  values (
    p_order_id, p_escrow_id, p_tx_hash, 'escrow_release', p_network,
    'confirmed', p_ledger, p_to_public_key, p_amount_usdc, 'USDC', now()
  )
  on conflict (tx_hash) do update
    set status = 'confirmed', confirmed_at = now(), ledger = p_ledger;

  insert into escrow_events (
    escrow_id, event_type, tx_hash, ledger, to_public_key, amount_usdc
  )
  values (
    p_escrow_id, 'release', p_tx_hash, p_ledger, p_to_public_key, p_amount_usdc
  )
  on conflict (tx_hash) where tx_hash is not null do nothing;

  if v_applied then
    insert into order_status_events (order_id, status, actor_type, metadata)
    values (
      p_order_id, 'completed', 'system',
      jsonb_build_object('releaseTxHash', p_tx_hash)
    );
  end if;

  return v_applied;
end;
$$;

-- Restrict execution to the backend service role only.
revoke all on function public.confirm_released_payment(
  uuid, uuid, text, bigint, text, numeric, network
) from public, anon, authenticated;

grant execute on function public.confirm_released_payment(
  uuid, uuid, text, bigint, text, numeric, network
) to service_role;
