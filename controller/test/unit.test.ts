import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadConfig, ConfigError } from '../src/config.ts';
import { createLogger, redact } from '../src/log.ts';
import { decryptRouterPassword, loadOrCreateCredentialKeys, KeyError, KEY_FILE } from '../src/keys.ts';
import { formatRouterOsDuration, parseRouterOsDuration } from '../src/routeros.ts';
import { profileFor } from '../src/jobs.ts';
import { bootstrapScript } from '../src/bootstrap.ts';
import type { GrantRow, RouterRow } from '../src/db.ts';

// Same parameters as lib/network/credentials.ts encryptForController().
const appEncrypt = (pem: string, plain: string) =>
  crypto.publicEncrypt({ key: pem, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, Buffer.from(plain)).toString('base64');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'cx-keys-'));

test('config: refuses a non-production controller pointed at the production database', () => {
  assert.throws(() => loadConfig({ CONTROLLER_ENV: 'staging', DATABASE_URL: 'postgres://u:p@aws-0-eu-west-1.pooler.supabase.com/postgres?x=plydltvxfozxflarrfrx', DATABASE_CA_FILE: '/ca' }, () => 'CA'), /must not connect to the production/);
  assert.throws(() => loadConfig({ CONTROLLER_ENV: 'local', DATABASE_URL: 'postgres://connectly_controller.plydltvxfozxflarrfrx@h/db' }), ConfigError);
});

test('config: production must use the production database; outside local the CA file is required', () => {
  assert.throws(() => loadConfig({ CONTROLLER_ENV: 'production', DATABASE_URL: 'postgres://u@h/ssmydcwqwytcmfhotjzs', DATABASE_CA_FILE: '/ca' }, () => 'CA'), /must connect to the production/);
  assert.throws(() => loadConfig({ CONTROLLER_ENV: 'staging', DATABASE_URL: 'postgres://u@h/ssmydcwqwytcmfhotjzs' }), /DATABASE_CA_FILE is required/);
  const c = loadConfig({ CONTROLLER_ENV: 'staging', DATABASE_URL: 'postgres://u@h/ssmydcwqwytcmfhotjzs', DATABASE_CA_FILE: '/ca', BOOTSTRAP_LISTEN: '10.77.0.1:8080' }, () => 'CA-PEM');
  assert.equal(c.database.caPem, 'CA-PEM');
  assert.deepEqual(c.bootstrap, { host: '10.77.0.1', port: 8080 });
  assert.throws(() => loadConfig({ CONTROLLER_ENV: 'test', DATABASE_URL: 'x' }), /CONTROLLER_ENV/);
  assert.throws(() => loadConfig({ CONTROLLER_ENV: 'local', DATABASE_URL: 'x', CONTROLLER_ENDPOINT: 'no-port' }), /host:port/);
});

