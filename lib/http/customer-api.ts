// The captive portal's API, written against the plain Fetch API (Request in,
// Response out) with no Next.js imports. Two hosts call it:
//   * the Cloudflare Worker's front door (worker.ts), which answers these
//     paths itself so that a customer request never starts the Next.js
//     renderer: on Workers Free each request has 10 ms of CPU, and rendering
//     a page costs 20 to 260 ms (measured on staging, 21 Nov 2026);
//   * the Next.js route handlers under app/api, for local dev and Vercel.
//
// Paths, behaviour and responses are the same on both.

import crypto from 'crypto';
import { db } from '@/lib/db/client';
import { verifyWebhookSignature, KorapayConfigError } from '@/lib/payments/korapay';
import { reconcilePurchase, sendPaymentConfirmation } from '@/lib/payments/ledger';
import { initializeKoraCheckout } from '@/lib/payments/checkout';
import { accessForPurchase, connectLink, hotspotLoginUrl } from '@/lib/network/customer-access';

type Handler = (request: Request) => Promise<Response>;

const NO_STORE = { 'Cache-Control': 'no-store' };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...NO_STORE },
  });
}

/** The routes the Worker answers without Next.js. Exact paths only. */
export function customerApiRoute(method: string, pathname: string): Handler | null {
  const routes: Record<string, Handler> = {
    'GET /api/portal': handlePortal,
    'POST /api/checkout': handleCheckout,
    'GET /api/purchase/status': handlePurchaseStatus,
    'POST /api/purchase/notify': handlePurchaseNotify,
    'POST /api/webhooks/kora': handleKoraWebhook,
    'GET /status': handleOldStatusLink,
  };
  return routes[`${method.toUpperCase()} ${pathname.replace(/\/+$/, '') || '/'}`] ?? null;
}

// ------------------------------------------------------------------ portal

const MAC_RE = /^([0-9a-f]{2}[:-]){5}[0-9a-f]{2}$/i;
const IDENT_RE = /^[a-z0-9][a-z0-9._-]{0,62}$/i;
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,62}$/i;

export type PortalPlan = {
  id: string;
  name: string;
  price_kobo: number;
  speed_down_mbps: number | null;
  duration_seconds: number | null;
  device_limit: number | null;
  data_limit_mb: number | null;
};
type PortalLocation = { id: string; name: string; slug: string };

/**
 * What the portal page shows. `unknown`: no router or location by that name.
 * `not_set_up`: the router exists but is not Active, so it does not sell.
 * `running`: this device already has a plan. `join`: a location link (QR
 * code) opened off the WiFi, which cannot sell. `plans`: ready to buy.
 */
export type PortalView =
  | { kind: 'unknown' }
  | { kind: 'not_set_up' }
  | { kind: 'join'; location: { name: string } }
  | { kind: 'running'; place: string | null; expiresAt: string; loginUrl: string | null }
  | { kind: 'plans'; location: PortalLocation; routerId: string; plans: PortalPlan[]; loginUrl: string | null };

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null);

/**
 * GET /api/portal?router=<identifier>&mac=<mac>  (the router's login page sends customers here)
 * GET /api/portal?loc=<slug>                     (location link printed on QR codes)
 * Returns no personal data: plan prices, the place name and the router's login page.
 */
export async function handlePortal(request: Request): Promise<Response> {
  const q = new URL(request.url).searchParams;
  const loc = q.get('loc') ?? '';
  const identifier = q.get('router') ?? '';
  const mac = q.get('mac') ?? '';

  if (loc && !identifier) {
    if (!SLUG_RE.test(loc)) return json({ kind: 'unknown' } satisfies PortalView);
    const { data } = await db.from('locations').select('name').eq('slug', loc).maybeSingle();
    return json((data ? { kind: 'join', location: { name: String(data.name) } } : { kind: 'unknown' }) satisfies PortalView);
  }
  if (!IDENT_RE.test(identifier)) return json({ kind: 'unknown' } satisfies PortalView);

  const { data: router } = await db
    .from('routers')
    .select('id, lifecycle_status, locations(id, name, slug)')
    .eq('identifier', identifier)
    .maybeSingle();
  if (!router) return json({ kind: 'unknown' } satisfies PortalView);

  const location = one(router.locations as PortalLocation | PortalLocation[] | null);
  // The router's own login page, worked out here from the registered router,
  // so the code form never sends a code to an address taken from the URL.
  const loginUrlP = hotspotLoginUrl(router.id as string).catch(() => null);

  // 1. Does this device already have a plan running?
  if (MAC_RE.test(mac)) {
    const { data: device } = await db.from('devices').select('id').eq('mac_address', mac).maybeSingle();
    if (device) {
      const { data: activeAuth } = await db
        .from('network_authorizations')
        .select('expires_at')
        .eq('device_id', device.id)
        .eq('status', 'active')
        .gt('expires_at', new Date().toISOString())
        .order('expires_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (activeAuth) {
        return json({ kind: 'running', place: location?.name ?? null, expiresAt: String(activeAuth.expires_at), loginUrl: await loginUrlP } satisfies PortalView);
      }
    }
  }

  // 2. Only an activated router at a location sells plans.
  if (router.lifecycle_status !== 'active' || !location) return json({ kind: 'not_set_up' } satisfies PortalView);

  // 3. Plans on sale at this location.
  const { data: plans } = await db
    .from('plans')
    .select('id, name, price_kobo, speed_down_mbps, duration_seconds, device_limit, data_limit_mb')
    .eq('is_active', true)
    .or(`allowed_location_ids.is.null,allowed_location_ids.cs.{${location.id}}`)
    .order('price_kobo', { ascending: true });

  return json({
    kind: 'plans',
    location: { id: location.id, name: location.name, slug: location.slug },
    routerId: router.id as string,
    plans: (plans ?? []) as PortalPlan[],
    loginUrl: await loginUrlP,
  } satisfies PortalView);
}

