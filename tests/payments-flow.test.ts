import { describe, it, expect, beforeEach, vi } from 'vitest';
import crypto from 'crypto';
import { createFakeDb, type Handler } from './fake-db';

// Shared mocks, rebuilt per test.
let fake: ReturnType<typeof createFakeDb>;
const verifyCharge = vi.fn();
const initializeCharge = vi.fn();
const sendTermiiSMS = vi.fn();

vi.mock('@/lib/db/client', () => ({ get db() { return fake.db; } }));
vi.mock('@/lib/sms', () => ({ sendTermiiSMS: (...a: unknown[]) => sendTermiiSMS(...a) }));
vi.mock('@/lib/payments/korapay', async (orig) => {
  const real = await orig<typeof import('@/lib/payments/korapay')>();
  return { ...real, verifyCharge: (...a: unknown[]) => verifyCharge(...a), initializeCharge: (...a: unknown[]) => initializeCharge(...a) };
});

const SECRET = 'sk_test_unit';
const REF = 'CONN_11111111-2222-3333-4444-555555555555';
const PLAN = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const LOC = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const OTHER_LOC = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const ROUTER = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

beforeEach(() => {
  process.env.KORA_SECRET_KEY = SECRET;
  process.env.NEXT_PUBLIC_APP_URL = 'https://preview.example';
  verifyCharge.mockReset();
  initializeCharge.mockReset();
  sendTermiiSMS.mockReset().mockResolvedValue({ ok: true, messageId: 'm1' });
});

// ---------------------------------------------------------------- reconcile
describe('reconcilePurchase', () => {
  const purchaseRow = (status: string): Handler => (op) => {
    if (op.table === 'purchases' && op.action === 'select') {
      return { data: { id: 'p1', status, reference: REF, phone_number: '2348031234567', amount_kobo: 25000, expires_at: '2026-11-18T10:00:00Z', plans: { name: 'Day' }, locations: { name: 'Garki' } }, error: null };
    }
    if (op.table === 'notifications' && op.action === 'insert') return { data: { id: 'n1' }, error: null };
    if (op.table === 'notifications' && op.action === 'select') return { data: { attempts: 0 }, error: null };
    if (op.table === 'network_authorizations') return { data: { voucher_code: 'K7M2Q9XP' }, error: null };
    return { data: null, error: null };
  };

  it('puts the WiFi code in the confirmation SMS', async () => {
    fake = createFakeDb(purchaseRow('pending'), (fn) => ({ data: { outcome: fn === 'confirm_payment' ? 'paid' : 'x' }, error: null }));
    verifyCharge.mockResolvedValue({ reference: REF, status: 'success', amountPaidKobo: 25000, feeKobo: 375, currency: 'NGN', providerReference: 'KPY-1' });
    const { reconcilePurchase } = await import('@/lib/payments/ledger');
    await reconcilePurchase(REF);
    expect(sendTermiiSMS.mock.calls[0][1]).toMatch(/Your WiFi code: K7M2Q9XP/);
    expect((sendTermiiSMS.mock.calls[0][1] as string).length).toBeLessThanOrEqual(306); // two SMS parts at most
  });

  it('confirms a verified success with kobo amounts and sends one SMS', async () => {
    fake = createFakeDb(purchaseRow('pending'), (fn) => ({ data: { outcome: fn === 'confirm_payment' ? 'paid' : 'x' }, error: null }));
    verifyCharge.mockResolvedValue({ reference: REF, status: 'success', amountPaidKobo: 25000, feeKobo: 375, currency: 'NGN', providerReference: 'KPY-1' });
    const { reconcilePurchase } = await import('@/lib/payments/ledger');
    expect((await reconcilePurchase(REF)).outcome).toBe('paid');
    expect(fake.rpcCalls).toEqual([{ fn: 'confirm_payment', args: { p_reference: REF, p_amount_paid_kobo: 25000, p_currency: 'NGN', p_fee_kobo: 375, p_provider_reference: 'KPY-1' } }]);
    expect(sendTermiiSMS).toHaveBeenCalledTimes(1);
  });

  it('does not call Korapay or SMS again for an already paid purchase', async () => {
    fake = createFakeDb(purchaseRow('paid'));
    const { reconcilePurchase } = await import('@/lib/payments/ledger');
    expect((await reconcilePurchase(REF)).outcome).toBe('already_paid');
    expect(verifyCharge).not.toHaveBeenCalled();
    expect(sendTermiiSMS).not.toHaveBeenCalled();
  });

  it('marks a verified failure as failed', async () => {
    fake = createFakeDb(purchaseRow('pending'), () => ({ data: { outcome: 'failed' }, error: null }));
    verifyCharge.mockResolvedValue({ reference: REF, status: 'failed', amountPaidKobo: 0, feeKobo: 0, currency: 'NGN', providerReference: null });
    const { reconcilePurchase } = await import('@/lib/payments/ledger');
    expect((await reconcilePurchase(REF)).outcome).toBe('failed');
    expect(fake.rpcCalls[0].fn).toBe('mark_payment_failed');
    expect(sendTermiiSMS).not.toHaveBeenCalled();
  });

  it('leaves a processing charge pending', async () => {
    fake = createFakeDb(purchaseRow('pending'));
    verifyCharge.mockResolvedValue({ reference: REF, status: 'processing', amountPaidKobo: null, feeKobo: null, currency: 'NGN', providerReference: null });
    const { reconcilePurchase } = await import('@/lib/payments/ledger');
    expect((await reconcilePurchase(REF)).outcome).toBe('still_pending');
    expect(fake.rpcCalls).toEqual([]);
  });

  it('skips the SMS when a confirmation was already claimed (duplicate webhook race)', async () => {
    const base = purchaseRow('pending');
    fake = createFakeDb(
      (op) => (op.table === 'notifications' && op.action === 'insert' ? { data: null, error: { code: '23505', message: 'duplicate' } } : base(op)),
      () => ({ data: { outcome: 'paid' }, error: null })
    );
    verifyCharge.mockResolvedValue({ reference: REF, status: 'success', amountPaidKobo: 25000, feeKobo: 0, currency: 'NGN', providerReference: null });
    const { reconcilePurchase } = await import('@/lib/payments/ledger');
    await reconcilePurchase(REF);
    expect(sendTermiiSMS).not.toHaveBeenCalled();
  });

  it('records an SMS failure without touching the payment', async () => {
    fake = createFakeDb(purchaseRow('pending'), () => ({ data: { outcome: 'paid' }, error: null }));
    verifyCharge.mockResolvedValue({ reference: REF, status: 'success', amountPaidKobo: 25000, feeKobo: 0, currency: 'NGN', providerReference: null });
    sendTermiiSMS.mockResolvedValue({ ok: false, error: 'Termii 400' });
    const { reconcilePurchase } = await import('@/lib/payments/ledger');
    expect((await reconcilePurchase(REF)).outcome).toBe('paid');
    const update = fake.ops.find((o) => o.table === 'notifications' && o.action === 'update');
    expect(update?.values).toMatchObject({ status: 'failed', last_error: 'Termii 400' });
    expect(fake.ops.some((o) => o.table === 'purchases' && o.action === 'update')).toBe(false);
  });
});

