// Every database call the controller makes. It logs in as
// connectly_controller (see supabase/migrations/20261118090000_network_management.sql),
// so each query here touches only the tables and columns that role is granted:
// no customers, phone numbers, prices, payments, SMS or admin data. Jobs are
// taken and finished only through claim_next_job / complete_job.

import pg from 'pg';
import type { Config } from './config.ts';

export type Job = {
  id: string;
  kind: string;
  router_id: string;
  authorization_id: string | null;
  payload: Record<string, unknown>;
  attempts: number;
  max_attempts: number;
};

export type RouterRow = {
  id: string;
  name: string | null;
  identifier: string;
  location_id: string;
  connection_method: 'wireguard' | 'direct_https';
  lifecycle_status: 'registered' | 'active' | 'suspended' | 'retired';
  status: string | null;
  tunnel_ip: string | null;
  management_ip: string | null;
  api_port: number | null;
  api_user: string | null;
  credential_ciphertext: string | null;
  credential_key_id: string | null;
  tls_cert_fingerprint: string | null;
  hotspot_server_name: string | null;
  wg_public_key: string | null;
};

export type GrantRow = {
  id: string;
  purchase_id: string;
  router_id: string;
  status: 'pending_device' | 'active' | 'revoked' | 'expired';
  expires_at: string;
  voucher_code: string | null;
  hotspot_username: string | null;
  revoked_at: string | null;
  plan_id: string | null;
  speed_down_mbps: number | null;
  speed_up_mbps: number | null;
  device_limit: number | null;
  data_limit_mb: string | null;
  /** The paying device's hardware address, as the portal saw it (null when unknown). */
  device_mac: string | null;
};

const ROUTER_COLUMNS = `id, name, identifier, location_id, connection_method, lifecycle_status, status,
  host(tunnel_ip) as tunnel_ip, management_ip, api_port, api_user, credential_ciphertext, credential_key_id,
  tls_cert_fingerprint, hotspot_server_name, wg_public_key`;

export function createPool(cfg: Config): pg.Pool {
  return new pg.Pool({
    connectionString: cfg.database.connectionString,
    max: cfg.database.maxConnections,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
    application_name: `connectly-controller/${cfg.environment}`,
    ...(cfg.database.caPem ? { ssl: { ca: cfg.database.caPem, rejectUnauthorized: true } } : {}),
  });
}

export class Db {
  readonly pool: pg.Pool;
  constructor(pool: pg.Pool) {
    this.pool = pool;
  }

  async claimNextJob(worker: string): Promise<Job | null> {
    const { rows } = await this.pool.query<Job>(
      'select id, kind, router_id, authorization_id, payload, attempts, max_attempts from public.claim_next_job($1)',
      [worker],
    );
    return rows[0] ?? null;
  }

  async completeJob(a: { jobId: string; worker: string; ok: boolean; result?: unknown; routerResponse?: unknown; error?: string; retryInSeconds?: number }): Promise<string> {
    const { rows } = await this.pool.query<{ r: { outcome: string } }>(
      'select public.complete_job($1, $2, $3, $4, $5, $6, $7) as r',
      [a.jobId, a.worker, a.ok, a.result === undefined ? null : JSON.stringify(a.result),
        a.routerResponse === undefined ? null : JSON.stringify(a.routerResponse), a.error ?? null, a.retryInSeconds ?? null],
    );
    return rows[0]!.r.outcome;
  }

  async enqueueJob(kind: string, routerId: string, authorizationId: string | null, payload: object, key: string, by: string): Promise<{ job_id: string; created: boolean }> {
    const { rows } = await this.pool.query<{ r: { job_id: string; created: boolean } }>(
      'select public.enqueue_job($1, $2, $3, $4, $5, $6) as r',
      [kind, routerId, authorizationId, JSON.stringify(payload), key, by],
    );
    return rows[0]!.r;
  }

