// Network Management migration (20261118090000) against a disposable local
// Postgres. Synthetic data only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { freshDb, fingerprint, PLAN, LOC } from './harness.mjs';

const KEY = (c) => `${c.repeat(42)}A=`; // valid-shaped WireGuard public key

async function addRouter(db, ident, { method = 'wireguard', lifecycle = 'registered', key = null, cred = 'ct' } = {}) {
  const r = await db.query(
    `insert into routers (location_id, identifier, name, connection_method, lifecycle_status, wg_public_key, credential_ciphertext, credential_key_id)
     values ($1, $2::text, $2::text, $3, $4, $5, $6, 'k1') returning *`,
    [LOC, ident, method, lifecycle, key, cred]
  );
  return r.rows[0];
}

async function paidPurchase(db, ref, routerId, { mac = 'aa:bb:cc:dd:ee:01', phone = '2348031110000' } = {}) {
  await db.query(
    `insert into purchases (plan_id, location_id, router_id, reference, phone_number, mac_address, amount_kobo, net_amount_ngn, payment_gateway)
     values ($1, $2, $3, $4, $5, $6, 25000, 250, 'korapay')`,
    [PLAN, LOC, routerId, ref, phone, mac]
  );
  const out = (await db.query(`select confirm_payment($1, 25000::bigint, 'NGN') r`, [ref])).rows[0].r;
  return { out, purchase: (await db.query(`select * from purchases where reference = $1`, [ref])).rows[0] };
}

const one = async (db, sql, params = []) => (await db.query(sql, params)).rows[0];
const count = async (db, sql, params = []) => Number((await one(db, sql, params)).n);

// ------------------------------------------------------------ schema

test('existing rows survive; settings row created; new routers default to offline/registered', async () => {
  const db = await freshDb();
  assert.equal(await count(db, `select count(*) n from purchases`), 2);
  const s = await one(db, `select * from network_settings`);
  assert.equal(s.tunnel_cidr, '10.77.0.0/22');
  assert.deepEqual(s.walled_garden_hosts, ['getconnectly.net', 'checkout.korapay.com']);
  const r = await addRouter(db, 'R1');
  assert.equal(r.status, 'offline');
  assert.equal(r.lifecycle_status, 'registered');
  assert.equal(r.last_heartbeat, null);
  assert.equal(r.api_port, 443);
});

test('rollback restores the exact post-ledger schema and keeps purchases', async () => {
  const before = await fingerprint(await freshDb({ upTo: '20261117090000_payment_ledger.sql' }));
  const db = await freshDb();
  await db.exec(fs.readFileSync(path.resolve(import.meta.dirname, '../rollbacks/20261118090000_network_management.rollback.sql'), 'utf8'));
  assert.equal(await fingerprint(db), before);
  assert.equal(await count(db, `select count(*) n from purchases`), 2);
});

test('rollback refuses to run while routers lack the old required columns', async () => {
  const db = await freshDb();
  await addRouter(db, 'R1');
  await assert.rejects(
    db.exec(fs.readFileSync(path.resolve(import.meta.dirname, '../rollbacks/20261118090000_network_management.rollback.sql'), 'utf8')),
    /Rollback stopped/
  );
  await db.exec('rollback').catch(() => {});
  assert.equal(await count(db, `select count(*) n from controller_jobs`), 0); // table still there
});

// ------------------------------------------------------------ routers

test('tunnel addresses: sequential, unique, never the controller, none for direct HTTPS', async () => {
  const db = await freshDb();
  const a = await addRouter(db, 'R1');
  const b = await addRouter(db, 'R2');
  const c = await addRouter(db, 'R3', { method: 'direct_https' });
  assert.equal(a.tunnel_ip, '10.77.0.2');
  assert.equal(b.tunnel_ip, '10.77.0.3');
  assert.equal(c.tunnel_ip, null);
  await assert.rejects(db.query(`update routers set tunnel_ip = '10.77.0.2' where id = $1`, [b.id]), /duplicate key|unique/);
  await assert.rejects(db.query(`update routers set tunnel_ip = '10.77.0.1' where id = $1`, [b.id]), /outside|controller/);
  await assert.rejects(db.query(`update routers set tunnel_ip = '192.168.1.5' where id = $1`, [b.id]), /outside/);
  // a retired router can give its address back, and it is reused
  await db.query(`update routers set lifecycle_status = 'retired', tunnel_ip = null where id = $1`, [a.id]);
  assert.equal((await one(db, `select tunnel_ip from routers where id = $1`, [a.id])).tunnel_ip, null);
  assert.equal((await addRouter(db, 'R4')).tunnel_ip, '10.77.0.2');
});

