// What each job kind does on a router. Every handler is safe to run twice
// (a crashed controller's job is handed out again after 5 minutes): it looks
// before it creates, and tags what it creates with the grant id.

import type { Db, GrantRow, Job, RouterRow } from './db.ts';
import { decryptRouterPassword, KeyError, type CredentialKeys } from './keys.ts';
import { formatRouterOsDuration, RouterError, type RouterClient } from './routeros.ts';
import type { Logger } from './log.ts';
import { applyHotspot, planHotspot } from './hotspot.ts';

export const ROUTER_API_USER = 'connectly-ctrl';

export type JobOutcome =
  | { ok: true; result: Record<string, unknown>; routerResponse?: Record<string, unknown> }
  | { ok: false; error: string; retryInSeconds?: number; result?: Record<string, unknown> };

export type ConnectFn = (target: { host: string; port: number; user: string; password: string; pinnedFingerprint: string | null }) => RouterClient;

export type JobContext = {
  db: Db;
  keys: CredentialKeys;
  connect: ConnectFn;
  log: Logger;
  now?: () => Date;
};

/** Where the controller reaches a router: its tunnel address, or its management address for direct HTTPS. */
export function routerHost(r: RouterRow): string | null {
  return r.connection_method === 'wireguard' ? r.tunnel_ip : r.management_ip;
}

/** Opens a client for a router, decrypting its credential in memory only. */
export function clientFor(router: RouterRow, ctx: JobContext): RouterClient {
  const host = routerHost(router);
  if (!host) throw new KeyError('The router has no address to connect to yet.');
  if (!router.credential_ciphertext) throw new KeyError('The router has no API credential yet. Issue one from its page.');
  const password = decryptRouterPassword(ctx.keys, router.credential_ciphertext, router.credential_key_id);
  return ctx.connect({ host, port: router.api_port || 443, user: router.api_user || ROUTER_API_USER, password, pinnedFingerprint: router.tls_cert_fingerprint });
}

/** Plan speeds as a RouterOS user profile: rate-limit is "upload/download" from the client's side. */
export function profileFor(g: GrantRow): { name: string; rateLimit: string; sharedUsers: number } {
  const down = Math.max(1, g.speed_down_mbps ?? 5);
  const up = Math.max(1, g.speed_up_mbps ?? 2);
  const shared = Math.max(1, g.device_limit ?? 1);
  return { name: `cx-${down}M-${up}M-${shared}d`, rateLimit: `${up}M/${down}M`, sharedUsers: shared };
}

function failure(e: unknown): JobOutcome {
  if (e instanceof RouterError) return { ok: false, error: e.message, retryInSeconds: e.permanent ? -1 : undefined };
  if (e instanceof KeyError) return { ok: false, error: e.message, retryInSeconds: -1 };
  throw e; // database or programming error: let the worker log it and leave the job to be reclaimed
}

async function routerTest(job: Job, router: RouterRow, ctx: JobContext): Promise<JobOutcome> {
  const started = Date.now();
  let client: RouterClient | null = null;
  try {
    client = clientFor(router, ctx);
    const identity = await client.identity();
    const res = await client.resource();
    const identityMatches = identity === router.identifier;
    const result = {
      ok: identityMatches,
      checked_at: (ctx.now?.() ?? new Date()).toISOString(),
      latency_ms: Date.now() - started,
      identity,
      identity_matches: identityMatches,
      routeros_version: res.version,
      board_name: res.boardName,
      ...(identityMatches ? {} : { error: `The router at this address calls itself "${identity}", not "${router.identifier}".` }),
    };
    await ctx.db.recordTest(router.id, {
      result, ok: identityMatches, error: identityMatches ? null : (result.error as string),
      fingerprint: identityMatches ? client.observedFingerprint : null, version: res.version, board: res.boardName,
    });
    return identityMatches ? { ok: true, result } : { ok: false, error: result.error as string, retryInSeconds: -1, result };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (!(e instanceof RouterError || e instanceof KeyError)) throw e;
    const result = { ok: false, checked_at: (ctx.now?.() ?? new Date()).toISOString(), latency_ms: Date.now() - started, error: message, error_kind: e instanceof RouterError ? e.kind : 'credential' };
    await ctx.db.recordTest(router.id, { result, ok: false, error: message, fingerprint: null, version: null, board: null });
    // A connection test answers now; the admin presses Test again rather than waiting for retries.
    return { ok: false, error: message, retryInSeconds: -1, result };
  }
}

