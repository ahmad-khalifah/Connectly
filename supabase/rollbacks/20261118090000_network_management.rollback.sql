-- Rollback for 20261118090000_network_management.sql
-- Returns the schema to exactly its state after the payment ledger migration.
--
-- Data loss on rollback (by design, and only of data this migration created):
--   network_settings, controller_jobs, controller_instances rows; the new
--   columns on routers, network_authorizations and network_sessions.
-- It refuses to run (and changes nothing) if restoring a NOT NULL would
-- fail: routers registered through the new screens without management_ip /
-- api_user / api_password_encrypted, or grants without a device. Those rows
-- must be reviewed by hand first.

begin;

do $$
begin
  if exists (select 1 from public.routers
              where management_ip is null or api_user is null or api_password_encrypted is null) then
    raise exception 'Rollback stopped: routers exist without management_ip/api_user/api_password_encrypted';
  end if;
  if exists (select 1 from public.network_authorizations where device_id is null) then
    raise exception 'Rollback stopped: access grants exist without a device';
  end if;
end;
$$;

-- 9. controller role
drop policy if exists controller_rw     on public.network_settings;
drop policy if exists controller_rw     on public.routers;
drop policy if exists controller_rw     on public.network_authorizations;
drop policy if exists controller_rw     on public.network_sessions;
drop policy if exists controller_rw     on public.access_points;
drop policy if exists controller_rw     on public.controller_instances;
drop policy if exists controller_read   on public.controller_jobs;
drop policy if exists controller_read   on public.locations;
drop policy if exists controller_read   on public.plans;
drop policy if exists controller_read   on public.purchases;
drop policy if exists controller_read   on public.devices;
drop policy if exists controller_insert on public.activity_logs;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'connectly_controller') then
    execute 'drop owned by connectly_controller';
    execute 'drop role connectly_controller';
  end if;
end;
$$;

-- 7. payment -> grant trigger
drop trigger if exists trg_purchases_grant_access on public.purchases;
drop function if exists public.grant_access_on_payment();

-- 6. job functions
drop function if exists public.enqueue_expired_revocations();
drop function if exists public.complete_job(uuid, text, boolean, jsonb, jsonb, text, integer);
drop function if exists public.claim_next_job(text);
drop function if exists public.enqueue_job(text, uuid, uuid, jsonb, text, text, timestamptz);

-- 5. job tables
drop table if exists public.controller_instances;
drop table if exists public.controller_jobs;

-- 4. network_sessions
drop index if exists public.uq_sessions_router_active;
alter table public.network_sessions
  drop column if exists last_seen_at,
  drop column if exists uptime_seconds,
  drop column if exists router_session_id,
  drop column if exists authorization_id;

-- 3. network_authorizations
drop function if exists public.new_voucher_code();
drop index if exists public.idx_authorizations_router;
drop index if exists public.idx_authorizations_status_expiry;
alter table public.network_authorizations
  drop constraint if exists network_authorizations_voucher_format,
  drop constraint if exists network_authorizations_purchase_router_key,
  drop constraint if exists network_authorizations_voucher_code_key;
alter table public.network_authorizations
  alter column status set default 'active',
  alter column device_id set not null;
alter table public.network_authorizations
  drop column if exists updated_at,
  drop column if exists last_error,
  drop column if exists last_router_response,
  drop column if exists revoke_reason,
  drop column if exists revoked_at,
  drop column if exists provisioned_at,
  drop column if exists hotspot_username,
  drop column if exists voucher_code;

-- 2. routers
drop trigger if exists trg_routers_tunnel_ip on public.routers;
drop function if exists public.assign_router_tunnel_ip();
drop index if exists public.idx_routers_lifecycle;
alter table public.routers
  drop constraint if exists routers_wg_public_key_key,
  drop constraint if exists routers_tunnel_ip_key,
  drop constraint if exists routers_active_needs_credential,
  drop constraint if exists routers_tunnel_ip_host,
  drop constraint if exists routers_wg_public_key_format,
  drop constraint if exists routers_lifecycle_status_check,
  drop constraint if exists routers_connection_method_check;
alter table public.routers
  alter column api_port               set default 8728,
  alter column wan_status             set default 'connected',
  alter column last_heartbeat         set default now(),
  alter column status                 set default 'online',
  alter column api_password_encrypted set not null,
  alter column api_user               set not null,
  alter column management_ip          set not null;
alter table public.routers
  drop column if exists updated_at,
  drop column if exists retired_at,
  drop column if exists activated_at,
  drop column if exists last_error,
  drop column if exists last_test_result,
  drop column if exists last_test_at,
  drop column if exists last_seen_at,
  drop column if exists board_name,
  drop column if exists routeros_version,
  drop column if exists tls_cert_fingerprint,
  drop column if exists credential_key_id,
  drop column if exists credential_ciphertext,
  drop column if exists wg_public_key,
  drop column if exists tunnel_ip,
  drop column if exists lifecycle_status,
  drop column if exists connection_method,
  drop column if exists name;

-- 1. settings
drop table if exists public.network_settings;

commit;
