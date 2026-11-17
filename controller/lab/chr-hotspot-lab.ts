// CHR hotspot lab: the hotspot set-up job and a real customer login, run by
// the real controller code against real RouterOS (MikroTik CHR in VirtualBox).
// Free and local: a throwaway database on this Mac's PostgreSQL, no Supabase,
// no payments, no hosting.
//
// Network (VirtualBox, VM powered off when changing adapters):
//   Adapter 2  host-only, 192.168.56.x : management. Router 192.168.56.200, Mac 192.168.56.1
//   Adapter 3  host-only, a SECOND host-only network : the customer side (RouterOS ether3).
//              The Mac's own address on that network acts as the "customer".
//
// Run (from this folder):
//   CONTROLLER_TEST_PG=postgres://$USER@127.0.0.1:5432/postgres node lab/chr-hotspot-lab.ts
//
// Lab-only differences from the field (each says why):
// - Router reached directly on its host-only address (direct_https), not WireGuard.
// - The customer is the Mac itself with a fixed address, not a phone on WiFi, so
//   the login check opens the router's login page directly instead of being
//   redirected to it. What is tested is the same: the page the router serves,
//   and the WiFi-code login the success page's Connect now button performs.

import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import pg from 'pg';
import { freshDb, paidPurchase, LOC } from '../test/pg.ts';
import { Db } from '../src/db.ts';
import { loadOrCreateCredentialKeys } from '../src/keys.ts';
import { RestRouterClient, type RouterClient } from '../src/routeros.ts';
import { Controller } from '../src/worker.ts';
import { bootstrapScript } from '../src/bootstrap.ts';
import { createLogger } from '../src/log.ts';
import type { JobContext } from '../src/jobs.ts';

const ROUTER_IP = process.env.LAB_ROUTER_IP ?? '192.168.56.200';
const HOST_IP = process.env.LAB_HOST_IP ?? '192.168.56.1';
const HOTSPOT_PORT = process.env.LAB_HOTSPOT_PORT ?? 'ether3';
const HOTSPOT_CIDR = process.env.LAB_HOTSPOT_CIDR ?? '192.168.57.10/24';
// The Mac's own address on the customer network, found automatically when not given.
const CUSTOMER_IP = process.env.LAB_CUSTOMER_IP ?? findLocalAddress(HOTSPOT_CIDR);
const PORT = 8080;
const IDENTITY = 'cx-lab-01';
const PORTAL = 'https://getconnectly.net/portal';

