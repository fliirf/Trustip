-- =============================================================================
-- Trustip v1.1 — service_role object privileges (Phase 4.7 pre-4.1 readiness)
-- Source of truth: Security & Risk Spec v1.1 §11 + RLS baseline
-- (20260630020000_enable_rls.sql).
--
-- WHY: the backend/workers use the SERVICE-ROLE Supabase client to perform all
-- money/escrow/payout/admin state changes (RLS is bypassed for service_role by
-- design; clients get only the narrow owner-scoped policies). Supabase Cloud
-- grants service_role these table privileges automatically at project init, but
-- a fresh LOCAL / SELF-HOSTED / CI Postgres does not receive that bootstrap, so
-- server-side inserts/updates fail with "permission denied for table ...". This
-- migration makes the service_role grant explicit and reproducible everywhere.
--
-- SCOPE / SAFETY:
--  * Grants ONLY service_role — never anon / authenticated / public — the DML it
--    needs (select/insert/update/delete). RLS stays ENABLED and remains the sole
--    gate for anon/authenticated (untouched here). service_role has BYPASSRLS,
--    so these grants are what let the trusted backend write.
--  * Idempotent: GRANT / ALTER DEFAULT PRIVILEGES re-run as no-ops, so this is
--    safe under `supabase db reset` and repeated `supabase migration up`.
--  * Does NOT touch confirm_funded_payment's EXECUTE grant (still service_role +
--    owner only, per 20260701000000).
--  * ALTER DEFAULT PRIVILEGES here applies to objects later created in schema
--    public by the migration role (postgres in local/CI/self-hosted), covering
--    tables/sequences added by future migrations.
-- =============================================================================

-- Schema usage (explicit; harmless if already present).
grant usage on schema public to service_role;

-- Existing tables: the DML the server-side code performs.
grant select, insert, update, delete
  on all tables in schema public
  to service_role;

-- Existing sequences, if any (no-op when the schema has none — all PKs are uuid).
grant usage, select, update
  on all sequences in schema public
  to service_role;

-- Future tables/sequences created in schema public by the migration role.
alter default privileges in schema public
  grant select, insert, update, delete on tables to service_role;
alter default privileges in schema public
  grant usage, select, update on sequences to service_role;
