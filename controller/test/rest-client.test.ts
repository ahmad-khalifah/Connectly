import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { RestRouterClient, RouterError } from '../src/routeros.ts';
import { selfSigned, startFakeRestServer } from './fake-router.ts';

const PASSWORD = 'Abc_def-123456789012345678901234';
const cert = selfSigned('cx-test-01');
const other = selfSigned('impostor');
let srv: Awaited<ReturnType<typeof startFakeRestServer>>;

before(async () => {
  srv = await startFakeRestServer({ identity: 'cx-test-01', password: PASSWORD, cert });
});
after(async () => srv.close());

const client = (o: Partial<{ password: string; pinnedFingerprint: string | null; port: number }> = {}) =>
  new RestRouterClient({ host: '127.0.0.1', port: o.port ?? srv.port, user: 'connectly-ctrl', password: o.password ?? PASSWORD, pinnedFingerprint: o.pinnedFingerprint ?? null, timeoutMs: 3000 });

test('first connection reads identity and resources and records the certificate fingerprint', async () => {
  const c = client();
  assert.equal(await c.identity(), 'cx-test-01');
  const r = await c.resource();
  assert.deepEqual(r, { version: '7.16.2 (stable)', boardName: 'CHR', uptimeSeconds: 93784, cpuLoad: 7, memoryUsedPct: 75 });
  assert.equal(c.observedFingerprint, cert.fingerprint);
});

test('matching pinned certificate is accepted', async () => {
  assert.equal(await client({ pinnedFingerprint: cert.fingerprint }).identity(), 'cx-test-01');
});

test('a different certificate is refused before the password is sent', async () => {
  const before = srv.requests.length;
  await assert.rejects(client({ pinnedFingerprint: other.fingerprint }).identity(), (e: RouterError) => e.kind === 'pin_mismatch' && e.permanent);
  assert.equal(srv.requests.length, before, 'the server received no request at all');
});

test('wrong password is a permanent auth error', async () => {
  await assert.rejects(client({ password: 'wrong_password_wrong_password_00' }).identity(), (e: RouterError) => e.kind === 'auth' && e.permanent);
});

test('unreachable router is a retryable error', async () => {
  await assert.rejects(client({ port: 1 }).identity(), (e: RouterError) => e.kind === 'unreachable' && !e.permanent);
});

test('hotspot users: add, find, remove; removing a missing user is not an error', async () => {
  const c = client({ pinnedFingerprint: cert.fingerprint });
  const id = await c.addHotspotUser({ name: 'ABCDEFGH', password: 'ABCDEFGH', profile: 'cx-10M-3M-1d', limitUptime: '2h0m0s', comment: 'connectly:g1' });
  const u = await c.findHotspotUser('ABCDEFGH');
  assert.equal(u?.id, id);
  assert.equal(u?.limitUptime, '2h0m0s');
  assert.equal(srv.users[0]!['limit-uptime'], '2h0m0s');
  await c.removeHotspotUser(id);
  assert.equal(await c.findHotspotUser('ABCDEFGH'), null);
  await c.removeHotspotUser(id);
});
