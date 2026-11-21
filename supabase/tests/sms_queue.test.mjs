// Text message queue migration (20261121120000) against a disposable local
// Postgres. Synthetic data only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { freshDb, fingerprint, PLAN, LOC } from './harness.mjs';

const MIG = '20261121120000_sms_queue.sql';
const NOW = '2026-11-21T12:00:00Z';
const at = (minutes) => new Date(Date.parse(NOW) + minutes * 60_000).toISOString();

async function router(db) {
  return (await db.query(
    `insert into routers (location_id, identifier, name, connection_method, lifecycle_status, credential_ciphertext, credential_key_id)
     values ($1, 'R1', 'R1', 'direct_https', 'active', 'ct', 'k1') returning id`, [LOC])).rows[0].id;
}

let n = 0;
/** A purchase confirmed through confirm_payment (so it has its access grant and voucher), then moved in time. */
async function paid(db, routerId, { paidAt, expiresAt, phone = '2348031234567' }) {
  n += 1;
  const ref = `CONN_sms${n}`;
  await db.query(
    `insert into purchases (plan_id, location_id, router_id, reference, phone_number, mac_address, amount_kobo, net_amount_ngn, payment_gateway)
     values ($1, $2, $3, $4, $5, $6, 25000, 250, 'korapay')`,
    [PLAN, LOC, routerId, ref, phone, `aa:bb:cc:dd:ee:${String(n).padStart(2, '0')}`]);
  await db.query(`select confirm_payment($1, 25000::bigint, 'NGN')`, [ref]);
  const p = (await db.query(`update purchases set paid_at = $2, expires_at = $3 where reference = $1 returning *`, [ref, paidAt, expiresAt])).rows[0];
  await db.query(`update network_authorizations set expires_at = $2 where purchase_id = $1`, [p.id, expiresAt]);
  return p;
}
const claim = async (db, limit = 10, now = NOW) => (await db.query(`select * from claim_due_sms($1, $2)`, [now, limit])).rows;

test('claims a payment confirmation the payment page did not ask for, after 2 minutes, once', async () => {
  const db = await freshDb();
  const r = await router(db);
  const p = await paid(db, r, { paidAt: at(-1), expiresAt: at(24 * 60) });
  assert.deepEqual(await claim(db), [], 'the page gets the first 2 minutes');
  await db.query(`update purchases set paid_at = $2 where id = $1`, [p.id, at(-5)]);
  const rows = await claim(db);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].template, 'payment_confirmed');
  assert.equal(rows[0].recipient, '2348031234567');
  assert.equal(rows[0].reference, p.reference);
  assert.equal(Number(rows[0].amount_kobo), 25000);
  assert.equal(rows[0].plan_name, 'Test Day Pass');
  assert.equal(rows[0].location_name, 'Test Hostel');
  assert.match(rows[0].voucher_code, /^[A-HJ-NP-Z2-9]{8}$/);
  const note = (await db.query(`select * from notifications where id = $1`, [rows[0].notification_id])).rows[0];
  assert.equal(note.status, 'queued');
  assert.equal(note.body, '');
  assert.deepEqual(await claim(db), [], 'never claimed twice');
});

test('a confirmation the payment page already sent is not claimed', async () => {
  const db = await freshDb();
  const r = await router(db);
  const p = await paid(db, r, { paidAt: at(-5), expiresAt: at(24 * 60) });
  await db.query(`insert into notifications (purchase_id, recipient, template, body, status) values ($1, $2, 'payment_confirmed', 'x', 'sent')`, [p.id, p.phone_number]);
  assert.deepEqual(await claim(db), []);
});

test('reminds a plan ending within the hour and one that ended within the hour, confirmations first', async () => {
  const db = await freshDb();
  const r = await router(db);
  const soon = await paid(db, r, { paidAt: at(-24 * 60 - 10), expiresAt: at(40), phone: '2348030000001' });
  const ended = await paid(db, r, { paidAt: at(-24 * 60 - 10), expiresAt: at(-30), phone: '2348030000002' });
  await paid(db, r, { paidAt: at(-24 * 60 - 10), expiresAt: at(90), phone: '2348030000003' });  // not yet
  await paid(db, r, { paidAt: at(-24 * 60 - 10), expiresAt: at(-90), phone: '2348030000004' }); // too long ago
  const fresh = await paid(db, r, { paidAt: at(-10), expiresAt: at(24 * 60), phone: '2348030000005' });
  const rows = await claim(db);
  assert.deepEqual(rows.map((x) => [x.purchase_id, x.template]), [
    [fresh.id, 'payment_confirmed'],
    [soon.id, 'expiry_soon'],
    [ended.id, 'expired'],
  ]);
});

test('no reminder for revoked access, or when the phone already has a newer plan running past it', async () => {
  const db = await freshDb();
  const r = await router(db);
  const revoked = await paid(db, r, { paidAt: at(-2000), expiresAt: at(30), phone: '2348030000010' });
  await db.query(`update network_authorizations set status = 'revoked', revoked_at = $2, revoke_reason = 'admin' where purchase_id = $1`, [revoked.id, at(-60)]);
  await paid(db, r, { paidAt: at(-2000), expiresAt: at(30), phone: '2348030000011' });
  await paid(db, r, { paidAt: at(-1500), expiresAt: at(300), phone: '2348030000011' }); // topped up, runs past it
  assert.deepEqual(await claim(db), []);
});

