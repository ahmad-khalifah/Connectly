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
//   no FastTrack customers' traffic kept out of FastTrack, so speed limits hold
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
  poolRange: string;     // 10.10.0.12-10.10.3.254 (RouterOS: comma-separated ranges)
  equipmentRange: string; // 10.10.0.2-10.10.0.11: fixed addresses for access points and switches
  dnsName: string;
  walledGarden: string[];
  loginHtml: string;
};

export const TAG = 'connectly-hotspot';
export const NAME = 'connectly';
export const POOL = 'connectly-hotspot';
const WG_TAG = 'connectly';
/** Private ranges customers may not reach (RFC 1918). */
export const PRIVATE_RANGES = ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16'] as const;

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
  // and a small block kept for equipment (access points, switches) with fixed
  // addresses: just after the gateway, or just before it when the gateway is
  // at the top. Keep in step with lib/network/hotspot.ts.
  const reserve = equipmentReserve(prefix);
  const [eqFrom, eqTo] = g + reserve < bcast ? [g + 1, g + reserve] : [g - reserve, g - 1];
  const spans: [number, number][] = [];
  const addSpan = (a: number, b: number) => { if (a <= b) spans.push([a, b]); };
  // Free addresses: (net, bcast) minus the gateway and the equipment block.
  const taken = [[Math.min(g, eqFrom), Math.max(g, eqTo)]] as const; // gateway and block are adjacent
  addSpan(net + 1, taken[0][0] - 1);
  addSpan(taken[0][1] + 1, bcast - 1);
  const poolRange = spans.map(([a, b]) => (a === b ? intToIp(a) : `${intToIp(a)}-${intToIp(b)}`)).join(',');
  const equipment = `${intToIp(eqFrom)}-${intToIp(eqTo)}`;

  const portal = new URL(p.portal_url);
  const hosts = [...new Set([portal.hostname, ...p.walled_garden_hosts, ...s.extra_walled_garden].map((h) => h.toLowerCase()))].sort();

  // MikroTik fills in $(mac), $(ip) and $(link-login-only-esc) for each customer.
  // A portal address may already carry a query string (a Vercel shareable link
  // on test day), so the router's own parameters are appended with & then.
  const sep = p.portal_url.includes('?') ? '&' : '?';
  const target = `${p.portal_url}${sep}router=${encodeURIComponent(routerIdentifier)}&mac=$(mac-esc)&ip=$(ip)&link=$(link-login-only-esc)`;
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
    poolRange,
    equipmentRange: equipment,
    dnsName: s.dns_name,
    walledGarden: hosts,
    loginHtml,
  };
}

export type ApplyReport = { created: string[]; updated: string[]; removed: string[]; unchanged: string[] };

/** Puts our firewall rule first in /ip/firewall/filter, so default drop rules cannot shadow it. */
async function moveToTop(c: RouterClient, r: ApplyReport, label: string, comment: string) {
  const rules = (await c.list('/ip/firewall/filter')).filter((x) => x.dynamic !== 'true');
  const first = rules[0];
  const ours = rules.find((x) => x.comment === comment);
  if (!ours || !first || first['.id'] === ours['.id']) return;
  // Our two DNS rules may sit together at the top; only move a rule that has a foreign rule above it.
  const pos = rules.indexOf(ours);
  if (rules.slice(0, pos).every((x) => (x.comment ?? '').startsWith(`${TAG}-dns-allow-`))) return;
  await c.command('/ip/firewall/filter/move', { numbers: ours['.id']!, destination: first['.id']! });
  r.updated.push(`${label}: moved above the existing firewall rules`);
}

