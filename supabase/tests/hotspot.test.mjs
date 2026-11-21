// Router hotspot settings migration (20261119090000) against a disposable
// local Postgres. Synthetic data only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { freshDb, fingerprint, LOC } from './harness.mjs';

const ROLLBACK = path.resolve(import.meta.dirname, '../rollbacks/20261119090000_router_hotspot.rollback.sql');
const one = async (db, sql, params = []) => (await db.query(sql, params)).rows[0];

async function router(db, ident, lifecycle = 'registered') {
  return one(db, `insert into routers (location_id, identifier, name, connection_method, lifecycle_status, management_ip, credential_ciphertext, credential_key_id)
                  values ($1, $2::text, $2::text, 'direct_https', $3, '192.168.88.1', 'ct', 'k1') returning id`, [LOC, ident, lifecycle]);
}

test('defaults are a usable private /22 on ether2', async () => {
  const db = await freshDb();
  const r = await router(db, 'R1');
  const s = await one(db, `insert into router_hotspot_settings (router_id) values ($1) returning *`, [r.id]);
  assert.equal(s.lan_interface, 'ether2');
  assert.equal(s.gateway_cidr, '10.10.0.1/22');
  assert.equal(s.dns_name, 'wifi.getconnectly.net');
  assert.equal(s.version, 1);
  assert.equal(s.applied_version, null);
});

test('rejects unsafe or broken settings', async () => {
  const db = await freshDb();
  const r = await router(db, 'R1');
  const bad = [
    [`lan_interface`, `'ether2; /system reset'`, /hotspot_lan_interface_format/],
    [`gateway_cidr`, `'8.8.8.1/24'`, /hotspot_gateway_private/],
    [`gateway_cidr`, `'10.10.0.0/24'`, /hotspot_gateway_is_host/],
    [`gateway_cidr`, `'10.10.0.1/30'`, /hotspot_gateway_ipv4/],
    [`gateway_cidr`, `'10.77.0.5/24'`, /overlaps the controller tunnel/],
    [`dns_name`, `'*.wifi.example.com'`, /hotspot_dns_name_format/],
    [`extra_walled_garden`, `array['ok.example.com', 'bad host']`, /hotspot_walled_garden_hosts/],
  ];
  for (const [col, value, err] of bad) {
    await assert.rejects(db.query(`insert into router_hotspot_settings (router_id, ${col}) values ($1, ${value})`, [r.id]), err, `${col}=${value}`);
  }
  await db.query(`insert into router_hotspot_settings (router_id, extra_walled_garden) values ($1, array['*.paystack.co', 'api.example.ng'])`, [r.id]);
});

test('every settings change raises the version; recording an apply does not', async () => {
  const db = await freshDb();
  const r = await router(db, 'R1');
  await db.query(`insert into router_hotspot_settings (router_id) values ($1)`, [r.id]);
  await db.query(`update router_hotspot_settings set applied_version = 1, applied_at = now() where router_id = $1`, [r.id]);
  assert.equal((await one(db, `select version from router_hotspot_settings where router_id = $1`, [r.id])).version, 1);
  await db.query(`update router_hotspot_settings set dns_name = 'hotspot.example.com' where router_id = $1`, [r.id]);
  const s = await one(db, `select version, applied_version from router_hotspot_settings where router_id = $1`, [r.id]);
  assert.deepEqual([s.version, s.applied_version], [2, 1]);
  await db.query(`update router_hotspot_settings set dns_name = 'hotspot.example.com' where router_id = $1`, [r.id]);
  assert.equal((await one(db, `select version from router_hotspot_settings where router_id = $1`, [r.id])).version, 2, 'same value: no bump');
  await assert.rejects(db.query(`update router_hotspot_settings set applied_version = 3 where router_id = $1`, [r.id]), /hotspot_applied_version/);
});

test('hotspot jobs run on a registered router; other router jobs still wait for activation', async () => {
  const db = await freshDb();
  const r = await router(db, 'R1');
  await db.query(`select enqueue_job('access.provision', $1, null, '{}', 'p1', 'test')`, [r.id]);
  await db.query(`select enqueue_job('router.configure_hotspot', $1, null, '{}', 'h1', 'test')`, [r.id]);
  const claimed = await one(db, `select kind from claim_next_job('w1')`);
  assert.equal(claimed.kind, 'router.configure_hotspot');
  await db.query(`update controller_jobs set status = 'succeeded' where idempotency_key = 'h1'`);
  assert.equal((await db.query(`select * from claim_next_job('w1')`)).rows.length, 0, 'provision waits for activation');
  await assert.rejects(db.query(`select enqueue_job('router.reboot', $1, null, '{}', 'x', 'test')`, [r.id]), /controller_jobs_kind_check/);
});

test('settings are removed with their router', async () => {
  const db = await freshDb();
  const r = await router(db, 'R1');
  await db.query(`insert into router_hotspot_settings (router_id) values ($1)`, [r.id]);
  await db.query(`delete from routers where id = $1`, [r.id]);
  assert.equal(Number((await one(db, `select count(*) n from router_hotspot_settings`)).n), 0);
});

test('browser roles cannot touch hotspot settings', async () => {
  const db = await freshDb();
  for (const role of ['anon', 'authenticated']) {
    const ok = await one(db, `select has_table_privilege($1, 'public.router_hotspot_settings', 'select') s,
                                     has_table_privilege($1, 'public.router_hotspot_settings', 'update') u`, [role]);
    assert.deepEqual([ok.s, ok.u], [false, false], role);
  }
  const c = await one(db, `select has_table_privilege('connectly_controller', 'public.router_hotspot_settings', 'select') s,
                                  has_column_privilege('connectly_controller', 'public.router_hotspot_settings', 'applied_version', 'update') a,
                                  has_column_privilege('connectly_controller', 'public.router_hotspot_settings', 'gateway_cidr', 'update') g`);
  assert.deepEqual([c.s, c.a, c.g], [true, true, false], 'controller reads settings and records the outcome only');
});

test('rollback restores the exact post-network schema; refuses while hotspot jobs exist', async () => {
  const before = await fingerprint(await freshDb({ upTo: '20261118090000_network_management.sql' }));
  // Pinned to this migration so later migrations do not appear in the comparison.
  const db = await freshDb({ upTo: '20261119090000_router_hotspot.sql' });
  const r = await router(db, 'R1');
  await db.query(`select enqueue_job('router.configure_hotspot', $1, null, '{}', 'h1', 'test')`, [r.id]);
  await assert.rejects(db.exec(fs.readFileSync(ROLLBACK, 'utf8')), /router.configure_hotspot jobs exist/);
  await db.exec('rollback').catch(() => {});
  await db.query(`delete from controller_jobs`);
  await db.exec(fs.readFileSync(ROLLBACK, 'utf8'));
  await db.query(`delete from routers`);
  assert.equal(await fingerprint(db), before);
});

test('rollback restores claim_next_job byte for byte (staging today: 70961b0833c06a7868500e4fbd4c67c0)', async () => {
  const md5 = `select md5(pg_get_functiondef('public.claim_next_job(text)'::regprocedure)) m`;
  const original = (await (await freshDb({ upTo: '20261118090000_network_management.sql' })).query(md5)).rows[0].m;
  assert.equal(original, '70961b0833c06a7868500e4fbd4c67c0', 'local copy of the pre-hotspot function matches what staging runs');
  const db = await freshDb();
  assert.notEqual((await db.query(md5)).rows[0].m, original, 'the migration changes it');
  await db.exec(fs.readFileSync(ROLLBACK, 'utf8'));
  assert.equal((await db.query(md5)).rows[0].m, original);
});
