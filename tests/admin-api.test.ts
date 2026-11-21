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
