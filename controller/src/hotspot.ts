// Turning a router into a Connectly hotspot (job router.configure_hotspot).
//
// planHotspot() works out, from the portal settings, every RouterOS item the
// site needs; applyHotspot() makes the router match, looking before it
// changes anything, so applying twice changes nothing the second time.
// Everything the controller creates is named or commented "connectly",
// and nothing else on the router is touched.
//
//   address      gateway on the customer port         /ip/address        comment connectly-hotspot
//   pool         addresses handed to customers        /ip/pool           name    connectly-hotspot
//   DHCP         server + network for that pool       /ip/dhcp-server(/network)
//   DNS          answer customers' lookups, and refuse lookups from any other port
//   profile      hotspot address and DNS name         /ip/hotspot/profile name connectly
//   server       the hotspot on the customer port     /ip/hotspot        name    connectly
//   NAT          customers out to the internet        /ip/firewall/nat   comment connectly-hotspot
//   walled garden  hosts reachable before paying      /ip/hotspot/walled-garden comment connectly
//   login page   sends customers to the payment page  hotspot/login.html
//
// STATUS: RouterOS menu and field names follow RouterOS 7 documentation;
// verified on CHR only where the lab says so.

import type { RouterClient } from './routeros.ts';
import { RouterError } from './routeros.ts';

export type HotspotSettings = {
  lan_interface: string;
  gateway_cidr: string; // "10.10.0.1/22"
  dns_name: string;
  extra_walled_garden: string[];
  version: number;
};
export type PortalSettings = { portal_url: string; walled_garden_hosts: string[] };

export type HotspotPlan = {
  lanInterface: string;
  gateway: string;
  cidr: string;          // gateway with prefix, e.g. 10.10.0.1/22
  network: string;       // 10.10.0.0/22
  poolRange: string;     // 10.10.0.12-10.10.3.254
  equipmentRange: string | null; // 10.10.0.2-10.10.0.11: fixed addresses for access points and switches
  dnsName: string;
  walledGarden: string[];
  loginHtml: string;
};

export const TAG = 'connectly-hotspot';
export const NAME = 'connectly';
export const POOL = 'connectly-hotspot';
const WG_TAG = 'connectly';

const ipToInt = (ip: string) => ip.split('.').reduce((n, o) => (n << 8) + Number(o), 0) >>> 0;
const intToIp = (n: number) => [24, 16, 8, 0].map((s) => (n >>> s) & 255).join('.');

/** Addresses kept beside the gateway for equipment: 10 on /26 or larger, 2 on /27 and /28. */
export function equipmentReserve(prefix: number): number {
  return prefix <= 26 ? 10 : 2;
}

export function planHotspot(routerIdentifier: string, s: HotspotSettings, p: PortalSettings): HotspotPlan {
  const [gateway, prefixRaw] = s.gateway_cidr.split('/');
  const prefix = Number(prefixRaw);
  if (!gateway || !Number.isInteger(prefix) || prefix < 16 || prefix > 28) throw new RouterError('protocol', `Bad customer network ${s.gateway_cidr}`);
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  const g = ipToInt(gateway);
  const net = (g & mask) >>> 0;
  const bcast = (net | (~mask >>> 0)) >>> 0;
  // Customers get every address except the network, the broadcast, the gateway
  // and a small block beside the gateway kept for equipment (access points,
  // switches) with fixed addresses. Keep in step with lib/network/hotspot.ts.
  const reserve = equipmentReserve(prefix);
  const [start, end] = g === net + 1 ? [net + 2 + reserve, bcast - 1] : [net + 1, g - 1 - reserve];
  const equipment = reserve === 0 ? null : g === net + 1 ? `${intToIp(net + 2)}-${intToIp(net + 1 + reserve)}` : `${intToIp(g - reserve)}-${intToIp(g - 1)}`;

  const portal = new URL(p.portal_url);
  const hosts = [...new Set([portal.hostname, ...p.walled_garden_hosts, ...s.extra_walled_garden].map((h) => h.toLowerCase()))].sort();

  // MikroTik fills in $(mac), $(ip) and $(link-login-only-esc) for each customer.
  const target = `${p.portal_url}?router=${encodeURIComponent(routerIdentifier)}&mac=$(mac-esc)&ip=$(ip)&link=$(link-login-only-esc)`;
  const loginHtml = [
    '<!doctype html>',
    '<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">',
    `<meta http-equiv="refresh" content="0; url=${target}">`,
    '<title>Connectly WiFi</title></head>',
    `<body><p>Opening Connectly WiFi... <a href="${target}">Tap here if nothing happens</a>.</p></body></html>`,
  ].join('\n');

  return {
    lanInterface: s.lan_interface,
    gateway,
    cidr: `${gateway}/${prefix}`,
    network: `${intToIp(net)}/${prefix}`,
    poolRange: `${intToIp(start)}-${intToIp(end)}`,
    equipmentRange: equipment,
    dnsName: s.dns_name,
    walledGarden: hosts,
    loginHtml,
  };
}

