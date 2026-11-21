-- Snapshot of the staging objects that migration 20261119090000_router_hotspot replaces,
-- read from connectly-staging (ssmydcwqwytcmfhotjzs) on 2026-11-17 20:23 UTC, before any change.
--
-- staging md5(pg_get_functiondef(claim_next_job)) = 70961b0833c06a7868500e4fbd4c67c0
-- That is identical to the function below (from 20261118090000_network_management.sql),
-- which supabase/tests/hotspot.test.mjs checks and which the rollback restores verbatim.
-- staging controller_jobs_kind_check =
--   CHECK ((kind = ANY (ARRAY['router.test', 'router.sync_profiles', 'access.provision',
--                             'access.revoke', 'access.login', 'session.disconnect'])))
-- staging claim_next_job EXECUTE grants: connectly_controller, postgres, service_role
--
-- Nothing else is altered or dropped by the migration; it adds one table (empty),
-- three functions and one trigger. Staging data at snapshot time: 0 routers,
-- 0 controller jobs, 9 purchases (4 paid), all synthetic.

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

alter table public.controller_jobs drop constraint controller_jobs_kind_check;
alter table public.controller_jobs add constraint controller_jobs_kind_check check (kind in (
  'router.test', 'router.sync_profiles', 'access.provision', 'access.revoke',
  'access.login', 'session.disconnect'));
