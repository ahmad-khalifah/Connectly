// Admin totals migration (20261121090000) against a disposable local
// Postgres. Synthetic data only. The fixtures mirror tests/metrics.test.ts,
// so the SQL functions are checked against the same expected figures as the
// TypeScript reference implementations in lib/admin/metrics.ts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { freshDb, fingerprint, PLAN, LOC } from './harness.mjs';

const MIG = '20261121090000_admin_totals.sql';
const ROOT = path.resolve(import.meta.dirname, '..');
const LOC_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const PLAN_2 = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
// 18 Nov 2026, 18:30 in Lagos.
const NOW = '2026-11-18T17:30:00Z';
const TODAY = '2026-11-17T23:00:00Z';   // midnight Lagos, 18 Nov
const DAYS7 = '2026-11-11T23:00:00Z';
const MONTH = '2026-10-31T23:00:00Z';

let seq = 0;
async function purchase(db, { status = 'paid', at, amount = null, kobo = null, fee = 0, loc = LOC, plan = PLAN, phone = '2348030000001', expires = null }) {
  seq += 1;
  const r = await db.query(
    `insert into purchases (plan_id, location_id, reference, phone_number, status, amount_paid, amount_kobo, gateway_fee_ngn, paid_at, created_at, expires_at, payment_gateway)
     values ($1, $2, $3, $4, $5::purchase_status, $6, $7, $8, case when $5 = 'paid' then $9::timestamptz end, $9::timestamptz, $10, 'korapay') returning id`,
    [plan, loc, `CONN_t${seq}`, phone, status, amount, kobo, fee, at, expires]
  );
  return r.rows[0].id;
}

async function seeded() {
  const db = await freshDb();
  // The harness seeds two legacy pending purchases; they must never count.
  await db.exec(`insert into locations (id, name, slug) values ('${LOC_B}', 'Other Hostel', 'other-hostel');
                 insert into plans (id, name, price_kobo, duration_seconds) values ('${PLAN_2}', 'Week', 150000, 604800);`);
  await purchase(db, { at: '2026-11-18T08:00:00Z', amount: 200, fee: 2.8 });                 // today
  await purchase(db, { at: '2026-11-17T22:30:00Z', amount: 500, fee: 7, plan: PLAN_2 });     // 23:30 Lagos on the 17th
  await purchase(db, { at: '2026-11-02T10:00:00Z', amount: 1000, fee: 14, loc: LOC_B });     // this month, other location
  await purchase(db, { at: '2026-10-20T10:00:00Z', amount: 300 });                           // last month
  await purchase(db, { status: 'failed', at: '2026-11-18T09:00:00Z' });
  await purchase(db, { status: 'pending', at: '2026-11-18T09:00:00Z' });
  await purchase(db, { at: '2026-11-18T09:00:00Z', amount: null, kobo: 15000 });             // no verified amount: checkout price
  return db;
}

const rows = async (db, sql, params) => (await db.query(sql, params)).rows.map((r) => ({ ...r, payments: Number(r.payments), revenue: Number(r.revenue), fees: Number(r.fees), failed: Number(r.failed) }));

test('migration applies on top of every earlier migration', async () => {
  const db = await freshDb();
  const names = (await db.query(`select proname from pg_proc where pronamespace = 'public'::regnamespace and proname like 'admin_%' order by 1`)).rows.map((r) => r.proname);
  assert.deepEqual(names, ['admin_customer_counts', 'admin_customer_page', 'admin_grant_counts', 'admin_paid_totals']);
});

test('lagos_day: midnight in Lagos is 23:00 UTC the day before', async () => {
  const db = await freshDb();
  const d = async (ts) => (await db.query(`select to_char(lagos_day($1::timestamptz), 'YYYY-MM-DD') d`, [ts])).rows[0].d;
  assert.equal(await d('2026-11-18T23:30:00Z'), '2026-11-19');
  assert.equal(await d('2026-11-18T22:59:59Z'), '2026-11-18');
  assert.equal(await d(NOW), '2026-11-18');
});