test('router constraints: key format, unique key, active needs a credential, valid states', async () => {
  const db = await freshDb();
  await assert.rejects(addRouter(db, 'R1', { key: 'not-a-key' }), /wg_public_key_format/);
  await addRouter(db, 'R2', { key: KEY('b') });
  await assert.rejects(addRouter(db, 'R3', { key: KEY('b') }), /wg_public_key_key/);
  await assert.rejects(addRouter(db, 'R4', { lifecycle: 'active', cred: null }), /active_needs_credential/);
  await assert.rejects(addRouter(db, 'R5', { lifecycle: 'online' }), /lifecycle_status_check/);
});

// ------------------------------------------------------------ payment -> grant -> job

test('paid purchase on a router creates one grant, one device and one provision job', async () => {
  const db = await freshDb();
  const r = await addRouter(db, 'R1', { lifecycle: 'active' });
  const { out, purchase } = await paidPurchase(db, 'CONN_g1', r.id);
  assert.equal(out.outcome, 'paid');
  const g = await one(db, `select * from network_authorizations where purchase_id = $1`, [purchase.id]);
  assert.equal(g.status, 'pending_device');
  assert.match(g.voucher_code, /^[A-HJ-NP-Z2-9]{8}$/);
  assert.equal(g.hotspot_username, g.voucher_code);
  assert.equal(String(g.expires_at), String(purchase.expires_at));
  assert.ok(g.device_id);
  const d = await one(db, `select * from devices where id = $1`, [g.device_id]);
  assert.equal(d.mac_address, 'aa:bb:cc:dd:ee:01');
  assert.equal(d.customer_id, purchase.customer_id);
  const j = await one(db, `select * from controller_jobs where authorization_id = $1`, [g.id]);
  assert.equal(j.kind, 'access.provision');
  assert.equal(j.status, 'queued');
  assert.equal(j.idempotency_key, `provision:${purchase.id}:${r.id}`);
});

test('duplicate payment confirmations never create a second grant or job', async () => {
  const db = await freshDb();
  const r = await addRouter(db, 'R1', { lifecycle: 'active' });
  await paidPurchase(db, 'CONN_dup', r.id);
  const again = await one(db, `select confirm_payment('CONN_dup', 25000::bigint, 'NGN') r`);
  assert.equal(again.r.outcome, 'already_paid');
  // even a manual status bounce cannot duplicate
  await db.query(`update purchases set status = 'pending' where reference = 'CONN_dup'`);
  await db.query(`update purchases set status = 'paid' where reference = 'CONN_dup'`);
  assert.equal(await count(db, `select count(*) n from network_authorizations`), 1);
  assert.equal(await count(db, `select count(*) n from controller_jobs`), 1);
});

test('no router or unknown MAC: payment still succeeds; no grant, or a grant without device', async () => {
  const db = await freshDb();
  const { out } = await paidPurchase(db, 'CONN_norouter', null);
  assert.equal(out.outcome, 'paid');
  assert.equal(await count(db, `select count(*) n from network_authorizations`), 0);

  const r = await addRouter(db, 'R1', { lifecycle: 'active' });
  await paidPurchase(db, 'CONN_nomac', r.id, { mac: '00:00:00:00:00:00', phone: '2348031110001' });
  const g = await one(db, `select * from network_authorizations`);
  assert.equal(g.device_id, null);
  assert.equal(await count(db, `select count(*) n from devices`), 0);
});