test('log: secret-looking fields never reach the output', () => {
  const lines: string[] = [];
  const log = createLogger((l) => lines.push(l));
  log.info('x', { password: 'hunter2hunter2', nested: { credential_ciphertext: 'abc', ok: 1 }, list: [{ privateKey: 'k' }] });
  assert.doesNotMatch(lines[0]!, /hunter2|abc"|"k"/);
  assert.match(lines[0]!, /"ok":1/);
  assert.deepEqual(redact({ api_password: 'x' }), { api_password: '[redacted]' });
});

test('keys: created once with owner-only permissions, reloaded with the same id', () => {
  const dir = tmp();
  const a = loadOrCreateCredentialKeys(dir);
  assert.equal(a.created, true);
  assert.equal(fs.statSync(path.join(dir, KEY_FILE)).mode & 0o777, 0o600);
  assert.match(a.keyId, /^ck_[0-9a-f]{16}$/);
  const b = loadOrCreateCredentialKeys(dir);
  assert.equal(b.created, false);
  assert.equal(b.keyId, a.keyId);
  assert.equal((crypto.createPublicKey(a.publicPem).asymmetricKeyDetails?.modulusLength), 3072);
});

test('keys: refuses a key file others can read', () => {
  const dir = tmp();
  loadOrCreateCredentialKeys(dir);
  fs.chmodSync(path.join(dir, KEY_FILE), 0o644);
  assert.throws(() => loadOrCreateCredentialKeys(dir), /owner only/);
});

test('keys: decrypts what the app encrypts; refuses the wrong key id or a malformed password', () => {
  const keys = loadOrCreateCredentialKeys(tmp());
  const pw = crypto.randomBytes(24).toString('base64url');
  assert.equal(decryptRouterPassword(keys, appEncrypt(keys.publicPem, pw), keys.keyId), pw);
  assert.throws(() => decryptRouterPassword(keys, appEncrypt(keys.publicPem, pw), 'ck_other'), KeyError);
  assert.throws(() => decryptRouterPassword(keys, appEncrypt(keys.publicPem, 'bad"; /system reset'), keys.keyId), /unexpected format/);
  assert.throws(() => decryptRouterPassword(keys, 'AAAA', keys.keyId), /could not be decrypted/);
});

test('routeros: durations', () => {
  assert.equal(parseRouterOsDuration('1w2d3h4m5s'), 604800 + 172800 + 10800 + 240 + 5);
  assert.equal(parseRouterOsDuration(undefined), 0);
  assert.equal(formatRouterOsDuration(7199.9), '1h59m59s');
  assert.equal(formatRouterOsDuration(-5), '0h0m0s');
});

test('jobs: plan speeds become a RouterOS profile (upload/download from the client side)', () => {
  const g = { speed_down_mbps: 10, speed_up_mbps: 3, device_limit: 2 } as GrantRow;
  assert.deepEqual(profileFor(g), { name: 'cx-10M-3M-2d', rateLimit: '3M/10M', sharedUsers: 2 });
  assert.deepEqual(profileFor({} as GrantRow), { name: 'cx-5M-2M-1d', rateLimit: '2M/5M', sharedUsers: 1 });
});

test('bootstrap script: restricted group, API only from the controller, password only in the user lines', () => {
  const pw = 'Abc_def-123456789012345678901234';
  const s = bootstrapScript({ identifier: 'cx-garki-01' } as RouterRow, pw, '10.77.0.1');
  assert.match(s, /policy="read,write,api,rest-api,test"/);
  assert.doesNotMatch(s, /policy="[^"]*(policy|sensitive|password|sniff|romon)/);
  assert.match(s, /\/ip service set www-ssl .*address=10\.77\.0\.1\/32/);
  assert.match(s, /address=10\.77\.0\.1\/32 password=/);
  const lines = s.split('\n').filter((l) => l.includes(pw));
  assert.equal(lines.length, 1);
  assert.match(lines[0]!, /\/user (add|set)/);
});

test('wireguard peers: only valid, non-retired WireGuard routers; file rewritten only on change', async () => {
  const { renderPeers, writePeersFile } = await import('../src/wg-peers.ts');
  const key = crypto.randomBytes(32).toString('base64');
  const base = { connection_method: 'wireguard', lifecycle_status: 'active', tunnel_ip: '10.77.0.2', wg_public_key: key } as unknown as RouterRow;
  const out = renderPeers([
    { ...base, identifier: 'cx-b' },
    { ...base, identifier: 'cx-retired', lifecycle_status: 'retired' } as RouterRow,
    { ...base, identifier: 'cx-nokey', wg_public_key: null } as RouterRow,
    { ...base, identifier: 'cx-evil', wg_public_key: 'x\nAllowedIPs = 0.0.0.0/0' } as RouterRow,
    { ...base, identifier: 'cx-outside', tunnel_ip: '192.168.1.1' } as RouterRow,
  ]);
  assert.equal(out.match(/\[Peer\]/g)?.length, 1);
  assert.match(out, new RegExp(`PublicKey = ${key.replace(/[+/]/g, '\\$&')}\\nAllowedIPs = 10\\.77\\.0\\.2/32`));
  assert.doesNotMatch(out, /0\.0\.0\.0/);
  const file = path.join(tmp(), 'peers.conf');
  assert.equal(writePeersFile(file, out), true);
  assert.equal(writePeersFile(file, out), false);
});
