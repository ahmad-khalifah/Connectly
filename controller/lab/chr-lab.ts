// CHR lab: runs the real controller code against a real RouterOS (MikroTik
// CHR in VirtualBox) over the Mac's private host-only network. Free and
// local: a throwaway database on this Mac's PostgreSQL, no Supabase, no
// payments, no hosting.
//
// Lab-only differences from the field set-up (each says why):
// - The router is reached directly on its host-only address (direct_https),
//   not through WireGuard, so no VPN set-up is needed on the Mac.
// - The bootstrap file is served on the Mac's host-only address and only to
//   the router's host-only address; the firewall line names ether2 instead
//   of the WireGuard interface; it also sets the identity cx-lab-01, as the
//   engineer's setup script does in the field.
//
// Run (from controller/):  CONTROLLER_TEST_PG=postgres://$USER@127.0.0.1:5432/postgres node lab/chr-lab.ts

import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import pg from 'pg';
import { freshDb, paidPurchase, LOC } from '../test/pg.ts';
import { Db } from '../src/db.ts';
import { loadOrCreateCredentialKeys } from '../src/keys.ts';
import { RestRouterClient } from '../src/routeros.ts';
import { Controller } from '../src/worker.ts';
import { HealthMonitor, reconcileRouter } from '../src/health.ts';
import { bootstrapScript } from '../src/bootstrap.ts';
import { createLogger } from '../src/log.ts';
import type { JobContext } from '../src/jobs.ts';

const ROUTER_IP = process.env.LAB_ROUTER_IP ?? '192.168.56.200';
const HOST_IP = process.env.LAB_HOST_IP ?? '192.168.56.1';
const PORT = 8080;
const IDENTITY = 'cx-lab-01';