test('failed and pending purchases never create access', async () => {
  const db = await freshDb();
  const r = await addRouter(db, 'R1', { lifecycle: 'active' });
  await db.query(
    `insert into purchases (plan_id, location_id, router_id, reference, phone_number, mac_address, amount_kobo, net_amount_ngn)
     values ($1, $2, $3, 'CONN_f', '2348031110002', 'aa:bb:cc:dd:ee:02', 25000, 250)`, [PLAN, LOC, r.id]);
  await db.query(`select mark_payment_failed('CONN_f', 'declined')`);
  await db.query(`select confirm_payment('CONN_f', 100::bigint, 'NGN')`); // underpaid
  assert.equal(await count(db, `select count(*) n from network_authorizations`), 0);
  assert.equal(await count(db, `select count(*) n from controller_jobs`), 0);
});

test('a broken grant step is logged and does not undo the payment', async () => {
  const db = await freshDb();
  const r = await addRouter(db, 'R1', { lifecycle: 'active' });
  await db.exec(`create or replace function public.new_voucher_code() returns text language sql as $$ select 1/0 || '' $$`);
  const { out, purchase } = await paidPurchase(db, 'CONN_broken', r.id);
  assert.equal(out.outcome, 'paid');
  assert.equal(purchase.status, 'paid');
  assert.equal(await count(db, `select count(*) n from network_authorizations`), 0);
  const log = await one(db, `select * from activity_logs where event_type = 'access.grant_failed'`);
  assert.equal(log.entity_id, purchase.id);
  assert.equal(log.metadata.sqlstate, '22012');
});

test('voucher codes: format and no collisions in 5,000 draws', async () => {
  const db = await freshDb();
  const rows = (await db.query(`select new_voucher_code() c from generate_series(1, 5000)`)).rows.map((r) => r.c);
  assert.ok(rows.every((c) => /^[A-HJ-NP-Z2-9]{8}$/.test(c)));
  assert.equal(new Set(rows).size, rows.length);
});

// ------------------------------------------------------------ job queue

const claim = async (db, w = 'w1') => (await db.query(`select * from claim_next_job($1)`, [w])).rows[0] ?? null;
const complete = async (db, id, w, ok, extra = {}) =>
  (await one(db, `select complete_job($1, $2, $3, $4, $5, $6, $7) r`,
    [id, w, ok, extra.result ?? null, extra.response ?? null, extra.error ?? null, extra.retry ?? null])).r;
const enqueue = async (db, kind, routerId, key) =>
  (await one(db, `select enqueue_job($1, $2, null, '{}'::jsonb, $3, 'admin@test') r`, [kind, routerId, key])).r;

test('enqueue is idempotent per key', async () => {
  const db = await freshDb();
  const r = await addRouter(db, 'R1');
  const a = await enqueue(db, 'router.test', r.id, 'test:1');
  const b = await enqueue(db, 'router.test', r.id, 'test:1');
  assert.equal(a.created, true);
  assert.equal(b.created, false);
  assert.equal(b.job_id, a.job_id);
  await assert.rejects(enqueue(db, 'router.reboot', r.id, 'x'), /kind_check/);
});

test('claim respects router lifecycle: registered runs tests only; suspended runs revokes only; retired nothing', async () => {
  const db = await freshDb();
  const reg = await addRouter(db, 'R1');
  const sus = await addRouter(db, 'R2', { lifecycle: 'suspended' });
  const ret = await addRouter(db, 'R3', { lifecycle: 'retired' });
  await enqueue(db, 'access.provision', reg.id, 'p:reg');
  await enqueue(db, 'access.provision', sus.id, 'p:sus');
  await enqueue(db, 'router.test', ret.id, 't:ret');
  assert.equal(await claim(db), null);
  await enqueue(db, 'router.test', reg.id, 't:reg');
  await enqueue(db, 'access.revoke', sus.id, 'r:sus');
  const kinds = [(await claim(db, 'w1')).idempotency_key, (await claim(db, 'w2')).idempotency_key].sort();
  assert.deepEqual(kinds, ['r:sus', 't:reg']);
  assert.equal(await claim(db, 'w3'), null);
});

