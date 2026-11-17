// End-to-end against a real local PostgreSQL with every migration applied.
// The controller logs in as connectly_controller; routers are simulated.

import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import pg from 'pg';
import { adminUrl, freshDb, addRouter, paidPurchase, type TestDb } from './pg.ts';
import { FakeRouter } from './fake-router.ts';
import { Db } from '../src/db.ts';
import { loadOrCreateCredentialKeys } from '../src/keys.ts';
import { Controller } from '../src/worker.ts';
import { createLogger } from '../src/log.ts';
import { reconcileRouter, HealthMonitor } from '../src/health.ts';
import { createBootstrapHandler } from '../src/bootstrap.ts';
import type { JobContext } from '../src/jobs.ts';

const skip = adminUrl() ? false : 'CONTROLLER_TEST_PG not set (see controller/README.md)';

describe('controller against a local copy of the database', { skip }, () => {
  let t: TestDb;
  let pool: pg.Pool;
  let db: Db;
  let ctx: JobContext;
  let ctl: Controller;
  const logLines: string[] = [];
  const routers = new Map<string, FakeRouter>(); // by tunnel address
  const keys = loadOrCreateCredentialKeys(fs.mkdtempSync(path.join(os.tmpdir(), 'cx-ctl-')));
  const WORKER = 'test-host:1';

  const register = async (identifier: string, lifecycle = 'registered', fake = identifier) => {
    const password = crypto.randomBytes(24).toString('base64url');
    const r = await addRouter(t.admin, { identifier, publicPem: keys.publicPem, keyId: keys.keyId, password, lifecycle });
    routers.set(r.tunnel_ip, new FakeRouter(fake, password));
    return { ...r, fake: routers.get(r.tunnel_ip)! };
  };
  const enqueue = async (kind: string, routerId: string, key = crypto.randomUUID()) =>
    (await t.admin.query(`select enqueue_job($1, $2, null, '{}', $3, 'admin@test') r`, [kind, routerId, key])).rows[0].r.job_id as string;
  const job = async (id: string) => (await t.admin.query('select * from controller_jobs where id = $1', [id])).rows[0];
  const jobFor = async (grantId: string, kind: string) => (await t.admin.query('select * from controller_jobs where authorization_id = $1 and kind = $2', [grantId, kind])).rows[0];
  const drain = async () => { while (await ctl.runOnce()); };

  before(async () => {
    t = await freshDb();
    pool = new pg.Pool({ connectionString: t.controllerUrl, max: 4 });
    db = new Db(pool);
    ctx = {
      db, keys, log: createLogger((l) => logLines.push(l)),
      connect: (target) => {
        const r = routers.get(target.host);
        if (!r) throw new Error(`no simulated router at ${target.host}`);
        return r.login(target.user, target.password);
      },
    };
    ctl = new Controller(ctx, { workerId: WORKER, version: 'test', environment: 'local', concurrency: 1, pollIntervalMs: 50, heartbeatIntervalMs: 60_000, sweepIntervalMs: 60_000, healthIntervalMs: 60_000, reconcileIntervalMs: 60_000 });
  });
  after(async () => {
    await pool?.end();
    await t?.drop();
  });

  test('logs in as the restricted controller role, publishes its key and heartbeats', async () => {
    assert.equal((await pool.query('select current_user u')).rows[0].u, 'connectly_controller');
    await db.publishKeys({ credentialPublicKey: keys.publicPem, credentialKeyId: keys.keyId, wgPublicKey: null, endpoint: 'controller.example.test:51820' });
    await ctl.heartbeat();
    const s = (await t.admin.query('select credential_key_id, controller_endpoint from network_settings')).rows[0];
    assert.deepEqual(s, { credential_key_id: keys.keyId, controller_endpoint: 'controller.example.test:51820' });
    const hb = (await t.admin.query('select info from controller_instances where id = $1', [WORKER])).rows[0];
    assert.equal(hb.info.environment, 'local');
    assert.equal(hb.info.production, false);
  });

  test('the controller role still cannot read customer data or activate routers', async () => {
    await assert.rejects(pool.query('select phone_number from purchases limit 1'), /permission denied/);
    await assert.rejects(pool.query('select * from customers limit 1'), /permission denied/);
    await assert.rejects(pool.query("update routers set lifecycle_status = 'active'"), /permission denied/);
    await assert.rejects(pool.query("update purchases set status = 'paid'"), /permission denied/);
  });

  test('Test Connection: a real check that records version, fingerprint and a pass', async () => {
    const r = await register('cx-test-01');
    const id = await enqueue('router.test', r.id);
    assert.equal(await ctl.runOnce(), true);
    const j = await job(id);
    assert.equal(j.status, 'succeeded');
    const row = (await t.admin.query('select last_test_at, last_test_result, tls_cert_fingerprint, routeros_version from routers where id = $1', [r.id])).rows[0];
    assert.equal(row.last_test_result.ok, true);
    assert.equal(row.last_test_result.identity_matches, true);
    assert.ok(row.last_test_at);
    assert.equal(row.tls_cert_fingerprint, 'AA'.repeat(32));
    assert.equal(row.routeros_version, '7.16.2 (stable)');
    assert.deepEqual(r.fake.calls, ['identity', 'resource']);
  });

  test('Test Connection fails honestly: wrong identity, wrong password, unreachable', async () => {
    const wrongName = await register('cx-test-02', 'registered', 'someone-else');
    const badPw = await register('cx-test-03');
    badPw.fake.password = 'not-the-issued-password-000000000';
    const down = await register('cx-test-04');
    down.fake.reachable = false;

    for (const [r, pattern] of [[wrongName, /calls itself "someone-else"/], [badPw, /refused the controller login/], [down, /Cannot reach/]] as const) {
      const id = await enqueue('router.test', r.id);
      await ctl.runOnce();
      const j = await job(id);
      assert.equal(j.status, 'dead', 'a test answers at once; the admin presses Test again');
      assert.match(j.last_error, pattern);
      const row = (await t.admin.query('select last_test_result, tls_cert_fingerprint from routers where id = $1', [r.id])).rows[0];
      assert.equal(row.last_test_result.ok, false);
      assert.equal(row.tls_cert_fingerprint, null);
    }
  });

  test('paid purchase -> hotspot user with plan speed and a router-side time limit', async () => {
    const r = await register('cx-site-01', 'active');
    const p = await paidPurchase(t.admin, r.id);
    await drain();
    assert.equal((await jobFor(p.grantId, 'access.provision')).status, 'succeeded');
    const u = r.fake.users.get(p.voucher)!;
    assert.equal(u.password, p.voucher);
    assert.equal(u.comment, `connectly:${p.grantId}`);
    assert.equal(u.profile, 'cx-10M-3M-1d');
    assert.deepEqual(r.fake.profiles.get('cx-10M-3M-1d'), { rateLimit: '3M/10M', sharedUsers: 1 });
    assert.match(u.limitUptime!, /^(1h59m\d+s|2h0m0s)$/);
    const g = (await t.admin.query('select status, provisioned_at, rate_limit_rule from network_authorizations where id = $1', [p.grantId])).rows[0];
    assert.equal(g.status, 'active');
    assert.ok(g.provisioned_at);
    assert.equal(g.rate_limit_rule, '3M/10M');
  });

  test('crash mid-job: the job is reclaimed after 5 minutes and repeating it creates no duplicate', async () => {
    const r = await register('cx-site-02', 'active');
    const p = await paidPurchase(t.admin, r.id);
    const claimed = await db.claimNextJob('crashed-host:9');
    assert.equal(claimed?.authorization_id, p.grantId);
    // The crashed controller had already created the user before dying.
    r.fake.users.set(p.voucher, { id: '*99', name: p.voucher, password: p.voucher, comment: `connectly:${p.grantId}`, profile: 'x', limitUptime: '1h' });
    assert.equal(await ctl.runOnce(), false, 'a running job is not handed out again within 5 minutes');
    await t.admin.query(`update controller_jobs set locked_at = now() - interval '6 minutes' where id = $1`, [claimed!.id]);
    assert.equal(await ctl.runOnce(), true);
    const j = await job(claimed!.id);
    assert.equal(j.status, 'succeeded');
    assert.equal(j.attempts, 2);
    assert.equal(r.fake.users.size, 1);
    assert.equal(r.fake.users.get(p.voucher)!.profile, 'cx-10M-3M-1d', 'the existing user was updated, not duplicated');
    assert.equal((await db.completeJob({ jobId: claimed!.id, worker: 'crashed-host:9', ok: true })), 'not_owner', 'the crashed worker cannot overwrite the result later');
  });

  test('router offline: provision retries with back-off, then succeeds when it returns', async () => {
    const r = await register('cx-site-03', 'active');
    r.fake.reachable = false;
    const p = await paidPurchase(t.admin, r.id);
    await ctl.runOnce();
    let j = await jobFor(p.grantId, 'access.provision');
    assert.equal(j.status, 'failed');
    assert.ok(new Date(j.run_after).getTime() > Date.now() + 10_000, 'next attempt about 15 s later');
    const g = (await t.admin.query('select status, last_error from network_authorizations where id = $1', [p.grantId])).rows[0];
    assert.equal(g.status, 'pending_device');
    assert.match(g.last_error, /Cannot reach/);
    r.fake.reachable = true;
    await t.admin.query('update controller_jobs set run_after = now() where id = $1', [j.id]);
    await drain();
    j = await job(j.id);
    assert.equal(j.status, 'succeeded');
    assert.equal(j.attempts, 2);
    assert.ok(r.fake.users.has(p.voucher));
  });

  test('expiry while the controller was down: one revoke each, user and session removed', async () => {
    const r = await register('cx-site-04', 'active');
    const p = await paidPurchase(t.admin, r.id);
    await drain();
    r.fake.active.set('*A1', { id: '*A1', user: p.voucher, address: '10.5.50.10' });
    await t.admin.query(`insert into network_sessions (router_id, mac_address, ip_address, authorization_id, router_session_id, status)
                         values ($1, 'aa:bb:cc:dd:ee:01', '10.5.50.10', $2, '*A1', 'active')`, [r.id, p.grantId]);
    await t.admin.query(`update network_authorizations set expires_at = now() - interval '1 minute' where id = $1`, [p.grantId]);
    assert.ok((await ctl.sweep()) >= 1);
    assert.equal(await ctl.sweep(), 0, 'sweeping again queues nothing new');
    await drain();
    assert.equal((await jobFor(p.grantId, 'access.revoke')).status, 'succeeded');
    assert.equal(r.fake.users.has(p.voucher), false);
    assert.equal(r.fake.active.size, 0);
    const g = (await t.admin.query('select status, revoked_at, revoke_reason from network_authorizations where id = $1', [p.grantId])).rows[0];
    assert.equal(g.status, 'expired');
    assert.ok(g.revoked_at);
    assert.equal(g.revoke_reason, 'expired');
    const s = (await t.admin.query('select status, session_end from network_sessions where authorization_id = $1', [p.grantId])).rows[0];
    assert.equal(s.status, 'terminated');
    assert.ok(s.session_end);
  });

  test('reconciliation removes users whose grant ended and re-queues live grants missing from the router', async () => {
    const r = await register('cx-site-05', 'active');
    const live = await paidPurchase(t.admin, r.id);
    await drain();
    r.fake.users.clear(); // router reset: lost every user
    r.fake.users.set('STALE001', { id: '*S', name: 'STALE001', password: 'x', comment: `connectly:${crypto.randomUUID()}` });
    r.fake.users.set('ADMINUSR', { id: '*M', name: 'ADMINUSR', password: 'x', comment: 'made by the engineer' });
    const router = (await db.getRouter(r.id))!;
    const out = await reconcileRouter(router, ctx);
    assert.deepEqual(out.removed, ['STALE001']);
    assert.deepEqual(out.requeued, [live.voucher]);
    assert.ok(r.fake.users.has('ADMINUSR'), 'users the controller did not create are left alone');
    assert.deepEqual((await reconcileRouter(router, ctx)).requeued, [], 'at most once an hour per grant');
    await drain();
    assert.ok(r.fake.users.has(live.voucher));
  });

  test('health: three missed polls mark a router offline and log it; it recovers when reachable', async () => {
    const r = await register('cx-site-06', 'active');
    const router = (await db.getRouter(r.id))!;
    const h = new HealthMonitor(ctx);
    assert.equal(await h.pollRouter(router), 'online');
    r.fake.reachable = false;
    assert.equal(await h.pollRouter(router), 'missed');
    assert.equal(await h.pollRouter(router), 'missed');
    assert.equal(await h.pollRouter(router), 'offline');
    let row = (await t.admin.query('select status, is_online, last_error from routers where id = $1', [r.id])).rows[0];
    assert.deepEqual([row.status, row.is_online], ['offline', false]);
    assert.equal((await t.admin.query(`select count(*)::int n from activity_logs where event_type = 'router.offline' and entity_id = $1`, [r.id])).rows[0].n, 1);
    r.fake.reachable = true;
    assert.equal(await h.pollRouter({ ...router, status: 'offline' }), 'online');
    row = (await t.admin.query('select status, is_online, cpu_usage_pct from routers where id = $1', [r.id])).rows[0];
    assert.deepEqual([row.status, row.is_online, row.cpu_usage_pct], ['online', true, 3]);
  });

  test('bootstrap: serves the credential only to the router\'s own tunnel address, and never logs it', async () => {
    const pw = crypto.randomBytes(24).toString('base64url');
    const r = await addRouter(t.admin, { identifier: 'cx-boot-01', publicPem: keys.publicPem, keyId: keys.keyId, password: pw });
    const lines: string[] = [];
    const handler = createBootstrapHandler({ db, keys, log: createLogger((l) => lines.push(l)), controllerIp: async () => '10.77.0.1' });
    const call = async (url: string, from: string) => {
      let status = 0;
      let body = '';
      const res = { writeHead(s: number) { status = s; return res; }, end(b?: string) { body = b ?? ''; } };
      await handler({ method: 'GET', url, socket: { remoteAddress: from } } as never, res as never);
      return { status, body };
    };
    const ok = await call(`/bootstrap/${r.id}`, `::ffff:${r.tunnel_ip}`);
    assert.equal(ok.status, 200);
    assert.ok(ok.body.includes(pw));
    assert.match(ok.body, /address=10\.77\.0\.1\/32/);
    assert.equal((await call(`/bootstrap/${r.id}`, '10.77.0.250')).status, 404, 'another tunnel address');
    assert.equal((await call(`/bootstrap/${crypto.randomUUID()}`, r.tunnel_ip)).status, 404, 'unknown router');
    assert.equal((await call(`/bootstrap/not-a-uuid`, r.tunnel_ip)).status, 404);
    assert.equal(lines.some((l) => l.includes(pw)), false, 'the password is in no log line');
    assert.equal((await t.admin.query(`select count(*)::int n from activity_logs where event_type = 'router.bootstrapped' and entity_id = $1`, [r.id])).rows[0].n, 1);
  });

  test('jobs this version does not handle fail clearly instead of pretending', async () => {
    const r = await register('cx-site-07', 'active');
    const id = await enqueue('router.sync_profiles', r.id);
    await ctl.runOnce();
    const j = await job(id);
    assert.equal(j.status, 'dead');
    assert.match(j.last_error, /does not handle router\.sync_profiles/);
  });

  test('WireGuard peer list is built from the database and drops retired routers', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cx-wg-'));
    const file = path.join(dir, 'wg-peers.conf');
    const c2 = new Controller(ctx, { workerId: 'peer-test', version: 'test', environment: 'local', concurrency: 1, pollIntervalMs: 50, heartbeatIntervalMs: 60_000, sweepIntervalMs: 60_000, healthIntervalMs: 60_000, reconcileIntervalMs: 60_000, wgPeersFile: file });
    const r = await register('cx-wg-01');
    assert.equal(await c2.syncPeers(), true);
    const ip = (await t.admin.query('select host(tunnel_ip) ip, wg_public_key k from routers where id = $1', [r.id])).rows[0];
    assert.ok(fs.readFileSync(file, 'utf8').includes(`PublicKey = ${ip.k}\nAllowedIPs = ${ip.ip}/32`));
    assert.equal(await c2.syncPeers(), false, 'unchanged list: no rewrite');
    await t.admin.query(`update routers set lifecycle_status = 'retired', tunnel_ip = null where id = $1`, [r.id]);
    assert.equal(await c2.syncPeers(), true);
    assert.equal(fs.readFileSync(file, 'utf8').includes(ip.k), false);
  });

  test('start/stop: a payment made while running is provisioned automatically; stop waits cleanly', async () => {
    const r = await register('cx-site-08', 'active');
    await ctl.start();
    const p = await paidPurchase(t.admin, r.id);
    for (let i = 0; i < 50 && !r.fake.users.has(p.voucher); i++) await new Promise((res) => setTimeout(res, 100));
    await ctl.stop();
    assert.ok(r.fake.users.has(p.voucher));
    assert.equal(logLines.some((l) => /"level":"error"/.test(l)), false, logLines.filter((l) => /error/.test(l)).join('\n'));
  });
});