test('claims at most the limit; the rest wait for the next run', async () => {
  const db = await freshDb();
  const r = await router(db);
  for (let i = 0; i < 4; i++) await paid(db, r, { paidAt: at(-2000), expiresAt: at(10 + i), phone: `23480300001${i}` });
  assert.equal((await claim(db, 3)).length, 3);
  assert.equal((await claim(db, 3)).length, 1);
  await assert.rejects(claim(db, 0), /p_limit/);
  await assert.rejects(claim(db, 51), /p_limit/);
});

test('records a batch of results; a claim left unrecorded for 15 minutes is marked failed, not sent again', async () => {
  const db = await freshDb();
  const r = await router(db);
  await paid(db, r, { paidAt: at(-2000), expiresAt: at(10), phone: '2348030000020' });
  await paid(db, r, { paidAt: at(-2000), expiresAt: at(20), phone: '2348030000021' });
  const [a, b] = await claim(db);
  const done = (await db.query(`select record_sms_results($1::jsonb) n`, [JSON.stringify([
    { id: a.notification_id, status: 'sent', body: 'Connectly: ends soon', provider_message_id: 'T1' },
    { id: b.notification_id, status: 'failed', body: 'Connectly: ends soon too', error: 'Termii is not configured' },
    { id: b.notification_id, status: 'bogus' },
  ])])).rows[0].n;
  assert.equal(done, 2);
  const rows = (await db.query(`select id, status, body, attempts, provider_message_id, last_error, sent_at from notifications order by recipient`)).rows;
  assert.deepEqual(rows.map((x) => [x.status, x.body, x.attempts, x.provider_message_id, x.last_error, Boolean(x.sent_at)]), [
    ['sent', 'Connectly: ends soon', 1, 'T1', null, true],
    ['failed', 'Connectly: ends soon too', 1, null, 'Termii is not configured', false],
  ]);
  // Recording again changes nothing: only queued rows are recorded.
  assert.equal((await db.query(`select record_sms_results($1::jsonb) n`, [JSON.stringify([{ id: a.notification_id, status: 'failed', error: 'late' }])])).rows[0].n, 0);

  // A claim nobody recorded.
  await paid(db, r, { paidAt: at(-2000), expiresAt: at(30), phone: '2348030000022' });
  const [c] = await claim(db);
  await claim(db, 10, at(16));
  const stale = (await db.query(`select status, last_error from notifications where id = $1`, [c.notification_id])).rows[0];
  assert.deepEqual(stale, { status: 'failed', last_error: 'Interrupted before the result was recorded' });
});

test('only the server key can call the functions', async () => {
  const db = await freshDb();
  for (const role of ['anon', 'authenticated']) {
    const can = (await db.query(`select has_function_privilege($1, 'public.claim_due_sms(timestamptz, integer)', 'execute') a,
                                        has_function_privilege($1, 'public.record_sms_results(jsonb)', 'execute') b`, [role])).rows[0];
    assert.deepEqual(can, { a: false, b: false }, role);
  }
  const svc = (await db.query(`select has_function_privilege('service_role', 'public.claim_due_sms(timestamptz, integer)', 'execute') a`)).rows[0];
  assert.equal(svc.a, true);
});

test('rollback restores the exact schema before this migration', async () => {
  const before = await fingerprint(await freshDb({ upTo: '20261121090000_admin_totals.sql' }));
  const db = await freshDb({ upTo: MIG });
  await db.exec(fs.readFileSync(path.resolve(import.meta.dirname, '../rollbacks/20261121120000_sms_queue.rollback.sql'), 'utf8'));
  assert.equal(await fingerprint(db), before);
});

test('"ends soon" is scaled to the plan: never right after buying a short plan', async () => {
  const db = await freshDb();
  const r = await router(db);
  // 15-minute plan bought 1 minute ago: 14 minutes left, more than a quarter.
  const short = await paid(db, r, { paidAt: at(-1), expiresAt: at(14), phone: '2348030000030' });
  // 1-hour plan, 20 minutes left: more than 15.
  const hour = await paid(db, r, { paidAt: at(-40), expiresAt: at(20), phone: '2348030000031' });
  // A plan of a day or more, 50 minutes left: within the hour.
  const day = await paid(db, r, { paidAt: at(-1450), expiresAt: at(50), phone: '2348030000032' });
  await db.query(`insert into notifications (purchase_id, recipient, template, body, status)
                  select id, phone_number, 'payment_confirmed', 'x', 'sent' from purchases where id = any($1::uuid[])`, [[short.id, hour.id]]);
  assert.deepEqual((await claim(db)).map((x) => [x.purchase_id, x.template]), [[day.id, 'expiry_soon']]);
  // Later, inside each plan's own window.
  assert.deepEqual((await claim(db, 10, at(6))).map((x) => [x.purchase_id, x.template]), [[hour.id, 'expiry_soon']]); // 14 of 60 left
  assert.deepEqual((await claim(db, 10, at(11))).map((x) => [x.purchase_id, x.template]), [[short.id, 'expiry_soon']]); // 3 of 15 left
});

test('short-plan rollback puts back the first version exactly', async () => {
  const before = await freshDb({ upTo: MIG });
  const db = await freshDb({ upTo: '20261121130000_sms_short_plans.sql' });
  await db.exec(fs.readFileSync(path.resolve(import.meta.dirname, '../rollbacks/20261121130000_sms_short_plans.rollback.sql'), 'utf8'));
  const src = async (d) => (await d.query(`select pg_get_functiondef('public.claim_due_sms(timestamptz, integer)'::regprocedure) s`)).rows[0].s;
  assert.equal(await src(db), await src(before));
  assert.equal(await fingerprint(db), await fingerprint(before));
});
