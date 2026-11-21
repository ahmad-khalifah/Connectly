import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createFakeDb, type Handler } from './fake-db';

let fake: ReturnType<typeof createFakeDb>;
const sendTermiiSMS = vi.fn();
vi.mock('@/lib/db/client', () => ({ get db() { return fake.db; } }));
vi.mock('@/lib/sms', () => ({ sendTermiiSMS: (...a: unknown[]) => sendTermiiSMS(...a), smsConfigured: () => Boolean(process.env.TERMII_API_KEY && process.env.TERMII_SENDER_ID) }));
vi.mock('@/lib/auth/admin', () => ({
  requireAdminApi: async () => ({ user: { id: 'u1', email: 'connectly.hq@outlook.com' }, denied: null }),
}));

const GRANT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ROUTER = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const params = <T extends Record<string, string>>(o: T) => ({ params: Promise.resolve(o) });

beforeEach(() => {
  vi.resetModules();
  sendTermiiSMS.mockReset();
  sendTermiiSMS.mockResolvedValue({ ok: true, messageId: 'm1' });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

// ---------------------------------------------------------------- voucher search
describe('voucher search', () => {
  it('tells a code, a reference and a phone number apart', async () => {
    const { classifyGrantSearch } = await import('@/lib/network/access');
    const { normaliseNigerianMobile } = await import('@/lib/phone');
    const c = (q?: string) => classifyGrantSearch(q, normaliseNigerianMobile);
    expect(c('k7m2q9xp')).toEqual({ kind: 'voucher', value: 'K7M2Q9XP' });
    expect(c('CONN_11111111-2222-4333-8444-555555555555')).toEqual({ kind: 'reference', value: 'CONN_11111111-2222-4333-8444-555555555555' });
    expect(c('0803 123 4567')).toEqual({ kind: 'phone', value: '2348031234567' });
    expect(c('hello')).toEqual({ kind: 'invalid' });
    expect(c('  ')).toBeNull();
  });
});

// ---------------------------------------------------------------- resend
describe('resend WiFi code', () => {
  const grant = (over: object = {}) => ({
    id: GRANT, status: 'active', revoked_at: null, expires_at: new Date(Date.now() + 3_600_000).toISOString(), voucher_code: 'K7M2Q9XP',
    purchases: { id: 'p1', phone_number: '2348031234567', plans: { name: 'Day pass' } }, ...over,
  });
  const world = (g: object | null, taken = new Set<string>()): Handler => (op) => {
    if (op.table === 'network_authorizations') return { data: g, error: null };
    if (op.table === 'notifications' && op.action === 'insert') {
      const t = (op.values as { template: string }).template;
      if (taken.has(t)) return { data: null, error: { code: '23505', message: 'dup' } };
      taken.add(t);
      return { data: { id: 'n1' }, error: null };
    }
    if (op.table === 'notifications') return { data: { attempts: 0 }, error: null };
    return { data: null, error: null };
  };
  const post = async () => {
    const { POST } = await import('@/app/api/admin/network/access/[id]/resend/route');
    return POST(new Request('http://x', { method: 'POST' }), params({ id: GRANT }));
  };

  it('texts the code to the phone that paid, and records who asked', async () => {
    fake = createFakeDb(world(grant()));
    const res = await post();
    expect(res.status).toBe(200);
    expect(sendTermiiSMS).toHaveBeenCalledWith('2348031234567', expect.stringMatching(/your WiFi code is K7M2Q9XP/));
    expect(fake.ops.find((o) => o.table === 'activity_logs')?.values).toMatchObject({ event_type: 'access.voucher_resent', entity_id: GRANT });
  });
  it('refuses a second send within two minutes', async () => {
    const taken = new Set<string>();
    fake = createFakeDb(world(grant(), taken));
    expect((await post()).status).toBe(200);
    const again = await post();
    expect(again.status).toBe(429);
    expect(sendTermiiSMS).toHaveBeenCalledTimes(1);
  });
  it.each([
    ['revoked', { status: 'revoked', revoked_at: '2026-11-17T10:00:00Z' }, 409],
    ['expired', { expires_at: '2020-01-01T00:00:00Z' }, 409],
    ['no phone', { purchases: { id: 'p1', phone_number: null } }, 409],
  ])('refuses when access is %s', async (_l, over, status) => {
    fake = createFakeDb(world(grant(over)));
    expect((await post()).status).toBe(status);
    expect(sendTermiiSMS).not.toHaveBeenCalled();
  });
  it('reports an SMS provider failure honestly', async () => {
    sendTermiiSMS.mockResolvedValue({ ok: false, error: 'Termii 400' });
    fake = createFakeDb(world(grant()));
    expect((await post()).status).toBe(502);
  });
});

// ---------------------------------------------------------------- network settings
describe('portal and walled-garden settings', () => {
  it('accepts an https portal and sorts, lowercases and de-duplicates hosts', async () => {
    const { parsePortalSettings } = await import('@/lib/network/settings');
    expect(parsePortalSettings({ portal_url: 'https://getconnectly.net/portal', walled_garden_hosts: 'Checkout.Korapay.com\n*.korapay.com checkout.korapay.com' }))
      .toEqual({ ok: true, value: { portal_url: 'https://getconnectly.net/portal', walled_garden_hosts: ['*.korapay.com', 'checkout.korapay.com'] } });
  });
  it('keeps a Vercel shareable link token, and nothing else, in the portal address', async () => {
    const { parsePortalSettings } = await import('@/lib/network/settings');
    const r = parsePortalSettings({ portal_url: 'https://x-git-y.vercel.app/portal?_vercel_share=tok123', walled_garden_hosts: '' });
    expect(r).toEqual({ ok: true, value: { portal_url: 'https://x-git-y.vercel.app/portal?_vercel_share=tok123', walled_garden_hosts: [] } });
  });
  it.each([
    [{ portal_url: 'http://getconnectly.net/portal' }, 'portal_url'],
    [{ portal_url: 'https://getconnectly.net/portal?x=1' }, 'portal_url'],
    [{ portal_url: 'https://getconnectly.net/portal?_vercel_share=a&x=1' }, 'portal_url'],
    [{ portal_url: 'https://u:p@getconnectly.net/portal' }, 'portal_url'],
    [{ walled_garden_hosts: '*.com' }, 'walled_garden_hosts'],
    [{ walled_garden_hosts: 'not a host' }, 'walled_garden_hosts'],
  ])('rejects %j', async (patch, key) => {
    const { parsePortalSettings } = await import('@/lib/network/settings');
    const r = parsePortalSettings({ portal_url: 'https://getconnectly.net/portal', walled_garden_hosts: 'checkout.korapay.com', ...patch });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors)).toEqual([key]);
  });
  it('saving queues the hotspot update on every configured router, skipping ones without a credential', async () => {
    fake = createFakeDb((op) => {
      if (op.table === 'network_settings' && op.action === 'select') return { data: { portal_url: 'https://old.example/portal', walled_garden_hosts: [] }, error: null };
      if (op.table === 'router_hotspot_settings') return { data: [
        { router_id: ROUTER, version: 3, routers: { credential_key_id: 'ck_1' } },
        { router_id: 'r-nocred', version: 1, routers: { credential_key_id: null } },
      ], error: null };
      return { data: null, error: null };
    });
    const { PUT } = await import('@/app/api/admin/network/settings/route');
    const res = await PUT(new Request('http://x', { method: 'PUT', body: JSON.stringify({ portal_url: 'https://getconnectly.net/portal', walled_garden_hosts: 'checkout.korapay.com' }) }));
    expect(await res.json()).toEqual({ saved: true, routersQueued: 1 });
    expect(fake.rpcCalls).toEqual([expect.objectContaining({ fn: 'enqueue_job', args: expect.objectContaining({ p_kind: 'router.configure_hotspot', p_router_id: ROUTER, p_payload: { version: 3, reason: 'network settings changed' } }) })]);
    expect(fake.ops.find((o) => o.table === 'activity_logs')?.values).toMatchObject({ event_type: 'network.settings_saved' });
  });
  it('still saves before the hotspot migration exists, and says routers pick it up later', async () => {
    fake = createFakeDb((op) => (op.table === 'router_hotspot_settings' ? { data: null, error: { code: '42P01', message: 'relation does not exist' } } : { data: null, error: null }));
    const { PUT } = await import('@/app/api/admin/network/settings/route');
    const res = await PUT(new Request('http://x', { method: 'PUT', body: JSON.stringify({ portal_url: 'https://getconnectly.net/portal', walled_garden_hosts: '' }) }));
    expect(await res.json()).toEqual({ saved: true, routersQueued: null });
  });
});

