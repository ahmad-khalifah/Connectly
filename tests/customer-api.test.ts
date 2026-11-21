import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createFakeDb, type Handler } from './fake-db';

// The portal API the Cloudflare Worker answers without Next.js
// (lib/http/customer-api.ts). Payment status and the webhook are covered in
// payments-flow.test.ts through the Next.js routes, which reuse these handlers.

let fake: ReturnType<typeof createFakeDb>;
const initializeCharge = vi.fn();
vi.mock('@/lib/db/client', () => ({ get db() { return fake.db; } }));
vi.mock('@/lib/payments/korapay', async (orig) => {
  const real = await orig<typeof import('@/lib/payments/korapay')>();
  return { ...real, initializeCharge: (...a: unknown[]) => initializeCharge(...a) };
});

const LOC = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ROUTER = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const PLAN = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const MAC = 'AA:BB:CC:DD:EE:FF';

beforeEach(() => {
  process.env.KORA_SECRET_KEY = 'sk_test_unit';
  process.env.NEXT_PUBLIC_APP_URL = 'https://preview.example';
  initializeCharge.mockReset();
});

const api = () => import('@/lib/http/customer-api');
const portal = async (query: string) => {
  const { handlePortal } = await api();
  const res = await handlePortal(new Request(`https://x/api/portal?${query}`));
  expect(res.headers.get('cache-control')).toBe('no-store');
  return res.json();
};

type World = { router?: object | null; device?: object | null; grant?: object | null; plans?: object[]; dns?: string | null; location?: object | null };
const world = (w: World = {}): Handler => (op) => {
  switch (op.table) {
    case 'routers':
      return { data: w.router === undefined ? { id: ROUTER, lifecycle_status: 'active', locations: { id: LOC, name: 'Garki', slug: 'garki' } } : w.router, error: null };
    case 'devices': return { data: w.device ?? null, error: null };
    case 'network_authorizations': return { data: w.grant ?? null, error: null };
    case 'router_hotspot_settings': return { data: w.dns === null ? null : { dns_name: w.dns ?? 'wifi.garki.example' }, error: null };
    case 'plans': return { data: w.plans ?? [{ id: PLAN, name: 'Day', price_kobo: 50000 }], error: null };
    case 'locations': return { data: w.location ?? null, error: null };
    default: return { data: null, error: null };
  }
};

describe('GET /api/portal', () => {
  it('lists the plans on sale at the router\'s location, with the router\'s own login page', async () => {
    fake = createFakeDb(world());
    expect(await portal(`router=cx-garki-01&mac=${MAC}`)).toEqual({
      kind: 'plans',
      location: { id: LOC, name: 'Garki', slug: 'garki' },
      routerId: ROUTER,
      plans: [{ id: PLAN, name: 'Day', price_kobo: 50000 }],
      loginUrl: 'http://wifi.garki.example/login',
    });
    expect(fake.ops.find((o) => o.table === 'plans')?.filters).toContainEqual(['or', `allowed_location_ids.is.null,allowed_location_ids.cs.{${LOC}}`]);
  });

  it('says the plan is still running when this device has an active grant', async () => {
    fake = createFakeDb(world({ device: { id: 'dev1' }, grant: { expires_at: '2026-11-21T20:00:00Z' } }));
    expect(await portal(`router=cx-garki-01&mac=${MAC}`)).toEqual({
      kind: 'running', place: 'Garki', expiresAt: '2026-11-21T20:00:00Z', loginUrl: 'http://wifi.garki.example/login',
    });
    expect(fake.ops.some((o) => o.table === 'plans')).toBe(false);
  });

  it('does not sell on a router that is not Active', async () => {
    fake = createFakeDb(world({ router: { id: ROUTER, lifecycle_status: 'registered', locations: { id: LOC, name: 'Garki', slug: 'garki' } } }));
    expect(await portal(`router=cx-garki-01&mac=${MAC}`)).toEqual({ kind: 'not_set_up' });
    expect(fake.ops.some((o) => o.table === 'plans')).toBe(false);
  });

  it('answers unknown for a router it does not know, or a malformed identifier, without querying', async () => {
    fake = createFakeDb(world({ router: null }));
    expect(await portal('router=cx-nowhere')).toEqual({ kind: 'unknown' });
    fake = createFakeDb(world());
    expect(await portal('router=' + encodeURIComponent("x'),or(1=1"))).toEqual({ kind: 'unknown' });
    expect(fake.ops).toEqual([]);
  });

  it('ignores a malformed MAC address instead of looking it up', async () => {
    fake = createFakeDb(world());
    expect((await portal('router=cx-garki-01&mac=not-a-mac')).kind).toBe('plans');
    expect(fake.ops.some((o) => o.table === 'devices')).toBe(false);
  });

  it('falls back to the default hotspot name when none is saved', async () => {
    fake = createFakeDb(world({ dns: null }));
    expect((await portal(`router=cx-garki-01&mac=${MAC}`)).loginUrl).toBe('http://wifi.getconnectly.net/login');
  });

  it('turns a location link into "join the WiFi", which sells nothing', async () => {
    fake = createFakeDb(world({ location: { name: 'Garki' } }));
    expect(await portal('loc=garki')).toEqual({ kind: 'join', location: { name: 'Garki' } });
    expect(fake.ops.map((o) => o.table)).toEqual(['locations']);
    fake = createFakeDb(world({ location: null }));
    expect(await portal('loc=nowhere')).toEqual({ kind: 'unknown' });
  });
});