// ------------------------------------------------------------------ webhook
describe('POST /api/webhooks/kora', () => {
  const sign = (data: unknown) => crypto.createHmac('sha256', SECRET).update(JSON.stringify(data)).digest('hex');
  const post = async (body: object, signature?: string) => {
    const { POST } = await import('@/app/api/webhooks/kora/route');
    const sig = signature ?? sign((body as { data: unknown }).data);
    return POST(new Request('https://x/api/webhooks/kora', { method: 'POST', headers: { 'x-korapay-signature': sig }, body: JSON.stringify(body) }));
  };
  const success = { event: 'charge.success', data: { reference: 'KPY-9', payment_reference: REF, amount: 250, status: 'success', currency: 'NGN' } };

  it('rejects a forged webhook and stores nothing', async () => {
    fake = createFakeDb(() => ({ data: null, error: null }));
    const res = await post(success, 'deadbeef');
    expect(res.status).toBe(401);
    expect(fake.ops).toEqual([]);
  });

  it('stores the event, reconciles OUR reference, and marks the event processed', async () => {
    fake = createFakeDb((op) => {
      if (op.table === 'payment_events' && op.action === 'insert') return { data: { id: 'e1' }, error: null };
      if (op.table === 'purchases') return { data: { id: 'p1', status: 'paid' }, error: null };
      return { data: null, error: null };
    });
    const res = await post(success);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ outcome: 'already_paid' });
    expect(fake.ops.find((o) => o.table === 'purchases')?.filters).toContainEqual(['reference', REF]);
    expect(fake.ops.find((o) => o.table === 'payment_events' && o.action === 'update')?.values).toMatchObject({ outcome: 'already_paid' });
  });

  it('answers a processed duplicate without reprocessing', async () => {
    fake = createFakeDb((op) => {
      if (op.table === 'payment_events' && op.action === 'insert') return { data: null, error: { code: '23505', message: 'dup' } };
      if (op.table === 'payment_events' && op.action === 'select') return { data: { id: 'e1', processed_at: '2026-11-16T10:00:00Z' }, error: null };
      return { data: null, error: null };
    });
    const res = await post(success);
    expect(await res.json()).toMatchObject({ duplicate: true });
    expect(fake.ops.some((o) => o.table === 'purchases')).toBe(false);
  });

  it('returns 500 so Korapay retries when Korapay verification is unreachable', async () => {
    fake = createFakeDb((op) => {
      if (op.table === 'payment_events' && op.action === 'insert') return { data: { id: 'e1' }, error: null };
      if (op.table === 'purchases') return { data: { id: 'p1', status: 'pending' }, error: null };
      return { data: null, error: null };
    });
    verifyCharge.mockRejectedValue(new Error('timeout'));
    const res = await post(success);
    expect(res.status).toBe(500);
    expect(fake.ops.find((o) => o.table === 'payment_events' && o.action === 'update')?.values).toMatchObject({ error: expect.stringContaining('timeout') });
  });

  it('ignores events it does not handle', async () => {
    fake = createFakeDb((op) => (op.action === 'insert' ? { data: { id: 'e1' }, error: null } : { data: null, error: null }));
    const res = await post({ event: 'transfer.success', data: { reference: 'T1' } });
    expect(await res.json()).toMatchObject({ outcome: 'ignored' });
  });
});

