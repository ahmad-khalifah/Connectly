-- =====================================================================
-- Network Management: router registry, access grants, controller job queue
-- Status: NOT APPLIED anywhere. Requires Phillip's approval, staging first.
-- Depends on: 20261116120000_security_lockdown, 20261117090000_payment_ledger
-- Rollback:   supabase/rollbacks/20261118090000_network_management.rollback.sql
--
-- Additive only. No table, column or row is dropped. Three NOT NULLs are
-- relaxed (routers.management_ip/api_user/api_password_encrypted, unused
-- since routers are reached through the controller) plus
-- network_authorizations.device_id (a grant can exist before the paying
-- device is known). confirm_payment and mark_payment_failed are unchanged.
--
-- How it fits together:
--   * The Vercel app (service_role) registers routers and queues jobs.
--   * When a purchase with a router becomes paid, a trigger creates one
--     access grant and one provision job, in the same transaction as the
--     payment. A failure there is logged and never blocks the payment.
--   * The controller on the VPS logs in as connectly_controller, which can
--     claim jobs and update router/grant/session state, and cannot read
--     customers, phone numbers, payments or plan prices.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. network_settings: one row the app and controller share
--    Public keys only; private keys never leave the VPS.
-- ---------------------------------------------------------------------
create table public.network_settings (
  id                      boolean primary key default true check (id),
  tunnel_cidr             cidr    not null default '10.77.0.0/22',
  controller_tunnel_ip    inet    not null default '10.77.0.1',
  controller_endpoint     text,           -- host:port routers dial (set at VPS deploy)
  controller_wg_public_key text,          -- published by the controller at start-up
  credential_public_key   text,           -- PEM (SPKI) RSA key; the app encrypts router passwords with it
  credential_key_id       text,
  portal_url              text    not null default 'https://getconnectly.net/portal',
  walled_garden_hosts     text[]  not null default array['getconnectly.net', 'checkout.korapay.com'],
  updated_at              timestamptz not null default now(),
  constraint network_settings_controller_in_tunnel check (controller_tunnel_ip << tunnel_cidr)
);
insert into public.network_settings (id) values (true);

-- ---------------------------------------------------------------------
-- 2. routers: registration, lifecycle, encrypted credentials, health
-- ---------------------------------------------------------------------
alter table public.routers
  add column name                  text,
  add column connection_method     text not null default 'wireguard',
  add column lifecycle_status      text not null default 'registered',
  add column tunnel_ip             inet,
  add column wg_public_key         text,
  add column credential_ciphertext text,   -- RSA-OAEP(SHA-256) of the API password, base64
  add column credential_key_id     text,   -- which controller key encrypted it
  add column tls_cert_fingerprint  text,   -- pinned on first successful test
  add column routeros_version      text,
  add column board_name            text,
  add column last_seen_at          timestamptz,
  add column last_test_at          timestamptz,
  add column last_test_result      jsonb,
  add column last_error            text,
  add column activated_at          timestamptz,
  add column retired_at            timestamptz,
  add column updated_at            timestamptz not null default now();

alter table public.routers
  alter column management_ip          drop not null,
  alter column api_user               drop not null,
  alter column api_password_encrypted drop not null,
  alter column status                 set default 'offline',   -- was 'online' before ever being seen
  alter column last_heartbeat         drop default,            -- was now()
  alter column wan_status             drop default,            -- was 'connected'
  alter column api_port               set default 443;         -- RouterOS REST on www-ssl

alter table public.routers
  add constraint routers_connection_method_check check (connection_method in ('wireguard', 'direct_https')),
  add constraint routers_lifecycle_status_check  check (lifecycle_status in ('registered', 'active', 'suspended', 'retired')),
  add constraint routers_wg_public_key_format    check (wg_public_key is null or wg_public_key ~ '^[A-Za-z0-9+/]{42}[AEIMQUYcgkosw048]=$'),
  add constraint routers_tunnel_ip_host          check (tunnel_ip is null or masklen(tunnel_ip) = 32),
  add constraint routers_active_needs_credential check (lifecycle_status in ('registered', 'retired') or credential_ciphertext is not null),
  add constraint routers_tunnel_ip_key           unique (tunnel_ip),
  add constraint routers_wg_public_key_key       unique (wg_public_key);

create index idx_routers_lifecycle on public.routers (lifecycle_status);

