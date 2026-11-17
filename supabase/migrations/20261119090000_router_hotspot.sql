-- Router hotspot settings, managed from the admin portal and applied to the
-- router by the Network Controller (job kind router.configure_hotspot).
--
-- One row per router: which port customers connect on, the customer
-- network's gateway and size, the hotspot's DNS name, and extra
-- walled-garden hosts (customers can reach these before paying). The
-- payment page address and the default walled garden stay in
-- network_settings, shared by every router.
--
-- version goes up on every change; applied_version records what the
-- controller last applied successfully, so the portal can show "changes not
-- yet applied" and activation can require the current settings to be live.
--
-- Additive only: one new table, one job kind, claim_next_job lets hotspot
-- jobs run on registered (not yet active) routers so a site can be set up
-- before it sells plans. Rollback: supabase/rollbacks/20261119090000_router_hotspot.rollback.sql

begin;

create or replace function public.is_walled_garden_host(h text)
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select h ~ '^(\*\.)?([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$' and length(h) <= 253
$$;

create or replace function public.all_walled_garden_hosts(hs text[])
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select coalesce(bool_and(public.is_walled_garden_host(h)), true) and coalesce(array_length(hs, 1), 0) <= 50
    from unnest(hs) as h
$$;

create table public.router_hotspot_settings (
  router_id            uuid primary key references public.routers (id) on delete cascade,
  lan_interface        text    not null default 'ether2',
  gateway_cidr         inet    not null default '10.10.0.1/22',
  dns_name             text    not null default 'wifi.getconnectly.net',
  extra_walled_garden  text[]  not null default '{}',
  version              integer not null default 1,
  applied_version      integer,
  applied_at           timestamptz,
  last_error           text,
  updated_by           text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint hotspot_lan_interface_format check (lan_interface ~ '^[A-Za-z0-9._-]{1,32}$'),
  constraint hotspot_gateway_ipv4         check (family(gateway_cidr) = 4 and masklen(gateway_cidr) between 16 and 28),
  constraint hotspot_gateway_private      check (gateway_cidr << '10.0.0.0/8' or gateway_cidr << '172.16.0.0/12' or gateway_cidr << '192.168.0.0/16'),
  constraint hotspot_gateway_is_host      check (host(gateway_cidr) <> host(network(gateway_cidr)) and host(gateway_cidr) <> host(broadcast(gateway_cidr))),
  constraint hotspot_dns_name_format      check (public.is_walled_garden_host(dns_name) and dns_name !~ '^\*'),
  constraint hotspot_walled_garden_hosts  check (public.all_walled_garden_hosts(extra_walled_garden)),
  constraint hotspot_applied_version      check (applied_version is null or applied_version between 1 and version)
);

comment on table public.router_hotspot_settings is
  'Per-router hotspot set-up, edited in the admin portal and applied by the controller (router.configure_hotspot).';

-- The customer network must not overlap the controller tunnel range, and
-- every change to the settings raises version (the applied state stays as it
-- was until the controller applies the new version).
create or replace function public.router_hotspot_settings_guard()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_tunnel cidr;
begin
  select tunnel_cidr into v_tunnel from public.network_settings where id;
  if v_tunnel is not null and new.gateway_cidr && v_tunnel then
    raise exception 'The customer network % overlaps the controller tunnel range %', new.gateway_cidr, v_tunnel
      using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' and (new.lan_interface, new.gateway_cidr, new.dns_name, new.extra_walled_garden)
                         is distinct from (old.lan_interface, old.gateway_cidr, old.dns_name, old.extra_walled_garden) then
    new.version := old.version + 1;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_router_hotspot_settings_guard
  before insert or update on public.router_hotspot_settings
  for each row execute function public.router_hotspot_settings_guard();

-- New job kind.
alter table public.controller_jobs drop constraint controller_jobs_kind_check;
alter table public.controller_jobs add constraint controller_jobs_kind_check check (kind in (
  'router.test', 'router.sync_profiles', 'router.configure_hotspot', 'access.provision', 'access.revoke',
  'access.login', 'session.disconnect'));

-- Same as 20261118090000 except that router.configure_hotspot may run on a
-- registered router (set-up happens before activation).
create or replace function public.claim_next_job(p_worker text)
returns setof public.controller_jobs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  -- Crashed jobs that have used every attempt are given up.
  update public.controller_jobs
     set status = 'dead', last_error = coalesce(last_error, 'worker stopped responding'),
         finished_at = now(), updated_at = now(), locked_by = null, locked_at = null
   where status = 'running' and locked_at < now() - interval '5 minutes' and attempts >= max_attempts;

  select j.id into v_id
    from public.controller_jobs j
    join public.routers r on r.id = j.router_id
   where (j.status in ('queued', 'failed') or (j.status = 'running' and j.locked_at < now() - interval '5 minutes'))
     and j.run_after <= now()
     and j.attempts < j.max_attempts
     and r.lifecycle_status <> 'retired'
     and (r.lifecycle_status = 'active'
          or j.kind in ('router.test', 'router.configure_hotspot')
          or (r.lifecycle_status = 'suspended' and j.kind in ('access.revoke', 'session.disconnect')))
     and not exists (
       select 1 from public.controller_jobs x
        where x.router_id = j.router_id and x.id <> j.id
          and x.status = 'running' and x.locked_at >= now() - interval '5 minutes')
   order by j.run_after, j.created_at
   for update of j skip locked
   limit 1;

  if v_id is null then
    return;
  end if;

  return query
  update public.controller_jobs
     set status = 'running', attempts = attempts + 1, locked_by = left(p_worker, 200),
         locked_at = now(), updated_at = now()
   where id = v_id
  returning *;
end;
$$;

-- Server-only, like every other network table.
alter table public.router_hotspot_settings enable row level security;
revoke all on public.router_hotspot_settings from anon, authenticated;
revoke all on function public.router_hotspot_settings_guard() from public, anon, authenticated;
revoke all on function public.claim_next_job(text) from public, anon, authenticated;
grant execute on function public.claim_next_job(text) to connectly_controller;

-- The controller reads the settings and records only the outcome of applying them.
grant select on public.router_hotspot_settings to connectly_controller;
grant update (applied_version, applied_at, last_error, updated_at) on public.router_hotspot_settings to connectly_controller;
create policy controller_rw on public.router_hotspot_settings for all to connectly_controller using (true) with check (true);

commit;
