// Router hotspot settings as the admin portal edits them. The database
// (20261119090000_router_hotspot.sql) enforces the same rules; checking here
// first gives the operator clear messages instead of a database error.
//
// The controller applies them (router.configure_hotspot): customer port,
// gateway and DHCP range, DNS name, walled garden, and a login page that
// sends customers to the payment page.

export const HOTSPOT_DEFAULTS = {
  lan_interface: 'ether2',
  gateway_cidr: '10.10.0.1/22',
  dns_name: 'wifi.getconnectly.net',
  extra_walled_garden: [] as string[],
};

export type HotspotInput = typeof HOTSPOT_DEFAULTS;

export type HotspotRow = HotspotInput & {
  version: number;
  applied_version: number | null;
  applied_at: string | null;
  last_error: string | null;
  updated_at: string;
  updated_by: string | null;
};

export const HOTSPOT_COLUMNS = 'lan_interface, gateway_cidr, dns_name, extra_walled_garden, version, applied_version, applied_at, last_error, updated_at, updated_by';

const IFACE = /^[A-Za-z0-9._-]{1,32}$/;
const HOST = /^(\*\.)?([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const TUNNEL = { net: ip('10.77.0.0'), prefix: 22 };

function ip(s: string): number {
  const parts = s.split('.');
  if (parts.length !== 4 || parts.some((p) => !/^\d{1,3}$/.test(p) || Number(p) > 255)) return NaN;
  return parts.reduce((n, p) => n * 256 + Number(p), 0);
}
const maskOf = (prefix: number) => (prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0);
const inRange = (addr: number, net: number, prefix: number) => ((addr & maskOf(prefix)) >>> 0) === net;

/** What the gateway setting means, for the form's help text. */
export function describeNetwork(gatewayCidr: string): string | null {
  const [g, p] = gatewayCidr.split('/');
  const a = ip(g ?? '');
  const prefix = Number(p);
  if (Number.isNaN(a) || !Number.isInteger(prefix) || prefix < 16 || prefix > 28) return null;
  const size = 2 ** (32 - prefix) - 3; // minus network, broadcast and the gateway itself
  return `${size.toLocaleString('en-NG')} customer devices at once`;
}

/** A walled-garden host: pay.example.com or *.example.com. */
export function isWalledGardenHost(h: string): boolean {
  return HOST.test(h) && h.length <= 253;
}

export function parseHotspotInput(raw: unknown): { ok: true; value: HotspotInput } | { ok: false; errors: Record<string, string> } {
  const b = (raw ?? {}) as Record<string, unknown>;
  const errors: Record<string, string> = {};

  const lan = String(b.lan_interface ?? '').trim();
  if (!IFACE.test(lan)) errors.lan_interface = 'Use the router port or bridge name exactly as RouterOS shows it, e.g. ether2 or bridge-hotspot.';

  const cidr = String(b.gateway_cidr ?? '').trim();
  const [g, p] = cidr.split('/');
  const addr = ip(g ?? '');
  const prefix = Number(p);
  if (Number.isNaN(addr) || !/^\d{1,2}$/.test(p ?? '')) {
    errors.gateway_cidr = 'Write the router\'s customer-side address with its size, e.g. 10.10.0.1/22.';
  } else if (prefix < 16 || prefix > 28) {
    errors.gateway_cidr = 'The size must be between /16 (65,000 devices) and /28 (13 devices).';
  } else {
    const mask = maskOf(prefix);
    const net = (addr & mask) >>> 0;
    const bcast = (net | (~mask >>> 0)) >>> 0;
    const isPrivate = inRange(addr, ip('10.0.0.0'), 8) || inRange(addr, ip('172.16.0.0'), 12) || inRange(addr, ip('192.168.0.0'), 16);
    const overlapsTunnel = inRange(net, TUNNEL.net, Math.min(prefix, TUNNEL.prefix)) || inRange(TUNNEL.net, net, Math.min(prefix, TUNNEL.prefix));
    if (!isPrivate) errors.gateway_cidr = 'Use a private range: 10.x.x.x, 172.16-31.x.x or 192.168.x.x.';
    else if (addr === net || addr === bcast) errors.gateway_cidr = 'That is the network\'s own address; use a host address such as the .1.';
    else if (overlapsTunnel) errors.gateway_cidr = 'This overlaps the controller tunnel range 10.77.0.0/22; pick another range.';
  }

  const dns = String(b.dns_name ?? '').trim().toLowerCase();
  if (!HOST.test(dns) || dns.startsWith('*')) errors.dns_name = 'Use a plain host name such as wifi.getconnectly.net.';

  const rawHosts = Array.isArray(b.extra_walled_garden) ? b.extra_walled_garden : String(b.extra_walled_garden ?? '').split(/[\s,]+/);
  const hosts = [...new Set(rawHosts.map((h) => String(h).trim().toLowerCase()).filter(Boolean))];
  const badHost = hosts.find((h) => !HOST.test(h) || h.length > 253);
  if (badHost) errors.extra_walled_garden = `"${badHost}" is not a host name. Use names like pay.example.com or *.example.com.`;
  else if (hosts.length > 50) errors.extra_walled_garden = 'At most 50 extra hosts.';

  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { lan_interface: lan, gateway_cidr: `${g}/${prefix}`, dns_name: dns, extra_walled_garden: hosts } };
}

export type HotspotState = 'not_set' | 'not_applied' | 'changes_pending' | 'applied' | 'failed';

export function hotspotState(row: Pick<HotspotRow, 'version' | 'applied_version' | 'last_error'> | null): HotspotState {
  if (!row) return 'not_set';
  if (row.applied_version === row.version) return 'applied';
  if (row.last_error) return 'failed';
  return row.applied_version == null ? 'not_applied' : 'changes_pending';
}

export const HOTSPOT_STATE_LABEL: Record<HotspotState, string> = {
  not_set: 'Not set up',
  not_applied: 'Saved, not applied yet',
  changes_pending: 'Changes not applied yet',
  applied: 'Applied to router',
  failed: 'Last apply failed',
};