const results: { step: string; ok: boolean; detail: string }[] = [];
const record = (step: string, ok: boolean, detail: string) => {
  results.push({ step, ok, detail });
  console.log(`\n${ok ? 'PASS' : 'FAIL'}  ${step}\n      ${detail}`);
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function findLocalAddress(cidr: string): string {
  for (const list of Object.values(os.networkInterfaces())) {
    for (const a of list ?? []) if (a.family === 'IPv4' && !a.internal && sameNetwork(cidr, a.address) && a.address !== cidr.split('/')[0]) return a.address;
  }
  return '';
}

function sameNetwork(cidr: string, ipAddr: string): boolean {
  const [g, p] = cidr.split('/');
  const n = (s: string) => s.split('.').reduce((a, o) => (a << 8) + Number(o), 0) >>> 0;
  const mask = Number(p) === 0 ? 0 : (0xffffffff << (32 - Number(p))) >>> 0;
  return ((n(g!) & mask) >>> 0) === ((n(ipAddr) & mask) >>> 0);
}

async function main() {
  console.log('Connectly controller - CHR hotspot lab\n');
  console.log(`Router customer side ${HOTSPOT_CIDR} on ${HOTSPOT_PORT}; this Mac as the customer: ${CUSTOMER_IP || 'not found'}\n`);
  if (!/^\d+\.\d+\.\d+\.\d+\/\d+$/.test(HOTSPOT_CIDR) || !/^\d+\.\d+\.\d+\.\d+$/.test(CUSTOMER_IP)) {
    console.log(`This Mac has no address inside ${HOTSPOT_CIDR}. Is the VM running with Adapter 3 on CustomerNet? Or set LAB_CUSTOMER_IP and LAB_HOTSPOT_CIDR yourself.`);
    process.exit(2);
  }
  if (!sameNetwork(HOTSPOT_CIDR, CUSTOMER_IP)) {
    console.log(`LAB_CUSTOMER_IP ${CUSTOMER_IP} is not inside ${HOTSPOT_CIDR}; they must be on the same network.`);
    process.exit(2);
  }

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
  await t.admin.query(`update network_settings set portal_url = $1, walled_garden_hosts = array['checkout.korapay.com']`, [PORTAL]);

  const pool = new pg.Pool({ connectionString: t.controllerUrl, max: 4 });
  const db = new Db(pool);
  const log = createLogger((l) => fs.appendFileSync(path.join(keysDir, 'lab.log'), l + '\n', { mode: 0o600 }));
  const ctx: JobContext = { db, keys, log, connect: (target) => new RestRouterClient({ ...target, timeoutMs: 15_000 }) };
  const ctl = new Controller(ctx, { workerId: 'chr-hotspot-lab', version: 'lab', environment: 'local', concurrency: 1, pollIntervalMs: 200, heartbeatIntervalMs: 60_000, sweepIntervalMs: 60_000, healthIntervalMs: 60_000, reconcileIntervalMs: 60_000 });
  const drain = async () => { while (await ctl.runOnce()); };
  const router = (await db.getRouter(routerId))!;

  // ---------------------------------------------------------------- bootstrap (same as chr-lab)
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
  if (!served || !applied) {
    record('Router applied its set-up file', false, served ? 'Fetched, but the import did not finish within 15 minutes.' : 'Nothing arrived from the router within 15 minutes.');
    return finish(t, pool);
  }
  await sleep(3000);

  const enqueue = async (kind: string, authId: string | null = null) =>
    (await t.admin.query(`select enqueue_job($1, $2, $3, '{}', $4, 'lab') r`, [kind, routerId, authId, `${kind}:${Date.now()}:${Math.random()}`])).rows[0].r.job_id as string;
  const jobRow = async (id: string) => (await t.admin.query('select status, attempts, last_error, result from controller_jobs where id = $1', [id])).rows[0];
  const runJob = async (kind: string) => {
    const id = await enqueue(kind);
    // A first attempt may wait for the router to write its hotspot files; give it a few tries.
    for (let i = 0; i < 6; i++) {
      await drain();
      const j = await jobRow(id);
      if (j.status === 'succeeded' || j.status === 'dead') return j;
      await t.admin.query(`update controller_jobs set run_after = now() where id = $1`, [id]);
      await sleep(5000);
    }
    return jobRow(id);
  };

  const tj = await runJob('router.test');
  const fp = (await t.admin.query('select tls_cert_fingerprint fp from routers where id = $1', [routerId])).rows[0].fp as string;
  record('Test Connection (real RouterOS over HTTPS)', tj.status === 'succeeded', tj.status === 'succeeded' ? `RouterOS ${tj.result?.routeros_version}, ${tj.result?.latency_ms} ms` : `job ${tj.status}: ${tj.last_error}`);
  if (tj.status !== 'succeeded') return finish(t, pool);
  const live: RouterClient = ctx.connect({ host: ROUTER_IP, port: 443, user: 'connectly-ctrl', password, pinnedFingerprint: fp });

  // ---------------------------------------------------------------- wrong port is refused clearly
  await t.admin.query(`insert into router_hotspot_settings (router_id, lan_interface, gateway_cidr, dns_name) values ($1, 'ether9', $2, 'wifi.getconnectly.net')`, [routerId, HOTSPOT_CIDR]);
  const bad = await runJob('router.configure_hotspot');
  record('A port the router does not have is refused with a clear message', bad.status === 'dead' && /no port called "ether9"/.test(bad.last_error ?? ''), `job ${bad.status}: ${bad.last_error}`);

  // ---------------------------------------------------------------- configure hotspot
  await t.admin.query(`update router_hotspot_settings set lan_interface = $2 where router_id = $1`, [routerId, HOTSPOT_PORT]);
  const hj = await runJob('router.configure_hotspot');
  const hs = (await t.admin.query('select version, applied_version, last_error from router_hotspot_settings where router_id = $1', [routerId])).rows[0];
  record('Hotspot set up on the router from saved settings', hj.status === 'succeeded' && hs.applied_version === hs.version,
    hj.status === 'succeeded' ? `v${hs.applied_version} applied; created: ${(hj.result?.created ?? []).join(', ') || 'nothing'}` : `job ${hj.status}: ${hj.last_error ?? hs.last_error}`);
  if (hj.status !== 'succeeded') return finish(t, pool);

  // ---------------------------------------------------------------- what is on the router now
  const [hsServer] = await live.list('/ip/hotspot', { name: 'connectly' });
  const [hsProfile] = await live.list('/ip/hotspot/profile', { name: 'connectly' });
  const wg = (await live.list('/ip/hotspot/walled-garden')).filter((w) => w.comment === 'connectly').map((w) => w['dst-host']).sort();
  const [loginFile] = await live.list('/file', { name: 'hotspot/login.html' });
  const serverOk = hsServer?.interface === HOTSPOT_PORT && hsServer?.disabled === 'false';
  record('Router shows the hotspot server, profile and walled garden', serverOk && hsProfile?.['dns-name'] === 'wifi.getconnectly.net' && wg.includes('getconnectly.net') && wg.includes('checkout.korapay.com'),
    `server on ${hsServer?.interface ?? '-'} (disabled ${hsServer?.disabled ?? '-'}), dns-name ${hsProfile?.['dns-name'] ?? '-'}, login-by ${hsProfile?.['login-by'] ?? '-'}, walled garden: ${wg.join(', ') || 'none'}`);
  record('Router login page sends customers to the Connectly portal', !!loginFile?.contents?.includes(`${PORTAL}?router=${IDENTITY}`),
    loginFile ? `hotspot/login.html, ${loginFile.contents?.length ?? 0} bytes` : 'hotspot/login.html not found');

  // ---------------------------------------------------------------- repeat is harmless
  const again = await runJob('router.configure_hotspot');
  const created = (again.result?.created ?? []) as string[];
  record('Applying the same settings again changes nothing', again.status === 'succeeded' && created.length === 0 && (again.result?.removed ?? []).length === 0,
    `created ${created.length}, updated ${(again.result?.updated ?? []).length}, removed ${(again.result?.removed ?? []).length}`);

  // ---------------------------------------------------------------- change settings -> new version
  await t.admin.query(`update router_hotspot_settings set extra_walled_garden = array['*.paystack.co'] where router_id = $1`, [routerId]);
  const v2 = await runJob('router.configure_hotspot');
  const wg2 = (await live.list('/ip/hotspot/walled-garden')).filter((w) => w.comment === 'connectly').map((w) => w['dst-host']);
  const hs2 = (await t.admin.query('select version, applied_version from router_hotspot_settings where router_id = $1', [routerId])).rows[0];
  record('A settings change reaches the router as a new version', v2.status === 'succeeded' && hs2.version === 2 && hs2.applied_version === 2 && wg2.includes('*.paystack.co'),
    `v${hs2.version} saved, v${hs2.applied_version} applied; walled garden now ${wg2.sort().join(', ')}`);

  // ---------------------------------------------------------------- the customer's journey on the router
  await t.admin.query(`update routers set lifecycle_status = 'active', activated_at = now() where id = $1`, [routerId]);
  const p = await paidPurchase(t.admin, routerId);
  await drain();
  const user = await live.findHotspotUser(p.voucher);
  record('Paid purchase -> WiFi code on the router', !!user, user ? `hotspot user ${user.name}, profile ${user.profile}, limit ${user.limitUptime}` : 'not found on router');

  const gw = HOTSPOT_CIDR.split('/')[0];
  try {
    const page = await fetch(`http://${gw}/login`, { redirect: 'manual', signal: AbortSignal.timeout(10_000) });
    const body = await page.text();
    record('Customer side: the router serves the Connectly login page', body.includes(`${PORTAL}?router=${IDENTITY}`) && /mac=/.test(body),
      `GET http://${gw}/login from ${CUSTOMER_IP}: HTTP ${page.status}; ${body.includes(PORTAL) ? 'redirects to the portal with router, MAC and IP' : `unexpected page: ${body.slice(0, 120).replace(/\s+/g, ' ')}`}`);
  } catch (e) {
    record('Customer side: the router serves the Connectly login page', false, `could not reach http://${gw}/login from this Mac: ${e instanceof Error ? e.message : e}`);
  }

  // Exactly what the success page's Connect now link does.
  const connectUrl = `http://${gw}/login?${new URLSearchParams({ username: p.voucher, password: p.voucher, dst: 'https://getconnectly.net' })}`;
  let loginStatus = 'no reply';
  try {
    const r = await fetch(connectUrl, { redirect: 'manual', signal: AbortSignal.timeout(10_000) });
    loginStatus = `HTTP ${r.status}`;
  } catch (e) { loginStatus = e instanceof Error ? e.message : String(e); }
  await sleep(2000);
  const active = (await live.list('/ip/hotspot/active')).filter((a) => a.user === p.voucher);
  record('Customer logs in with the WiFi code (Connect now link)', active.length === 1,
    active.length ? `active session for ${p.voucher} from ${active[0]!.address}, MAC ${active[0]!['mac-address']}, server ${active[0]!.server} (${loginStatus})` : `no active session after login (${loginStatus})`);

  const wrong = await fetch(`http://${gw}/login?${new URLSearchParams({ username: 'NOTACODE', password: 'NOTACODE' })}`, { redirect: 'manual', signal: AbortSignal.timeout(10_000) }).then((r) => r.text()).catch(() => '');
  const wrongActive = (await live.list('/ip/hotspot/active')).filter((a) => a.user === 'NOTACODE');
  record('A wrong code does not log in', wrongActive.length === 0, `${wrongActive.length} session(s) for NOTACODE; router replied ${wrong ? 'with its page' : 'nothing'}`);

  // ---------------------------------------------------------------- expiry cuts the customer off
  await t.admin.query(`update network_authorizations set expires_at = now() - interval '1 minute' where id = $1`, [p.grantId]);
  await ctl.sweep();
  await drain();
  await sleep(2000);
  const stillActive = (await live.list('/ip/hotspot/active')).filter((a) => a.user === p.voucher).length;
  const stillUser = await live.findHotspotUser(p.voucher);
  record('Expiry ends the live session and removes the code', stillActive === 0 && !stillUser, `active sessions ${stillActive}; user ${stillUser ? 'STILL PRESENT' : 'removed'}`);

  const reLogin = await fetch(connectUrl, { redirect: 'manual', signal: AbortSignal.timeout(10_000) }).then(() => 'replied').catch(() => 'no reply');
  await sleep(1500);
  const after = (await live.list('/ip/hotspot/active')).filter((a) => a.user === p.voucher).length;
  record('An expired code cannot log in again', after === 0, `router ${reLogin}; ${after} session(s)`);

  return finish(t, pool);
}

async function finish(t: Awaited<ReturnType<typeof freshDb>>, pool: pg.Pool) {
  await pool.end();
  if (process.env.LAB_KEEP !== '1') await t.drop();
  const passed = results.filter((r) => r.ok).length;
  console.log(`\n==== ${passed} of ${results.length} hotspot lab checks passed (real RouterOS) ====`);
  for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.step}`);
  process.exit(passed === results.length && results.length > 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('\nLab stopped:', e instanceof Error ? e.message : e);
  process.exit(1);
});
