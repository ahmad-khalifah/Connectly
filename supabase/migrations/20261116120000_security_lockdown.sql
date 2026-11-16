-- =====================================================================
-- Connectly: Stage 1 security lockdown
-- Project: plydltvxfozxflarrfrx (Connectly, eu-west-1)
-- Date:    2026-11-16
--
-- Purpose: stop the public anon key (shipped in every browser bundle)
-- from reading or changing data, without touching any table, column,
-- row, auth user or Realtime publication.
--
-- Not changed:
--   * service_role keeps all privileges and has BYPASSRLS, so every
--     server-side query using SUPABASE_SERVICE_ROLE_KEY is unaffected.
--   * auth.users and your admin account are not touched.
--   * The "Admins can view activity logs" policy (authenticated, SELECT)
--     is kept.
--   * No table, column, constraint, index or row is dropped or edited.
--   * Realtime publication membership is unchanged (RLS now filters it).
-- Rollback: 20261116120000_security_lockdown.rollback.sql
-- =====================================================================

begin;

-- 1. Turn on Row Level Security for the 11 tables that had it off.
--    With no policies, anon/authenticated see no rows; service_role
--    bypasses RLS.
alter table public.organizations          enable row level security;
alter table public.universities           enable row level security;
alter table public.locations              enable row level security;
alter table public.routers                enable row level security;
alter table public.qr_codes               enable row level security;
alter table public.plans                  enable row level security;
alter table public.customers              enable row level security;
alter table public.devices                enable row level security;
alter table public.purchases              enable row level security;
alter table public.payments               enable row level security;
alter table public.network_authorizations enable row level security;

-- 2. Remove the policy that let ANY role (including anon) read every
--    purchase, with customer phone numbers.
drop policy "Allow public read access to purchases" on public.purchases;

-- 3. The anon role gets no table or sequence access in public.
--    (It previously held SELECT, INSERT, UPDATE, DELETE, TRUNCATE,
--    REFERENCES, TRIGGER and MAINTAIN on all 20 tables.)
revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;

-- 4. Logged-in users keep SELECT/INSERT/UPDATE/DELETE (still governed by
--    RLS), but lose privileges that RLS does not police.
--    TRUNCATE ignores RLS entirely.
revoke truncate, references, trigger, maintain on all tables in schema public from authenticated;

-- 5. New tables/sequences created later by the postgres role in public
--    are no longer auto-granted to anon.
alter default privileges for role postgres in schema public revoke all on tables    from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;

commit;