test('one running job per router; other routers still progress', async () => {
  const db = await freshDb();
  const a = await addRouter(db, 'R1', { lifecycle: 'active' });
  const b = await addRouter(db, 'R2', { lifecycle: 'active' });
  await enqueue(db, 'router.test', a.id, 'a1');
  await enqueue(db, 'router.test', a.id, 'a2');
  await enqueue(db, 'router.test', b.id, 'b1');
  const j1 = await claim(db, 'w1');
  const j2 = await claim(db, 'w2');
  assert.equal(j1.idempotency_key, 'a1');
  assert.equal(j2.idempotency_key, 'b1');
  assert.equal(j1.status, 'running');
  assert.equal(j1.attempts, 1);
  assert.equal(await claim(db, 'w3'), null);          // a2 waits for a1
  assert.equal((await complete(db, j1.id, 'w1', true)).outcome, 'succeeded');
  assert.equal((await claim(db, 'w3')).idempotency_key, 'a2');
});

test('complete: only the owner; failures back off; permanent failure and exhaustion go dead', async () => {
  const db = await freshDb();
  const r = await addRouter(db, 'R1', { lifecycle: 'active' });
  await enqueue(db, 'router.test', r.id, 'k1');
  const j = await claim(db, 'w1');
  assert.equal((await complete(db, j.id, 'intruder', true)).outcome, 'not_owner');
  assert.equal((await complete(db, j.id, 'w1', false, { error: 'timeout' })).outcome, 'failed');
  const f = await one(db, `select *, extract(epoch from run_after - now()) wait from controller_jobs where id = $1`, [j.id]);
  assert.equal(f.status, 'failed');
  assert.equal(f.last_error, 'timeout');
  assert.ok(f.wait > 10 && f.wait <= 16, `backoff ${f.wait}`);
  assert.equal(f.locked_by, null);
  assert.equal(await claim(db), null);                 // not before run_after
  await db.query(`update controller_jobs set run_after = now() where id = $1`, [j.id]);
  const j2 = await claim(db, 'w1');
  assert.equal(j2.attempts, 2);
  assert.equal((await complete(db, j2.id, 'w1', false, { error: 'bad credentials', retry: -1 })).outcome, 'dead');

  await enqueue(db, 'router.test', r.id, 'k2');
  await db.query(`update controller_jobs set max_attempts = 1 where idempotency_key = 'k2'`);
  const j3 = await claim(db, 'w1');
  assert.equal((await complete(db, j3.id, 'w1', false, { error: 'x' })).outcome, 'dead');
  assert.equal((await complete(db, j3.id, 'w1', true)).outcome, 'not_owner'); // finished jobs stay finished
});

test('a job abandoned by a crashed worker is reclaimed after 5 minutes, then given up when out of attempts', async () => {
  const db = await freshDb();
  const r = await addRouter(db, 'R1', { lifecycle: 'active' });
  await enqueue(db, 'router.test', r.id, 'k1');
  const j = await claim(db, 'w1');
  assert.equal(await claim(db, 'w2'), null);
  await db.query(`update controller_jobs set locked_at = now() - interval '6 minutes' where id = $1`, [j.id]);
  const again = await claim(db, 'w2');
  assert.equal(again.id, j.id);
  assert.equal(again.locked_by, 'w2');
  assert.equal(again.attempts, 2);
  assert.equal((await complete(db, j.id, 'w1', true)).outcome, 'not_owner'); // the old worker cannot finish it
  await db.query(`update controller_jobs set locked_at = now() - interval '6 minutes', attempts = max_attempts where id = $1`, [j.id]);
  assert.equal(await claim(db, 'w3'), null);
  assert.equal((await one(db, `select status from controller_jobs where id = $1`, [j.id])).status, 'dead');
});

test('expiry: one revoke job per expired grant, however often it runs', async () => {
  const db = await freshDb();
  const r = await addRouter(db, 'R1', { lifecycle: 'active' });
  await paidPurchase(db, 'CONN_e1', r.id);
  await paidPurchase(db, 'CONN_e2', r.id, { mac: 'aa:bb:cc:dd:ee:03', phone: '2348031110003' });
  assert.equal(Number((await one(db, `select enqueue_expired_revocations() n`)).n), 0);
  await db.query(`update network_authorizations set expires_at = now() - interval '1 second'
                   where purchase_id = (select id from purchases where reference = 'CONN_e1')`);
  assert.equal(Number((await one(db, `select enqueue_expired_revocations() n`)).n), 1);
  assert.equal(Number((await one(db, `select enqueue_expired_revocations() n`)).n), 0);
  assert.equal(await count(db, `select count(*) n from controller_jobs where kind = 'access.revoke'`), 1);
});

