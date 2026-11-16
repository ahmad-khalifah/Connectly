-- =====================================================================
-- ROLLBACK for 20261116120000_security_lockdown.sql
-- Restores the exact pre-migration permissions recorded on 2026-11-16:
--   tables:    anon=arwdDxtm, authenticated=arwdDxtm (ALL incl. MAINTAIN)
--   sequence:  anon=rwU
--   defaults:  postgres role grants ALL on new tables/sequences to anon
-- WARNING: running this re-opens the database to the public anon key.
-- =====================================================================

begin;

alter default privileges for role postgres in schema public grant all on sequences to anon;
alter default privileges for role postgres in schema public grant all on tables    to anon;

grant truncate, references, trigger, maintain on all tables in schema public to authenticated;

grant all on all sequences in schema public to anon;
grant all on all tables    in schema public to anon;

create policy "Allow public read access to purchases"
  on public.purchases as permissive for select to public using (true);

alter table public.organizations          disable row level security;
alter table public.universities           disable row level security;
alter table public.locations              disable row level security;
alter table public.routers                disable row level security;
alter table public.qr_codes               disable row level security;
alter table public.plans                  disable row level security;
alter table public.customers              disable row level security;
alter table public.devices                disable row level security;
alter table public.purchases              disable row level security;
alter table public.payments               disable row level security;
alter table public.network_authorizations disable row level security;

commit;
