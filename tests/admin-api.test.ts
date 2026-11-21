import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createFakeDb } from './fake-db';

// Admin data requests answered without Next.js (lib/http/admin-api.ts) and
// the cookie-based admin check behind them (lib/auth/request-admin.ts).

let fake: ReturnType<typeof createFakeDb>;
vi.mock('@/lib/db/client', () => ({ get db() { return fake.db; } }));

const URL_ = 'https://abcdefghij.supabase.co';
const authFetch = vi.fn();

beforeEach(() => {
  vi.resetModules(); // fresh token cache per test
  process.env.NEXT_PUBLIC_SUPABASE_URL = URL_;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon';
  process.env.ADMIN_EMAILS = 'connectly.hq@outlook.com';
  authFetch.mockReset();
  vi.stubGlobal('fetch', authFetch);
  fake = createFakeDb(() => ({ data: null, error: null }));
});
afterEach(() => vi.unstubAllGlobals());

const b64url = (s: string) => Buffer.from(s).toString('base64url');
const session = (token: string) => `base64-${b64url(JSON.stringify({ access_token: token, refresh_token: 'r' }))}`;
const TOKEN = 'header.' + 'x'.repeat(40) + '.sig';
const cookie = (value: string, name = 'sb-abcdefghij-auth-token') => `other=1; ${name}=${encodeURIComponent(value)}`;
const user = (email: string) => new Response(JSON.stringify({ id: 'u1', email }), { status: 200 });
const req = (path: string, headers: Record<string, string> = {}, init: RequestInit = {}) =>
  new Request(`https://admin.example${path}`, { headers, ...init });

describe('reading the session cookie', () => {
  it('reads a base64 session, a chunked one, and refuses junk', async () => {
    const { sessionAccessToken } = await import('@/lib/auth/request-admin');
    expect(sessionAccessToken(cookie(session(TOKEN)), URL_)).toBe(TOKEN);
    const value = session(TOKEN);
    const chunked = `sb-abcdefghij-auth-token.0=${value.slice(0, 30)}; sb-abcdefghij-auth-token.1=${value.slice(30)}`;
    expect(sessionAccessToken(chunked, URL_)).toBe(TOKEN);
    expect(sessionAccessToken(cookie(JSON.stringify({ access_token: TOKEN })), URL_)).toBe(TOKEN);
    expect(sessionAccessToken(cookie('base64-!!!'), URL_)).toBeNull();
    expect(sessionAccessToken(cookie(session(TOKEN), 'sb-otherproject-auth-token'), URL_)).toBeNull();
    expect(sessionAccessToken(null, URL_)).toBeNull();
  });
});

