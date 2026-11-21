-- Router agent: the router fetches its own work over HTTPS instead of the Mac
-- controller pushing it over the REST API.
--
-- STAGING FIRST. Not applied anywhere yet.
--
-- Additive and off by default. Nothing changes for any router until an admin
-- issues it a token AND sets routers.agent_enabled = true. Until then every
-- function below is unreachable for that router and claim_next_job behaves
-- exactly as before.
--
--   1. routers: agent_enabled flag, last-seen, clock offset, poll interval.
--   2. router_agent_tokens: SHA-256 of each router's token, in its own table so
--      no "select *" on routers can ever carry it.
--   3. router_agent_issue_token(router): issue or rotate; shows the token once.
--   4. router_agent_sync(token_hash, results, status): ONE call per router
--      poll. Authenticates, records the router's job results, queues expired
--      revokes for that router, hands out up to 5 jobs, stores the heartbeat
--      and (optionally) the router's active sessions.
--   5. claim_next_job: the Mac controller no longer takes provision / revoke /
--      disconnect jobs for an agent-enabled router (two workers on one router
--      would collide). Everything else it does (configure hotspot, test) stays.
--
-- Rollback: supabase/rollbacks/20261122090000_router_agent.rollback.sql.
-- Fast switch-off without any SQL file:
--   update public.routers set agent_enabled = false where id = '<router>';
-- The Mac controller then takes that router's queued jobs again; jobs the
-- agent had running are re-claimable after 5 minutes.

-- ---------------------------------------------------------------------
-- 1. routers
-- ---------------------------------------------------------------------
alter table public.routers
  add column agent_enabled              boolean     not null default false,
  add column agent_last_seen_at         timestamptz,
  add column agent_version              text,
  add column agent_clock_offset_seconds integer,
  add column agent_poll_seconds         integer     not null default 15;

alter table public.routers
  add constraint routers_agent_poll_seconds_check check (agent_poll_seconds between 5 and 300);

-- ---------------------------------------------------------------------
-- 2. tokens (hash only; the token itself is shown once, at issue)
-- ---------------------------------------------------------------------
create table public.router_agent_tokens (
  router_id  uuid primary key references public.routers(id) on delete cascade,
  token_hash text not null,
  created_at timestamptz not null default now(),
  rotated_at timestamptz,
  constraint router_agent_tokens_hash_key unique (token_hash),
  constraint router_agent_tokens_hash_format check (token_hash ~ '^[0-9a-f]{64}$')
);

