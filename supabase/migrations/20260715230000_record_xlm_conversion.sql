-- =============================================================================
-- Trustip v1.1 — record a seller USDC->XLM conversion (XLM_WALLET route exec)
--
-- The seller converts a completed DIRECT payout's USDC into XLM by signing a
-- strict-send path payment themselves (the operator never touches it). This RPC
-- records that conversion as a SECOND payout_request on the same order
-- (route_type=xlm_wallet, release_mode=guided_offramp, status=completed) plus a
-- path_payment payout_transaction. The direct USDC payout row is left as-is —
-- the two together tell the true story (received USDC, then converted to XLM).
--
-- Idempotent on idempotency_key ('convert:<source_payout_id>') and on tx_hash.
-- amount_usdc = USDC sent; target_asset_code/target_amount_estimate = the XLM.
--
-- SECURITY: security definer + locked search_path; EXECUTE service_role only.
-- Records ledger rows only; moves no money (the seller's signed tx did that).
-- =============================================================================

create or replace function public.record_xlm_conversion(
  p_source_payout_id uuid,
  p_tx_hash          text,
  p_send_usdc        numeric,
  p_recv_xlm         numeric,
  p_network          payout_transaction_network
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order    uuid;
  v_escrow   uuid;
  v_seller   uuid;
  v_key      text := 'convert:' || p_source_payout_id::text;
  v_payout   uuid;
begin
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
    v_order, v_escrow, v_seller, 'xlm_wallet', 'completed', p_send_usdc,
    'XLM', p_recv_xlm, 'guided_offramp', v_key, now(), now(), now()
  )
  on conflict (idempotency_key) do nothing
  returning id into v_payout;

  if v_payout is null then
    select id into v_payout from payout_requests where idempotency_key = v_key;
  end if;

  insert into payout_transactions (
    payout_request_id, transaction_type, network, asset_code, amount, tx_hash, status
  )
  values (
    v_payout, 'path_payment', p_network, 'XLM', p_recv_xlm, p_tx_hash, 'confirmed'
  )
  on conflict (tx_hash) where tx_hash is not null do nothing;
end;
$$;

revoke all on function public.record_xlm_conversion(
  uuid, text, numeric, numeric, payout_transaction_network
) from public, anon, authenticated;

grant execute on function public.record_xlm_conversion(
  uuid, text, numeric, numeric, payout_transaction_network
) to service_role;
