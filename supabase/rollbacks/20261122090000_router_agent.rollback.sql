-- Rolls back 20261122090000_router_agent.sql.
-- Run only after every router has agent_enabled = false (the Mac controller
-- must be running again for those routers), otherwise their jobs stop moving.

update public.routers set agent_enabled = false where agent_enabled;

-- claim_next_job as it was in 20261119090000_router_hotspot.sql.
create or replace function public.claim_next_job(p_worker text)
returns setof public.controller_jobs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
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
revoke all on function public.claim_next_job(text) from public, anon, authenticated;
grant execute on function public.claim_next_job(text) to connectly_controller;

drop function if exists public.router_agent_sync(text, jsonb, jsonb);
drop function if exists public.router_agent_issue_token(uuid);
drop table if exists public.router_agent_tokens;
alter table public.routers
  drop constraint if exists routers_agent_poll_seconds_check,
  drop column if exists agent_enabled,
  drop column if exists agent_last_seen_at,
  drop column if exists agent_version,
  drop column if exists agent_clock_offset_seconds,
  drop column if exists agent_poll_seconds;
