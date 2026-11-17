import { db } from '@/lib/db/client';
import { HOTSPOT_DEFAULTS } from './hotspot';

// What a paying customer needs to get online: their voucher, whether the
// controller has put it on the router yet, and the router's own login page.
// The customer's browser logs in by opening the router's login URL; the app
// never talks to the router (the controller does).

export type CustomerAccess = {
  voucher: string;
  /** true once the controller has added the voucher to the router. */
  ready: boolean;
  ended: boolean;
  devices: number;
  loginUrl: string;
};

/** The hotspot's login page as customers' devices see it, e.g. http://wifi.getconnectly.net/login. */
export async function hotspotLoginUrl(routerId: string): Promise<string> {
  let dns: string = HOTSPOT_DEFAULTS.dns_name;
  // The table arrives with migration 20261119090000; until then the default name is used.
  const { data, error } = await db.from('router_hotspot_settings').select('dns_name').eq('router_id', routerId).maybeSingle();
  if (!error && data?.dns_name) dns = String(data.dns_name);
  return `http://${dns}/login`;
}

/**
 * Link that logs a device in with its voucher. RouterOS accepts the login
 * form as a GET with username and password (login-by http-pap). It is plain
 * HTTP on the customer's own WiFi network, which is how a hotspot login
 * works; the voucher only opens this plan, never an account.
 */
export function connectLink(loginUrl: string, voucher: string, dst = 'https://getconnectly.net'): string {
  const q = new URLSearchParams({ username: voucher, password: voucher, dst });
  return `${loginUrl}?${q.toString()}`;
}

export async function accessForPurchase(purchaseId: string, routerId: string | null): Promise<CustomerAccess | null> {
  if (!routerId) return null;
  const { data: grant } = await db
    .from('network_authorizations')
    .select('voucher_code, status, purchases(plans(device_limit))')
    .eq('purchase_id', purchaseId)
    .eq('router_id', routerId)
    .maybeSingle();
  if (!grant?.voucher_code) return null;
  const purchase = (Array.isArray(grant.purchases) ? grant.purchases[0] : grant.purchases) as { plans?: unknown } | null;
  const plan = (Array.isArray(purchase?.plans) ? purchase.plans[0] : purchase?.plans) as { device_limit?: number | null } | null;
  return {
    voucher: String(grant.voucher_code),
    ready: grant.status === 'active',
    ended: grant.status === 'revoked' || grant.status === 'expired',
    devices: Math.max(1, Number(plan?.device_limit ?? 1)),
    loginUrl: await hotspotLoginUrl(routerId),
  };
}
