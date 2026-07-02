-- =============================================================================
-- Trustip v1.1 — Initial schema (Phase 1)
-- Source of truth: ERD Spec v1.1 (+ Security & Risk Spec v1.1, CLAUDE.md §8).
--
-- Notes:
--  * Buyer payment is USDC on Stellar. DB stores only verified on-chain
--    references (tx hashes, contract IDs, events) — never moves funds itself.
--  * Payout method DB values are lowercase (usdc_wallet | xlm_wallet |
--    moneygram_cashout). API payload constants are uppercase and mapped in
--    @trustip/validators (see PAYOUT_METHOD_DB_VALUE).
--  * RLS is enabled in a separate migration (20260630020000_enable_rls.sql).
-- =============================================================================

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Enums (ERD §6, extended for tables defined by CLAUDE.md/Security spec)
-- -----------------------------------------------------------------------------
create type user_role                  as enum ('buyer', 'seller', 'admin');
create type user_status                as enum ('active', 'suspended', 'pending_review');
create type auth_provider              as enum ('email', 'google', 'wallet');
create type wallet_provider            as enum ('freighter', 'xbull', 'other');
create type network                    as enum ('testnet', 'mainnet');

create type identity_status            as enum ('not_started', 'pending', 'verified', 'rejected');
create type kyc_status                 as enum ('not_required_mvp', 'pending_future', 'verified_future');
create type seller_activation_status   as enum ('incomplete', 'ready', 'restricted');

create type checkout_link_status       as enum ('draft', 'active', 'inactive', 'expired');

create type order_status               as enum (
  'awaiting_payment', 'payment_submitted', 'payment_confirmed', 'escrow_locked',
  'processing', 'packed', 'shipped', 'delivered', 'completed',
  'payout_pending', 'payout_completed',
  'refund_requested', 'refund_review', 'refunded', 'cancelled', 'failed'
);

create type payment_method             as enum ('stellar_wallet', 'binance_pay_future');
create type payment_status             as enum (
  'pending', 'awaiting_signature', 'submitted', 'confirmed', 'failed', 'expired', 'refunded'
);

create type escrow_status              as enum (
  'not_created', 'created', 'funded', 'released', 'refunded', 'cancelled', 'paused'
);
create type escrow_event_type          as enum ('create', 'fund', 'lock', 'release', 'refund', 'cancel', 'error');
create type release_destination_type   as enum ('seller_wallet', 'payout_treasury_future');

create type payout_method_type         as enum ('usdc_wallet', 'xlm_wallet', 'moneygram_cashout');
create type payout_method_status       as enum ('active', 'disabled', 'needs_review', 'unsupported_region');
create type payout_status              as enum (
  'not_requested', 'route_selected', 'pending_release', 'processing',
  'completed', 'failed', 'needs_review', 'cancelled'
);
create type payout_release_mode        as enum ('direct_wallet', 'guided_offramp', 'treasury_orchestrated_future');
create type payout_transaction_type    as enum (
  'escrow_release', 'stellar_payment', 'path_payment',
  'moneygram_cashout_created', 'moneygram_cashout_completed', 'reconciliation', 'failed'
);
create type payout_transaction_network as enum ('testnet', 'mainnet', 'external');
create type payout_transaction_status  as enum ('submitted', 'confirmed', 'failed', 'pending_external');

create type moneygram_integration_level as enum ('guided', 'integrated_future');
create type moneygram_status            as enum (
  'not_started', 'guide_opened', 'initiated', 'pending_kyc',
  'ready_for_pickup', 'completed', 'failed', 'expired'
);
create type moneygram_compliance_status as enum ('not_required_mvp', 'pending', 'approved', 'rejected');

create type refund_status              as enum (
  'submitted', 'under_review', 'seller_response_needed', 'approved', 'rejected', 'completed'
);
create type refund_reason_code         as enum (
  'not_received', 'wrong_item', 'damaged', 'fake', 'seller_unresponsive', 'other'
);
create type refund_decision            as enum ('none', 'refund_buyer', 'release_seller', 'partial_refund_future');

