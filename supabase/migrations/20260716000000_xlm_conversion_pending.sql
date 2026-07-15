-- =============================================================================
-- Trustip v1.1 — two-phase XLM conversion recording (audit fix #1/#2)
--
-- The old record_xlm_conversion only knew "confirmed", so a Horizon timeout
-- left NOTHING recorded while the signed tx could still land (5-minute
-- timebounds) — a seller retry then built a second valid tx and converted
-- twice. Now the service records the conversion as SUBMITTED (payout_request
-- status 'processing', tx status 'submitted') BEFORE the Horizon submit, and
-- confirms it (status 'completed'/'confirmed', with the CHAIN-ACTUAL received
-- XLM) after. A pending row blocks any new prepare until it is resolved
-- against Horizon (confirmed / failed / expired).
--
-- Idempotent on idempotency_key ('convert:<source_payout_id>') and tx_hash.
-- Confirm only ever upgrades (processing -> completed); never downgrades.
--
-- SECURITY: security definer + locked search_path; EXECUTE service_role only.
-- Records ledger rows only; moves no money (the seller's signed tx did that).
-- =============================================================================

drop function if exists public.record_xlm_conversion(
  uuid, text, numeric, numeric, payout_transaction_network
);

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
        target_amount_estimate = excluded.target_amount_estimate,
        completed_at           = excluded.completed_at
    -- Only upgrade a pending row to completed; never touch a completed one.
    where payout_requests.status = 'processing'
      and excluded.status = 'completed'
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

revoke all on function public.record_xlm_conversion(
  uuid, text, numeric, numeric, payout_transaction_network, text
) from public, anon, authenticated;

grant execute on function public.record_xlm_conversion(
  uuid, text, numeric, numeric, payout_transaction_network, text
) to service_role;