test('paid totals: today, windows and location filter match the dashboard definitions', async () => {
  const db = await seeded();
  const total = async (from, loc = null) => rows(db, `select * from admin_paid_totals($1, $2, $3)`, [from, NOW, loc]);
  assert.deepEqual(await total(TODAY), [{ bucket: null, location_id: null, plan_id: null, payments: 2, revenue: 350, fees: 2.8, failed: 1 }]);
  const rev = async (from, loc) => (await total(from, loc))[0]?.revenue ?? 0;
  assert.deepEqual([await rev(TODAY), await rev(DAYS7), await rev(MONTH), await rev(null)], [350, 850, 1850, 2150]);
  assert.equal(await rev(null, LOC), 1150);
  const month = (await total(MONTH, LOC))[0];
  assert.equal(month.revenue, 850);
  assert.equal(month.payments, 3);
});

test('paid totals by day and by month, with the Lagos day boundary', async () => {
  const db = await seeded();
  const days = await rows(db, `select * from admin_paid_totals($1, $2, null, 'day')`, [DAYS7, NOW]);
  assert.deepEqual(days.map((r) => [r.bucket, r.payments, r.revenue, r.failed]), [['2026-11-17', 1, 500, 0], ['2026-11-18', 2, 350, 1]]);
  const months = await rows(db, `select * from admin_paid_totals(null, $1, null, 'month')`, [NOW]);
  assert.deepEqual(months.map((r) => [r.bucket, r.revenue]), [['2026-10', 300], ['2026-11', 1850]]);
});

test('paid totals grouped by location and by plan', async () => {
  const db = await seeded();
  const byLoc = await rows(db, `select * from admin_paid_totals($1, $2, null, 'none', true)`, [MONTH, NOW]);
  assert.deepEqual(byLoc.map((r) => [r.location_id, r.payments, r.revenue, r.fees]), [[LOC, 3, 850, 9.8], [LOC_B, 1, 1000, 14]]);
  const byPlan = await rows(db, `select * from admin_paid_totals($1, $2, null, 'none', false, true)`, [MONTH, NOW]);
  assert.deepEqual(byPlan.map((r) => [r.plan_id, r.payments, r.revenue]).sort(), [[PLAN, 3, 1350], [PLAN_2, 1, 500]].sort());
});

test('grant counts: running, customers on a plan, ended and ended early', async () => {
  const db = await freshDb();
  const router = (await db.query(`insert into routers (location_id, identifier, name, connection_method, lifecycle_status, credential_ciphertext, credential_key_id)
    values ($1, 'cx-test', 'cx-test', 'wireguard', 'registered', 'ct', 'k1') returning id`, [LOC])).rows[0].id;
  const grant = async (status, expires, { phone = '2348030000001', revokedAt = null, reason = null } = {}) => {
    const pid = await purchase(db, { at: '2026-11-18T07:00:00Z', amount: 200, phone });
    await db.query(`insert into network_authorizations (purchase_id, router_id, status, expires_at, revoked_at, revoke_reason) values ($1, $2, $3::auth_status, $4, $5, $6)`,
      [pid, router, status, expires, revokedAt, reason]);
  };
  await grant('active', '2026-11-18T18:00:00Z');
  await grant('pending_device', '2026-11-18T19:00:00Z', { phone: '2348030000002' });
  await grant('expired', '2026-11-18T10:00:00Z', { reason: 'expired', revokedAt: '2026-11-18T10:00:20Z' });
  await grant('revoked', '2026-11-18T20:00:00Z', { reason: 'admin', revokedAt: '2026-11-18T12:00:00Z' });
  await grant('active', '2026-11-18T09:00:00Z'); // ended, controller not yet caught up
  const c = (await db.query(`select * from admin_grant_counts($1, $2, $2)`, [TODAY, NOW])).rows[0];
  assert.deepEqual(Object.fromEntries(Object.entries(c).map(([k, v]) => [k, Number(v)])), { running: 2, customers_on_plans: 2, ended: 2, ended_early: 1 });
  const other = (await db.query(`select * from admin_grant_counts($1, $2, $2, $3)`, [TODAY, NOW, LOC_B])).rows[0];
  assert.equal(Number(other.running), 0);
});

