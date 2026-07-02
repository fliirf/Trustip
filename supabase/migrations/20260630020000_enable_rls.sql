-- =============================================================================
-- Trustip v1.1 — Row-Level Security (Phase 1 baseline)
-- Source of truth: Security & Risk Spec v1.1 §11, ERD Spec v1.1 §11.
--
-- Posture:
--  * RLS is ENABLED on every application table (deny-by-default).
--  * `service_role` (backend/workers) BYPASSES RLS and performs all
--    money/escrow/payout/admin state changes — never the client.
--  * Client (anon/authenticated) gets ONLY the narrow, owner-scoped policies
--    below. Money-moving tables (payments, escrows, payout_*, blockchain_*,
--    admin_actions, audit_logs) have NO client write policies by design.
--  * These are baseline policies. Each feature phase must add RLS tests
--    (Testing & QA Checklist) before that surface is considered done.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Helper functions (SECURITY DEFINER → run as owner, bypass RLS, no recursion)
-- -----------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.my_seller_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.seller_profiles where user_id = auth.uid();
$$;

create or replace function public.is_order_buyer(p_order uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.orders
    where id = p_order and buyer_user_id = auth.uid()
  );
$$;

create or replace function public.is_order_seller(p_order uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.orders o
    join public.seller_profiles sp on sp.id = o.seller_profile_id
    where o.id = p_order and sp.user_id = auth.uid()
  );
$$;

create or replace function public.is_order_party(p_order uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_order_buyer(p_order) or public.is_order_seller(p_order);
$$;

-- -----------------------------------------------------------------------------
-- Enable RLS on all application tables
-- -----------------------------------------------------------------------------
alter table users                    enable row level security;
alter table user_wallets             enable row level security;
alter table seller_profiles          enable row level security;
alter table checkout_links           enable row level security;
alter table orders                   enable row level security;
alter table order_items              enable row level security;
alter table payments                 enable row level security;
alter table escrows                  enable row level security;
alter table escrow_events            enable row level security;
alter table blockchain_transactions  enable row level security;
alter table seller_payout_methods    enable row level security;
alter table payout_requests          enable row level security;
alter table payout_transactions      enable row level security;
alter table moneygram_payout_details enable row level security;
alter table order_status_events      enable row level security;
alter table shipments                enable row level security;
alter table shipment_proofs          enable row level security;
alter table refund_requests          enable row level security;
alter table refund_evidence          enable row level security;
alter table reviews                  enable row level security;
alter table trust_profiles           enable row level security;
alter table trust_events             enable row level security;
alter table binance_topup_sessions   enable row level security;
alter table admin_actions            enable row level security;
alter table notifications            enable row level security;
alter table audit_logs               enable row level security;

-- -----------------------------------------------------------------------------
-- users — read own row or admin. Profile writes go through backend/service role
-- (prevents client-side role/status escalation).
-- -----------------------------------------------------------------------------
create policy users_select_self_or_admin on users
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

-- -----------------------------------------------------------------------------
-- user_wallets — full CRUD scoped to the owner.
-- -----------------------------------------------------------------------------
create policy user_wallets_select on user_wallets
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy user_wallets_insert on user_wallets
  for insert to authenticated
  with check (user_id = auth.uid());
create policy user_wallets_update on user_wallets
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
create policy user_wallets_delete on user_wallets
  for delete to authenticated
  using (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- seller_profiles — owner read/write; admin read.
-- -----------------------------------------------------------------------------
create policy seller_profiles_select on seller_profiles
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy seller_profiles_insert on seller_profiles
  for insert to authenticated
  with check (user_id = auth.uid());
create policy seller_profiles_update on seller_profiles
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- checkout_links — public can read ACTIVE links (needed to render checkout);
-- owner/admin can read all; owner manages.
-- -----------------------------------------------------------------------------
create policy checkout_links_select_public on checkout_links
  for select to anon, authenticated
  using (
    status = 'active'
    or seller_profile_id = public.my_seller_profile_id()
    or public.is_admin()
  );
create policy checkout_links_insert on checkout_links
  for insert to authenticated
  with check (seller_profile_id = public.my_seller_profile_id());
create policy checkout_links_update on checkout_links
  for update to authenticated
  using (seller_profile_id = public.my_seller_profile_id())
  with check (seller_profile_id = public.my_seller_profile_id());
create policy checkout_links_delete on checkout_links
  for delete to authenticated
  using (seller_profile_id = public.my_seller_profile_id());

-- -----------------------------------------------------------------------------
-- orders — read for buyer/seller party or admin. NO client writes: order
-- creation and all status transitions are backend/service-role driven.
-- -----------------------------------------------------------------------------
create policy orders_select_party on orders
  for select to authenticated
  using (
    buyer_user_id = auth.uid()
    or seller_profile_id = public.my_seller_profile_id()
    or public.is_admin()
  );

-- -----------------------------------------------------------------------------
-- order_items — read for order party or admin. No client writes.
-- -----------------------------------------------------------------------------
create policy order_items_select on order_items
  for select to authenticated
  using (public.is_order_party(order_id) or public.is_admin());

-- -----------------------------------------------------------------------------
-- payments / escrows / escrow_events / blockchain_transactions
-- Read-only for the order party or admin. Writes: service role ONLY.
-- (Security spec §3: never set payment/escrow state from the client.)
-- -----------------------------------------------------------------------------
create policy payments_select on payments
  for select to authenticated
  using (public.is_order_party(order_id) or public.is_admin());

create policy escrows_select on escrows
  for select to authenticated
  using (public.is_order_party(order_id) or public.is_admin());

create policy escrow_events_select on escrow_events
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from escrows e
      where e.id = escrow_events.escrow_id and public.is_order_party(e.order_id)
    )
  );