  async enqueueExpiredRevocations(): Promise<number> {
    const { rows } = await this.pool.query<{ n: number }>('select public.enqueue_expired_revocations() as n');
    return rows[0]!.n;
  }

  async heartbeat(workerId: string, version: string, info: object): Promise<void> {
    await this.pool.query(
      `insert into public.controller_instances (id, version, started_at, last_heartbeat_at, info)
       values ($1, $2, now(), now(), $3)
       on conflict (id) do update set version = excluded.version, last_heartbeat_at = now(), info = excluded.info`,
      [workerId, version, JSON.stringify(info)],
    );
  }

  async readPublishedKey(): Promise<{ credential_key_id: string | null }> {
    const { rows } = await this.pool.query<{ credential_key_id: string | null }>('select credential_key_id from public.network_settings where id');
    return rows[0] ?? { credential_key_id: null };
  }

  async readTunnelSettings(): Promise<{ controller_tunnel_ip: string; tunnel_cidr: string }> {
    const { rows } = await this.pool.query<{ controller_tunnel_ip: string; tunnel_cidr: string }>(
      'select host(controller_tunnel_ip) as controller_tunnel_ip, tunnel_cidr::text from public.network_settings where id');
    return rows[0]!;
  }

  async publishKeys(k: { credentialPublicKey: string; credentialKeyId: string; wgPublicKey: string | null; endpoint: string | null }): Promise<void> {
    await this.pool.query(
      `update public.network_settings set
         credential_public_key = $1, credential_key_id = $2,
         controller_wg_public_key = coalesce($3, controller_wg_public_key),
         controller_endpoint = coalesce($4, controller_endpoint), updated_at = now()
       where id`,
      [k.credentialPublicKey, k.credentialKeyId, k.wgPublicKey, k.endpoint],
    );
  }

  async getRouter(id: string): Promise<RouterRow | null> {
    const { rows } = await this.pool.query<RouterRow>(`select ${ROUTER_COLUMNS} from public.routers where id = $1`, [id]);
    return rows[0] ?? null;
  }

  async listRouters(lifecycles: string[]): Promise<RouterRow[]> {
    const { rows } = await this.pool.query<RouterRow>(
      `select ${ROUTER_COLUMNS} from public.routers where lifecycle_status = any($1) order by identifier`, [lifecycles]);
    return rows;
  }

  async getGrant(id: string): Promise<GrantRow | null> {
    const { rows } = await this.pool.query<GrantRow>(
      `select a.id, a.purchase_id, a.router_id, a.status, a.expires_at, a.voucher_code, a.hotspot_username, a.revoked_at,
              p.plan_id, pl.speed_down_mbps, pl.speed_up_mbps, pl.device_limit, pl.data_limit_mb,
              d.mac_address::text as device_mac
         from public.network_authorizations a
         left join public.purchases p on p.id = a.purchase_id
         left join public.plans pl on pl.id = p.plan_id
         left join public.devices d on d.id = a.device_id
        where a.id = $1`, [id]);
    return rows[0] ?? null;
  }

  /** Grants that should exist on this router right now. */
  async liveGrantsForRouter(routerId: string): Promise<{ id: string; hotspot_username: string; status: string }[]> {
    const { rows } = await this.pool.query<{ id: string; hotspot_username: string; status: string }>(
      `select id, hotspot_username, status from public.network_authorizations
        where router_id = $1 and status in ('pending_device', 'active') and revoked_at is null
          and expires_at > now() and hotspot_username is not null`, [routerId]);
    return rows;
  }

  async recordTest(routerId: string, r: { result: object; ok: boolean; error: string | null; fingerprint: string | null; version: string | null; board: string | null }): Promise<void> {
    await this.pool.query(
      `update public.routers set
         last_test_at = now(), last_test_result = $2, last_error = $3,
         tls_cert_fingerprint = coalesce(tls_cert_fingerprint, $4),
         routeros_version = coalesce($5, routeros_version), board_name = coalesce($6, board_name),
         last_seen_at = case when $7 then now() else last_seen_at end, updated_at = now()
       where id = $1`,
      [routerId, JSON.stringify(r.result), r.error, r.fingerprint, r.version, r.board, r.ok],
    );
  }