create type actor_type                 as enum ('buyer', 'seller', 'admin', 'system');
create type shipment_status            as enum ('processing', 'packed', 'shipped', 'delivered');
create type file_type                  as enum ('photo', 'video', 'document');
create type shipment_proof_type        as enum ('packing_photo', 'shipping_receipt', 'item_photo');
create type evidence_type              as enum (
  'unboxing_video', 'chat_screenshot', 'shipping_receipt', 'item_photo', 'other'
);

create type binance_guide_status       as enum ('opened', 'copied_address', 'completed_self_reported', 'abandoned');

create type admin_action_type          as enum (
  'approve_refund', 'reject_refund', 'force_release', 'restrict_seller',
  'mark_payout_review', 'approve_payout_retry', 'add_note'
);

-- trust_profiles / trust_events / blockchain_transactions are required by
-- CLAUDE.md §8 + Security spec §6 but not field-defined in ERD §5; modeled
-- conservatively here.
create type trust_level                as enum ('new', 'bronze', 'silver', 'gold', 'restricted');
create type trust_event_type           as enum (
  'order_completed', 'order_refunded', 'order_cancelled',
  'review_received', 'seller_restricted', 'manual_adjustment'
);
create type blockchain_tx_type         as enum (
  'payment', 'escrow_create', 'escrow_fund', 'escrow_release',
  'escrow_refund', 'escrow_cancel', 'payout', 'other'
);
create type blockchain_tx_status       as enum ('submitted', 'pending', 'confirmed', 'failed');

-- -----------------------------------------------------------------------------
-- updated_at trigger helper
-- -----------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Core identity
-- -----------------------------------------------------------------------------
create table users (
  id            uuid primary key references auth.users (id) on delete cascade,
  email         text unique,
  phone         text,
  display_name  text,
  role          user_role     not null default 'buyer',
  auth_provider auth_provider not null default 'email',
  status        user_status   not null default 'active',
  created_at    timestamptz   not null default now(),
  updated_at    timestamptz   not null default now()
);
create index idx_users_role   on users (role);
create index idx_users_status on users (status);

create table user_wallets (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references users (id) on delete cascade,
  wallet_provider wallet_provider not null,
  public_key      text not null,
  network         network not null,
  is_primary      boolean not null default false,
  verified_at     timestamptz,
  created_at      timestamptz not null default now(),
  unique (user_id, public_key, network)
);
create index idx_user_wallets_user_id    on user_wallets (user_id);
create index idx_user_wallets_public_key on user_wallets (public_key);
create index idx_user_wallets_network    on user_wallets (network);

create table seller_profiles (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references users (id) on delete cascade,
  store_name               text not null,
  category                 text,
  social_url               text,
  product_type             text,
  phone_verified           boolean not null default false,
  email_verified           boolean not null default false,
  identity_status          identity_status not null default 'not_started',
  kyc_status               kyc_status not null default 'not_required_mvp',
  default_payout_method_id uuid,  -- FK added after seller_payout_methods exists
  activation_status        seller_activation_status not null default 'incomplete',
  created_at               timestamptz not null default now(),
  unique (user_id)
);
create index idx_seller_profiles_user_id on seller_profiles (user_id);

-- -----------------------------------------------------------------------------
-- Checkout & orders
-- -----------------------------------------------------------------------------
create table checkout_links (
  id                  uuid primary key default gen_random_uuid(),
  seller_profile_id   uuid not null references seller_profiles (id) on delete cascade,
  slug                text not null unique,
  title               text not null,
  description         text,
  price_usdc          numeric(20,7) not null check (price_usdc >= 0),
  price_idr_reference numeric(20,2),
  currency_display    text,
  status              checkout_link_status not null default 'draft',
  expires_at          timestamptz,
  created_at          timestamptz not null default now()
);
create index idx_checkout_links_seller_profile_id on checkout_links (seller_profile_id);
create index idx_checkout_links_status            on checkout_links (status);

