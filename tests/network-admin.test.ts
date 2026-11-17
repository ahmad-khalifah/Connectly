import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import crypto from 'crypto';
import { createFakeDb, type Handler } from './fake-db';

let fake: ReturnType<typeof createFakeDb>;
vi.mock('@/lib/db/client', () => ({ get db() { return fake.db; } }));
vi.mock('@/lib/auth/admin', () => ({
  requireAdminApi: async () => ({ user: { id: 'u1', email: 'connectly.hq@outlook.com' }, denied: null }),
}));

const ROUTER = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const LOC = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const JOB = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const WG = `${'a'.repeat(42)}A=`;

// A throwaway "controller" key pair, generated per test run.
let pub = '';
let priv: crypto.KeyObject;
beforeAll(() => {
  const kp = crypto.generateKeyPairSync('rsa', { modulusLength: 3072 });
  pub = kp.publicKey.export({ type: 'spki', format: 'pem' }).toString();
  priv = kp.privateKey;
});
const decrypt = (b64: string) =>
  crypto.privateDecrypt({ key: priv, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, Buffer.from(b64, 'base64')).toString('utf8');

// Capture everything the code writes to the console.
let logged: string[] = [];
beforeEach(() => {
  logged = [];
  for (const level of ['log', 'info', 'warn', 'error'] as const) {
    vi.spyOn(console, level).mockImplementation((...args: unknown[]) => { logged.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ')); });
  }
});
afterEach(() => vi.restoreAllMocks());

const params = <T extends Record<string, string>>(o: T) => ({ params: Promise.resolve(o) });

// ---------------------------------------------------------------- input
describe('parseRouterInput', () => {
  it('accepts a WireGuard router and lowercases the identifier', async () => {
    const { parseRouterInput } = await import('@/lib/network/routers');
    const r = parseRouterInput({ name: 'Garki main', locationId: LOC, identifier: 'Garki-01', wgPublicKey: WG });
    expect(r).toMatchObject({ ok: true, value: { identifier: 'garki-01', connectionMethod: 'wireguard', hotspotServerName: 'hs-main', managementHost: null } });
  });
  it.each([
    [{ name: '', locationId: LOC, identifier: 'a' }, /name is required/],
    [{ name: 'x', locationId: 'nope', identifier: 'a' }, /Choose a location/],
    [{ name: 'x', locationId: LOC, identifier: '-bad-' }, /Identifier/],
    [{ name: 'x', locationId: LOC, identifier: 'a', wgPublicKey: 'short' }, /WireGuard public key/],
    [{ name: 'x', locationId: LOC, identifier: 'a', connectionMethod: 'direct_https' }, /public hostname/],
    [{ name: 'x', locationId: LOC, identifier: 'a', managementHost: '1.2.3.4' }, /leave the management address empty/],
    [{ name: 'x', locationId: LOC, identifier: 'a', hotspotServerName: 'bad name;' }, /Hotspot server name/],
    [{ name: 'x', locationId: LOC, identifier: 'a', connectionMethod: 'telnet' }, /Unknown connection method/],
  ])('rejects %j', async (body, msg) => {
    const { parseRouterInput } = await import('@/lib/network/routers');
    const r = parseRouterInput(body);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(msg);
  });
});

// ---------------------------------------------------------------- activation rule
describe('activationBlockers (activation needs a real, recent, passing test)', () => {
  const base = {
    lifecycle_status: 'registered' as const, connection_method: 'wireguard' as const, has_credential: true,
    wg_public_key: WG, tunnel_ip: '10.77.0.2', management_ip: null,
    last_test_at: new Date(Date.now() - 60_000).toISOString(), last_test_result: { ok: true },
  };
  it('allows a router with a passing test from a minute ago', async () => {
    const { activationBlockers } = await import('@/lib/network/routers');
    expect(activationBlockers(base)).toEqual([]);
  });
  it.each([
    [{ last_test_at: null, last_test_result: null }, /has not passed/],
    [{ last_test_result: { ok: false } }, /has not passed/],
    [{ last_test_result: { ok: 'true' } }, /has not passed/],
    [{ last_test_at: new Date(Date.now() - 25 * 3600_000).toISOString() }, /older than 24 hours/],
    [{ has_credential: false }, /No API credential/],
    [{ wg_public_key: null }, /WireGuard public key/],
    [{ tunnel_ip: null }, /tunnel address/],
    [{ lifecycle_status: 'retired' }, /cannot be activated/],
    [{ lifecycle_status: 'active' }, /cannot be activated/],
  ])('blocks when %j', async (patch, msg) => {
    const { activationBlockers } = await import('@/lib/network/routers');
    expect(activationBlockers({ ...base, ...patch } as never).join(' ')).toMatch(msg);
  });
});

// ---------------------------------------------------------------- credentials
describe('router credentials', () => {
  it('generates 32-character URL-safe passwords, never the same twice', async () => {
    const { generateRouterPassword } = await import('@/lib/network/credentials');
    const seen = new Set(Array.from({ length: 200 }, () => generateRouterPassword()));
    expect(seen.size).toBe(200);
    for (const p of seen) expect(p).toMatch(/^[A-Za-z0-9_-]{32}$/);
  });
  it('encrypts so only the controller key can decrypt (RSA-OAEP SHA-256)', async () => {
    const { encryptForController } = await import('@/lib/network/credentials');
    const ct = encryptForController('s3cret-value', pub);
    expect(ct).not.toContain('s3cret');
    expect(decrypt(ct)).toBe('s3cret-value');
    expect(encryptForController('s3cret-value', pub)).not.toBe(ct); // randomised padding
  });
  it('refuses a weak or non-RSA controller key', async () => {
    const { encryptForController } = await import('@/lib/network/credentials');
    const small = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).publicKey.export({ type: 'spki', format: 'pem' }).toString();
    const ec = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' }).publicKey.export({ type: 'spki', format: 'pem' }).toString();
    expect(() => encryptForController('x', small)).toThrow(/at least 3072/);
    expect(() => encryptForController('x', ec)).toThrow(/RSA/);
    expect(() => encryptForController('x', 'not a key')).toThrow(/not a valid/);
  });
  it('issues nothing until the controller has published its key', async () => {
    fake = createFakeDb(() => ({ data: { credential_public_key: null, credential_key_id: null }, error: null }));
    const { issueRouterCredential } = await import('@/lib/network/credentials');
    expect(await issueRouterCredential()).toBeNull();
  });
});

// ---------------------------------------------------------------- register via the real route
describe('POST /api/admin/network/routers', () => {
  const world = (opts: { key?: boolean } = {}): Handler => (op) => {
    if (op.table === 'locations') return { data: { id: LOC }, error: null };
    if (op.table === 'network_settings') return { data: opts.key === false ? { credential_public_key: null, credential_key_id: null } : { credential_public_key: pub, credential_key_id: 'test-key-1' }, error: null };
    if (op.table === 'routers' && op.action === 'insert') return { data: { id: ROUTER, tunnel_ip: '10.77.0.2' }, error: null };
    return { data: null, error: null };
  };
  const post = async (body: unknown) => {
    const { POST } = await import('@/app/api/admin/network/routers/route');
    return POST(new Request('http://x/api/admin/network/routers', { method: 'POST', body: JSON.stringify(body) }));
  };

  it('stores only the encrypted password; the password appears in no response, log or audit entry', async () => {
    fake = createFakeDb(world());
    const res = await post({ name: 'Garki main', locationId: LOC, identifier: 'garki-01', wgPublicKey: WG });
    const text = await res.text();
    expect(res.status).toBe(201);
    expect(JSON.parse(text)).toEqual({ id: ROUTER, credential: 'stored' });

    const insert = fake.ops.find((o) => o.table === 'routers' && o.action === 'insert')!.values as Record<string, string>;
    expect(insert).toMatchObject({ lifecycle_status: 'registered', api_user: 'connectly-ctrl', credential_key_id: 'test-key-1', identifier: 'garki-01' });
    const password = decrypt(insert.credential_ciphertext); // only the controller key can do this
    expect(password).toMatch(/^[A-Za-z0-9_-]{32}$/);

    const everythingVisible = [text, ...logged, JSON.stringify(fake.ops.filter((o) => o.table !== 'routers'))].join('\n');
    expect(everythingVisible).not.toContain(password);
    expect(everythingVisible).not.toContain(insert.credential_ciphertext);
    expect(JSON.stringify(insert)).not.toContain(password); // not stored in plain text either
  });

  it('registers without a credential while the controller key is missing', async () => {
    fake = createFakeDb(world({ key: false }));
    const res = await post({ name: 'Garki main', locationId: LOC, identifier: 'garki-01' });
    expect(await res.json()).toEqual({ id: ROUTER, credential: 'waiting_for_controller_key' });
    const insert = fake.ops.find((o) => o.table === 'routers' && o.action === 'insert')!.values as Record<string, unknown>;
    expect(insert.credential_ciphertext).toBeUndefined();
  });

  it('explains a duplicate identifier', async () => {
    fake = createFakeDb((op) => (op.table === 'routers' ? { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint "routers_identifier_key"' } } : world()(op)));
    const res = await post({ name: 'x', locationId: LOC, identifier: 'garki-01' });
    expect(res.status).toBe(409);
    expect((await res.json()).message).toMatch(/identifier/);
  });
});

// ---------------------------------------------------------------- lifecycle actions via the real route
describe('router actions', () => {
  const router = (patch: Record<string, unknown> = {}) => ({
    id: ROUTER, name: 'Garki main', location_id: LOC, lifecycle_status: 'registered', connection_method: 'wireguard',
    credential_key_id: 'test-key-1', wg_public_key: WG, tunnel_ip: '10.77.0.2', management_ip: null,
    last_test_at: new Date(Date.now() - 60_000).toISOString(), last_test_result: { ok: true }, ...patch,
  });
  const act = async (action: string) => {
    const { POST } = await import('@/app/api/admin/network/routers/[id]/[action]/route');
    return POST(new Request('http://x', { method: 'POST' }), params({ id: ROUTER, action }));
  };
  const world = (r: Record<string, unknown>, extra: Handler = () => ({ data: null, error: null })): Handler => (op) => {
    if (op.table === 'routers' && op.action === 'select') return { data: r, error: null };
    if (op.table === 'routers' && op.action === 'update') return { data: [{ id: ROUTER }], error: null };
    return extra(op);
  };

  it('activates after a recent passing test, conditional on that exact test', async () => {
    const r = router();
    fake = createFakeDb(world(r));
    const res = await act('activate');
    expect(res.status).toBe(200);
    const update = fake.ops.find((o) => o.table === 'routers' && o.action === 'update')!;
    expect(update.values).toMatchObject({ lifecycle_status: 'active' });
    expect(update.filters).toEqual(expect.arrayContaining([['id', ROUTER], ['lifecycle_status in', ['registered', 'suspended']], ['last_test_at', r.last_test_at]]));
  });

  it.each([
    ['no test yet', { last_test_at: null, last_test_result: null }],
    ['a failed test', { last_test_result: { ok: false, error: 'timeout' } }],
    ['no credential', { credential_key_id: null }],
  ])('refuses activation with %s and changes nothing', async (_label, patch) => {
    fake = createFakeDb(world(router(patch)));
    const res = await act('activate');
    expect(res.status).toBe(409);
    expect((await res.json()).reasons.length).toBeGreaterThan(0);
    expect(fake.ops.some((o) => o.table === 'routers' && o.action === 'update')).toBe(false);
  });

  it('Test connection queues a real controller job (no simulated result) and never writes a test result itself', async () => {
    fake = createFakeDb(world(router({ last_test_at: null, last_test_result: null })), () => ({ data: null, error: null }));
    (fake.db as unknown as { rpc: unknown }).rpc = vi.fn(async () => ({ data: { job_id: JOB, created: true, status: 'queued' }, error: null }));
    const res = await act('test');
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ jobId: JOB, status: 'queued', created: true });
    const rpc = (fake.db as unknown as { rpc: ReturnType<typeof vi.fn> }).rpc;
    expect(rpc).toHaveBeenCalledWith('enqueue_job', expect.objectContaining({ p_kind: 'router.test', p_router_id: ROUTER, p_requested_by: 'connectly.hq@outlook.com' }));
    expect(fake.ops.some((o) => o.table === 'routers' && o.action === 'update')).toBe(false);
  });

  it('a second Test connection while one is waiting returns the same job', async () => {
    fake = createFakeDb(world(router(), (op) => (op.table === 'controller_jobs' ? { data: { id: JOB, status: 'queued' }, error: null } : { data: null, error: null })));
    const res = await act('test');
    expect(await res.json()).toEqual({ jobId: JOB, status: 'queued', created: false });
  });

  it('refuses to retire a router while customers still have access', async () => {
    fake = createFakeDb(world(router({ lifecycle_status: 'suspended' }), (op) => (op.table === 'network_authorizations' ? { data: null, error: null, count: 2 } as never : { data: null, error: null })));
    const res = await act('retire');
    expect(res.status).toBe(409);
    expect((await res.json()).message).toMatch(/2 customers still have access/);
  });

  it('suspends only an Active router', async () => {
    fake = createFakeDb(world(router({ lifecycle_status: 'registered' })));
    expect((await act('suspend')).status).toBe(409);
  });

  it('never selects the credential ciphertext for lifecycle actions', async () => {
    fake = createFakeDb(world(router()));
    await act('activate');
    const select = fake.ops.find((o) => o.table === 'routers' && o.action === 'select');
    expect(JSON.stringify(select)).not.toContain('credential_ciphertext');
  });
});

// ---------------------------------------------------------------- setup script
describe('engineer setup script', () => {
  const settings = { controller_endpoint: 'ctrl.getconnectly.net:51820', controller_wg_public_key: `${'b'.repeat(42)}A=`, controller_tunnel_ip: '10.77.0.1', tunnel_cidr: '10.77.0.0/22' };
  const router = { id: ROUTER, name: 'Garki "main"', identifier: 'garki-01', connection_method: 'wireguard', tunnel_ip: '10.77.0.2', wg_public_key: WG };

  it('is ready when everything is known, and holds no secret', async () => {
    const { buildSetupScript } = await import('@/lib/network/setup-script');
    const s = buildSetupScript({ router, settings });
    expect(s.ready).toBe(true);
    expect(s.script).toContain('endpoint-address=ctrl.getconnectly.net endpoint-port=51820 allowed-address=10.77.0.1/32');
    expect(s.script).toContain('/ip address add address=10.77.0.2/22 interface=wg-connectly');
    expect(s.script).toContain(`/bootstrap/${ROUTER}`);
    expect(s.script).toContain('Garki \\"main\\"'); // RouterOS escaping
    expect(s.script).not.toMatch(/password=|private-key=/);
  });
  it('lists what is missing until the controller is deployed', async () => {
    const { buildSetupScript } = await import('@/lib/network/setup-script');
    const s = buildSetupScript({ router: { ...router, wg_public_key: null }, settings: { ...settings, controller_endpoint: null, controller_wg_public_key: null } });
    expect(s.ready).toBe(false);
    expect(s.missing).toHaveLength(3);
  });
});

// ---------------------------------------------------------------- jobs
describe('job retry and cancel', () => {
  it('re-queues a dead job now, with 3 more attempts, only if it is still failed or dead', async () => {
    fake = createFakeDb((op) =>
      op.action === 'select' && op.table === 'controller_jobs'
        ? { data: { id: JOB, status: 'dead', attempts: 8, max_attempts: 8 }, error: null }
        : op.action === 'update' ? { data: [{ id: JOB }], error: null } : { data: null, error: null });
    const { retryJob } = await import('@/lib/network/jobs');
    expect(await retryJob(JOB, 'connectly.hq@outlook.com')).toEqual({ ok: true });
    const u = fake.ops.find((o) => o.action === 'update')!;
    expect(u.values).toMatchObject({ status: 'queued', max_attempts: 11, finished_at: null });
    expect(u.filters).toEqual(expect.arrayContaining([['status in', ['failed', 'dead']]]));
    expect(fake.ops.find((o) => o.table === 'activity_logs')?.values).toMatchObject({ event_type: 'job.retried' });
  });
  it.each(['running', 'succeeded', 'queued'])('refuses to retry a %s job', async (status) => {
    fake = createFakeDb((op) => (op.action === 'select' ? { data: { id: JOB, status, attempts: 1, max_attempts: 8 }, error: null } : { data: null, error: null }));
    const { retryJob } = await import('@/lib/network/jobs');
    expect(await retryJob(JOB, 'a')).toMatchObject({ ok: false, status: 409 });
    expect(fake.ops.some((o) => o.action === 'update')).toBe(false);
  });
  it('retry caps attempts at 50', async () => {
    fake = createFakeDb((op) => (op.action === 'select' ? { data: { id: JOB, status: 'dead', attempts: 49, max_attempts: 49 }, error: null } : { data: [{ id: JOB }], error: null }));
    const { retryJob } = await import('@/lib/network/jobs');
    await retryJob(JOB, 'a');
    expect(fake.ops.find((o) => o.action === 'update')!.values).toMatchObject({ max_attempts: 50 });
  });
  it('cancels only a queued or failed job, never a running one', async () => {
    fake = createFakeDb(() => ({ data: [], error: null })); // the conditional update matched nothing
    const { cancelJob } = await import('@/lib/network/jobs');
    expect(await cancelJob(JOB, 'a')).toMatchObject({ ok: false, status: 409 });
    expect(fake.ops[0].filters).toEqual(expect.arrayContaining([['status in', ['queued', 'failed']]]));
  });
  it('treats a controller heartbeat older than 2 minutes as not running', async () => {
    const { isControllerLive } = await import('@/lib/network/jobs');
    const now = Date.parse('2026-11-17T00:00:00Z');
    expect(isControllerLive('2026-11-16T23:59:00Z', now)).toBe(true);
    expect(isControllerLive('2026-11-16T23:57:00Z', now)).toBe(false);
  });
});

// ---------------------------------------------------------------- access grants
describe('POST /api/admin/network/access/[id]/revoke', () => {
  const GRANT = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
  const revoke = async (id = GRANT) => {
    const { POST } = await import('@/app/api/admin/network/access/[id]/revoke/route');
    return POST(new Request('http://x', { method: 'POST' }), params({ id }));
  };
  const grant = (patch: Record<string, unknown> = {}) => ({
    id: GRANT, router_id: ROUTER, status: 'active', revoked_at: null, expires_at: new Date(Date.now() + 3_600_000).toISOString(), ...patch,
  });

  it('queues one revoke job with the same key the expiry sweep uses, and records who asked', async () => {
    fake = createFakeDb(
      (op) => (op.table === 'network_authorizations' ? { data: grant(), error: null } : { data: null, error: null }),
      () => ({ data: { job_id: JOB, created: true, status: 'queued' }, error: null }),
    );
    const res = await revoke();
    expect(res.status).toBe(201);
    expect(fake.rpcCalls).toEqual([{ fn: 'enqueue_job', args: {
      p_kind: 'access.revoke', p_router_id: ROUTER, p_authorization_id: GRANT, p_payload: { reason: 'admin' },
      p_idempotency_key: `revoke:${GRANT}`, p_requested_by: 'connectly.hq@outlook.com',
    } }]);
    const audit = fake.ops.find((o) => o.table === 'activity_logs' && o.action === 'insert');
    expect(audit?.values).toMatchObject({ event_type: 'access.revoke_requested', entity_id: GRANT });
  });

  it('a second request returns the existing job instead of queuing another', async () => {
    fake = createFakeDb(
      (op) => (op.table === 'network_authorizations' ? { data: grant(), error: null } : { data: null, error: null }),
      () => ({ data: { job_id: JOB, created: false, status: 'queued' }, error: null }),
    );
    const res = await revoke();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ jobId: JOB, created: false });
  });

  it.each([
    ['already revoked', { status: 'revoked', revoked_at: new Date().toISOString() }],
    ['already expired', { status: 'expired' }],
  ])('refuses when %s and queues nothing', async (_l, patch) => {
    fake = createFakeDb((op) => (op.table === 'network_authorizations' ? { data: grant(patch), error: null } : { data: null, error: null }));
    expect((await revoke()).status).toBe(409);
    expect(fake.rpcCalls).toHaveLength(0);
  });

  it('unknown or malformed ids are 404 with nothing queued', async () => {
    fake = createFakeDb(() => ({ data: null, error: null }));
    expect((await revoke()).status).toBe(404);
    expect((await revoke('not-a-uuid')).status).toBe(404);
    expect(fake.rpcCalls).toHaveLength(0);
  });
});
