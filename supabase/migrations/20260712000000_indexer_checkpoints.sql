-- =============================================================================
-- Trustip v1.1 — indexer checkpoints (Phase 19, Part 3/9)
-- Durable resume point for the escrow event indexer so it recovers after a
-- restart/crash without re-scanning the whole chain or double-processing. One
-- row per (worker, network). Written ONLY by the service-role worker; RLS is
-- enabled with no policies, so anon/authenticated have no access (service_role
-- has BYPASSRLS and is granted DML by 20260702000000_service_role_grants.sql +
-- its ALTER DEFAULT PRIVILEGES, which covers this table).
-- =============================================================================

create table indexer_checkpoints (
  worker      text not null,
  network     network not null,
  last_ledger bigint not null default 0,
  cursor      text,
  updated_at  timestamptz not null default now(),
  primary key (worker, network)
);

alter table indexer_checkpoints enable row level security;