/** Puts our forward rule above the first FastTrack rule, if the router has one. */
async function placeAboveFasttrack(c: RouterClient, r: ApplyReport, label: string, comment: string) {
  const rules = (await c.list('/ip/firewall/filter')).filter((x) => x.dynamic !== 'true');
  const ft = rules.find((x) => x.action === 'fasttrack-connection');
  const ours = rules.find((x) => x.comment === comment);
  if (!ft || !ours || rules.indexOf(ours) < rules.indexOf(ft)) return;
  await c.command('/ip/firewall/filter/move', { numbers: ours['.id']!, destination: ft['.id']! });
  r.updated.push(`${label}: moved above FastTrack`);
}

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
  // The guard refuses DNS from the internet side. On a router with the default
  // WAN interface list it matches that list only, so the management network
  // (staff, the controller, the APs' own config pages) keeps using the router
  // for DNS. Found reviewing the physical L009, 19 Nov 2026: the earlier form
  // ("every port except the customer port") would have cut DNS for management.
  // A router with no WAN list (the CHR lab) keeps the earlier form.
  const hasWanList = (await c.list('/interface/list', { name: 'WAN' })).length > 0;
  const guard: Record<string, string> = hasWanList ? { 'in-interface-list': 'WAN' } : { 'in-interface': `!${plan.lanInterface}` };
  for (const proto of ['udp', 'tcp']) {
    const comment = `${TAG}-dns-${proto}`;
    // A guard written in the other form is replaced, not patched: RouterOS keeps a matcher that is not mentioned.
    for (const old of await c.list('/ip/firewall/filter', { comment })) {
      if (hasWanList ? old['in-interface'] : old['in-interface-list']) {
        await c.remove('/ip/firewall/filter', old['.id']!);
        r.removed.push(`DNS guard (${proto}), earlier form`);
      }
    }
    await ensure(c, r, `DNS guard (${proto})`, '/ip/firewall/filter', { comment },
      { chain: 'input', protocol: proto, 'dst-port': '53', ...guard, action: 'drop' });
  }
  // Physical MikroTik routers ship with a firewall that ends "drop everything not
  // coming from LAN". The customer port is not on that list, so customers'
  // DNS to the router must be allowed explicitly, above that rule.
  for (const proto of ['udp', 'tcp']) {
    await ensure(c, r, `customer DNS allowed (${proto})`, '/ip/firewall/filter', { comment: `${TAG}-dns-allow-${proto}` },
      { chain: 'input', protocol: proto, 'dst-port': '53', 'in-interface': plan.lanInterface, action: 'accept' });
    await moveToTop(c, r, `customer DNS allowed (${proto})`, `${TAG}-dns-allow-${proto}`);
  }

  await ensure(c, r, 'hotspot profile', '/ip/hotspot/profile', { name: NAME }, { 'hotspot-address': plan.gateway, 'dns-name': plan.dnsName, 'login-by': 'http-chap,http-pap' });
  await ensure(c, r, 'hotspot server', '/ip/hotspot', { name: NAME }, { interface: plan.lanInterface, 'address-pool': POOL, profile: NAME, disabled: 'false' });
  await ensure(c, r, 'customer NAT', '/ip/firewall/nat', { comment: TAG }, { chain: 'srcnat', 'src-address': plan.network, action: 'masquerade' });

  // FastTracked traffic skips queues, so a plan's speed limit (the hotspot's
  // dynamic queue) would not hold. Customers' established traffic is accepted
  // just above the default FastTrack rule instead, so it never gets fast-tracked.
  for (const [dir, field] of [['out', 'src-address'], ['in', 'dst-address']] as const) {
    const comment = `${TAG}-no-fasttrack-${dir}`;
    const label = `FastTrack exemption (${dir})`;
    await ensure(c, r, label, '/ip/firewall/filter', { comment },
      { chain: 'forward', action: 'accept', 'connection-state': 'established,related', [field]: plan.network });
    await placeAboveFasttrack(c, r, label, comment);
  }

  // Customers reach the internet only: never the site's private networks (the
  // management LAN with the router's admin pages, staff computers and the
  // controller; the upstream router, e.g. Starlink's 192.168.1.0/24). Traffic
  // within the customer network is bridged and never passes this chain.
  // Found reviewing the physical L009, 20 Nov 2026.
  for (const [i, range] of PRIVATE_RANGES.entries()) {
    const comment = `${TAG}-no-private-${i + 1}`;
    const label = `customer isolation (${range})`;
    await ensure(c, r, label, '/ip/firewall/filter', { comment },
      { chain: 'forward', action: 'drop', 'src-address': plan.network, 'dst-address': range });
    await placeAboveFasttrack(c, r, label, comment);
  }

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