export type ApplyReport = { created: string[]; updated: string[]; removed: string[]; unchanged: string[] };

/** Makes one menu entry (found by `key`) have `fields`, creating it if missing. */
async function ensure(c: RouterClient, r: ApplyReport, label: string, path: string, key: Record<string, string>, fields: Record<string, string>) {
  const rows = await c.list(path, key);
  const want = { ...key, ...fields };
  if (rows.length === 0) {
    await c.add(path, want);
    r.created.push(label);
    return;
  }
  const row = rows[0]!;
  const diff: Record<string, string> = {};
  for (const [k, v] of Object.entries(want)) if ((row[k] ?? '') !== v) diff[k] = v;
  if (Object.keys(diff).length) {
    await c.set(path, row['.id']!, diff);
    r.updated.push(label);
  } else {
    r.unchanged.push(label);
  }
  for (const extra of rows.slice(1)) {
    await c.remove(path, extra['.id']!);
    r.removed.push(`${label} (duplicate)`);
  }
}

export async function applyHotspot(c: RouterClient, plan: HotspotPlan): Promise<ApplyReport> {
  const r: ApplyReport = { created: [], updated: [], removed: [], unchanged: [] };

  if ((await c.list('/interface', { name: plan.lanInterface })).length === 0) {
    throw new RouterError('protocol', `The router has no port called "${plan.lanInterface}". Check the customer port in the hotspot settings.`);
  }

  await ensure(c, r, 'gateway address', '/ip/address', { comment: TAG }, { address: plan.cidr, interface: plan.lanInterface });
  await ensure(c, r, 'address pool', '/ip/pool', { name: POOL }, { ranges: plan.poolRange });
  await ensure(c, r, 'DHCP server', '/ip/dhcp-server', { name: POOL }, { interface: plan.lanInterface, 'address-pool': POOL, 'lease-time': '1h', disabled: 'false' });
  await ensure(c, r, 'DHCP network', '/ip/dhcp-server/network', { comment: TAG }, { address: plan.network, gateway: plan.gateway, 'dns-server': plan.gateway });

  // Customers resolve names through the router; nobody else may use it as a resolver.
  const dns = (await c.list('/ip/dns')) as unknown as Record<string, string>; // a single settings object
  if (dns['allow-remote-requests'] !== 'true') {
    await c.command('/ip/dns/set', { 'allow-remote-requests': 'true' });
    r.updated.push('DNS for customers');
  } else {
    r.unchanged.push('DNS for customers');
  }
  for (const proto of ['udp', 'tcp']) {
    await ensure(c, r, `DNS guard (${proto})`, '/ip/firewall/filter', { comment: `${TAG}-dns-${proto}` },
      { chain: 'input', protocol: proto, 'dst-port': '53', 'in-interface': `!${plan.lanInterface}`, action: 'drop' });
  }

  await ensure(c, r, 'hotspot profile', '/ip/hotspot/profile', { name: NAME }, { 'hotspot-address': plan.gateway, 'dns-name': plan.dnsName, 'login-by': 'http-chap,http-pap' });
  await ensure(c, r, 'hotspot server', '/ip/hotspot', { name: NAME }, { interface: plan.lanInterface, 'address-pool': POOL, profile: NAME, disabled: 'false' });
  await ensure(c, r, 'customer NAT', '/ip/firewall/nat', { comment: TAG }, { chain: 'srcnat', 'src-address': plan.network, action: 'masquerade' });

  // Walled garden: exactly the planned hosts, among the entries we own.
  const wg = (await c.list('/ip/hotspot/walled-garden')).filter((w) => w.comment === WG_TAG);
  const have = new Map(wg.map((w) => [w['dst-host'], w]));
  for (const host of plan.walledGarden) {
    if (have.has(host)) {
      r.unchanged.push(`walled garden ${host}`);
      have.delete(host);
    } else {
      await c.add('/ip/hotspot/walled-garden', { 'dst-host': host, action: 'allow', comment: WG_TAG });
      r.created.push(`walled garden ${host}`);
    }
  }
  for (const [host, w] of have) {
    await c.remove('/ip/hotspot/walled-garden', w['.id']!);
    r.removed.push(`walled garden ${host}`);
  }

  // The login page that sends customers to the payment page. The router
  // writes its default hotspot files when the server is created, so the
  // file may need a moment to appear; the job then retries.
  const files = await c.list('/file', { name: 'hotspot/login.html' });
  if (files.length === 0) throw new RouterError('unreachable', 'The router has not created its hotspot files yet; will retry.');
  if (files[0]!.contents !== plan.loginHtml) {
    await c.set('/file', files[0]!['.id']!, { contents: plan.loginHtml });
    r.updated.push('login page');
  } else {
    r.unchanged.push('login page');
  }
  return r;
}
