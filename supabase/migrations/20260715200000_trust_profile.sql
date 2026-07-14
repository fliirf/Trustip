-- =============================================================================
-- Trustip v1.1 — Trust Profile recompute RPC (Trust Profile & Reviews)
--
-- A seller's trust_profiles row is FULLY DERIVED from orders + reviews. This RPC
-- recomputes it from scratch and appends a trust_events audit row, in one
-- transaction. Because it is a pure recompute (not an increment), it is
-- idempotent and safe to re-run at any time — a crash between a money move and
-- the recompute self-heals on the next trigger. It is called after:
--   order completed   (release.ts)   -> order_completed
--   refund approved   (refund.ts)    -> order_refunded
--   review submitted  (reviews.ts)   -> review_received
--
-- The score/level formula is APPLICATION POLICY, deliberately simple and kept
-- here so the recompute is race-free (counts + upsert in one statement).
--   -- ponytail: tunable — adjust weights/bands in one place, no code change.
--
-- SECURITY: security definer + locked search_path; EXECUTE granted to
-- service_role ONLY. Reads/writes only derived reputation data — never money.
-- =============================================================================

create or replace function public.recompute_trust_profile(
  p_order_id   uuid,
  p_event_type trust_event_type
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seller_profile_id uuid;
  v_completed         integer;
  v_refunded          integer;
  v_cancelled         integer;
  v_total_orders      integer;
  v_total_reviews     integer;
  v_avg_rating        numeric(3,2);
  v_refund_rate       numeric(5,2);
  v_trust_score       numeric(6,2);
  v_old_score         numeric(6,2);
  v_old_level         trust_level;
  v_level             trust_level;
  v_profile_id        uuid;
begin
  select seller_profile_id into v_seller_profile_id
    from orders where id = p_order_id;
  if v_seller_profile_id is null then
    return;  -- unknown order: nothing to recompute
  end if;

  -- Settled order outcomes for this seller.
  select
    count(*) filter (where status = 'completed'),
    count(*) filter (where status = 'refunded'),
    count(*) filter (where status = 'cancelled')
  into v_completed, v_refunded, v_cancelled
  from orders
  where seller_profile_id = v_seller_profile_id;

  v_total_orders := v_completed + v_refunded + v_cancelled;

  -- Review aggregates.
  select count(*), coalesce(round(avg(rating), 2), 0)
  into v_total_reviews, v_avg_rating
  from reviews
  where seller_profile_id = v_seller_profile_id;

  -- Derived metrics — ponytail: tunable formula. A cancel is not counted as a
  -- seller failure, so refund_rate is refunded / (completed + refunded).
  v_refund_rate := round(
    v_refunded::numeric / greatest(v_completed + v_refunded, 1) * 100, 2);
  v_trust_score := least(9999.99, greatest(0,
    v_completed * 10
    + v_total_reviews * v_avg_rating * 2
    - v_refunded * 20))::numeric(6,2);

  -- Existing row: needed for the score delta and to keep 'restricted' sticky.
  select trust_score, level
    into v_old_score, v_old_level
    from trust_profiles where seller_profile_id = v_seller_profile_id;

  -- Level bands — ponytail: tunable. 'restricted' is admin-set (out of scope
  -- here) and must never be recomputed away by ordinary activity.
  if v_old_level = 'restricted' then
    v_level := 'restricted';
  elsif v_completed = 0 then
    v_level := 'new';
  elsif v_completed >= 20 and v_refund_rate <= 10 and v_avg_rating >= 4.5 then
    v_level := 'gold';
  elsif v_completed >= 5 and v_refund_rate <= 15 then
    v_level := 'silver';
  else
    v_level := 'bronze';
  end if;

  insert into trust_profiles (
    seller_profile_id, total_orders, completed_orders, refunded_orders,
    cancelled_orders, total_reviews, average_rating, refund_rate,
    trust_score, level, updated_at
  )
  values (
    v_seller_profile_id, v_total_orders, v_completed, v_refunded,
    v_cancelled, v_total_reviews, v_avg_rating, v_refund_rate,
    v_trust_score, v_level, now()
  )
  on conflict (seller_profile_id) do update set
    total_orders     = excluded.total_orders,
    completed_orders = excluded.completed_orders,
    refunded_orders  = excluded.refunded_orders,
    cancelled_orders = excluded.cancelled_orders,
    total_reviews    = excluded.total_reviews,
    average_rating   = excluded.average_rating,
    refund_rate      = excluded.refund_rate,
    trust_score      = excluded.trust_score,
    level            = excluded.level,
    updated_at       = now()
  returning id into v_profile_id;

  insert into trust_events (
    trust_profile_id, order_id, event_type, score_delta, metadata
  )
  values (
    v_profile_id, p_order_id, p_event_type,
    v_trust_score - coalesce(v_old_score, 0),
    jsonb_build_object(
      'completedOrders', v_completed,
      'refundedOrders', v_refunded,
      'totalReviews', v_total_reviews,
      'averageRating', v_avg_rating,
      'trustScore', v_trust_score,
      'level', v_level
    )
  );
end;
$$;

-- Restrict execution to the backend service role only.
revoke all on function public.recompute_trust_profile(uuid, trust_event_type)
  from public, anon, authenticated;

grant execute on function public.recompute_trust_profile(uuid, trust_event_type)
  to service_role;