async function provision(job: Job, router: RouterRow, ctx: JobContext): Promise<JobOutcome> {
  if (!job.authorization_id) return { ok: false, error: 'Provision job has no access grant.', retryInSeconds: -1 };
  const grant = await ctx.db.getGrant(job.authorization_id);
  if (!grant) return { ok: false, error: 'The access grant no longer exists.', retryInSeconds: -1 };
  if (grant.router_id !== router.id) return { ok: false, error: 'The access grant belongs to a different router.', retryInSeconds: -1 };
  if (!grant.hotspot_username || !grant.voucher_code) return { ok: false, error: 'The access grant has no voucher code.', retryInSeconds: -1 };

  const now = ctx.now?.() ?? new Date();
  const remaining = Math.floor((Date.parse(grant.expires_at) - now.getTime()) / 1000);
  if (grant.revoked_at || grant.status === 'revoked' || grant.status === 'expired' || remaining <= 0) {
    return { ok: true, result: { skipped: 'The access grant has ended; nothing was added to the router.' } };
  }

  try {
    const client = clientFor(router, ctx);
    const profile = profileFor(grant);
    await client.ensureUserProfile(profile);
    const fields = {
      password: grant.voucher_code,
      profile: profile.name,
      // Backstop: the router itself cuts the user off even if the controller is down at expiry.
      limitUptime: formatRouterOsDuration(remaining),
      ...(grant.data_limit_mb ? { limitBytesTotal: Number(grant.data_limit_mb) * 1024 * 1024 } : {}),
      comment: `connectly:${grant.id}`,
    };
    const existing = await client.findHotspotUser(grant.hotspot_username);
    let userId: string;
    if (existing) {
      if (existing.comment && existing.comment !== fields.comment) {
        return { ok: false, error: `A hotspot user named ${grant.hotspot_username} already exists for something else; not touched.`, retryInSeconds: -1 };
      }
      await client.updateHotspotUser(existing.id, fields);
      userId = existing.id;
    } else {
      userId = await client.addHotspotUser({ name: grant.hotspot_username, ...fields });
    }
    const response = { hotspot_user_id: userId, username: grant.hotspot_username, profile: profile.name, limit_uptime: fields.limitUptime, updated: Boolean(existing) };
    await ctx.db.markProvisioned(grant.id, profile.rateLimit, response);
    // The code is on the router: now log the paying device in, so the customer
    // is online without visiting the router's (plain HTTP) login page.
    const autoLogin = await logInPayingDevice(client, grant);
    return { ok: true, result: { provisioned: true, username: grant.hotspot_username, auto_login: autoLogin }, routerResponse: { ...response, auto_login: autoLogin } };
  } catch (e) {
    if (e instanceof RouterError || e instanceof KeyError) await ctx.db.recordGrantError(grant.id, e.message);
    return failure(e);
  }
}

export type AutoLogin =
  | { status: 'logged_in'; ip: string }
  | { status: 'already_online' }
  | { status: 'device_not_seen' }
  | { status: 'no_device' }
  | { status: 'failed'; error: string };

/**
 * Logs the device that paid into the hotspot with its code, using the
 * router's own record of that device (/ip/hotspot/host: hardware address ->
 * current address). Best effort: the code is already on the router, so a
 * failure here leaves the customer with the code and the Connect button, and
 * never fails or repeats the provisioning job.
 */
export async function logInPayingDevice(client: RouterClient, grant: GrantRow): Promise<AutoLogin> {
  if (!grant.device_mac || !grant.hotspot_username || !grant.voucher_code) return { status: 'no_device' };
  const mac = grant.device_mac.toUpperCase();
  try {
    if ((await client.list('/ip/hotspot/active', { 'mac-address': mac })).length > 0) return { status: 'already_online' };
    const [host] = await client.list('/ip/hotspot/host', { 'mac-address': mac });
    if (!host?.address) return { status: 'device_not_seen' };
    await client.command('/ip/hotspot/active/login', { user: grant.hotspot_username, password: grant.voucher_code, 'mac-address': mac, ip: host.address });
    const ok = (await client.list('/ip/hotspot/active', { 'mac-address': mac })).some((a) => a.user === grant.hotspot_username);
    return ok ? { status: 'logged_in', ip: host.address } : { status: 'failed', error: 'The router accepted the login but shows no session.' };
  } catch (e) {
    return { status: 'failed', error: e instanceof Error ? e.message : String(e) };
  }
}