alter table public.router_agent_tokens enable row level security;
revoke all on public.router_agent_tokens from anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. issue / rotate a token. 244 random bits (two UUIDv4, dashes removed);
--    far too long to guess, so storing a plain SHA-256 is enough.
-- ---------------------------------------------------------------------
create or replace function public.router_agent_issue_token(p_router_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_token text := 'cxa_' || replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  v_hash  text := encode(sha256(convert_to(v_token, 'utf8')), 'hex');
begin
  if not exists (select 1 from public.routers where id = p_router_id and lifecycle_status <> 'retired') then
    raise exception 'router not found or retired';
  end if;
  insert into public.router_agent_tokens (router_id, token_hash)
  values (p_router_id, v_hash)
  on conflict (router_id) do update set token_hash = excluded.token_hash, rotated_at = now();
  return v_token;
end;
$$;

-- ---------------------------------------------------------------------
-- 4. the poll
--
--   p_token_hash  hex SHA-256 of the bearer token (the Worker hashes it)
--   p_results     [{job_id, ok, error?, retryable?, response?}] for jobs this
--                 router was handed earlier
--   p_status      {version?, uptime_seconds?, cpu?, memory?, router_epoch?,
--                  agent_version?, sessions?: [{id, user, mac, ip, uptime,
--                  bytes_in, bytes_out}]}   (the Worker sanitises it)
--
-- Returns {ok:false} for an unknown token, a disabled agent or a retired
-- router (the Worker answers 401). Otherwise {ok:true, server_epoch,
-- poll_after_seconds, jobs:[...], accepted, ignored}.
-- ---------------------------------------------------------------------
create or replace function public.router_agent_sync(
  p_token_hash text,
  p_results    jsonb default '[]'::jsonb,
  p_status     jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r         public.routers%rowtype;
  v_worker  text;
  v_item    jsonb;
  j         public.controller_jobs%rowtype;
  g         record;
  v_ok      boolean;
  v_accepted integer := 0;
  v_ignored  integer := 0;
  v_jobs    jsonb := '[]'::jsonb;
  v_epoch   double precision := extract(epoch from now());
  v_rate    text;
  v_remaining integer;
  v_router_epoch bigint;
begin
  select rt.* into r
    from public.router_agent_tokens t
    join public.routers rt on rt.id = t.router_id
   where t.token_hash = p_token_hash
     and rt.agent_enabled
     and rt.lifecycle_status <> 'retired';
  if not found then
    return jsonb_build_object('ok', false);
  end if;
  v_worker := 'agent:' || r.id;

  -- 4a. heartbeat
  begin
    v_router_epoch := nullif(p_status->>'router_epoch', '')::bigint;
  exception when others then
    v_router_epoch := null;
  end;
  update public.routers set
    agent_last_seen_at = now(),
    agent_version = coalesce(left(p_status->>'agent_version', 40), agent_version),
    agent_clock_offset_seconds = case when v_router_epoch is null then agent_clock_offset_seconds
                                      else (v_router_epoch - floor(v_epoch))::integer end,
    status = 'online', is_online = true, last_seen_at = now(), last_heartbeat = now(), last_error = null,
    routeros_version = coalesce(left(p_status->>'version', 40), routeros_version),
    uptime_seconds = coalesce((p_status->>'uptime_seconds')::bigint, uptime_seconds),
    cpu_usage_pct = coalesce((p_status->>'cpu')::numeric, cpu_usage_pct),
    memory_usage_pct = coalesce((p_status->>'memory')::numeric, memory_usage_pct),
    updated_at = now()
  where id = r.id;

  -- 4b. results of jobs handed out earlier (at most 20 per poll)
  for v_item in select e from jsonb_array_elements(case when jsonb_typeof(p_results) = 'array' then p_results else '[]'::jsonb end) with ordinality as t(e, n) where n <= 20
  loop
    select * into j from public.controller_jobs
     where id = (case when (v_item->>'job_id') ~* '^[0-9a-f-]{36}$' then (v_item->>'job_id')::uuid end)
       and router_id = r.id and locked_by = v_worker and status = 'running'
     for update;
    if not found then
      v_ignored := v_ignored + 1;
      continue;
    end if;
    v_ok := coalesce((v_item->>'ok')::boolean, false);

    if v_ok and j.kind = 'access.provision' and j.authorization_id is not null then
      select pl.speed_up_mbps, pl.speed_down_mbps into g
        from public.network_authorizations a
        left join public.purchases p on p.id = a.purchase_id
        left join public.plans pl on pl.id = p.plan_id
       where a.id = j.authorization_id;
      v_rate := greatest(1, coalesce(g.speed_up_mbps, 2)) || 'M/' || greatest(1, coalesce(g.speed_down_mbps, 5)) || 'M';
      update public.network_authorizations set
        status = 'active', provisioned_at = coalesce(provisioned_at, now()), rate_limit_rule = v_rate,
        last_router_response = coalesce(v_item->'response', '{}'::jsonb), last_error = null, updated_at = now()
      where id = j.authorization_id and revoked_at is null;
    elsif v_ok and j.kind = 'access.revoke' and j.authorization_id is not null then
      update public.network_authorizations set
        status = case when j.payload->>'reason' = 'expired' then 'expired'::public.auth_status else 'revoked'::public.auth_status end,
        revoked_at = coalesce(revoked_at, now()), revoke_reason = coalesce(revoke_reason, coalesce(j.payload->>'reason', 'revoked')),
        last_router_response = coalesce(v_item->'response', '{}'::jsonb), last_error = null, updated_at = now()
      where id = j.authorization_id;
      update public.network_sessions set status = 'terminated', session_end = coalesce(session_end, now())
       where authorization_id = j.authorization_id and status = 'active';
    elsif not v_ok and j.authorization_id is not null then
      update public.network_authorizations set last_error = left(coalesce(v_item->>'error', 'router reported a failure'), 2000), updated_at = now()
       where id = j.authorization_id;
    end if;

    perform public.complete_job(
      j.id, v_worker, v_ok, coalesce(v_item->'response', '{}'::jsonb), v_item->'response',
      left(v_item->>'error', 2000),
      case when v_ok then null when coalesce((v_item->>'retryable')::boolean, true) then null else -1 end);
    v_accepted := v_accepted + 1;
  end loop;

  -- 4c. optional: the router's active sessions, for the dashboard. A bad row
  --     here must never stop jobs from being handed out.
  if jsonb_typeof(p_status->'sessions') = 'array' then
    begin
      update public.network_sessions s set status = 'terminated', session_end = coalesce(s.session_end, now())
       where s.router_id = r.id and s.status = 'active'
         and not exists (select 1 from jsonb_to_recordset(p_status->'sessions') as c(id text, mac text)
                          where c.id = s.router_session_id and c.mac = s.mac_address);
      insert into public.network_sessions
        (router_id, location_id, authorization_id, router_session_id, mac_address, ip_address,
         uptime_seconds, bytes_in, bytes_out, session_start, last_seen_at, status)
      select r.id, r.location_id,
             (select a.id from public.network_authorizations a where a.router_id = r.id and a.hotspot_username = c."user" limit 1),
             c.id, c.mac,
             c.ip::inet,
             coalesce(c.uptime, 0), coalesce(c.bytes_in, 0), coalesce(c.bytes_out, 0),
             now() - make_interval(secs => coalesce(c.uptime, 0)::double precision), now(), 'active'
        from jsonb_to_recordset(p_status->'sessions')
             as c(id text, "user" text, mac text, ip text, uptime bigint, bytes_in bigint, bytes_out bigint)
       where c.id is not null and c.mac is not null
         and c.ip ~ '^((25[0-5]|2[0-4][0-9]|1?[0-9]{1,2})\.){3}(25[0-5]|2[0-4][0-9]|1?[0-9]{1,2})$'
      on conflict (router_id, router_session_id) where status = 'active' and router_session_id is not null
      do update set ip_address = excluded.ip_address, uptime_seconds = excluded.uptime_seconds,
                    bytes_in = excluded.bytes_in, bytes_out = excluded.bytes_out, last_seen_at = now(),
                    authorization_id = coalesce(public.network_sessions.authorization_id, excluded.authorization_id);
    exception when others then
      null;
    end;
  end if;

  -- 4d. expiry: queue a revoke for every grant on THIS router whose time is up
  --     (the Mac controller's sweep does the same for all routers; the key
  --     makes it once per grant).
  insert into public.controller_jobs (kind, router_id, authorization_id, payload, idempotency_key, requested_by)
  select 'access.revoke', a.router_id, a.id, jsonb_build_object('reason', 'expired'), 'revoke:' || a.id, 'expiry'
    from public.network_authorizations a
   where a.router_id = r.id and a.status in ('pending_device', 'active')
     and a.revoked_at is null and a.expires_at <= now()
  on conflict (idempotency_key) do nothing;

  -- 4e. hand out work. Jobs the agent was given but never reported are
  --     handed out again after 90 s (every action here is safe to repeat).
  update public.controller_jobs
     set status = 'dead', last_error = coalesce(last_error, 'agent stopped responding'),
         finished_at = now(), updated_at = now(), locked_by = null, locked_at = null
   where router_id = r.id and status = 'running' and locked_at < now() - interval '90 seconds'
     and attempts >= max_attempts;

  for j in
    with picked as (
      select x.id from public.controller_jobs x
       where x.router_id = r.id
         and x.kind in ('access.provision', 'access.revoke', 'session.disconnect')
         and (r.lifecycle_status = 'active' or x.kind in ('access.revoke', 'session.disconnect'))
         and (x.status in ('queued', 'failed') or (x.status = 'running' and x.locked_at < now() - interval '90 seconds'))
         and x.run_after <= now() and x.attempts < x.max_attempts
       order by x.run_after, x.created_at
       for update skip locked
       limit 5
    )
    update public.controller_jobs c
       set status = 'running', attempts = c.attempts + 1, locked_by = v_worker, locked_at = now(), updated_at = now()
      from picked where c.id = picked.id
    returning c.*
  loop
    if j.kind = 'session.disconnect' then
      v_jobs := v_jobs || jsonb_build_object('job_id', j.id, 'kind', j.kind, 'router_session_id', j.payload->>'router_session_id');
      continue;
    end if;

    select a.id as grant_id, a.status, a.expires_at, a.voucher_code, a.hotspot_username, a.revoked_at,
           pl.speed_up_mbps, pl.speed_down_mbps, pl.device_limit, pl.data_limit_mb, d.mac_address::text as device_mac
      into g
      from public.network_authorizations a
      left join public.purchases p on p.id = a.purchase_id
      left join public.plans pl on pl.id = p.plan_id
      left join public.devices d on d.id = a.device_id
     where a.id = j.authorization_id;

    if not found then
      perform public.complete_job(j.id, v_worker, true, jsonb_build_object('skipped', 'The access grant no longer exists.'));
      continue;
    end if;

    if j.kind = 'access.revoke' then
      v_jobs := v_jobs || jsonb_build_object('job_id', j.id, 'kind', j.kind, 'grant_id', g.grant_id,
                                             'username', g.hotspot_username, 'reason', coalesce(j.payload->>'reason', 'revoked'));
      continue;
    end if;

    -- access.provision
    v_remaining := floor(extract(epoch from (g.expires_at - now())))::integer;
    if g.hotspot_username is null or g.voucher_code is null then
      perform public.complete_job(j.id, v_worker, false, null, null, 'The access grant has no voucher code.', -1);
      continue;
    end if;
    if g.revoked_at is not null or g.status in ('revoked', 'expired') or v_remaining <= 0 then
      perform public.complete_job(j.id, v_worker, true, jsonb_build_object('skipped', 'The access grant has ended; nothing was added to the router.'));
      continue;
    end if;
    v_jobs := v_jobs || jsonb_build_object(
      'job_id', j.id, 'kind', j.kind, 'grant_id', g.grant_id,
      'username', g.hotspot_username, 'password', g.voucher_code,
      'profile', jsonb_build_object(
        'name', 'cx-' || greatest(1, coalesce(g.speed_down_mbps, 5)) || 'M-' || greatest(1, coalesce(g.speed_up_mbps, 2)) || 'M-' || greatest(1, coalesce(g.device_limit, 1)) || 'd',
        'rate_limit', greatest(1, coalesce(g.speed_up_mbps, 2)) || 'M/' || greatest(1, coalesce(g.speed_down_mbps, 5)) || 'M',
        'shared_users', greatest(1, coalesce(g.device_limit, 1))),
      'remaining_seconds', v_remaining,
      'expires_epoch', floor(extract(epoch from g.expires_at))::bigint,
      'limit_bytes_total', case when g.data_limit_mb is null then null else g.data_limit_mb::bigint * 1024 * 1024 end,
      'comment', 'connectly:' || g.grant_id,
      'device_mac', g.device_mac);
  end loop;

  return jsonb_build_object(
    'ok', true,
    'server_epoch', floor(v_epoch)::bigint,
    'poll_after_seconds', r.agent_poll_seconds,
    'jobs', v_jobs,
    'accepted', v_accepted,
    'ignored', v_ignored);
end;
$$;

-- ---------------------------------------------------------------------
-- 5. claim_next_job: same as 20261119090000, plus one condition. An
--    agent-enabled router's grant jobs belong to its agent, not the Mac.
-- ---------------------------------------------------------------------
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
     and not (r.agent_enabled and j.kind in ('access.provision', 'access.revoke', 'access.login', 'session.disconnect'))
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

-- ---------------------------------------------------------------------
-- Privileges: the Worker (service_role) only.
-- ---------------------------------------------------------------------
revoke all on function public.router_agent_issue_token(uuid)            from public, anon, authenticated;
revoke all on function public.router_agent_sync(text, jsonb, jsonb)      from public, anon, authenticated;
revoke all on function public.claim_next_job(text)                       from public, anon, authenticated;
grant execute on function public.router_agent_issue_token(uuid)          to service_role;
grant execute on function public.router_agent_sync(text, jsonb, jsonb)   to service_role;
grant execute on function public.claim_next_job(text)                    to connectly_controller;
