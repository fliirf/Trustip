-- =============================================================================
-- Trustip v1.1 — public read grant for trust_profiles
--
-- trust_profiles is a public trust signal: its RLS policy already allows anon
-- SELECT (trust_profiles_select_public USING (true)), and it holds only derived
-- aggregates (counts, score, level) — no PII. Supabase Cloud bootstraps the
-- table-level SELECT grant for anon/authenticated, but a postgres-created DB
-- (local/CI/self-hosted) does not, so the RLS policy alone can't be exercised
-- (same gap fixed for checkout_links in 20260704000000). Grant SELECT so the
-- buyer checkout page can render the seller trust badge with the anon client.
--
-- SELECT only — the harden migration (20260714) already revoked all writes from
-- anon/authenticated and asserts none remain; this does not reintroduce any.
-- =============================================================================

grant select on table public.trust_profiles to anon, authenticated;