create table orders (
  id                        uuid primary key default gen_random_uuid(),
  order_no                  text not null unique,
  checkout_link_id          uuid references checkout_links (id) on delete set null,
  buyer_user_id             uuid references users (id) on delete set null,
  seller_profile_id         uuid not null references seller_profiles (id) on delete restrict,
  status                    order_status not null default 'awaiting_payment',
  total_usdc                numeric(20,7) not null check (total_usdc >= 0),
  total_idr_reference       numeric(20,2),
  buyer_wallet_id           uuid references user_wallets (id) on delete set null,
  seller_wallet_id          uuid references user_wallets (id) on delete set null,
  selected_payout_method_id uuid,  -- FK added after seller_payout_methods exists
  created_at                timestamptz not null default now(),
  paid_at                   timestamptz,
  completed_at              timestamptz,
  cancelled_at              timestamptz
);
create index idx_orders_buyer_user_id     on orders (buyer_user_id);
create index idx_orders_seller_profile_id on orders (seller_profile_id);
create index idx_orders_status            on orders (status);
create index idx_orders_created_at        on orders (created_at);

create table order_items (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references orders (id) on delete cascade,
  name            text not null,
  quantity        integer not null check (quantity > 0),
  unit_price_usdc numeric(20,7) not null check (unit_price_usdc >= 0),
  subtotal_usdc   numeric(20,7) not null check (subtotal_usdc >= 0),
  metadata        jsonb not null default '{}'::jsonb
);
create index idx_order_items_order_id on order_items (order_id);

-- One payment record per order (1:1 per ERD; retries update the row/status).
create table payments (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid not null references orders (id) on delete cascade,
  method           payment_method not null default 'stellar_wallet',
  status           payment_status not null default 'pending',
  asset_code       text not null default 'USDC',
  asset_issuer     text,
  network          network not null,
  amount_usdc      numeric(20,7) not null check (amount_usdc >= 0),
  payer_public_key text,
  tx_hash          text,
  ledger           bigint,
  failure_reason   text,
  created_at       timestamptz not null default now(),
  confirmed_at     timestamptz,
  unique (order_id)
);
create index idx_payments_order_id on payments (order_id);
create index idx_payments_status   on payments (status);
create unique index uq_payments_tx_hash on payments (tx_hash) where tx_hash is not null;

-- One active escrow per order (ERD integrity rule 1).
create table escrows (
  id                       uuid primary key default gen_random_uuid(),
  order_id                 uuid not null references orders (id) on delete cascade,
  contract_id              text,
  contract_order_id        text,
  status                   escrow_status not null default 'not_created',
  asset_code               text not null default 'USDC',
  amount_usdc              numeric(20,7) not null check (amount_usdc >= 0),
  buyer_public_key         text,
  seller_public_key        text,
  release_destination_type release_destination_type not null default 'seller_wallet',
  funded_tx_hash           text,
  release_tx_hash          text,
  refund_tx_hash           text,
  created_at               timestamptz not null default now(),
  funded_at                timestamptz,
  released_at              timestamptz,
  refunded_at              timestamptz,
  unique (order_id)
);
create index idx_escrows_status            on escrows (status);
create index idx_escrows_contract_order_id on escrows (contract_order_id);
create index idx_escrows_funded_tx_hash    on escrows (funded_tx_hash);
create index idx_escrows_release_tx_hash   on escrows (release_tx_hash);

create table escrow_events (
  id              uuid primary key default gen_random_uuid(),
  escrow_id       uuid not null references escrows (id) on delete cascade,
  event_type      escrow_event_type not null,
  tx_hash         text,
  ledger          bigint,
  from_public_key text,
  to_public_key   text,
  amount_usdc     numeric(20,7),
  raw_event       jsonb,
  created_at      timestamptz not null default now()
);
create index idx_escrow_events_escrow_id on escrow_events (escrow_id);
create unique index uq_escrow_events_tx_hash on escrow_events (tx_hash) where tx_hash is not null;