create policy blockchain_transactions_select on blockchain_transactions
  for select to authenticated
  using (
    public.is_admin()
    or (order_id is not null and public.is_order_party(order_id))
  );

-- -----------------------------------------------------------------------------
-- seller_payout_methods — owner CRUD; admin read.
-- -----------------------------------------------------------------------------
create policy seller_payout_methods_select on seller_payout_methods
  for select to authenticated
  using (seller_profile_id = public.my_seller_profile_id() or public.is_admin());
create policy seller_payout_methods_insert on seller_payout_methods
  for insert to authenticated
  with check (seller_profile_id = public.my_seller_profile_id());
create policy seller_payout_methods_update on seller_payout_methods
  for update to authenticated
  using (seller_profile_id = public.my_seller_profile_id())
  with check (seller_profile_id = public.my_seller_profile_id());
create policy seller_payout_methods_delete on seller_payout_methods
  for delete to authenticated
  using (seller_profile_id = public.my_seller_profile_id());

-- -----------------------------------------------------------------------------
-- payout_requests / payout_transactions / moneygram_payout_details
-- Read for owning seller or admin. Writes: service role ONLY (idempotent
-- backend orchestration; MoneyGram requires manual/admin review).
-- -----------------------------------------------------------------------------
create policy payout_requests_select on payout_requests
  for select to authenticated
  using (seller_profile_id = public.my_seller_profile_id() or public.is_admin());

create policy payout_transactions_select on payout_transactions
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from payout_requests pr
      where pr.id = payout_transactions.payout_request_id
        and pr.seller_profile_id = public.my_seller_profile_id()
    )
  );

create policy moneygram_payout_details_select on moneygram_payout_details
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from payout_requests pr
      where pr.id = moneygram_payout_details.payout_request_id
        and pr.seller_profile_id = public.my_seller_profile_id()
    )
  );

-- -----------------------------------------------------------------------------
-- order_status_events — read for order party or admin. No client writes.
-- -----------------------------------------------------------------------------
create policy order_status_events_select on order_status_events
  for select to authenticated
  using (public.is_order_party(order_id) or public.is_admin());

-- -----------------------------------------------------------------------------
-- shipments / shipment_proofs — read for order party/admin; seller of the
-- order manages shipment + uploads proof. (Escrow-funded precondition is
-- enforced at the service layer.)
-- -----------------------------------------------------------------------------
create policy shipments_select on shipments
  for select to authenticated
  using (public.is_order_party(order_id) or public.is_admin());
