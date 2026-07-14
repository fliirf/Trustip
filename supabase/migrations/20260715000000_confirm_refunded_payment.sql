-- =============================================================================
-- Trustip v1.1 — Atomic escrow refund confirmation RPC (REFUND-2)
-- Mirror of confirm_released_payment: records a CHAIN-VERIFIED refund in a
-- single transaction so a crash can never leave escrow=refunded while the
-- order or the refund request lags:
--   escrows                 -> refunded  (guarded: only from funded)
--   orders                  -> refunded  (guarded: only from a non-terminal state)
--   refund_requests         -> completed, decision refund_buyer, resolved_at
--   blockchain_transactions -> escrow_refund, confirmed (idempotent on tx_hash)
--   escrow_events(refund)   -> inserted idempotently (unique tx_hash)
--   order_status_events     -> system 'refunded' row (only when newly applied)
--
-- Idempotent on tx hash: a repeat/heal call with the same refund tx is a
-- no-op returning FALSE. Any other state raises, rolling back all writes.
-- payments -> refunded (guarded: only from confirmed).
--
-- SECURITY: security definer + locked search_path; EXECUTE granted to
-- service_role ONLY. The caller is trusted to have already verified on-chain
-- truth (get_order == Refunded) before invoking this.
-- =============================================================================

create or replace function public.confirm_refunded_payment(
  p_order_id          uuid,
  p_escrow_id         uuid,
  p_refund_request_id uuid,
  p_tx_hash           text,
  p_ledger            bigint,
  p_to_public_key     text,
  p_amount_usdc       numeric,
  p_network           network
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
     set status = 'refunded', refunded_at = now(), refund_tx_hash = p_tx_hash
   where id = p_escrow_id
     and status = 'funded';
  v_applied := found;

  if not v_applied then
    -- Only a heal/repeat of the SAME refund tx is a legal no-op.
    perform 1 from escrows
      where id = p_escrow_id
        and status = 'refunded'
        and refund_tx_hash = p_tx_hash;
    if not found then
      raise exception 'escrow % is not refundable', p_escrow_id;
    end if;
  end if;

  -- Any non-terminal order state may move to refunded (a refund can be granted
  -- before or after shipment). Terminal states other than refunded raise.
  update orders
     set status = 'refunded'
   where id = p_order_id
     and status not in ('completed', 'refunded', 'cancelled', 'failed');

  perform 1 from orders where id = p_order_id and status = 'refunded';
  if not found then
    raise exception 'order % is not in a refundable state', p_order_id;
  end if;

  update payments
     set status = 'refunded'
   where order_id = p_order_id
     and status = 'confirmed';

  update refund_requests
     set status = 'completed', decision = 'refund_buyer', resolved_at = now()
   where id = p_refund_request_id
     and status in ('submitted', 'under_review', 'seller_response_needed',
                    'approved');

  perform 1 from refund_requests
    where id = p_refund_request_id and status = 'completed';
  if not found then
    raise exception 'refund request % is not completable', p_refund_request_id;
  end if;

  insert into blockchain_transactions (
    order_id, escrow_id, tx_hash, tx_type, network, status, ledger,
    destination_account, amount, asset_code, confirmed_at
  )
  values (
    p_order_id, p_escrow_id, p_tx_hash, 'escrow_refund', p_network,
    'confirmed', p_ledger, p_to_public_key, p_amount_usdc, 'USDC', now()
  )
  on conflict (tx_hash) do update
    set status = 'confirmed', confirmed_at = now(), ledger = p_ledger;

  insert into escrow_events (
    escrow_id, event_type, tx_hash, ledger, to_public_key, amount_usdc
  )
  values (
    p_escrow_id, 'refund', p_tx_hash, p_ledger, p_to_public_key, p_amount_usdc
  )
  on conflict (tx_hash) where tx_hash is not null do nothing;

  if v_applied then
    insert into order_status_events (order_id, status, actor_type, metadata)
    values (
      p_order_id, 'refunded', 'admin',
      jsonb_build_object('refundTxHash', p_tx_hash)
    );
  end if;

  return v_applied;
end;
$$;

-- Restrict execution to the backend service role only.
revoke all on function public.confirm_refunded_payment(
  uuid, uuid, uuid, text, bigint, text, numeric, network
) from public, anon, authenticated;

grant execute on function public.confirm_refunded_payment(
  uuid, uuid, uuid, text, bigint, text, numeric, network
) to service_role;