  async recordHealth(routerId: string, h: { online: boolean; version?: string; uptimeSeconds?: number; cpu?: number; memory?: number; error?: string | null }): Promise<void> {
    if (h.online) {
      await this.pool.query(
        `update public.routers set status = 'online', is_online = true, last_seen_at = now(), last_heartbeat = now(),
           routeros_version = $2, uptime_seconds = $3, cpu_usage_pct = $4, memory_usage_pct = $5, last_error = null, updated_at = now()
         where id = $1`, [routerId, h.version, h.uptimeSeconds, h.cpu, h.memory]);
    } else {
      await this.pool.query(
        `update public.routers set status = 'offline', is_online = false, last_error = $2, updated_at = now() where id = $1`,
        [routerId, h.error ?? null]);
    }
  }

  async markProvisioned(grantId: string, rateLimit: string | null, response: object): Promise<void> {
    await this.pool.query(
      `update public.network_authorizations set status = 'active', provisioned_at = coalesce(provisioned_at, now()),
         rate_limit_rule = $2, last_router_response = $3, last_error = null, updated_at = now()
       where id = $1 and revoked_at is null`, [grantId, rateLimit, JSON.stringify(response)]);
  }

  async markRevoked(grantId: string, status: 'expired' | 'revoked', reason: string, response: object): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      await client.query(
        `update public.network_authorizations set status = $2, revoked_at = coalesce(revoked_at, now()),
           revoke_reason = coalesce(revoke_reason, $3), last_router_response = $4, last_error = null, updated_at = now()
         where id = $1`, [grantId, status, reason, JSON.stringify(response)]);
      await client.query(
        `update public.network_sessions set status = 'terminated', session_end = coalesce(session_end, now())
          where authorization_id = $1 and status = 'active'`, [grantId]);
      await client.query('commit');
    } catch (e) {
      await client.query('rollback').catch(() => {});
      throw e;
    } finally {
      client.release();
    }
  }

  async recordGrantError(grantId: string, error: string): Promise<void> {
    await this.pool.query('update public.network_authorizations set last_error = $2, updated_at = now() where id = $1', [grantId, error.slice(0, 2000)]);
  }

  async getHotspotSettings(routerId: string): Promise<(import('./hotspot.ts').HotspotSettings & { applied_version: number | null }) | null> {
    const { rows } = await this.pool.query(
      `select lan_interface, gateway_cidr::text as gateway_cidr, dns_name, extra_walled_garden, version, applied_version
         from public.router_hotspot_settings where router_id = $1`, [routerId]);
    return rows[0] ?? null;
  }

  async getPortalSettings(): Promise<import('./hotspot.ts').PortalSettings> {
    const { rows } = await this.pool.query('select portal_url, walled_garden_hosts from public.network_settings where id');
    return rows[0];
  }

  async recordHotspotApplied(routerId: string, version: number): Promise<void> {
    await this.pool.query(
      `update public.router_hotspot_settings set applied_version = least($2, version), applied_at = now(), last_error = null, updated_at = now()
        where router_id = $1`, [routerId, version]);
  }

  async recordHotspotError(routerId: string, error: string): Promise<void> {
    await this.pool.query('update public.router_hotspot_settings set last_error = $2, updated_at = now() where router_id = $1', [routerId, error.slice(0, 2000)]);
  }

  async logActivity(eventType: string, severity: 'info' | 'warn' | 'error', entityId: string, locationId: string | null, message: string, metadata: object = {}): Promise<void> {
    await this.pool.query(
      `insert into public.activity_logs (event_type, severity, entity_id, location_id, message, metadata) values ($1, $2, $3, $4, $5, $6)`,
      [eventType, severity, entityId, locationId, message, JSON.stringify(metadata)]);
  }
}