// ---------------------------------------------------------------- checkout

const MAX_BODY = 4096;

/**
 * POST /api/checkout  { planId, phone, locationId, routerId, mac?, ip? }
 * Same checks as before (lib/payments/checkout.ts): the price comes from the
 * database and the purchase is recorded before Korapay opens.
 */
export async function handleCheckout(request: Request): Promise<Response> {
  // Like Next.js Server Functions, refuse calls from another site's page.
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return json({ ok: false, error: 'Request refused.' }, 403);
  if (!(request.headers.get('content-type') ?? '').includes('application/json')) return json({ ok: false, error: 'Request refused.' }, 415);

  const raw = await request.text();
  if (raw.length > MAX_BODY) return json({ ok: false, error: 'Request refused.' }, 413);
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return json({ ok: false, error: 'Request refused.' }, 400);
  }
  const result = await initializeKoraCheckout(payload as Parameters<typeof initializeKoraCheckout>[0]);
  return json(result, result.ok ? 200 : 422);
}

// ---------------------------------------------------------- payment status

// Payment status for the customer's return page, looked up by the payment
// reference (an unguessable UUID). Returns no personal data. Once paid it
// returns the voucher: the reference is the customer's receipt, and they
// need the voucher to log in (it is also sent to their phone).
//
// With ?check=1, a still-pending purchase is re-checked with Korapay's
// verify API, which Korapay documents as the expected step after a
// checkout redirect. Limited to recent pending purchases.

const REF_RE = /^CONN_[0-9a-f-]{36}$/i;
const CHECK_WINDOW_MS = 2 * 60 * 60 * 1000;

export async function handlePurchaseStatus(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const reference = url.searchParams.get('reference') ?? url.searchParams.get('ref') ?? '';
  if (!REF_RE.test(reference)) return json({ message: 'Invalid reference' }, 400);

  const load = () =>
    db
      .from('purchases')
      .select('id, router_id, status, created_at, expires_at, amount_kobo, mac_address, plans(name), locations(name), routers(identifier)')
      .eq('reference', reference)
      .maybeSingle();

  let { data: p } = await load();
  if (!p) return json({ status: 'not_found' }, 404);

  const recent = Date.now() - new Date(p.created_at).getTime() < CHECK_WINDOW_MS;
  if (url.searchParams.get('check') === '1' && p.status === 'pending' && recent) {
    try {
      await reconcilePurchase(reference, { notify: false }); // the page asks for the SMS separately
      ({ data: p } = await load());
    } catch (error) {
      console.error('[STATUS_RECHECK_FAILED]', reference, error);
    }
  }
  if (!p) return json({ status: 'not_found' }, 404);

  const plan = one(p.plans as { name?: string } | { name?: string }[] | null);
  const location = one(p.locations as { name?: string } | { name?: string }[] | null);
  const router = one(p.routers as { identifier?: string } | { identifier?: string }[] | null);

  return json({
    status: p.status,
    retryPath: p.status === 'paid' ? null : retryPath(router?.identifier, p.mac_address as string | null),
    planName: plan?.name ?? null,
    locationName: location?.name ?? null,
    amountNaira: p.amount_kobo ? p.amount_kobo / 100 : null,
    expiresAt: p.expires_at,
    access: p.status === 'paid' ? await accessView(p.id, p.router_id) : null,
  });
}

async function accessView(purchaseId: string, routerId: string | null) {
  const a = await accessForPurchase(purchaseId, routerId);
  if (!a) return null;
  const { data: sms } = await db.from('notifications').select('status').eq('purchase_id', purchaseId).eq('template', 'payment_confirmed').maybeSingle();
  return {
    voucher: a.voucher, ready: a.ready, ended: a.ended, devices: a.devices, online: a.online,
    sms: (sms?.status as 'sent' | 'failed' | 'queued' | undefined) ?? 'none',
    connectUrl: connectLink(a.loginUrl, a.voucher),
  };
}

