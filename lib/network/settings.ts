// Network-wide settings every router's hotspot uses: where the login page
// sends customers (the portal) and the sites anyone may open before paying.
// Stored in the single network_settings row; changed from Settings.

import { db } from '@/lib/db/client';
import { isWalledGardenHost } from './hotspot';

export type PortalSettings = { portal_url: string; walled_garden_hosts: string[] };

export function parsePortalSettings(raw: unknown): { ok: true; value: PortalSettings } | { ok: false; errors: Record<string, string> } {
  const b = (raw ?? {}) as Record<string, unknown>;
  const errors: Record<string, string> = {};

  let url: URL | null = null;
  try { url = new URL(String(b.portal_url ?? '').trim()); } catch { /* reported below */ }
  // The only query string allowed is a Vercel shareable link's own token
  // (_vercel_share), so phones on a protected staging preview can open the
  // portal on a test day. The router adds its own parameters after it.
  const shareOnly = url ? [...url.searchParams.keys()].every((k) => k === '_vercel_share') : false;
  if (!url || url.protocol !== 'https:' || url.username || url.password || url.hash || (url.search && !shareOnly)) {
    errors.portal_url = 'Use the full https address of the portal page, e.g. https://getconnectly.net/portal, with nothing after the path (a Vercel shareable link\'s _vercel_share is the only exception).';
  }

  const rawHosts = Array.isArray(b.walled_garden_hosts) ? b.walled_garden_hosts : String(b.walled_garden_hosts ?? '').split(/[\s,]+/);
  const hosts = [...new Set(rawHosts.map((h) => String(h).trim().toLowerCase()).filter(Boolean))].sort();
  const bad = hosts.find((h) => !isWalledGardenHost(h));
  if (bad) errors.walled_garden_hosts = `"${bad}" is not a host name. Use names like checkout.korapay.com or *.korapay.com.`;
  else if (hosts.length > 50) errors.walled_garden_hosts = 'At most 50 hosts.';
  else if (hosts.some((h) => h === '*' || /^\*\.[a-z]{2,63}$/.test(h))) errors.walled_garden_hosts = 'A whole top-level domain would let customers browse without paying.';

  if (Object.keys(errors).length || !url) return { ok: false, errors };
  return { ok: true, value: { portal_url: `${url.origin}${url.pathname}${url.search}`, walled_garden_hosts: hosts } };
}

/**
 * After a change, every router with saved hotspot settings needs the new
 * login page and walled garden: queue its hotspot job again. Returns how many
 * were queued, or null when hotspot settings do not exist yet (migration
 * 20261119090000 not applied).
 */
export async function requeueHotspotEverywhere(requestedBy: string, now = Date.now()): Promise<number | null> {
  const { data, error } = await db
    .from('router_hotspot_settings')
    .select('router_id, version, routers!inner(lifecycle_status, credential_key_id)')
    .neq('routers.lifecycle_status', 'retired');
  if (error) return null;
  let queued = 0;
  for (const row of (data ?? []) as { router_id: string; version: number; routers: { credential_key_id: string | null } | { credential_key_id: string | null }[] }[]) {
    const r = Array.isArray(row.routers) ? row.routers[0] : row.routers;
    if (!r?.credential_key_id) continue;
    const { error: e } = await db.rpc('enqueue_job', {
      p_kind: 'router.configure_hotspot',
      p_router_id: row.router_id,
      p_authorization_id: null,
      p_payload: { version: row.version, reason: 'network settings changed' },
      p_idempotency_key: `hotspot:${row.router_id}:v${row.version}:settings:${now}`,
      p_requested_by: requestedBy,
    });
    if (!e) queued += 1;
  }
  return queued;
}