// ----------------------------------------------------------------- checkout
describe('initializeKoraCheckout', () => {
  const world = (overrides: { plan?: object; location?: object; router?: object | null } = {}): Handler => (op) => {
    if (op.table === 'locations') return { data: { id: LOC, name: 'Garki', is_active: true, ...overrides.location }, error: null };
    if (op.table === 'plans') return { data: { id: PLAN, name: 'Day', price_kobo: 25000, is_active: true, allowed_location_ids: null, ...overrides.plan }, error: null };
    if (op.table === 'routers') return { data: overrides.router === undefined ? { id: ROUTER, location_id: LOC, lifecycle_status: 'active' } : overrides.router, error: null };
    if (op.table === 'purchases' && op.action === 'insert') return { data: null, error: null };
    return { data: null, error: null };
  };
  const call = async (input: Record<string, unknown>) => {
    const { initializeKoraCheckout } = await import('@/app/actions/payment');
    return initializeKoraCheckout({ planId: PLAN, locationId: LOC, phone: '08031234567', ...input } as never);
  };

  it('records a pending purchase priced from the database BEFORE opening Korapay', async () => {
    fake = createFakeDb(world());
    initializeCharge.mockImplementation(async () => {
      expect(fake.ops.some((o) => o.table === 'purchases' && o.action === 'insert')).toBe(true);
      return 'https://checkout.korapay.com/x';
    });
    const res = await call({ amount: 1, routerId: ROUTER, mac: 'AA:BB:CC:DD:EE:FF' });
    expect(res).toMatchObject({ ok: true, checkoutUrl: 'https://checkout.korapay.com/x' });
    const insert = fake.ops.find((o) => o.table === 'purchases')!.values as Record<string, unknown>;
    expect(insert).toMatchObject({ amount_kobo: 25000, status: 'pending', phone_number: '2348031234567', location_id: LOC, router_id: ROUTER, mac_address: 'aa:bb:cc:dd:ee:ff' });
    expect(initializeCharge.mock.calls[0][0]).toMatchObject({
      amountKobo: 25000,
      reference: insert.reference,
      redirectUrl: `https://preview.example/success?reference=${insert.reference}`,
      notificationUrl: 'https://preview.example/api/webhooks/kora',
    });
  });

  it('rejects an invalid phone number without touching the database', async () => {
    fake = createFakeDb(world());
    expect(await call({ phone: '12345' })).toEqual({ ok: false, error: 'Please enter a valid Nigerian mobile number.' });
    expect(fake.ops).toEqual([]);
  });

  it('refuses a plan that is not sold at this location', async () => {
    fake = createFakeDb(world({ plan: { allowed_location_ids: [OTHER_LOC] } }));
    expect(await call({})).toEqual({ ok: false, error: 'This plan is not available at this location.' });
  });

  it('refuses an archived plan', async () => {
    fake = createFakeDb(world({ plan: { is_active: false } }));
    expect(await call({})).toEqual({ ok: false, error: 'This plan is not available.' });
  });

  it('refuses a router that belongs to another location', async () => {
    fake = createFakeDb(world({ router: { id: ROUTER, location_id: OTHER_LOC } }));
    expect(await call({ routerId: ROUTER })).toEqual({ ok: false, error: 'Unrecognised network equipment.' });
  });

  it('refuses a router that is not Active (registered, suspended or retired)', async () => {
    for (const lifecycle_status of ['registered', 'suspended', 'retired']) {
      fake = createFakeDb(world({ router: { id: ROUTER, location_id: LOC, lifecycle_status } }));
      expect(await call({ routerId: ROUTER })).toEqual({ ok: false, error: 'This network is not taking payments yet.' });
      expect(fake.ops.some((o) => o.table === 'purchases')).toBe(false);
    }
  });

  it('refuses a purchase with no router, since it could never become access', async () => {
    fake = createFakeDb(world());
    expect(await call({})).toEqual({ ok: false, error: 'Please connect to the Connectly WiFi network to buy a plan.' });
    expect(fake.ops.some((o) => o.table === 'purchases')).toBe(false);
    expect(initializeCharge).not.toHaveBeenCalled();
  });

  it('marks the purchase failed if Korapay cannot start the checkout', async () => {
    fake = createFakeDb(world());
    initializeCharge.mockRejectedValue(new Error('Korapay down'));
    const res = await call({ routerId: ROUTER });
    expect(res).toEqual({ ok: false, error: 'Unable to start payment. Please try again.' });
    expect(fake.rpcCalls[0]).toMatchObject({ fn: 'mark_payment_failed' });
  });
});

