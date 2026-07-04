-- =============================================================================
-- Trustip v1.1 — public SELECT grant on checkout_links (Phase 5.1C-fix)
--
-- WHY: the public buyer checkout page (/checkout/[slug], anon client) reads
-- checkout_links directly. The RLS policy checkout_links_select_public
-- (20260630020000) already restricts anon/authenticated to ACTIVE links (or
-- owner/admin), but RLS only filters rows — it does not grant table access.
-- Supabase Cloud bootstraps anon/authenticated grants at project init; a fresh
-- LOCAL / SELF-HOSTED / CI Postgres does not, so the anon read fails with
-- "42501 permission denied for table checkout_links". This makes the grant
-- explicit and reproducible. Public checkout display relies on this SELECT
-- grant PLUS the RLS active-link policy as the real filter.
--
-- SAFETY: SELECT only, no DML granted; RLS stays ENABLED and untouched.
-- Idempotent (GRANT re-runs as a no-op).
-- =============================================================================

grant select on table public.checkout_links to anon, authenticated;
