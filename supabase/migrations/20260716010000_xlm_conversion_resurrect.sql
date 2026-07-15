-- =============================================================================
-- Trustip v1.1 — fix XLM conversion re-submission after a failed attempt
--
-- 20260716000000's upsert only upgraded 'processing' -> 'completed'. A payout
-- whose first conversion attempt was marked FAILED could therefore never be
-- recorded again: the fresh attempt's 'submitted' write hit the idempotency-key
-- conflict, the WHERE clause rejected the update, and the row stayed 'failed'
-- even when the new tx confirmed — which made the context report "not
-- converted" and reopened the double-convert window through the failed path.
--
-- Now any non-completed row is updated by the incoming write (failed ->
-- processing on re-submission, with a FRESH requested_at so pending-expiry is
-- measured from the latest attempt; processing/failed -> completed on confirm).
-- 'completed' remains immutable.
-- =============================================================================

create or replace function public.record_xlm_conversion(
  p_source_payout_id uuid,
  p_tx_hash          text,
  p_send_usdc        numeric,
  p_recv_xlm         numeric,
  p_network          payout_transaction_network,
  p_status           text default 'confirmed' -- 'submitted' | 'confirmed'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order      uuid;
  v_escrow     uuid;
  v_seller     uuid;
  v_key        text := 'convert:' || p_source_payout_id::text;
  v_payout     uuid;
  v_req_status payout_status :=
    case when p_status = 'confirmed' then 'completed' else 'processing' end;
  v_completed  timestamptz :=
    case when p_status = 'confirmed' then now() else null end;
begin
  if p_status not in ('submitted', 'confirmed') then
    raise exception 'invalid conversion status %', p_status;
  end if;

  select order_id, escrow_id, seller_profile_id
    into v_order, v_escrow, v_seller
  from payout_requests
  where id = p_source_payout_id;

  if v_order is null then
    return; -- unknown source payout
  end if;

  insert into payout_requests (
    order_id, escrow_id, seller_profile_id, route_type, status, amount_usdc,
    target_asset_code, target_amount_estimate, release_mode, idempotency_key,
    requested_at, processed_at, completed_at
  )
  values (
    v_order, v_escrow, v_seller, 'xlm_wallet', v_req_status, p_send_usdc,
    'XLM', p_recv_xlm, 'guided_offramp', v_key, now(), now(), v_completed
  )
  on conflict (idempotency_key) do update
    set status                 = excluded.status,
        amount_usdc            = excluded.amount_usdc,
        target_amount_estimate = excluded.target_amount_estimate,
        requested_at           = excluded.requested_at,
        processed_at           = excluded.processed_at,
        completed_at           = excluded.completed_at
    -- Completed is immutable; anything else adopts the incoming write
    -- (failed -> processing resurrects a re-submission with a fresh clock).
    where payout_requests.status <> 'completed'
  returning id into v_payout;

  if v_payout is null then
    select id into v_payout from payout_requests where idempotency_key = v_key;
  end if;

  insert into payout_transactions (
    payout_request_id, transaction_type, network, asset_code, amount, tx_hash, status
  )
  values (
    v_payout, 'path_payment', p_network, 'XLM', p_recv_xlm, p_tx_hash,
    p_status::payout_transaction_status
  )
  on conflict (tx_hash) where tx_hash is not null do update
    set status = excluded.status,
        amount = excluded.amount
    where payout_transactions.status = 'submitted'
      and excluded.status = 'confirmed';
end;
$$;