test('customer counts and the customers page, newest first, with search and paging', async () => {
  const db = await freshDb();
  await db.exec(`insert into locations (id, name, slug) values ('${LOC_B}', 'Other Hostel', 'other-hostel');
                 insert into plans (id, name, price_kobo, duration_seconds) values ('${PLAN_2}', 'Week', 150000, 604800);`);
  await db.exec(`insert into customers (phone_number, created_at) values ('2348030000001', '2026-11-18T08:00:00Z'), ('2348030000002', '2026-11-01T08:00:00Z')`);
  const cc = (await db.query(`select * from admin_customer_counts($1, $2)`, [TODAY, NOW])).rows[0];
  assert.deepEqual([Number(cc.registered), Number(cc.new_customers)], [2, 1]);

  await purchase(db, { at: '2026-11-10T08:00:00Z', amount: 200, phone: '2348030000001', expires: '2026-11-11T08:00:00Z' });
  await purchase(db, { at: '2026-11-18T08:00:00Z', amount: 500, phone: '2348030000001', plan: PLAN_2, expires: '2026-11-25T08:00:00Z' });
  await purchase(db, { at: '2026-11-15T08:00:00Z', amount: 300, phone: '2348030000002', loc: LOC_B, expires: '2026-11-16T08:00:00Z' });
  await purchase(db, { status: 'failed', at: '2026-11-18T09:00:00Z', phone: '2348039999999' });
  const page = async (search, limit = 20, offset = 0) => (await db.query(`select admin_customer_page($1, $2, $3, $4) r`, [search, limit, offset, NOW])).rows[0].r;

  const all = await page('');
  assert.equal(all.total, 2);
  assert.deepEqual(all.rows.map((r) => [r.phone, r.purchases, Number(r.spent), r.plan_name, r.running]),
    [['2348030000001', 2, 700, 'Week', true], ['2348030000002', 1, 300, 'Test Day Pass', false]]);
  assert.equal(all.rows[1].location_name, 'Other Hostel');
  assert.equal((await page('9999')).total, 0, 'failed purchases are not customers');
  assert.deepEqual((await page('8030000002')).rows.map((r) => r.phone), ['2348030000002']);
  const second = await page('', 1, 1);
  assert.equal(second.total, 2);
  assert.deepEqual(second.rows.map((r) => r.phone), ['2348030000002']);
});

test('functions are callable by the service role only', async () => {
  const db = await freshDb();
  const can = async (role, fn) => (await db.query(`select has_function_privilege($1, $2, 'execute') ok`, [role, fn])).rows[0].ok;
  for (const fn of ['admin_paid_totals(timestamptz, timestamptz, uuid, text, boolean, boolean)', 'admin_grant_counts(timestamptz, timestamptz, timestamptz, uuid)',
    'admin_customer_counts(timestamptz, timestamptz)', 'admin_customer_page(text, integer, integer, timestamptz)']) {
    assert.equal(await can('service_role', fn), true, fn);
    assert.equal(await can('anon', fn), false, fn);
    assert.equal(await can('authenticated', fn), false, fn);
  }
});

test('rollback returns the schema to the previous migration exactly', async () => {
  const before = await fingerprint(await freshDb({ upTo: '20261119090000_router_hotspot.sql' }));
  const db = await freshDb({ upTo: MIG });
  await db.exec(fs.readFileSync(path.join(ROOT, 'rollbacks', MIG.replace('.sql', '.rollback.sql')), 'utf8'));
  assert.equal(await fingerprint(db), before);
});