create policy shipments_insert on shipments
  for insert to authenticated
  with check (public.is_order_seller(order_id));
create policy shipments_update on shipments
  for update to authenticated
  using (public.is_order_seller(order_id))
  with check (public.is_order_seller(order_id));

create policy shipment_proofs_select on shipment_proofs
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from shipments s
      where s.id = shipment_proofs.shipment_id and public.is_order_party(s.order_id)
    )
  );
create policy shipment_proofs_insert on shipment_proofs
  for insert to authenticated
  with check (
    uploaded_by = auth.uid()
    and exists (
      select 1 from shipments s
      where s.id = shipment_proofs.shipment_id and public.is_order_seller(s.order_id)
    )
  );

-- -----------------------------------------------------------------------------
-- refund_requests / refund_evidence
-- Buyer of the order may open a refund request; order party may add evidence.
-- Resolution/decision changes: admin via service role only (no client update).
-- Evidence is immutable to clients (no update/delete policy).
-- -----------------------------------------------------------------------------
create policy refund_requests_select on refund_requests
  for select to authenticated
  using (public.is_order_party(order_id) or public.is_admin());
create policy refund_requests_insert on refund_requests
  for insert to authenticated
  with check (buyer_user_id = auth.uid() and public.is_order_buyer(order_id));

create policy refund_evidence_select on refund_evidence
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from refund_requests rr
      where rr.id = refund_evidence.refund_request_id and public.is_order_party(rr.order_id)
    )
  );
create policy refund_evidence_insert on refund_evidence
  for insert to authenticated
  with check (
    uploaded_by = auth.uid()
    and exists (
      select 1 from refund_requests rr
      where rr.id = refund_evidence.refund_request_id and public.is_order_party(rr.order_id)
    )
  );

-- -----------------------------------------------------------------------------
-- reviews — publicly readable (trust signal). Buyer of a completed order may
-- create one (1 per order enforced by unique constraint). Completion check is
-- enforced at the service layer.
-- -----------------------------------------------------------------------------
create policy reviews_select_public on reviews
  for select to anon, authenticated
  using (true);
create policy reviews_insert on reviews
  for insert to authenticated
  with check (buyer_user_id = auth.uid() and public.is_order_buyer(order_id));

-- -----------------------------------------------------------------------------
-- trust_profiles — publicly readable (seller trust). No client writes.
-- trust_events — owning seller or admin read. No client writes.
-- -----------------------------------------------------------------------------
create policy trust_profiles_select_public on trust_profiles
  for select to anon, authenticated
  using (true);

create policy trust_events_select on trust_events
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from trust_profiles tp
      where tp.id = trust_events.trust_profile_id
        and tp.seller_profile_id = public.my_seller_profile_id()
    )
  );

-- -----------------------------------------------------------------------------
-- binance_topup_sessions — buyer-owned guide session.
-- -----------------------------------------------------------------------------
create policy binance_topup_sessions_select on binance_topup_sessions
  for select to authenticated
  using (buyer_user_id = auth.uid() or public.is_admin());
create policy binance_topup_sessions_insert on binance_topup_sessions
  for insert to authenticated
  with check (buyer_user_id = auth.uid());
create policy binance_topup_sessions_update on binance_topup_sessions
  for update to authenticated
  using (buyer_user_id = auth.uid())
  with check (buyer_user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- admin_actions / audit_logs — admin read only; writes via service role only.
-- (Audit/admin records are immutable: no update/delete policies — ERD rule 12.)
-- -----------------------------------------------------------------------------
create policy admin_actions_select on admin_actions
  for select to authenticated
  using (public.is_admin());

create policy audit_logs_select on audit_logs
  for select to authenticated
  using (public.is_admin());

-- -----------------------------------------------------------------------------
-- notifications — owner reads and marks read. Inserts via service role.
-- -----------------------------------------------------------------------------
create policy notifications_select on notifications
  for select to authenticated
  using (user_id = auth.uid());
create policy notifications_update on notifications
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
