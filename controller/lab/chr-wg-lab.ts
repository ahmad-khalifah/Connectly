// CHR WireGuard lab: the field path, end to end, on one Mac.
//
//   Mac (WireGuard app = controller hub 10.77.0.1)  <-- tunnel -->  CHR (cx-lab-01)
//
// 1. The router creates its WireGuard interface (the engineer's
//    pre-registration step) and reports its public key to the lab.
// 2. The lab registers the router; the database assigns its tunnel address.
// 3. Claude adds the router as a peer in the Mac's WireGuard app.
// 4. The router runs the REAL engineer set-up script (lib/network/setup-script.ts,
//    copied verbatim) which joins the tunnel and fetches its credential from
//    the REAL bootstrap endpoint (src/bootstrap.ts) on 10.77.0.1:8080, which
//    answers only the router's own tunnel address.
// 5. Test Connection, provision, expiry, all through the tunnel, plus checks
//    that HTTPS and bootstrap are closed outside it.
//
// Lab-only helper: the pre-registration and set-up scripts are handed to the
// router over the host-only network (192.168.56.1:8080) instead of the
// engineer typing them, and the router reports its key instead of the
// engineer copying it into the dashboard.
//
// Needs ../../lab-wg.json = {"macPublicKey": "<the Mac WireGuard app's public key>"}.
// Run (from controller/):
//   LAB_HOST_IP=<Mac Wi-Fi address> LAB_ROUTER_IP=<router ether2 address> node lab/chr-wg-lab.ts

import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import pg from 'pg';
import { freshDb, paidPurchase, LOC, type TestDb } from '../test/pg.ts';
import { Db } from '../src/db.ts';
import { loadOrCreateCredentialKeys } from '../src/keys.ts';
import { RestRouterClient } from '../src/routeros.ts';
import { Controller } from '../src/worker.ts';
import { createBootstrapHandler } from '../src/bootstrap.ts';
import { createLogger } from '../src/log.ts';
import type { JobContext } from '../src/jobs.ts';
import { buildSetupScript, PRE_REGISTRATION_STEPS, WG_INTERFACE } from './app-setup-script.ts';

const ROUTER_LAN = process.env.LAB_ROUTER_IP ?? '192.168.56.200';
const HOST_LAN = process.env.LAB_HOST_IP ?? '192.168.56.1';
const HUB = '10.77.0.1';
const WG_PORT = 51820;
const PORT = 8080;
const IDENTITY = 'cx-lab-01';
const WG_KEY = /^[A-Za-z0-9+/]{42}[AEIMQUYcgkosw048]=$/;
const LAB_DIR = path.resolve(import.meta.dirname, '..', '..');