/** Back to the plans on the same WiFi, for a payment that did not go through. */
function retryPath(identifier: string | undefined, mac: string | null): string | null {
  if (!identifier || !mac || mac === '00:00:00:00:00:00') return null;
  return `/portal?${new URLSearchParams({ router: identifier, mac }).toString()}`;
}

/** Old status URL (/status?ref=...): the payment page now lives at /success?reference=... */
export async function handleOldStatusLink(request: Request): Promise<Response> {
  const q = new URL(request.url).searchParams;
  const value = q.get('reference') ?? q.get('ref');
  const to = new URL(value ? `/success?reference=${encodeURIComponent(value)}` : '/success', request.url);
  return new Response(null, { status: 307, headers: { Location: to.toString(), ...NO_STORE } });
}

/**
 * POST /api/purchase/notify  { reference }
 * Sends the confirmation SMS (WiFi code) for a paid purchase. The payment
 * page calls it once it sees the payment confirmed; it is separate from the
 * webhook so neither request exceeds the CPU limit. At most one SMS per
 * purchase, ever: the notification row is claimed before sending.
 */
export async function handlePurchaseNotify(request: Request): Promise<Response> {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return json({ message: 'Request refused.' }, 403);
  const raw = await request.text();
  if (raw.length > 512) return json({ message: 'Request refused.' }, 413);
  let reference = '';
  try {
    reference = String((JSON.parse(raw) as { reference?: unknown })?.reference ?? '');
  } catch {
    return json({ message: 'Request refused.' }, 400);
  }
  if (!REF_RE.test(reference)) return json({ message: 'Invalid reference' }, 400);
  return json({ sms: await sendPaymentConfirmation({ reference }) });
}

// --------------------------------------------------------- Korapay webhook

// https://developers.korapay.com/docs/webhooks
//
// 1. Verify the signature (HMAC of the `data` object). Unsigned or forged
//    requests are rejected and NOT stored.
// 2. Store the event once (identical redeliveries collapse on a hash).
// 3. Never trust the payload's amount or status: re-check the charge with
//    Korapay's verify API, then let the idempotent database functions move
//    the purchase (lib/payments/ledger.ts).
// Responds 200 when the event is handled or deliberately ignored, and 500
// on transient failures so Korapay retries.

export async function handleKoraWebhook(request: Request): Promise<Response> {
  const rawBody = await request.text();

  let body: { event?: string; data?: Record<string, unknown> } | null;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return json({ message: 'Invalid payload' }, 400);
  }

  try {
    if (!verifyWebhookSignature(body, request.headers.get('x-korapay-signature'))) {
      return json({ message: 'Invalid signature' }, 401);
    }
  } catch (error) {
    if (error instanceof KorapayConfigError) {
      console.error('[KORA_WEBHOOK] KORA_SECRET_KEY missing');
      return json({ message: 'Not configured' }, 500);
    }
    throw error;
  }

  const event = String(body?.event ?? '');
  const data = body?.data ?? {};
  // Hosted checkout puts our reference in payment_reference; other flows in reference.
  const reference = String(data.payment_reference ?? data.reference ?? '');
  const sha = crypto.createHash('sha256').update(rawBody).digest('hex');

  // Store once. If this exact payload was already fully processed, stop.
  const { data: inserted, error: insertError } = await db
    .from('payment_events')
    .insert({ provider: 'korapay', event_type: event, reference: reference || null, payload_sha256: sha, payload: body })
    .select('id')
    .maybeSingle();

  let eventId = inserted?.id as string | undefined;
  if (insertError) {
    if (insertError.code !== '23505') {
      console.error('[KORA_WEBHOOK] event insert failed', insertError);
      return json({ message: 'Retry later' }, 500);
    }
    const { data: existing } = await db
      .from('payment_events')
      .select('id, processed_at')
      .eq('provider', 'korapay')
      .eq('payload_sha256', sha)
      .single();
    if (existing?.processed_at) return json({ received: true, duplicate: true });
    eventId = existing?.id; // earlier attempt crashed before finishing; process again
  }

  let outcome = 'ignored';
  try {
    if ((event === 'charge.success' || event === 'charge.failed') && reference) {
      // The SMS is sent at the payment page's request (POST /api/purchase/notify),
      // keeping this request within the free plan's 10 ms of CPU.
      outcome = (await reconcilePurchase(reference, { notify: false })).outcome;
    }
  } catch (error) {
    console.error('[KORA_WEBHOOK] processing failed', reference, error);
    if (eventId) {
      await db.from('payment_events').update({ error: String(error).slice(0, 1000) }).eq('id', eventId);
    }
    return json({ message: 'Retry later' }, 500);
  }

  if (eventId) {
    await db
      .from('payment_events')
      .update({ processed_at: new Date().toISOString(), outcome, error: null })
      .eq('id', eventId);
  }
  return json({ received: true, outcome });
}