-- Verified on-chain transaction ledger (Security spec §6).
create table blockchain_transactions (
  id                  uuid primary key default gen_random_uuid(),
  order_id            uuid references orders (id) on delete set null,
  escrow_id           uuid references escrows (id) on delete set null,
  payment_id          uuid references payments (id) on delete set null,
  tx_hash             text not null unique,
  tx_type             blockchain_tx_type not null,
  network             network not null,
  status              blockchain_tx_status not null default 'submitted',
  ledger              bigint,
  source_account      text,
  destination_account text,
  amount              numeric(20,7),
  asset_code          text,
  raw_response        jsonb,
  created_at          timestamptz not null default now(),
  confirmed_at        timestamptz
);
create index idx_blockchain_transactions_order_id on blockchain_transactions (order_id);
create index idx_blockchain_transactions_status   on blockchain_transactions (status);

-- -----------------------------------------------------------------------------
-- Seller payout (multi-route)
-- -----------------------------------------------------------------------------
create table seller_payout_methods (
  id                uuid primary key default gen_random_uuid(),
  seller_profile_id uuid not null references seller_profiles (id) on delete cascade,
  method_type       payout_method_type not null,
  display_name      text not null,
  is_default        boolean not null default false,
  status            payout_method_status not null default 'active',
  wallet_id         uuid references user_wallets (id) on delete set null,
  stellar_address   text,
  asset_code        text,
  cashout_country   text,
  cashout_currency  text,
  external_provider text,
  provider_payload  jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index idx_seller_payout_methods_seller_profile_id on seller_payout_methods (seller_profile_id);
create index idx_seller_payout_methods_method_type       on seller_payout_methods (method_type);
create index idx_seller_payout_methods_status            on seller_payout_methods (status);
-- ERD integrity rule 9: at most one default payout method per seller.
create unique index uq_seller_default_payout_method
  on seller_payout_methods (seller_profile_id) where is_default;

-- Deferred FKs now that seller_payout_methods exists.
alter table seller_profiles
  add constraint fk_seller_profiles_default_payout_method
  foreign key (default_payout_method_id) references seller_payout_methods (id) on delete set null;
alter table orders
  add constraint fk_orders_selected_payout_method
  foreign key (selected_payout_method_id) references seller_payout_methods (id) on delete set null;

create table payout_requests (
  id                     uuid primary key default gen_random_uuid(),
  order_id               uuid not null references orders (id) on delete cascade,
  escrow_id              uuid references escrows (id) on delete set null,
  seller_profile_id      uuid not null references seller_profiles (id) on delete restrict,
  payout_method_id       uuid references seller_payout_methods (id) on delete set null,
  route_type             payout_method_type not null,
  status                 payout_status not null default 'not_requested',
  amount_usdc            numeric(20,7) check (amount_usdc >= 0),
  target_asset_code      text,
  target_amount_estimate numeric(20,7),
  fee_estimate_usdc      numeric(20,7),
  rate_snapshot          jsonb,
  release_mode           payout_release_mode not null default 'direct_wallet',
  provider_reference_id  text,
  idempotency_key        text unique,  -- Security spec §9: payout idempotency
  failure_reason         text,
  requested_at           timestamptz,
  processed_at           timestamptz,
  completed_at           timestamptz
);
create index idx_payout_requests_order_id          on payout_requests (order_id);
create index idx_payout_requests_seller_profile_id on payout_requests (seller_profile_id);
create index idx_payout_requests_payout_method_id  on payout_requests (payout_method_id);
create index idx_payout_requests_route_type        on payout_requests (route_type);
create index idx_payout_requests_status            on payout_requests (status);

create table payout_transactions (
  id                    uuid primary key default gen_random_uuid(),
  payout_request_id     uuid not null references payout_requests (id) on delete cascade,
  transaction_type      payout_transaction_type not null,
  network               payout_transaction_network not null,
  asset_code            text,
  amount                numeric(20,7),
  tx_hash               text,
  external_reference_id text,
  status                payout_transaction_status not null default 'submitted',
  raw_payload           jsonb,
  created_at            timestamptz not null default now()
);
create index idx_payout_transactions_payout_request_id on payout_transactions (payout_request_id);
create index idx_payout_transactions_status            on payout_transactions (status);
create unique index uq_payout_transactions_tx_hash on payout_transactions (tx_hash) where tx_hash is not null;

create table moneygram_payout_details (
  id                     uuid primary key default gen_random_uuid(),
  payout_request_id      uuid not null unique references payout_requests (id) on delete cascade,
  integration_level      moneygram_integration_level not null default 'guided',
  country                text,
  cashout_currency       text,
  moneygram_reference_id text,
  external_status        moneygram_status not null default 'not_started',
  recipient_profile_ref  text,  -- encrypted reference only; never raw PII
  location_hint          text,
  compliance_status      moneygram_compliance_status not null default 'not_required_mvp',
  metadata               jsonb,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index idx_moneygram_payout_details_external_status on moneygram_payout_details (external_status);

-- -----------------------------------------------------------------------------
-- Order lifecycle, shipment, refund, review
-- -----------------------------------------------------------------------------
create table order_status_events (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references orders (id) on delete cascade,
  status        order_status not null,
  label_public  text,
  actor_user_id uuid references users (id) on delete set null,
  actor_type    actor_type not null default 'system',
  metadata      jsonb,
  created_at    timestamptz not null default now()
);
create index idx_order_status_events_order_id on order_status_events (order_id);

create table shipments (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references orders (id) on delete cascade,
  courier_name    text,
  tracking_number text,
  status          shipment_status not null default 'processing',
  shipped_at      timestamptz,
  delivered_at    timestamptz,
  seller_note     text,
  created_at      timestamptz not null default now()
);
create index idx_shipments_order_id        on shipments (order_id);
create index idx_shipments_tracking_number on shipments (tracking_number);

create table shipment_proofs (
  id          uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references shipments (id) on delete cascade,
  uploaded_by uuid references users (id) on delete set null,
  file_url    text not null,
  file_type   file_type not null,
  proof_type  shipment_proof_type not null,
  created_at  timestamptz not null default now()
);
create index idx_shipment_proofs_shipment_id on shipment_proofs (shipment_id);

create table refund_requests (
  id                    uuid primary key default gen_random_uuid(),
  order_id              uuid not null references orders (id) on delete cascade,
  buyer_user_id         uuid references users (id) on delete set null,
  seller_profile_id     uuid not null references seller_profiles (id) on delete restrict,
  reason_code           refund_reason_code not null,
  description           text,
  status                refund_status not null default 'submitted',
  requested_amount_usdc numeric(20,7) check (requested_amount_usdc >= 0),
  decision              refund_decision not null default 'none',
  decision_note         text,
  created_at            timestamptz not null default now(),
  resolved_at           timestamptz
);
create index idx_refund_requests_order_id          on refund_requests (order_id);
create index idx_refund_requests_status            on refund_requests (status);
create index idx_refund_requests_seller_profile_id on refund_requests (seller_profile_id);

create table refund_evidence (
  id                uuid primary key default gen_random_uuid(),
  refund_request_id uuid not null references refund_requests (id) on delete cascade,
  uploaded_by       uuid references users (id) on delete set null,
  actor_type        actor_type not null,
  file_url          text not null,
  file_type         file_type not null,
  evidence_type     evidence_type not null,
  note              text,
  created_at        timestamptz not null default now()
);
create index idx_refund_evidence_refund_request_id on refund_evidence (refund_request_id);

create table reviews (
  id                uuid primary key default gen_random_uuid(),
  order_id          uuid not null references orders (id) on delete cascade,
  buyer_user_id     uuid references users (id) on delete set null,
  seller_profile_id uuid not null references seller_profiles (id) on delete cascade,
  rating            integer not null check (rating between 1 and 5),
  comment           text,
  created_at        timestamptz not null default now(),
  unique (order_id)
);
create index idx_reviews_seller_profile_id on reviews (seller_profile_id);

-- -----------------------------------------------------------------------------
-- Trust profile
-- -----------------------------------------------------------------------------
create table trust_profiles (
  id                uuid primary key default gen_random_uuid(),
  seller_profile_id uuid not null unique references seller_profiles (id) on delete cascade,
  total_orders      integer not null default 0,
  completed_orders  integer not null default 0,
  refunded_orders   integer not null default 0,
  cancelled_orders  integer not null default 0,
  total_reviews     integer not null default 0,
  average_rating    numeric(3,2) not null default 0,
  refund_rate       numeric(5,2) not null default 0,
  trust_score       numeric(6,2) not null default 0,
  level             trust_level not null default 'new',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table trust_events (
  id               uuid primary key default gen_random_uuid(),
  trust_profile_id uuid not null references trust_profiles (id) on delete cascade,
  order_id         uuid references orders (id) on delete set null,
  event_type       trust_event_type not null,
  score_delta      numeric(6,2) not null default 0,
  metadata         jsonb,
  created_at       timestamptz not null default now()
);
create index idx_trust_events_trust_profile_id on trust_events (trust_profile_id);
create index idx_trust_events_order_id         on trust_events (order_id);
create index idx_trust_events_event_type       on trust_events (event_type);

-- -----------------------------------------------------------------------------
-- Top-up guide, admin, notifications, audit
-- -----------------------------------------------------------------------------
create table binance_topup_sessions (
  id                        uuid primary key default gen_random_uuid(),
  order_id                  uuid references orders (id) on delete cascade,
  buyer_user_id             uuid references users (id) on delete set null,
  amount_usdc               numeric(20,7) check (amount_usdc >= 0),
  guide_status              binance_guide_status not null default 'opened',
  wallet_address_to_receive text,
  created_at                timestamptz not null default now()
);
create index idx_binance_topup_sessions_order_id      on binance_topup_sessions (order_id);
create index idx_binance_topup_sessions_buyer_user_id on binance_topup_sessions (buyer_user_id);

create table admin_actions (
  id                uuid primary key default gen_random_uuid(),
  admin_user_id     uuid references users (id) on delete set null,
  order_id          uuid references orders (id) on delete set null,
  refund_request_id uuid references refund_requests (id) on delete set null,
  payout_request_id uuid references payout_requests (id) on delete set null,
  action_type       admin_action_type not null,
  note              text,
  metadata          jsonb,
  created_at        timestamptz not null default now()
);
create index idx_admin_actions_admin_user_id     on admin_actions (admin_user_id);
create index idx_admin_actions_order_id          on admin_actions (order_id);
create index idx_admin_actions_refund_request_id on admin_actions (refund_request_id);
create index idx_admin_actions_payout_request_id on admin_actions (payout_request_id);

create table notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users (id) on delete cascade,
  type       text not null,
  title      text,
  message    text,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index idx_notifications_user_id on notifications (user_id);

create table audit_logs (
  id            uuid primary key default gen_random_uuid(),
  actor_user_id uuid references users (id) on delete set null,
  actor_role    actor_type not null default 'system',
  action        text not null,
  entity_type   text,
  entity_id     uuid,
  metadata      jsonb,
  created_at    timestamptz not null default now()
);
create index idx_audit_logs_actor_user_id on audit_logs (actor_user_id);
create index idx_audit_logs_created_at     on audit_logs (created_at);
create index idx_audit_logs_action         on audit_logs (action);

-- -----------------------------------------------------------------------------
-- updated_at triggers (tables carrying an updated_at column)
-- -----------------------------------------------------------------------------
create trigger trg_users_updated_at
  before update on users
  for each row execute function set_updated_at();
create trigger trg_seller_payout_methods_updated_at
  before update on seller_payout_methods
  for each row execute function set_updated_at();
create trigger trg_moneygram_payout_details_updated_at
  before update on moneygram_payout_details
  for each row execute function set_updated_at();
create trigger trg_trust_profiles_updated_at
  before update on trust_profiles
  for each row execute function set_updated_at();