describe('the admin check', () => {
  it('asks Supabase Auth to verify the token, then checks the allow-list', async () => {
    authFetch.mockResolvedValue(user('Connectly.HQ@outlook.com'));
    const { checkAdmin } = await import('@/lib/auth/request-admin');
    const r = await checkAdmin(req('/x', { cookie: cookie(session(TOKEN)) }));
    expect(r).toEqual({ admin: { id: 'u1', email: 'Connectly.HQ@outlook.com' }, reason: null });
    const [url, init] = authFetch.mock.calls[0];
    expect(String(url)).toBe(`${URL_}/auth/v1/user`);
    expect(init.headers).toEqual({ apikey: 'anon', Authorization: `Bearer ${TOKEN}` });
  });

  it('tells a signed-in non-admin apart from someone signed out, and refuses both', async () => {
    authFetch.mockResolvedValue(user('mafindijr@gmail.com'));
    const { checkAdmin } = await import('@/lib/auth/request-admin');
    expect(await checkAdmin(req('/x', { cookie: cookie(session(TOKEN)) }))).toEqual({ admin: null, reason: 'not_admin' });
    authFetch.mockResolvedValue(new Response('{}', { status: 401 }));
    expect(await checkAdmin(req('/x', { cookie: cookie(session(TOKEN + 'b')) }))).toEqual({ admin: null, reason: 'signed_out' });
    expect(await checkAdmin(req('/x'))).toEqual({ admin: null, reason: 'signed_out' });
  });

  it('checks a token once a minute, not on every request', async () => {
    authFetch.mockImplementation(async () => user('connectly.hq@outlook.com'));
    const { adminFromRequest } = await import('@/lib/auth/request-admin');
    const r = () => req('/x', { cookie: cookie(session(TOKEN)) });
    await Promise.all([adminFromRequest(r())]);
    await adminFromRequest(r());
    await adminFromRequest(r());
    expect(authFetch).toHaveBeenCalledTimes(1);
  });

  it('refuses everyone when ADMIN_EMAILS is not set', async () => {
    delete process.env.ADMIN_EMAILS;
    authFetch.mockResolvedValue(user('connectly.hq@outlook.com'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { adminFromRequest } = await import('@/lib/auth/request-admin');
    expect(await adminFromRequest(req('/x', { cookie: cookie(session(TOKEN)) }))).toBeNull();
    spy.mockRestore();
  });
});

describe('admin data requests', () => {
  const signedIn = { cookie: cookie(session(TOKEN)) };

  it('refuses a signed-out caller before touching the database', async () => {
    const { handleAdminView } = await import('@/lib/http/admin-api');
    const res = await handleAdminView(req('/api/admin/view/dashboard-side'));
    expect(res.status).toBe(401);
    expect(fake.ops).toEqual([]);
  });

  it('answers 404 for a view that does not exist, even to an admin', async () => {
    authFetch.mockResolvedValue(user('connectly.hq@outlook.com'));
    const { handleAdminView } = await import('@/lib/http/admin-api');
    expect((await handleAdminView(req('/api/admin/view/constructor', signedIn))).status).toBe(404);
    expect((await handleAdminView(req('/api/admin/view/nope', signedIn))).status).toBe(404);
  });

  it('serves a view to an admin, with no caching', async () => {
    authFetch.mockResolvedValue(user('connectly.hq@outlook.com'));
    fake = createFakeDb((op) => ({ data: op.table === 'locations' ? [{ id: 'l1', name: 'Hub' }] : [], error: null }));
    const { handleAdminView } = await import('@/lib/http/admin-api');
    const res = await handleAdminView(req('/api/admin/view/dashboard-side', signedIn));
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.json()).toEqual({ locations: [{ id: 'l1', name: 'Hub' }], routers: [], activity: [] });
  });

  it('answers 404 for a customer id that is malformed or unknown', async () => {
    authFetch.mockResolvedValue(user('connectly.hq@outlook.com'));
    const { handleAdminView } = await import('@/lib/http/admin-api');
    expect((await handleAdminView(req('/api/admin/view/customer?id=1%20or%201', signedIn))).status).toBe(404);
    expect(fake.ops).toEqual([]);
    expect((await handleAdminView(req('/api/admin/view/customer?id=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', signedIn))).status).toBe(404);
  });

  it('/api/admin/me: 401 signed out, 403 not an admin, the email and environment for an admin', async () => {
    const { handleAdminMe } = await import('@/lib/http/admin-api');
    expect((await handleAdminMe(req('/api/admin/me'))).status).toBe(401);
    authFetch.mockResolvedValueOnce(user('someone@example.com'));
    expect((await handleAdminMe(req('/api/admin/me', { cookie: cookie(session(TOKEN + 'n')) }))).status).toBe(403);
    authFetch.mockResolvedValueOnce(user('connectly.hq@outlook.com'));
    const res = await handleAdminMe(req('/api/admin/me', signedIn));
    expect(await res.json()).toEqual({ email: 'connectly.hq@outlook.com', environment: 'development' });
  });

  it("the payment sweep needs an admin and refuses another site's page", async () => {
    const { handleAdminSweep } = await import('@/lib/http/admin-api');
    expect((await handleAdminSweep(req('/api/admin/sweep', {}, { method: 'POST' }))).status).toBe(401);
    expect((await handleAdminSweep(req('/api/admin/sweep', { origin: 'https://evil.example', ...signedIn }, { method: 'POST' }))).status).toBe(403);
  });

  it('routes only its own paths, and sends old customer links to the new page', async () => {
    const { adminApiRoute, handleAdminMe, handleAdminView } = await import('@/lib/http/admin-api');
    expect(adminApiRoute('GET', '/api/admin/me')).toBe(handleAdminMe);
    expect(adminApiRoute('GET', '/api/admin/view/dashboard-paid')).toBe(handleAdminView);
    expect(adminApiRoute('POST', '/api/admin/view/dashboard-paid')).toBeNull();
    expect(adminApiRoute('POST', '/api/admin/plans')).toBeNull();
    expect(adminApiRoute('GET', '/admin/customers')).toBeNull();
    const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const moved = adminApiRoute('GET', `/admin/customers/${id}`);
    const res = await moved!(req(`/admin/customers/${id}`));
    expect(res.status).toBe(308);
    expect(res.headers.get('location')).toBe(`https://admin.example/admin/customer?id=${id}`);
  });
});

describe('admin save and edit actions in the front door', () => {
  const signedIn = { cookie: cookie(session(TOKEN)), 'content-type': 'application/json' };

  it('routes each action with its ids, and leaves unknown paths to Next.js', async () => {
    const { adminActionRoute } = await import('@/lib/http/admin-routes');
    const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    for (const [m, p] of [
      ['POST', '/api/admin/expenses'], ['DELETE', `/api/admin/expenses/${id}`], ['POST', '/api/admin/locations'], ['PATCH', `/api/admin/locations/${id}`],
      ['POST', `/api/admin/network/access/${id}/resend`], ['POST', `/api/admin/network/access/${id}/revoke`], ['POST', `/api/admin/network/jobs/${id}/retry`],
      ['POST', '/api/admin/network/routers'], ['PATCH', `/api/admin/network/routers/${id}`], ['POST', `/api/admin/network/routers/${id}/test`],
      ['PUT', `/api/admin/network/routers/${id}/hotspot`], ['PUT', '/api/admin/network/settings'], ['POST', '/api/admin/payments/reconcile'],
      ['POST', '/api/admin/plans'], ['PATCH', `/api/admin/plans/${id}`], ['DELETE', `/api/admin/plans/${id}`], ['POST', '/api/admin/sms/test'], ['PATCH', `/api/admin/support/${id}`],
    ]) expect(adminActionRoute(m, p), `${m} ${p}`).not.toBeNull();
    expect(adminActionRoute('POST', '/api/admin/nothing')).toBeNull();
    expect(adminActionRoute('GET', '/api/cron/sms-reminders')).toBeNull();
    const wrongMethod = adminActionRoute('GET', '/api/admin/plans');
    expect((await wrongMethod!(req('/api/admin/plans'))).status).toBe(405);
  });

  it('refuses a signed-out caller and another site’s page before doing anything', async () => {
    const { adminActionRoute } = await import('@/lib/http/admin-routes');
    const run = adminActionRoute('POST', '/api/admin/plans')!;
    const out = await run(req('/api/admin/plans', { 'content-type': 'application/json' }, { method: 'POST', body: '{}' }));
    expect(out.status).toBe(401);
    const foreign = await run(req('/api/admin/plans', { ...signedIn, origin: 'https://evil.example' }, { method: 'POST', body: '{}' }));
    expect(foreign.status).toBe(403);
    expect(fake.ops).toEqual([]);
    expect(authFetch).not.toHaveBeenCalled();
  });

  it('runs the action for an admin, with the id from the address', async () => {
    authFetch.mockResolvedValue(user('connectly.hq@outlook.com'));
    fake = createFakeDb((op) => (op.table === 'plans' ? { data: [{ id: 'p', name: 'Day' }], error: null } : { data: null, error: null }));
    const { adminActionRoute } = await import('@/lib/http/admin-routes');
    const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const res = await adminActionRoute('PATCH', `/api/admin/plans/${id}`)!(req(`/api/admin/plans/${id}`, signedIn, { method: 'PATCH', body: JSON.stringify({ isActive: false }) }));
    expect(res.status).toBe(200);
    const update = fake.ops.find((o) => o.table === 'plans' && o.action === 'update');
    expect(update?.values).toEqual({ is_active: false });
    expect(update?.filters).toContainEqual(['id', id]);
    expect(fake.ops.find((o) => o.table === 'activity_logs')?.values).toMatchObject({ event_type: 'plan.archived', metadata: { operator: 'connectly.hq@outlook.com' } });
  });

  it('sends every old detail address to its new page', async () => {
    const { movedAdminPage } = await import('@/lib/http/admin-api');
    const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    expect(movedAdminPage(`/admin/customers/${id}`)).toBe(`/admin/customer?id=${id}`);
    expect(movedAdminPage(`/admin/plans/${id}`)).toBe(`/admin/plan?id=${id}`);
    expect(movedAdminPage(`/admin/locations/${id}`)).toBe(`/admin/location?id=${id}`);
    expect(movedAdminPage(`/admin/locations/${id}/edit`)).toBe(`/admin/location/edit?id=${id}`);
    expect(movedAdminPage(`/admin/network/routers/${id}`)).toBe(`/admin/network/router?id=${id}`);
    expect(movedAdminPage(`/admin/network/routers/${id}/edit/`)).toBe(`/admin/network/router/edit?id=${id}`);
    expect(movedAdminPage('/admin/plans/new')).toBeNull();
    expect(movedAdminPage('/admin/network/routers/new')).toBeNull();
  });
});

describe('admin page data', () => {
  it('counts a location’s paid purchases, not its revenue buckets', async () => {
    fake = createFakeDb((op) => {
      if (op.table === 'locations') return { data: { id: 'l', name: 'Hub', slug: 'hub', building: null, address: null, is_active: true, institutions: null }, error: null };
      if (op.table === 'routers') return { data: [{ id: 'r1', lifecycle_status: 'active' }], error: null };
      if (op.table === 'network_authorizations') return { data: null, count: 2, error: null } as never;
      return { data: [], error: null };
    }, () => ({ data: [{ bucket: null, location_id: null, plan_id: null, payments: 14, revenue: 2100, fees: 29.39, failed: 3 }], error: null }));
    const { locationView } = await import('@/lib/admin/views');
    const d = await locationView(new URLSearchParams({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }));
    expect(d.paidPurchases).toBe(14);
    expect(d.revenue).toBe(2100);
  });

  it('shows only the last four digits of a paying phone on the access page', async () => {
    fake = createFakeDb((op) => (op.table === 'network_authorizations'
      ? { data: [{ id: 'g1', status: 'active', voucher_code: 'K7M2Q9XP', expires_at: '2026-11-22T00:00:00Z', purchases: { id: 'p', reference: 'CONN_x', phone_number: '2348031234567' }, routers: null }], error: null }
      : { data: [], error: null }));
    const { accessView } = await import('@/lib/admin/views');
    const d = await accessView(new URLSearchParams());
    expect(d.grants[0]).toMatchObject({ phoneLast4: '4567', reference: 'CONN_x' });
    expect(JSON.stringify(d)).not.toContain('2348031234567');
  });

  it('answers not found for a malformed or unknown router', async () => {
    const { routerView, NotFound } = await import('@/lib/admin/views');
    await expect(routerView(new URLSearchParams({ id: 'x' }))).rejects.toBeInstanceOf(NotFound);
    await expect(routerView(new URLSearchParams({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }))).rejects.toBeInstanceOf(NotFound);
  });
});

describe('a signed-in account that is not an admin', () => {
  it('gets 403 "not_admin" from data requests and actions, so the browser can say why', async () => {
    authFetch.mockResolvedValue(user('someone@example.com'));
    const headers = { cookie: cookie(session(TOKEN)), 'content-type': 'application/json' };
    const { handleAdminView } = await import('@/lib/http/admin-api');
    const view = await handleAdminView(req('/api/admin/view/settings', headers));
    expect(view.status).toBe(403);
    expect(await view.json()).toMatchObject({ reason: 'not_admin' });
    const { adminActionRoute } = await import('@/lib/http/admin-routes');
    const action = await adminActionRoute('POST', '/api/admin/plans')!(req('/api/admin/plans', headers, { method: 'POST', body: '{}' }));
    expect(action.status).toBe(403);
    expect(fake.ops).toEqual([]);
  });
});