-- Every WireGuard router gets the next free tunnel address, under a lock on
-- network_settings so two registrations never pick the same one.
create or replace function public.assign_router_tunnel_ip()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  s public.network_settings%rowtype;
begin
  if new.connection_method <> 'wireguard' or (new.lifecycle_status = 'retired' and new.tunnel_ip is null) then
    return new;  -- direct HTTPS routers have no tunnel; a retired router may give its address back
  end if;

  select * into s from public.network_settings where id for update;

  if new.tunnel_ip is null then
    select set_masklen(network(s.tunnel_cidr) + g, 32) into new.tunnel_ip
      from generate_series(1, (1 << (32 - masklen(s.tunnel_cidr))) - 2) g
     where set_masklen(network(s.tunnel_cidr) + g, 32) <> set_masklen(s.controller_tunnel_ip, 32)
       and not exists (select 1 from public.routers r
                        where r.tunnel_ip = set_masklen(network(s.tunnel_cidr) + g, 32) and r.id <> new.id)
     order by g
     limit 1;
    if new.tunnel_ip is null then
      raise exception 'No free tunnel address left in %', s.tunnel_cidr using errcode = 'P0001';
    end if;
  elsif not (new.tunnel_ip << s.tunnel_cidr) or set_masklen(new.tunnel_ip, 32) = set_masklen(s.controller_tunnel_ip, 32) then
    raise exception 'Tunnel address % is outside % or is the controller''s', new.tunnel_ip, s.tunnel_cidr using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger trg_routers_tunnel_ip
  before insert or update of connection_method, tunnel_ip on public.routers
  for each row execute function public.assign_router_tunnel_ip();

-- ---------------------------------------------------------------------
-- 3. network_authorizations: the access grant for one purchase on one router
-- ---------------------------------------------------------------------
alter table public.network_authorizations
  add column voucher_code         text,
  add column hotspot_username     text,
  add column provisioned_at       timestamptz,
  add column revoked_at           timestamptz,
  add column revoke_reason        text,
  add column last_router_response jsonb,
  add column last_error           text,
  add column updated_at           timestamptz not null default now();

alter table public.network_authorizations
  alter column device_id drop not null,
  alter column status set default 'pending_device';  -- 'pending_device' = not yet on the router

alter table public.network_authorizations
  add constraint network_authorizations_voucher_code_key   unique (voucher_code),
  add constraint network_authorizations_purchase_router_key unique (purchase_id, router_id),
  add constraint network_authorizations_voucher_format     check (voucher_code is null or voucher_code ~ '^[A-HJ-NP-Z2-9]{8}$');

create index idx_authorizations_status_expiry on public.network_authorizations (status, expires_at);
create index idx_authorizations_router on public.network_authorizations (router_id);

-- 8 characters from 32 unambiguous symbols (no 0/O, 1/I): 40 random bits.
create or replace function public.new_voucher_code()
returns text
language plpgsql
volatile
set search_path = public, pg_temp
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  b bytea := uuid_send(gen_random_uuid());
  pos int;
  code text := '';
begin
  -- bytes 6 and 8 of a v4 UUID carry fixed version/variant bits; skip them
  foreach pos in array array[0, 1, 2, 3, 4, 5, 10, 11] loop
    code := code || substr(alphabet, (get_byte(b, pos) % 32) + 1, 1);
  end loop;
  return code;
end;
$$;

-- ---------------------------------------------------------------------
-- 4. network_sessions: link to the grant and the router's own session id
-- ---------------------------------------------------------------------
alter table public.network_sessions
  add column authorization_id  uuid references public.network_authorizations(id) on delete set null,
  add column router_session_id text,
  add column uptime_seconds    bigint,
  add column last_seen_at      timestamptz;

create unique index uq_sessions_router_active
  on public.network_sessions (router_id, router_session_id)
  where status = 'active' and router_session_id is not null;