// ------------------------------------------------------------ privileges

async function as(db, role, sql, params = []) {
  await db.exec(`set role ${role}`);
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec('reset role');
  }
}

test('browser roles cannot touch any of it', async () => {
  const db = await freshDb();
  const r = await addRouter(db, 'R1', { lifecycle: 'active' });
  for (const role of ['anon', 'authenticated']) {
    await assert.rejects(as(db, role, `select claim_next_job('x')`), /permission denied/);
    await assert.rejects(as(db, role, `select enqueue_job('router.test', $1, null, '{}', 'k', 'x')`, [r.id]), /permission denied/);
    await assert.rejects(as(db, role, `select enqueue_expired_revocations()`), /permission denied/);
  }
  await assert.rejects(as(db, 'anon', `select * from network_settings`), /permission denied/);
  await assert.rejects(as(db, 'anon', `select * from controller_jobs`), /permission denied/);
  assert.equal((await as(db, 'authenticated', `select * from controller_jobs`)).rows.length, 0);
  assert.equal((await as(db, 'authenticated', `select * from network_settings`)).rows.length, 0);
});

test('controller role: does its job, and cannot read customers, phones, payments or prices', async () => {
  const db = await freshDb();
  const r = await addRouter(db, 'R1', { lifecycle: 'active' });
  await paidPurchase(db, 'CONN_c1', r.id);
  const C = 'connectly_controller';

  // allowed
  const job = (await as(db, C, `select * from claim_next_job('vps:1')`)).rows[0];
  assert.equal(job.kind, 'access.provision');
  assert.equal((await as(db, C, `select credential_ciphertext from routers`)).rows[0].credential_ciphertext, 'ct');
  assert.equal((await as(db, C, `select id, expires_at, router_id from purchases`)).rows.length, 3);
  assert.equal((await as(db, C, `select duration_seconds, download_limit_kbps from plans`)).rows.length, 1);
  await as(db, C, `update network_authorizations set status = 'active', provisioned_at = now()`);
  await as(db, C, `update routers set status = 'online', last_seen_at = now(), routeros_version = '7.16'`);
  await as(db, C, `insert into network_sessions (router_id, mac_address, ip_address, router_session_id) values ($1, 'aa:bb:cc:dd:ee:01', '10.5.50.2', '*1')`, [r.id]);
  await as(db, C, `insert into controller_instances (id, version) values ('vps:1', '0.1.0')`);
  await as(db, C, `insert into activity_logs (event_type, message) values ('router.online', 'R1 online')`);
  await as(db, C, `update network_settings set controller_wg_public_key = $1`, [KEY('c')]);
  assert.equal((await as(db, C, `select complete_job($1, 'vps:1', true) r`, [job.id])).rows[0].r.outcome, 'succeeded');

  // refused
  for (const sql of [
    `select phone_number from purchases`,
    `select amount_kobo from purchases`,
    `select price_kobo from plans`,
    `select * from customers`,
    `select * from payment_events`,
    `select * from notifications`,
    `select customer_id from devices`,
    `update purchases set status = 'paid'`,
    `update routers set lifecycle_status = 'active'`,
    `update routers set credential_ciphertext = 'x'`,
    `update network_authorizations set expires_at = now() + interval '1 year'`,
    `insert into controller_jobs (kind, router_id, idempotency_key) values ('router.test', '${r.id}', 'direct')`,
    `update controller_jobs set status = 'succeeded'`,
    `update network_settings set tunnel_cidr = '10.0.0.0/8'`,
    `select confirm_payment('CONN_c1', 1::bigint, 'NGN')`,
    `delete from routers`,
    `select * from activity_logs`,
  ]) {
    await assert.rejects(as(db, C, sql), /permission denied/, sql);
  }
});