// ---------------------------------------------------------------- alerts
describe('operational alerts', () => {
  const NOW = Date.parse('2026-11-18T12:00:00Z');
  const world = (o: { routers?: object[]; heartbeat?: string | null; counts?: Record<string, number> }): Handler => (op) => {
    const c = o.counts ?? {};
    if (op.table === 'routers') return { data: o.routers ?? [], error: null };
    if (op.table === 'controller_instances') return { data: o.heartbeat ? [{ last_heartbeat_at: o.heartbeat }] : [], error: null };
    const f = Object.fromEntries(op.filters);
    const key = op.table === 'activity_logs' ? String(f.event_type) : op.table;
    return { data: null, error: null, count: c[key] ?? 0 } as never;
  };
  const withTermii = (on: boolean) => {
    if (on) { process.env.TERMII_API_KEY = 'test-key'; process.env.TERMII_SENDER_ID = 'Connectly'; }
    else { delete process.env.TERMII_API_KEY; delete process.env.TERMII_SENDER_ID; }
  };
  beforeEach(() => withTermii(true));
  it('is quiet when nothing is wrong', async () => {
    fake = createFakeDb(world({ routers: [{ id: ROUTER, name: 'Garki', identifier: 'cx-garki-01', status: 'online' }], heartbeat: '2026-11-18T11:59:30Z' }));
    const { loadAlerts } = await import('@/lib/admin/alerts');
    expect(await loadAlerts(NOW)).toEqual([]);
  });
  it('raises a stopped controller, an offline router and customers waiting for access', async () => {
    fake = createFakeDb(world({ routers: [{ id: ROUTER, name: 'Garki', identifier: 'cx-garki-01', status: 'offline' }], heartbeat: '2026-11-18T11:40:00Z', counts: { network_authorizations: 2, controller_jobs: 1, notifications: 3 } }));
    const { loadAlerts } = await import('@/lib/admin/alerts');
    const titles = (await loadAlerts(NOW)).map((a) => a.title);
    expect(titles).toEqual([
      'Network Controller is not running',
      'Router Garki is offline',
      '2 paid customers are waiting for access',
      '1 controller job failed',
      '3 SMS failed',
    ]);
  });
  it('reports SMS as pending provider approval, not as failures, until Termii is set up', async () => {
    withTermii(false);
    fake = createFakeDb(world({ routers: [{ id: ROUTER, name: 'Garki', identifier: 'cx-garki-01', status: 'online' }], heartbeat: '2026-11-18T11:59:30Z', counts: { notifications: 3 } }));
    const { loadAlerts } = await import('@/lib/admin/alerts');
    const alerts = await loadAlerts(NOW);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ severity: 'info', title: 'SMS pending provider approval' });
    expect(alerts[0].detail).toMatch(/Payments and WiFi work as normal.*3 messages were not sent/);
  });
  it('does not call a missing controller a problem before any router is active', async () => {
    fake = createFakeDb(world({ routers: [], heartbeat: null }));
    const { loadAlerts } = await import('@/lib/admin/alerts');
    expect(await loadAlerts(NOW)).toEqual([]);
  });
});