-- ---------------------------------------------------------------------
-- 5. controller_jobs: every router action, durable and idempotent
-- ---------------------------------------------------------------------
create table public.controller_jobs (
  id               uuid primary key default gen_random_uuid(),
  kind             text not null,
  router_id        uuid not null references public.routers(id) on delete restrict,
  authorization_id uuid references public.network_authorizations(id) on delete set null,
  payload          jsonb not null default '{}'::jsonb,
  status           text not null default 'queued',
  attempts         integer not null default 0,
  max_attempts     integer not null default 8,
  run_after        timestamptz not null default now(),
  locked_by        text,
  locked_at        timestamptz,
  result           jsonb,
  router_response  jsonb,
  last_error       text,
  idempotency_key  text not null,
  requested_by     text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  finished_at      timestamptz,
  constraint controller_jobs_idempotency_key_key unique (idempotency_key),
  constraint controller_jobs_status_check check (status in ('queued', 'running', 'succeeded', 'failed', 'dead')),
  constraint controller_jobs_kind_check check (kind in (
    'router.test', 'router.sync_profiles', 'access.provision', 'access.revoke',
    'access.login', 'session.disconnect')),
  constraint controller_jobs_attempts_check check (attempts >= 0 and max_attempts between 1 and 50)
);
create index idx_jobs_claimable on public.controller_jobs (run_after) where status in ('queued', 'failed', 'running');
create index idx_jobs_router on public.controller_jobs (router_id, created_at desc);
create index idx_jobs_authorization on public.controller_jobs (authorization_id);

-- Which controller processes are alive (shown on the admin dashboard).
create table public.controller_instances (
  id                text primary key,       -- e.g. hostname:pid
  version           text,
  started_at        timestamptz not null default now(),
  last_heartbeat_at timestamptz not null default now(),
  info              jsonb not null default '{}'::jsonb
);

-- ---------------------------------------------------------------------
-- 6. Job functions. SECURITY DEFINER so the controller role needs no write
--    access to controller_jobs itself; search_path pinned.
-- ---------------------------------------------------------------------