const results: { step: string; ok: boolean; detail: string }[] = [];
const record = (step: string, ok: boolean, detail: string) => {
  results.push({ step, ok, detail });
  console.log(`\n${ok ? 'PASS' : 'FAIL'}  ${step}\n      ${detail}`);
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log('Connectly controller - CHR lab\n');
  const t = await freshDb();
  const keysDir = path.join(os.homedir(), '.connectly-lab');
  const keys = loadOrCreateCredentialKeys(keysDir);
  const password = crypto.randomBytes(24).toString('base64url');
  const ciphertext = crypto
    .publicEncrypt({ key: keys.publicPem, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, Buffer.from(password))
    .toString('base64');

  const { rows } = await t.admin.query(
    `insert into routers (location_id, identifier, name, connection_method, lifecycle_status, management_ip, api_user, api_port, credential_ciphertext, credential_key_id)
     values ($1, $2::text, 'CHR lab', 'direct_https', 'registered', $3, 'connectly-ctrl', 443, $4, $5) returning id`,
    [LOC, IDENTITY, ROUTER_IP, ciphertext, keys.keyId]);
  const routerId: string = rows[0].id;

  const pool = new pg.Pool({ connectionString: t.controllerUrl, max: 4 });
  const db = new Db(pool);
  const log = createLogger((l) => fs.appendFileSync(path.join(keysDir, 'lab.log'), l + '\n', { mode: 0o600 }));
  const ctx: JobContext = { db, keys, log, connect: (target) => new RestRouterClient({ ...target, timeoutMs: 10_000 }) };
  const ctl = new Controller(ctx, { workerId: 'chr-lab', version: 'lab', environment: 'local', concurrency: 1, pollIntervalMs: 200, heartbeatIntervalMs: 60_000, sweepIntervalMs: 60_000, healthIntervalMs: 60_000, reconcileIntervalMs: 60_000 });
  const drain = async () => { while (await ctl.runOnce()); };
  const router = (await db.getRouter(routerId))!;

  // ---------------------------------------------------------------- bootstrap
  // The served file ends by calling /done, so the lab tests only after the
  // router has applied everything (a fixed wait raced the operator's typing).
  let served = false;
  let applied = false;
  const server = http.createServer((req, res) => {
    const from = (req.socket.remoteAddress ?? '').replace(/^::ffff:/, '');
    if (req.method !== 'GET' || from !== ROUTER_IP || (req.url !== '/b' && req.url !== '/done')) {
      res.writeHead(404).end('not found\n');
      return;
    }
    if (req.url === '/done') {
      applied = true;
      res.writeHead(200, { 'content-type': 'text/plain' }).end('ok\n');
      console.log('      The router finished applying it.');
      return;
    }
    const script = `/system identity set name="${IDENTITY}"\n`
      + bootstrapScript(router, password, HOST_IP).replace('in-interface=wg-connectly', 'in-interface=ether2')
      + `\n/tool fetch url="http://${HOST_IP}:${PORT}/done" output=none`;
    res.writeHead(200, { 'content-type': 'text/plain', 'cache-control': 'no-store' }).end(script + '\n');
    served = true;
    console.log('\n      The router fetched its set-up file. Now type the /import line.');
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(PORT, HOST_IP, resolve);
  });

  console.log('Type these three lines in the MikroTik window, pressing Return after each:\n');
  console.log(`  /tool fetch url="http://${HOST_IP}:${PORT}/b" dst-path=cx.rsc`);
  console.log('  /import cx.rsc');
  console.log('  /file remove cx.rsc\n');
  console.log('Waiting for the router (up to 15 minutes)...');
  for (let i = 0; i < 900 && !applied; i++) await sleep(1000);
  server.close();
  if (!served) {
    record('Router fetched its set-up file', false, 'Nothing arrived from the router within 15 minutes.');
    return finish(t, pool);
  }
  record('Router fetched and applied its set-up file', applied,
    applied ? `Served only to ${ROUTER_IP} on ${HOST_IP}:${PORT}; the password was never printed or logged.` : 'Fetched, but the import did not finish within 15 minutes (check the MikroTik window for an error).');
  if (!applied) return finish(t, pool);
  await sleep(3000);

  // ---------------------------------------------------------------- test
  const enqueue = async (kind: string) =>
    (await t.admin.query(`select enqueue_job($1, $2, null, '{}', $3, 'lab') r`, [kind, routerId, `${kind}:${Date.now()}`])).rows[0].r.job_id as string;
  const jobRow = async (id: string) => (await t.admin.query('select status, attempts, last_error, result from controller_jobs where id = $1', [id])).rows[0];

  const testJob = await enqueue('router.test');
  await ctl.runOnce();
  const tj = await jobRow(testJob);
  const tr = (await t.admin.query('select last_test_result r, tls_cert_fingerprint fp from routers where id = $1', [routerId])).rows[0];
  record('Test Connection (real RouterOS over HTTPS)', tj.status === 'succeeded',
    tj.status === 'succeeded'
      ? `identity ${tr.r.identity}, RouterOS ${tr.r.routeros_version}, ${tr.r.latency_ms} ms; certificate ${String(tr.fp).slice(0, 16)}... pinned`
      : `job ${tj.status}: ${tj.last_error}`);
  if (tj.status !== 'succeeded') return finish(t, pool);

  // Same rule the dashboard enforces: a passing test in the last 24 h.
  await t.admin.query(`update routers set lifecycle_status = 'active', activated_at = now()
    where id = $1 and (last_test_result->>'ok')::boolean and last_test_at > now() - interval '24 hours'`, [routerId]);

  // ---------------------------------------------------------------- provision
  const p = await paidPurchase(t.admin, routerId);
  await drain();
  const live = ctx.connect({ host: ROUTER_IP, port: 443, user: 'connectly-ctrl', password, pinnedFingerprint: tr.fp });
  const onRouter = await live.findHotspotUser(p.voucher);
  const pj = (await t.admin.query(`select status, last_error from controller_jobs where authorization_id = $1 and kind = 'access.provision'`, [p.grantId])).rows[0];
  record('Paid purchase -> voucher on the router', pj.status === 'succeeded' && !!onRouter,
    onRouter ? `hotspot user ${onRouter.name}, profile ${onRouter.profile}, time limit ${onRouter.limitUptime}` : `job ${pj.status}: ${pj.last_error ?? 'user not found on router'}`);

  // ---------------------------------------------------------------- repeat safety
  await t.admin.query(`select enqueue_job('access.provision', $1, $2, '{}', $3, 'lab')`, [routerId, p.grantId, `again:${Date.now()}`]);
  await drain();
  const users = (await live.listHotspotUsers()).filter((u) => u.name === p.voucher);
  record('Provisioning twice creates no duplicate', users.length === 1, `${users.length} hotspot user(s) named ${p.voucher}`);

  // ---------------------------------------------------------------- health
  const h = await new HealthMonitor(ctx).pollRouter((await db.getRouter(routerId))!);
  const hr = (await t.admin.query('select status, cpu_usage_pct, memory_usage_pct, uptime_seconds from routers where id = $1', [routerId])).rows[0];
  record('Health check', h === 'online', `status ${hr.status}, CPU ${hr.cpu_usage_pct}%, memory ${hr.memory_usage_pct}%, up ${hr.uptime_seconds}s`);

  // ---------------------------------------------------------------- expiry
  await t.admin.query(`update network_authorizations set expires_at = now() - interval '1 minute' where id = $1`, [p.grantId]);
  const queued = await ctl.sweep();
  await drain();
  const gone = !(await live.findHotspotUser(p.voucher));
  const g = (await t.admin.query('select status, revoke_reason from network_authorizations where id = $1', [p.grantId])).rows[0];
  record('Expiry removes the voucher from the router', gone && g.status === 'expired', `${queued} revoke job(s) queued; user ${gone ? 'removed' : 'STILL PRESENT'}; grant ${g.status}`);

  // ---------------------------------------------------------------- reconcile
  const rc = await reconcileRouter((await db.getRouter(routerId))!, ctx);
  record('Reconciliation finds nothing out of place', rc.removed.length === 0 && rc.requeued.length === 0, `removed ${rc.removed.length}, re-queued ${rc.requeued.length}`);

  // ---------------------------------------------------------------- wrong certificate
  const pinned = ctx.connect({ host: ROUTER_IP, port: 443, user: 'connectly-ctrl', password, pinnedFingerprint: 'AA'.repeat(32) });
  let refused = false;
  try { await pinned.identity(); } catch (e) { refused = (e as { kind?: string }).kind === 'pin_mismatch'; }
  record('A different certificate is refused before the password is sent', refused, refused ? 'refused with pin_mismatch' : 'NOT refused');

  return finish(t, pool);
}

async function finish(t: Awaited<ReturnType<typeof freshDb>>, pool: pg.Pool) {
  await pool.end();
  if (process.env.LAB_KEEP !== '1') await t.drop();
  const passed = results.filter((r) => r.ok).length;
  console.log(`\n==== ${passed} of ${results.length} lab checks passed ====`);
  for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.step}`);
  process.exit(passed === results.length && results.length > 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('\nLab stopped:', e instanceof Error ? e.message : e);
  process.exit(1);
});
