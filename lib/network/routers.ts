// Router registration input and lifecycle rules. Pure functions, so every
// rule here is unit-tested (tests/network-routers.test.ts).

import { isUuid } from '@/lib/admin/inputs';

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

export const CONNECTION_METHODS = ['wireguard', 'direct_https'] as const;
export type ConnectionMethod = (typeof CONNECTION_METHODS)[number];
export type Lifecycle = 'registered' | 'active' | 'suspended' | 'retired';

const IDENTIFIER_RE = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
const WG_KEY_RE = /^[A-Za-z0-9+/]{42}[AEIMQUYcgkosw048]=$/;
const HOTSPOT_RE = /^[A-Za-z0-9_-]{1,64}$/;
// Hostname or IPv4, as the controller would dial it on a public address.
const HOST_RE = /^(?=.{1,253}$)(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)*[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/;

export type RouterInput = {
  name: string;
  locationId: string;
  identifier: string;
  connectionMethod: ConnectionMethod;
  wgPublicKey: string | null;
  managementHost: string | null;
  hotspotServerName: string;
  model: string | null;
};

const text = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);

export function parseRouterInput(body: unknown): Parsed<RouterInput> {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Invalid request.' };
  const b = body as Record<string, unknown>;

  const name = text(b.name, 100);
  if (!name) return { ok: false, error: 'Router name is required.' };

  if (!isUuid(b.locationId)) return { ok: false, error: 'Choose a location.' };

  const identifier = (text(b.identifier, 64) ?? '').toLowerCase();
  if (!IDENTIFIER_RE.test(identifier))
    return { ok: false, error: 'Identifier: 1 to 64 lowercase letters, numbers and hyphens (no hyphen at either end). It must match the router identity.' };

  const connectionMethod = (b.connectionMethod ?? 'wireguard') as ConnectionMethod;
  if (!CONNECTION_METHODS.includes(connectionMethod)) return { ok: false, error: 'Unknown connection method.' };

  const wgPublicKey = text(b.wgPublicKey, 44);
  if (wgPublicKey && !WG_KEY_RE.test(wgPublicKey))
    return { ok: false, error: 'That is not a WireGuard public key (44 characters ending in "=").' };
  if (connectionMethod === 'direct_https' && wgPublicKey)
    return { ok: false, error: 'A direct HTTPS router has no WireGuard key.' };

  const managementHost = text(b.managementHost, 253);
  if (connectionMethod === 'direct_https') {
    if (!managementHost || !HOST_RE.test(managementHost))
      return { ok: false, error: 'A direct HTTPS router needs its public hostname or IP address.' };
  } else if (managementHost) {
    return { ok: false, error: 'A WireGuard router is reached through its tunnel address; leave the management address empty.' };
  }

  const hotspotServerName = text(b.hotspotServerName, 64) ?? 'hs-main';
  if (!HOTSPOT_RE.test(hotspotServerName))
    return { ok: false, error: 'Hotspot server name: letters, numbers, hyphens and underscores only.' };

  return {
    ok: true,
    value: { name, locationId: b.locationId as string, identifier, connectionMethod, wgPublicKey, managementHost, hotspotServerName, model: text(b.model, 100) },
  };
}

/** Columns a registration or edit writes. Never the credential. */
export function routerRow(r: RouterInput) {
  return {
    name: r.name,
    location_id: r.locationId,
    identifier: r.identifier,
    connection_method: r.connectionMethod,
    wg_public_key: r.wgPublicKey,
    management_ip: r.managementHost,
    hotspot_server_name: r.hotspotServerName,
    model: r.model,
    updated_at: new Date().toISOString(),
  };
}

/** Router columns safe to read for the admin pages: no credential ciphertext. */
export const ROUTER_PUBLIC_COLUMNS =
  'id, name, identifier, location_id, connection_method, lifecycle_status, status, tunnel_ip, wg_public_key, management_ip, api_user, credential_key_id, hotspot_server_name, model, routeros_version, board_name, last_seen_at, last_test_at, last_test_result, last_error, activated_at, retired_at, created_at, updated_at';

export type RouterForLifecycle = {
  lifecycle_status: Lifecycle;
  connection_method: ConnectionMethod;
  has_credential: boolean;
  wg_public_key: string | null;
  tunnel_ip: string | null;
  management_ip: string | null;
  last_test_at: string | null;
  last_test_result: { ok?: unknown } | null;
  /** The router's hotspot settings: the current version must be applied before activation. */
  hotspot: { version: number; applied_version: number | null } | null;
};

/** How recent a passing Test Connection must be to activate. */
export const TEST_VALID_FOR_MS = 24 * 60 * 60 * 1000;

/**
 * A router may become Active only after the controller has really reached it.
 * last_test_* are written by the controller alone (the app never writes
 * them), so a passing result here means a real connection succeeded.
 */
export function activationBlockers(r: RouterForLifecycle, now = Date.now()): string[] {
  const reasons: string[] = [];
  if (r.lifecycle_status !== 'registered' && r.lifecycle_status !== 'suspended')
    reasons.push(`A ${r.lifecycle_status} router cannot be activated.`);
  if (!r.has_credential) reasons.push('No API credential is stored yet.');
  if (r.connection_method === 'wireguard') {
    if (!r.wg_public_key) reasons.push("The router's WireGuard public key is missing.");
    if (!r.tunnel_ip) reasons.push('No tunnel address is assigned.');
  } else if (!r.management_ip) {
    reasons.push('The management address is missing.');
  }
  const passed = r.last_test_result?.ok === true;
  const at = r.last_test_at ? Date.parse(r.last_test_at) : NaN;
  if (!passed || Number.isNaN(at)) reasons.push('Test Connection has not passed.');
  else if (now - at > TEST_VALID_FOR_MS) reasons.push('The last passing Test Connection is older than 24 hours; test again.');
  if (!r.hotspot) reasons.push('Hotspot settings have not been saved.');
  else if (r.hotspot.applied_version !== r.hotspot.version) reasons.push('The current hotspot settings have not been applied to the router yet.');
  return reasons;
}

export function canSuspend(l: Lifecycle) {
  return l === 'active';
}
export function canRetire(l: Lifecycle) {
  return l === 'registered' || l === 'suspended';
}
export function canTest(l: Lifecycle) {
  return l !== 'retired';
}

/** Routers that may sell plans: active only. Used by the portal and checkout. */
export const SELLING_LIFECYCLE: Lifecycle = 'active';