// ---------------------------------------------------------------- missed-webhook sweep
describe('reconcileRecentPending (admin pages settle missed webhooks)', () => {
  const R_OK = 'CONN_aaaaaaaa-0000-4000-8000-000000000001';
  const R_FAIL = 'CONN_aaaaaaaa-0000-4000-8000-000000000002';
  const R_WAIT = 'CONN_aaaaaaaa-0000-4000-8000-000000000003';

  const handler: Handler = (op) => {
    if (op.table !== 'purchases' || op.action !== 'select') return { data: null, error: null };
    const ref = op.filters.find(([c]) => c === 'reference')?.[1] as string | undefined;
    if (ref) return { data: { id: `p-${ref.slice(-1)}`, status: 'pending' }, error: null };
    return { data: [{ reference: R_OK }, { reference: R_FAIL }, { reference: R_WAIT }], error: null };
  };

  it('asks only for recent pending Korapay checkouts, newest 10', async () => {
    fake = createFakeDb(() => ({ data: [], error: null }));
    const { reconcileRecentPending } = await import('@/lib/payments/ledger');
    expect(await reconcileRecentPending()).toEqual({ checked: 0, confirmed: 0, failed: 0, errors: 0 });
    const f = Object.fromEntries(fake.ops[0].filters);
    expect(f).toMatchObject({ status: 'pending', payment_gateway: 'korapay', 'reference~': 'CONN_%', limit: 10 });
    const since = Date.parse(f['created_at>='] as string);
    expect(Math.abs(Date.now() - 24 * 3_600_000 - since)).toBeLessThan(5_000);
    expect(verifyCharge).not.toHaveBeenCalled();
  });

  it('confirms paid, marks failed, leaves processing pending, through the same idempotent path', async () => {
    fake = createFakeDb(handler, (fn) => ({ data: { outcome: fn === 'confirm_payment' ? 'paid' : 'failed' }, error: null }));
    verifyCharge.mockImplementation(async (ref: string) => ({
      reference: ref,
      status: ref === R_OK ? 'success' : ref === R_FAIL ? 'failed' : 'processing',
      amountPaidKobo: ref === R_OK ? 30000 : 0, feeKobo: 419, currency: 'NGN', providerReference: 'KPY',
    }));
    const { reconcileRecentPending } = await import('@/lib/payments/ledger');
    expect(await reconcileRecentPending()).toEqual({ checked: 3, confirmed: 1, failed: 1, errors: 0 });
    expect(fake.rpcCalls.map((c) => c.fn).sort()).toEqual(['confirm_payment', 'mark_payment_failed']);
  });

  it('never throws: a Korapay outage is counted, the page still renders', async () => {
    fake = createFakeDb(handler);
    verifyCharge.mockRejectedValue(new Error('Korapay unreachable'));
    const { reconcileRecentPending } = await import('@/lib/payments/ledger');
    expect(await reconcileRecentPending()).toEqual({ checked: 3, confirmed: 0, failed: 0, errors: 3 });
    expect(fake.rpcCalls).toEqual([]);
  });

  it('never throws when the database query itself fails', async () => {
    fake = createFakeDb(() => ({ data: null, error: { message: 'db down' } }));
    const { reconcileRecentPending } = await import('@/lib/payments/ledger');
    expect(await reconcileRecentPending()).toEqual({ checked: 0, confirmed: 0, failed: 0, errors: 1 });
  });
});