const results: { step: string; ok: boolean; detail: string }[] = [];
const record = (step: string, ok: boolean, detail: string) => {
  results.push({ step, ok, detail });
  console.log(`\n${ok ? 'PASS' : 'FAIL'}  ${step}\n      ${detail}`);
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function waitFor(what: () => boolean | Promise<boolean>, seconds: number): Promise<boolean> {
  for (let i = 0; i < seconds; i++) {
    if (await what()) return true;
    await sleep(1000);
  }
  return false;
}

async function main() {
  console.log('Connectly controller - CHR WireGuard lab\n');
  const macPublicKey = (JSON.parse(fs.readFileSync(path.join(LAB_DIR, 'lab-wg.json'), 'utf8')) as { macPublicKey: string }).macPublicKey.trim();
  if (!WG_KEY.test(macPublicKey)) throw new Error('lab-wg.json does not hold a valid WireGuard public key');

  const t = await freshDb();
  const keysDir = path.join(os.homedir(), '.connectly-lab');
  const keys = loadOrCreateCredentialKeys(keysDir);
  const password = crypto.randomBytes(24).toString('base64url');
  const pool = new pg.Pool({ connectionString: t.controllerUrl, max: 4 });
  const db = new Db(pool);
  const log = createLogger((l) => fs.appendFileSync(path.join(keysDir, 'lab.log'), l + '\n', { mode: 0o600 }));
  const ctx: JobContext = { db, keys, log, connect: (target) => new RestRouterClient({ ...target, timeoutMs: 10_000 }) };
  const ctl = new Controller(ctx, { workerId: 'chr-wg-lab', version: 'lab', environment: 'local', concurrency: 1, pollIntervalMs: 200, heartbeatIntervalMs: 60_000, sweepIntervalMs: 60_000, healthIntervalMs: 60_000, reconcileIntervalMs: 60_000 });
  const drain = async () => { while (await ctl.runOnce()); };

  // What the controller does at start-up: publish its keys and its address.
  await db.publishKeys({ credentialPublicKey: keys.publicPem, credentialKeyId: keys.keyId, wgPublicKey: macPublicKey, endpoint: `${HOST_LAN}:${WG_PORT}` });

  // ------------------------------------------------ lab helper on the host-only network
  let routerKey: string | null = null;
  let setupScript: string | null = null;
  let setupServed = false;
  const helper = http.createServer((req, res) => {
    const from = (req.socket.remoteAddress ?? '').replace(/^::ffff:/, '');
    const no = () => res.writeHead(404).end('not found\n');
    if (from !== ROUTER_LAN) return no();
    if (req.method === 'GET' && req.url === '/a') {
      const script = [
        `:if ([:len [/interface wireguard find name=${WG_INTERFACE}]] = 0) do={ ${PRE_REGISTRATION_STEPS.split('\n')[0]} }`,
        `:local pk [/interface wireguard get [find name=${WG_INTERFACE}] public-key]`,
        `/tool fetch url="http://${HOST_LAN}:${PORT}/k" http-method=post http-data=$pk output=none`,
      ].join('\n');
      res.writeHead(200, { 'content-type': 'text/plain' }).end(script + '\n');
      return;
    }
    if (req.method === 'POST' && req.url === '/k') {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        const k = body.trim().replace(/ /g, '+');
        if (WG_KEY.test(k)) routerKey = k;
        res.writeHead(WG_KEY.test(k) ? 200 : 400).end('ok\n');
      });
      return;
    }
    if (req.method === 'GET' && req.url === '/s' && setupScript) {
      setupServed = true;
      res.writeHead(200, { 'content-type': 'text/plain' }).end(setupScript + '\n');
      return;
    }
    no();
  });
  await new Promise<void>((resolve, reject) => { helper.once('error', reject); helper.listen(PORT, HOST_LAN, resolve); });

  console.log('STEP 1. Type these two lines in the MikroTik window:\n');
  console.log(`  /tool fetch url=http://${HOST_LAN}:${PORT}/a dst-path=a.rsc`);
  console.log('  /import a.rsc\n');
  console.log('Waiting for the router\'s WireGuard key (up to 15 minutes)...');
  if (!(await waitFor(() => routerKey !== null, 900))) {
    record('Router created its WireGuard interface and reported its key', false, 'No key arrived within 15 minutes.');
    helper.close();
    return finish(t, pool);
  }
  record('Router created its WireGuard interface and reported its key', true, `${WG_INTERFACE} public key ${routerKey!.slice(0, 10)}...`);

  // ------------------------------------------------ register (what the dashboard does)
  const ciphertext = crypto
    .publicEncrypt({ key: keys.publicPem, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, Buffer.from(password))
    .toString('base64');
  const { rows } = await t.admin.query(
    `insert into routers (location_id, identifier, name, connection_method, lifecycle_status, wg_public_key, api_user, api_port, credential_ciphertext, credential_key_id)
     values ($1, $2::text, 'CHR lab', 'wireguard', 'registered', $3, 'connectly-ctrl', 443, $4, $5) returning id, host(tunnel_ip) as tunnel_ip`,
    [LOC, IDENTITY, routerKey, ciphertext, keys.keyId]);
  const routerId: string = rows[0].id;
  const tunnelIp: string = rows[0].tunnel_ip;
  record('Router registered; the database assigned its tunnel address', /^10\.77\./.test(tunnelIp), `tunnel address ${tunnelIp}`);

  const peerFile = path.join(LAB_DIR, 'lab-wg-peer.txt');
  // Lab-only: the Mac also dials the router (Endpoint + keepalive), because the
  // macOS WireGuard app sends only through the main network interface. In the
  // field the router dials the controller's public address instead.
  fs.writeFileSync(peerFile, `[Peer]\nPublicKey = ${routerKey}\nAllowedIPs = ${tunnelIp}/32\nEndpoint = ${ROUTER_LAN}:13231\nPersistentKeepalive = 25\n`);
  console.log(`\nSTEP 2. Claude now adds the router to the WireGuard app on this Mac and turns the tunnel on.`);
  console.log(`        (Peer written to ${path.basename(peerFile)}; it holds public keys only.)`);
  console.log('Waiting for the Mac\'s tunnel address 10.77.0.1 (up to 15 minutes)...');

  // ------------------------------------------------ real bootstrap endpoint on the tunnel
  const handler = createBootstrapHandler({ db, keys, log, controllerIp: async () => HUB });
  let bootstrap: http.Server | null = null;
  const listening = await waitFor(() => new Promise<boolean>((resolve) => {
    const s = http.createServer(handler);
    s.once('error', () => { s.close(); resolve(false); });
    s.listen(PORT, HUB, () => { bootstrap = s; resolve(true); });
  }), 900);
  if (!listening) {
    record('Mac tunnel up at 10.77.0.1', false, 'The tunnel address never appeared on this Mac.');
    helper.close();
    return finish(t, pool);
  }
  record('Mac tunnel up at 10.77.0.1', true, `real bootstrap endpoint listening on ${HUB}:${PORT}`);

  const settings = (await t.admin.query(`select controller_endpoint, controller_wg_public_key, host(controller_tunnel_ip) as controller_tunnel_ip, tunnel_cidr::text from network_settings`)).rows[0];
  const built = buildSetupScript({
    router: { id: routerId, name: 'CHR lab', identifier: IDENTITY, connection_method: 'wireguard', tunnel_ip: tunnelIp, wg_public_key: routerKey },
    settings,
  });
  if (!built.ready) {
    record('Engineer set-up script ready', false, built.missing.join('; '));
    return finish(t, pool);
  }
  setupScript = built.script;

  console.log('\nSTEP 3. Type these three lines in the MikroTik window:\n');
  console.log(`  /tool fetch url=http://${HOST_LAN}:${PORT}/s dst-path=s.rsc`);
  console.log('  /import s.rsc');
  console.log('  /file remove s.rsc\n');
  console.log('Waiting for the router to fetch its credential through the tunnel (up to 15 minutes)...');
  const bootstrapped = await waitFor(async () =>
    (await t.admin.query(`select 1 from activity_logs where event_type = 'router.bootstrapped' and entity_id = $1`, [routerId])).rowCount! > 0, 900);
  helper.close();
  record('Router joined the tunnel and fetched its credential through it', bootstrapped,
    bootstrapped ? `engineer script ran (${setupServed ? 'served' : 'not served'}); real bootstrap endpoint answered ${tunnelIp} only` : 'No bootstrap request arrived through the tunnel.');
  if (!bootstrapped) return finish(t, pool);

  console.log('\nGiving the router 30 seconds to make its certificate and start HTTPS...');
  await sleep(30_000);

  // ------------------------------------------------ Test Connection through the tunnel
  let tj: { status: string; last_error: string | null } = { status: 'none', last_error: null };
  for (let attempt = 1; attempt <= 6; attempt++) {
    const id = (await t.admin.query(`select enqueue_job('router.test', $1, null, '{}', $2, 'lab') r`, [routerId, `test:${Date.now()}`])).rows[0].r.job_id;
    await ctl.runOnce();
    tj = (await t.admin.query('select status, last_error from controller_jobs where id = $1', [id])).rows[0];
    if (tj.status === 'succeeded') break;
    await sleep(10_000);
  }
  const tr = (await t.admin.query('select last_test_result r, tls_cert_fingerprint fp from routers where id = $1', [routerId])).rows[0];
  record('Test Connection through the WireGuard tunnel', tj.status === 'succeeded',
    tj.status === 'succeeded' ? `${tunnelIp}: identity ${tr.r.identity}, RouterOS ${tr.r.routeros_version}, ${tr.r.latency_ms} ms; certificate pinned` : `job ${tj.status}: ${tj.last_error}`);
  if (tj.status !== 'succeeded') return finish(t, pool);

  await t.admin.query(`update routers set lifecycle_status = 'active', activated_at = now()
    where id = $1 and (last_test_result->>'ok')::boolean and last_test_at > now() - interval '24 hours'`, [routerId]);

  // ------------------------------------------------ provision and expiry through the tunnel
  const p = await paidPurchase(t.admin, routerId);
  await drain();
  const live = ctx.connect({ host: tunnelIp, port: 443, user: 'connectly-ctrl', password, pinnedFingerprint: tr.fp });
  const u = await live.findHotspotUser(p.voucher);
  record('Paid purchase -> voucher on the router, through the tunnel', !!u, u ? `${u.name}, profile ${u.profile}, limit ${u.limitUptime}` : 'voucher not found on the router');

  await t.admin.query(`update network_authorizations set expires_at = now() - interval '1 minute' where id = $1`, [p.grantId]);
  await ctl.sweep();
  await drain();
  const gone = !(await live.findHotspotUser(p.voucher));
  record('Expiry removes the voucher, through the tunnel', gone, gone ? 'voucher removed; grant expired' : 'voucher STILL on the router');

  // ------------------------------------------------ closed outside the tunnel
  let lanRefused = false;
  try {
    await ctx.connect({ host: ROUTER_LAN, port: 443, user: 'connectly-ctrl', password, pinnedFingerprint: tr.fp }).identity();
  } catch {
    lanRefused = true;
  }
  record('Router HTTPS is closed outside the tunnel', lanRefused, lanRefused ? `${ROUTER_LAN}:443 no longer answers the controller login` : `${ROUTER_LAN}:443 still accepts the login`);

  const wrongSource = await new Promise<number>((resolve) => {
    http.get({ host: HUB, port: PORT, path: `/bootstrap/${routerId}`, localAddress: HUB }, (res) => { res.resume(); resolve(res.statusCode ?? 0); })
      .on('error', () => resolve(-1));
  });
  record('Bootstrap refuses anyone but the router\'s tunnel address', wrongSource === 404, `request from ${HUB} got ${wrongSource}`);

  (bootstrap as http.Server | null)?.close();
  return finish(t, pool);
}

async function finish(t: TestDb, pool: pg.Pool) {
  await pool.end();
  if (process.env.LAB_KEEP !== '1') await t.drop();
  const passed = results.filter((r) => r.ok).length;
  console.log(`\n==== ${passed} of ${results.length} WireGuard lab checks passed ====`);
  for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.step}`);
  process.exit(passed === results.length && results.length > 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('\nLab stopped:', e instanceof Error ? e.message : e);
  process.exit(1);
});