async function revoke(job: Job, router: RouterRow, ctx: JobContext): Promise<JobOutcome> {
  if (!job.authorization_id) return { ok: false, error: 'Revoke job has no access grant.', retryInSeconds: -1 };
  const grant = await ctx.db.getGrant(job.authorization_id);
  if (!grant) return { ok: true, result: { skipped: 'The access grant no longer exists.' } };
  const reason = typeof job.payload.reason === 'string' ? job.payload.reason : 'revoked';
  try {
    const removedSessions: string[] = [];
    let removedUser = false;
    if (grant.hotspot_username) {
      const client = clientFor(router, ctx);
      for (const s of await client.listActive(grant.hotspot_username)) {
        await client.removeActive(s.id);
        removedSessions.push(s.id);
      }
      const user = await client.findHotspotUser(grant.hotspot_username);
      if (user && (!user.comment || user.comment === `connectly:${grant.id}`)) {
        await client.removeHotspotUser(user.id);
        removedUser = true;
      }
    }
    const response = { removed_user: removedUser, removed_sessions: removedSessions };
    await ctx.db.markRevoked(grant.id, reason === 'expired' ? 'expired' : 'revoked', reason, response);
    return { ok: true, result: response, routerResponse: response };
  } catch (e) {
    if (e instanceof RouterError || e instanceof KeyError) await ctx.db.recordGrantError(grant.id, e.message);
    return failure(e);
  }
}

async function disconnect(job: Job, router: RouterRow, ctx: JobContext): Promise<JobOutcome> {
  const sessionId = typeof job.payload.router_session_id === 'string' ? job.payload.router_session_id : null;
  if (!sessionId) return { ok: false, error: 'Disconnect job has no router session id.', retryInSeconds: -1 };
  try {
    await clientFor(router, ctx).removeActive(sessionId);
    return { ok: true, result: { disconnected: sessionId } };
  } catch (e) {
    return failure(e);
  }
}

async function configureHotspot(job: Job, router: RouterRow, ctx: JobContext): Promise<JobOutcome> {
  const settings = await ctx.db.getHotspotSettings(router.id);
  if (!settings) return { ok: false, error: 'No hotspot settings are saved for this router yet.', retryInSeconds: -1 };
  try {
    const plan = planHotspot(router.identifier, settings, await ctx.db.getPortalSettings());
    const report = await applyHotspot(clientFor(router, ctx), plan);
    await ctx.db.recordHotspotApplied(router.id, settings.version);
    await ctx.db.logActivity('router.hotspot_applied', 'info', router.id, router.location_id,
      `Hotspot settings v${settings.version} applied to ${router.identifier}`, { created: report.created.length, updated: report.updated.length, removed: report.removed.length });
    return { ok: true, result: { version: settings.version, ...report } };
  } catch (e) {
    if (e instanceof RouterError || e instanceof KeyError) await ctx.db.recordHotspotError(router.id, e.message);
    return failure(e);
  }
}

export async function runJob(job: Job, ctx: JobContext): Promise<JobOutcome> {
  const router = await ctx.db.getRouter(job.router_id);
  if (!router) return { ok: false, error: 'The router no longer exists.', retryInSeconds: -1 };
  switch (job.kind) {
    case 'router.test':
      return routerTest(job, router, ctx);
    case 'access.provision':
      return provision(job, router, ctx);
    case 'access.revoke':
      return revoke(job, router, ctx);
    case 'session.disconnect':
      return disconnect(job, router, ctx);
    case 'router.configure_hotspot':
      return configureHotspot(job, router, ctx);
    default:
      return { ok: false, error: `This controller version does not handle ${job.kind} jobs yet.`, retryInSeconds: -1 };
  }
}
