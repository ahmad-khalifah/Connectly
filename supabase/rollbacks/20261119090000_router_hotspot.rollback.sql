-- Rollback for 20261119090000_router_hotspot.sql.
-- Fails (and changes nothing) if hotspot jobs exist, so none is silently lost.

begin;

do $$
begin
  if exists (select 1 from public.controller_jobs where kind = 'router.configure_hotspot') then
    raise exception 'router.configure_hotspot jobs exist; remove them deliberately before rolling back';
  end if;
end $$;

-- claim_next_job as in 20261118090000.
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

alter table public.controller_jobs drop constraint controller_jobs_kind_check;
alter table public.controller_jobs add constraint controller_jobs_kind_check check (kind in (
  'router.test', 'router.sync_profiles', 'access.provision', 'access.revoke',
  'access.login', 'session.disconnect'));

drop table public.router_hotspot_settings;
drop function public.router_hotspot_settings_guard();
drop function public.all_walled_garden_hosts(text[]);
drop function public.is_walled_garden_host(text);

commit;