-- Queue a job once per idempotency key. Returns the existing job if any.
create or replace function public.enqueue_job(
  p_kind             text,
  p_router_id        uuid,
  p_authorization_id uuid,
  p_payload          jsonb,
  p_idempotency_key  text,
  p_requested_by     text,
  p_run_after        timestamptz default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_status text;
begin
  insert into public.controller_jobs (kind, router_id, authorization_id, payload, idempotency_key, requested_by, run_after)
  values (p_kind, p_router_id, p_authorization_id, coalesce(p_payload, '{}'::jsonb), p_idempotency_key,
          left(p_requested_by, 200), coalesce(p_run_after, now()))
  on conflict (idempotency_key) do nothing
  returning id into v_id;

  if v_id is not null then
    return jsonb_build_object('job_id', v_id, 'created', true, 'status', 'queued');
  end if;
  select id, status into v_id, v_status from public.controller_jobs where idempotency_key = p_idempotency_key;
  return jsonb_build_object('job_id', v_id, 'created', false, 'status', v_status);
end;
$$;

-- Hand exactly one runnable job to one worker. Row locks with SKIP LOCKED
-- mean two workers never take the same job; a router with a job already
-- running is skipped, so each router gets one action at a time. A job left
-- 'running' for 5 minutes (crashed worker) becomes claimable again, so every
-- router action must be safe to repeat.
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
          or j.kind = 'router.test'
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

-- Record a job's outcome. Only the worker holding the job may complete it.
-- Failures retry with exponential backoff (15 s, 30 s, 60 s ... max 1 h);
-- p_retry_in_seconds < 0 marks a permanent failure.
create or replace function public.complete_job(
  p_job_id           uuid,
  p_worker           text,
  p_ok               boolean,
  p_result           jsonb default null,
  p_router_response  jsonb default null,
  p_error            text default null,
  p_retry_in_seconds integer default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  j public.controller_jobs%rowtype;
  v_status text;
begin
  select * into j from public.controller_jobs where id = p_job_id for update;
  if not found then
    return jsonb_build_object('outcome', 'unknown_job');
  end if;
  if j.status <> 'running' or j.locked_by is distinct from left(p_worker, 200) then
    return jsonb_build_object('outcome', 'not_owner', 'status', j.status);
  end if;

  if p_ok then
    v_status := 'succeeded';
  elsif j.attempts >= j.max_attempts or coalesce(p_retry_in_seconds, 0) < 0 then
    v_status := 'dead';
  else
    v_status := 'failed';
  end if;

  update public.controller_jobs set
    status          = v_status,
    result          = p_result,
    router_response = p_router_response,
    last_error      = case when p_ok then null else left(p_error, 2000) end,
    run_after       = case when v_status = 'failed'
                           then now() + make_interval(secs => coalesce(nullif(p_retry_in_seconds, 0),
                                                               least(3600, 15 * power(2, greatest(j.attempts - 1, 0)))::int))
                           else run_after end,
    finished_at     = case when v_status in ('succeeded', 'dead') then now() else null end,
    locked_by       = null,
    locked_at       = null,
    updated_at      = now()
  where id = j.id;

  return jsonb_build_object('outcome', v_status);
end;
$$;

-- Queue a revoke job for every grant whose time is up. Safe to call every
-- minute: the idempotency key makes each grant's revoke job exist once.
create or replace function public.enqueue_expired_revocations()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  n integer;
begin
  with due as (
    select a.id, a.router_id
      from public.network_authorizations a
     where a.status in ('pending_device', 'active')
       and a.revoked_at is null
       and a.expires_at <= now()
  ), ins as (
    insert into public.controller_jobs (kind, router_id, authorization_id, payload, idempotency_key, requested_by)
    select 'access.revoke', d.router_id, d.id, jsonb_build_object('reason', 'expired'), 'revoke:' || d.id, 'expiry'
      from due d
    on conflict (idempotency_key) do nothing
    returning 1
  )
  select count(*) into n from ins;
  return n;
end;
$$;

-- ---------------------------------------------------------------------
-- 7. Paid purchase with a router -> one access grant + one provision job,
--    inside the payment's own transaction. Any error is logged and
--    swallowed: provisioning problems must never undo a verified payment.
-- ---------------------------------------------------------------------
create or replace function public.grant_access_on_payment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_device uuid;
  v_grant  uuid;
  v_code   text;
begin
  if new.router_id is null or new.expires_at is null then
    return new;
  end if;

  begin
    if new.mac_address ~* '^([0-9a-f]{2}:){5}[0-9a-f]{2}$' and new.mac_address <> '00:00:00:00:00:00' then
      insert into public.devices (customer_id, mac_address, last_seen_at)
      values (new.customer_id, new.mac_address::macaddr, now())
      on conflict (mac_address) do update
        set last_seen_at = now(), customer_id = coalesce(public.devices.customer_id, excluded.customer_id)
      returning id into v_device;
    end if;

    for attempt in 1..5 loop
      v_code := public.new_voucher_code();
      begin
        insert into public.network_authorizations
          (purchase_id, device_id, router_id, status, expires_at, voucher_code, hotspot_username)
        values (new.id, v_device, new.router_id, 'pending_device', new.expires_at, v_code, v_code)
        on conflict (purchase_id, router_id) do nothing
        returning id into v_grant;
        exit;
      exception when unique_violation then
        null;  -- voucher code collision: draw another
      end;
    end loop;

    if v_grant is not null then
      perform public.enqueue_job('access.provision', new.router_id, v_grant,
                                 jsonb_build_object('purchase_id', new.id),
                                 'provision:' || new.id || ':' || new.router_id, 'payment');
    end if;
  exception when others then
    insert into public.activity_logs (event_type, severity, entity_id, location_id, message, metadata)
    values ('access.grant_failed', 'error', new.id::text, new.location_id,
            'Payment confirmed but the access grant could not be created',
            jsonb_build_object('sqlstate', sqlstate, 'error', sqlerrm, 'router_id', new.router_id));
  end;
  return new;
end;
$$;

create trigger trg_purchases_grant_access
  after update of status on public.purchases
  for each row
  when (new.status = 'paid' and old.status is distinct from 'paid')
  execute function public.grant_access_on_payment();

-- ---------------------------------------------------------------------
-- 8. Browser roles: nothing. Same rules as the security lockdown.
-- ---------------------------------------------------------------------
alter table public.network_settings     enable row level security;
alter table public.controller_jobs      enable row level security;
alter table public.controller_instances enable row level security;

revoke all on public.network_settings, public.controller_jobs, public.controller_instances from anon;
revoke truncate, references, trigger, maintain
  on public.network_settings, public.controller_jobs, public.controller_instances from authenticated;

revoke all on function public.enqueue_job(text, uuid, uuid, jsonb, text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.claim_next_job(text)                                    from public, anon, authenticated;
revoke all on function public.complete_job(uuid, text, boolean, jsonb, jsonb, text, integer) from public, anon, authenticated;
revoke all on function public.enqueue_expired_revocations()                           from public, anon, authenticated;
revoke all on function public.grant_access_on_payment()                               from public, anon, authenticated;
revoke all on function public.assign_router_tunnel_ip()                               from public, anon, authenticated;
revoke all on function public.new_voucher_code()                                      from public, anon, authenticated;

grant execute on function public.enqueue_job(text, uuid, uuid, jsonb, text, text, timestamptz) to service_role;
grant execute on function public.claim_next_job(text)                                    to service_role;
grant execute on function public.complete_job(uuid, text, boolean, jsonb, jsonb, text, integer) to service_role;
grant execute on function public.enqueue_expired_revocations()                           to service_role;
grant execute on function public.new_voucher_code()                                      to service_role;

-- ---------------------------------------------------------------------
-- 9. connectly_controller: the VPS's database login, least privilege.
--    Created NOLOGIN. Login and its password are set by Phillip at VPS
--    deployment (never in a migration file):
--      alter role connectly_controller login password '<generated>';
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'connectly_controller') then
    create role connectly_controller nologin noinherit;
  end if;
end;
$$;

grant usage on schema public to connectly_controller;

-- Reads it needs to act on routers. No customers, payments, phone numbers or prices.
grant select on public.network_settings, public.routers, public.network_authorizations,
                public.network_sessions, public.access_points, public.controller_jobs,
                public.controller_instances to connectly_controller;
grant select (id, name, slug) on public.locations to connectly_controller;
grant select (id, name, duration_seconds, download_limit_kbps, upload_limit_kbps,
              speed_down_mbps, speed_up_mbps, device_limit, data_limit_mb, is_active)
  on public.plans to connectly_controller;
grant select (id, plan_id, location_id, router_id, status, paid_at, expires_at, mac_address)
  on public.purchases to connectly_controller;
grant select (id, mac_address) on public.devices to connectly_controller;

-- Writes, column by column.
grant update (controller_endpoint, controller_wg_public_key, credential_public_key, credential_key_id, updated_at)
  on public.network_settings to connectly_controller;
grant update (status, is_online, routeros_version, board_name, model, uptime_seconds, cpu_usage_pct,
              memory_usage_pct, wan_status, last_heartbeat, last_seen_at, last_test_at, last_test_result,
              last_error, tls_cert_fingerprint, updated_at)
  on public.routers to connectly_controller;
grant update (status, assigned_ip, rate_limit_rule, provisioned_at, revoked_at, revoke_reason,
              last_router_response, last_error, updated_at)
  on public.network_authorizations to connectly_controller;
grant insert, update on public.network_sessions to connectly_controller;
grant update (status, connected_clients, uptime_seconds, last_seen) on public.access_points to connectly_controller;
grant insert on public.activity_logs to connectly_controller;
grant insert, update on public.controller_instances to connectly_controller;

grant execute on function public.claim_next_job(text)                                    to connectly_controller;
grant execute on function public.complete_job(uuid, text, boolean, jsonb, jsonb, text, integer) to connectly_controller;
grant execute on function public.enqueue_job(text, uuid, uuid, jsonb, text, text, timestamptz) to connectly_controller;
grant execute on function public.enqueue_expired_revocations()                           to connectly_controller;

-- RLS is on for every table; the controller is not BYPASSRLS, so it gets
-- explicit policies on exactly the tables above (column grants still apply).
create policy controller_rw on public.network_settings       for all    to connectly_controller using (true) with check (true);
create policy controller_rw on public.routers                for all    to connectly_controller using (true) with check (true);
create policy controller_rw on public.network_authorizations for all    to connectly_controller using (true) with check (true);
create policy controller_rw on public.network_sessions       for all    to connectly_controller using (true) with check (true);
create policy controller_rw on public.access_points          for all    to connectly_controller using (true) with check (true);
create policy controller_rw on public.controller_instances   for all    to connectly_controller using (true) with check (true);
create policy controller_read on public.controller_jobs      for select to connectly_controller using (true);
create policy controller_read on public.locations            for select to connectly_controller using (true);
create policy controller_read on public.plans                for select to connectly_controller using (true);
create policy controller_read on public.purchases            for select to connectly_controller using (true);
create policy controller_read on public.devices              for select to connectly_controller using (true);
create policy controller_insert on public.activity_logs      for insert to connectly_controller with check (true);

commit;
