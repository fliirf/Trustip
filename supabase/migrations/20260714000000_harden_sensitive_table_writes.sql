-- =============================================================================
-- Trustip v1.1 — backend-only writes for application tables
--
-- All mutations in schema public must cross a validated backend/API boundary
-- that uses service_role. RLS read policies stay intact; direct table writes
-- from anon/authenticated are removed at both the policy and grant layers.
-- =============================================================================

-- Remove every existing client-write policy. The audited baseline contains
-- write policies for wallets, seller profiles, checkout links, payout methods,
-- shipments/proofs, refunds/evidence, reviews, Binance guide sessions, and
-- notification read-state. SELECT policies are deliberately preserved.
do $$
declare
  write_policy record;
begin
  for write_policy in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and cmd in ('ALL', 'INSERT', 'UPDATE', 'DELETE')
  loop
    execute format(
      'drop policy %I on %I.%I',
      write_policy.policyname,
      write_policy.schemaname,
      write_policy.tablename
    );
  end loop;
end;
$$;

-- RLS is not the only boundary: remove table-level write privileges too. This
-- covers Supabase projects where bootstrap defaults granted broad public-schema
-- privileges before these migrations ran. SELECT privileges are untouched.
revoke insert, update, delete, truncate, references, trigger
  on all tables in schema public
  from anon, authenticated;

-- Future public tables start backend-only as well. A future feature that truly
-- needs a client write must opt in with a reviewed migration and narrow policy.
-- Revoke both global and public-schema defaults because older Supabase setups
-- may have installed either form; PostgreSQL combines the two ACL sources.
alter default privileges
  revoke insert, update, delete, truncate, references, trigger
  on tables from anon, authenticated;

alter default privileges in schema public
  revoke insert, update, delete, truncate, references, trigger
  on tables from anon, authenticated;

-- Reassert that the two state-changing SECURITY DEFINER functions remain
-- callable only by service_role. These grants already exist in earlier
-- migrations; repeating them here makes the hardened boundary self-contained.
revoke all on function public.confirm_funded_payment(
  uuid, uuid, uuid, text, bigint, text, numeric, network
) from public, anon, authenticated;
grant execute on function public.confirm_funded_payment(
  uuid, uuid, uuid, text, bigint, text, numeric, network
) to service_role;

revoke all on function public.confirm_released_payment(
  uuid, uuid, text, bigint, text, numeric, network
) from public, anon, authenticated;
grant execute on function public.confirm_released_payment(
  uuid, uuid, text, bigint, text, numeric, network
) to service_role;

-- Fail the migration if a table grant or write policy escaped the hardening,
-- or if the trusted backend role cannot perform the DML it needs.
do $$
declare
  application_table record;
  client_role text;
  privilege_name text;
  leaked_policies text;
begin
  for application_table in
    select c.oid, c.relname, c.relrowsecurity
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
  loop
    if not application_table.relrowsecurity then
      raise exception 'RLS is disabled on public.%', application_table.relname;
    end if;

    foreach client_role in array array['anon', 'authenticated']
    loop
      foreach privilege_name in array array[
        'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'
      ]
      loop
        if has_table_privilege(
          client_role,
          application_table.oid,
          privilege_name
        ) then
          raise exception '% still has % on public.%',
            client_role,
            privilege_name,
            application_table.relname;
        end if;
      end loop;
    end loop;

    foreach privilege_name in array array['SELECT', 'INSERT', 'UPDATE', 'DELETE']
    loop
      if not has_table_privilege(
        'service_role',
        application_table.oid,
        privilege_name
      ) then
        raise exception 'service_role lacks % on public.%',
          privilege_name,
          application_table.relname;
      end if;
    end loop;
  end loop;

  select string_agg(format('%I.%I (%s)', schemaname, policyname, cmd), ', ')
    into leaked_policies
  from pg_policies
  where schemaname = 'public'
    and cmd in ('ALL', 'INSERT', 'UPDATE', 'DELETE');

  if leaked_policies is not null then
    raise exception 'client-write policies remain: %', leaked_policies;
  end if;
end;
$$;