describe('POST /api/checkout', () => {
  const checkoutWorld: Handler = (op) => {
    if (op.table === 'locations') return { data: { id: LOC, name: 'Garki', is_active: true }, error: null };
    if (op.table === 'plans') return { data: { id: PLAN, name: 'Day', price_kobo: 50000, is_active: true, allowed_location_ids: null }, error: null };
    if (op.table === 'routers') return { data: { id: ROUTER, location_id: LOC, lifecycle_status: 'active' }, error: null };
    return { data: null, error: null };
  };
  const body = { planId: PLAN, locationId: LOC, routerId: ROUTER, phone: '08031234567', mac: MAC };
  const post = async (init: RequestInit) => {
    const { handleCheckout } = await api();
    return handleCheckout(new Request('https://portal.example/api/checkout', { method: 'POST', ...init }));
  };

  it('starts the checkout priced from the database and returns the Korapay page', async () => {
    fake = createFakeDb(checkoutWorld);
    initializeCharge.mockResolvedValue('https://checkout.korapay.com/x');
    const res = await post({ headers: { 'content-type': 'application/json', origin: 'https://portal.example' }, body: JSON.stringify({ ...body, amount: 1 }) });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, checkoutUrl: 'https://checkout.korapay.com/x' });
    expect(fake.ops.find((o) => o.table === 'purchases' && o.action === 'insert')?.values).toMatchObject({ amount_kobo: 50000, status: 'pending' });
    expect(initializeCharge.mock.calls[0][0]).toMatchObject({ amountKobo: 50000, redirectUrl: expect.stringMatching(/^https:\/\/preview\.example\/success\?reference=CONN_/) });
  });

  it('returns the checkout\'s own message when a check fails', async () => {
    fake = createFakeDb(checkoutWorld);
    const res = await post({ headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...body, phone: '123' }) });
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ ok: false, error: 'Please enter a valid Nigerian mobile number.' });
  });

  it('refuses another site\'s page, a non-JSON body and an oversized body, touching nothing', async () => {
    fake = createFakeDb(checkoutWorld);
    expect((await post({ headers: { 'content-type': 'application/json', origin: 'https://evil.example' }, body: JSON.stringify(body) })).status).toBe(403);
    expect((await post({ headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'planId=x' })).status).toBe(415);
    expect((await post({ headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...body, pad: 'x'.repeat(5000) }) })).status).toBe(413);
    expect((await post({ headers: { 'content-type': 'application/json' }, body: '{nope' })).status).toBe(400);
    expect(fake.ops).toEqual([]);
    expect(initializeCharge).not.toHaveBeenCalled();
  });
});

describe('routes the Worker answers itself', () => {
  it('matches only the customer paths and methods', async () => {
    const { customerApiRoute, handlePortal, handleCheckout, handlePurchaseStatus, handleKoraWebhook } = await api();
    expect(customerApiRoute('GET', '/api/portal')).toBe(handlePortal);
    expect(customerApiRoute('POST', '/api/checkout')).toBe(handleCheckout);
    expect(customerApiRoute('GET', '/api/purchase/status')).toBe(handlePurchaseStatus);
    expect(customerApiRoute('POST', '/api/webhooks/kora')).toBe(handleKoraWebhook);
    expect(customerApiRoute('post', '/api/webhooks/kora/')).toBe(handleKoraWebhook);
    expect(customerApiRoute('GET', '/api/checkout')).toBeNull();
    expect(customerApiRoute('GET', '/api/admin/plans')).toBeNull();
    expect(customerApiRoute('GET', '/portal')).toBeNull();
    expect(customerApiRoute('GET', '/admin')).toBeNull();
  });

  it('sends old /status links to the payment page', async () => {
    const { handleOldStatusLink } = await api();
    const ref = 'CONN_11111111-2222-4333-8444-555555555555';
    const res = await handleOldStatusLink(new Request(`https://x.example/status?ref=${ref}`));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe(`https://x.example/success?reference=${ref}`);
    expect((await handleOldStatusLink(new Request('https://x.example/status'))).headers.get('location')).toBe('https://x.example/success');
  });
});

describe('staging banner', () => {
  it('shows on every address except the live site', async () => {
    const { bannerFor } = await import('@/components/env-banner');
    expect(bannerFor('getconnectly.net')).toBeNull();
    expect(bannerFor('www.getconnectly.net')).toBeNull();
    expect(bannerFor('connectly-web.getconnectly.workers.dev')).toBe('Staging');
    expect(bannerFor('localhost')).toBe('Local');
  });
});