// ---------------------------------------------------------------- customer return page
describe('GET /api/purchase/status (what the customer sees after paying)', () => {
  const REF2 = 'CONN_11111111-2222-4333-8444-555555555555';
  const get = async () => {
    const { GET } = await import('@/app/api/purchase/status/route');
    return (await GET(new Request(`http://x/api/purchase/status?reference=${REF2}`))).json();
  };
  const world = (grant: object | null, purchaseStatus = 'paid', dns: string | null = 'wifi.garki.example', autoLogin: string | null = null, sms: string | null = 'failed'): Handler => (op) => {
    if (op.table === 'controller_jobs') return { data: autoLogin ? { result: { auto_login: { status: autoLogin } } } : null, error: null };
    if (op.table === 'notifications') return { data: sms ? { status: sms } : null, error: null };
    if (op.table === 'purchases') return { data: { id: 'p1', router_id: ROUTER, status: purchaseStatus, created_at: new Date().toISOString(), expires_at: '2026-11-18T10:00:00Z', amount_kobo: 25000, plans: { name: 'Day' }, locations: { name: 'Garki' } }, error: null };
    if (op.table === 'network_authorizations') return { data: grant, error: null };
    if (op.table === 'router_hotspot_settings') return { data: dns ? { dns_name: dns } : null, error: null };
    return { data: null, error: null };
  };

  it('gives the voucher and a login link to the router\'s own hotspot page once it is on the router', async () => {
    fake = createFakeDb(world({ voucher_code: 'K7M2Q9XP', status: 'active', purchases: { plans: { device_limit: 2 } } }));
    const body = await get();
    expect(body.access).toEqual({
      voucher: 'K7M2Q9XP', ready: true, ended: false, devices: 2, online: false, sms: 'failed',
      connectUrl: 'http://wifi.garki.example/login?username=K7M2Q9XP&password=K7M2Q9XP&dst=https%3A%2F%2Fgetconnectly.net',
    });
  });
  it('says the paying device is online when the controller logged it in', async () => {
    fake = createFakeDb(world({ id: 'g1', voucher_code: 'K7M2Q9XP', status: 'active', purchases: null }, 'paid', null, 'logged_in', 'sent'));
    expect((await get()).access).toMatchObject({ online: true, sms: 'sent' });
  });
  it('says "not ready" while the controller has not added it yet', async () => {
    fake = createFakeDb(world({ voucher_code: 'K7M2Q9XP', status: 'pending_device', purchases: null }));
    expect((await get()).access).toMatchObject({ ready: false, ended: false, devices: 1 });
  });
  it('falls back to the default hotspot name when none is saved', async () => {
    fake = createFakeDb(world({ voucher_code: 'K7M2Q9XP', status: 'active', purchases: null }, 'paid', null));
    expect((await get()).access.connectUrl).toMatch(/^http:\/\/wifi\.getconnectly\.net\/login\?/);
  });
  it('reveals no voucher before the payment is confirmed', async () => {
    fake = createFakeDb(world({ voucher_code: 'K7M2Q9XP', status: 'active', purchases: null }, 'pending'));
    const body = await get();
    expect(body.access).toBeNull();
    expect(fake.ops.some((o) => o.table === 'network_authorizations')).toBe(false);
  });
});

// ---------------------------------------------------------------- return page
describe('success page', () => {
  it('finds our reference when Korapay adds its own reference to the return address', async () => {
    const { default: SuccessPage } = await import('@/app/success/page');
    const ours = 'CONN_97c9db0f-7c51-47b0-abe8-4113b33c4bf2';
    const el = await SuccessPage({ searchParams: Promise.resolve({ reference: [ours, 'KPY-CK-abc123'] }) });
    expect(JSON.stringify(el)).toContain(ours);
    expect(JSON.stringify(el)).not.toContain('No payment reference');
    const none = await SuccessPage({ searchParams: Promise.resolve({ reference: ['KPY-CK-abc123'] }) });
    expect(JSON.stringify(none)).toContain('No payment reference');
  });
});
