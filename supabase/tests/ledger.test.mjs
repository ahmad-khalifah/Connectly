import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { freshDb, fingerprint, PLAN, LOC } from './harness.mjs';


async function newPurchase(db, ref, { amount = 25000, phone = '2348031234567', status = 'pending' } = {}) {
  await db.query(
    `insert into purchases (plan_id, location_id, reference, phone_number, mac_address, amount_kobo, net_amount_ngn, status, payment_gateway)
     values ($1, $2, $3, $4, 'aa:bb:cc:dd:ee:ff', $5::bigint, $5::bigint / 100.0, $6::purchase_status, 'korapay')`,
    [PLAN, LOC, ref, phone, amount, status]
  );
}
const confirm = async (db, ref, paid, cur = 'NGN', fee = 375) =>
  (await db.query(`select confirm_payment($1, $2, $3, $4, 'KPY-X') r`, [ref, paid, cur, fee])).rows[0].r;
const row = async (db, ref) => (await db.query(`select * from purchases where reference = $1`, [ref])).rows[0];

test('existing rows survive untouched', async () => {
  const db = await freshDb();
  const r = (await db.query(`select reference, status, net_amount_ngn, phone_number from purchases order by created_at`)).rows;
  assert.equal(r.length, 2);
  assert.deepEqual(r.map((x) => x.status), ['pending', 'pending']);
  assert.equal(Number(r[0].net_amount_ngn), 250);
});

test('successful payment: pending -> paid, expiry from plan, customer created', async () => {
  const db = await freshDb();
  await newPurchase(db, 'CONN_ok');
  const out = await confirm(db, 'CONN_ok', 25000);
  assert.equal(out.outcome, 'paid');
  const p = await row(db, 'CONN_ok');
  assert.equal(p.status, 'paid');
  assert.equal(Number(p.amount_paid), 250);
  assert.equal(Number(p.gateway_fee_ngn), 3.75);
  assert.equal(p.provider_reference, 'KPY-X');
  const secs = (new Date(p.expires_at) - new Date(p.paid_at)) / 1000;
  assert.ok(Math.abs(secs - 86400) < 2, `expiry ${secs}s`);
  const c = (await db.query(`select * from customers where phone_number = '2348031234567'`)).rows;
  assert.equal(c.length, 1);
  assert.equal(p.customer_id, c[0].id);
});

test('duplicate webhook: second confirm is a no-op', async () => {
  const db = await freshDb();
  await newPurchase(db, 'CONN_dup');
  await confirm(db, 'CONN_dup', 25000);
  const first = await row(db, 'CONN_dup');
  const out = await confirm(db, 'CONN_dup', 25000);
  assert.equal(out.outcome, 'already_paid');
  const second = await row(db, 'CONN_dup');
  assert.equal(String(second.expires_at), String(first.expires_at));
  assert.equal((await db.query(`select count(*)::int n from customers`)).rows[0].n, 1);
});

test('underpayment is refused and stays pending', async () => {
  const db = await freshDb();
  await newPurchase(db, 'CONN_under');
  const out = await confirm(db, 'CONN_under', 24999);
  assert.equal(out.outcome, 'amount_mismatch');
  assert.equal((await row(db, 'CONN_under')).status, 'pending');
});

test('overpayment is accepted', async () => {
  const db = await freshDb();
  await newPurchase(db, 'CONN_over');
  assert.equal((await confirm(db, 'CONN_over', 30000)).outcome, 'paid');
});

test('wrong currency is refused', async () => {
  const db = await freshDb();
  await newPurchase(db, 'CONN_cur');
  assert.equal((await confirm(db, 'CONN_cur', 25000, 'USD')).outcome, 'currency_mismatch');
  assert.equal((await row(db, 'CONN_cur')).status, 'pending');
});

test('unknown reference changes nothing', async () => {
  const db = await freshDb();
  assert.equal((await confirm(db, 'NOT_OURS', 25000)).outcome, 'unknown_reference');
});

test('legacy row without amount_kobo is never auto-confirmed', async () => {
  const db = await freshDb();
  assert.equal((await confirm(db, 'TRX_LEGACY_1', 25000)).outcome, 'amount_mismatch');
  assert.equal((await row(db, 'TRX_LEGACY_1')).status, 'pending');
});

test('failed then later successful payment ends paid; paid cannot be failed', async () => {
  const db = await freshDb();
  await newPurchase(db, 'CONN_retry');
  const f = (await db.query(`select mark_payment_failed('CONN_retry', 'card declined') r`)).rows[0].r;
  assert.equal(f.outcome, 'failed');
  assert.equal((await row(db, 'CONN_retry')).failure_reason, 'card declined');
  assert.equal((await confirm(db, 'CONN_retry', 25000)).outcome, 'paid');
  const again = (await db.query(`select mark_payment_failed('CONN_retry', 'late failure') r`)).rows[0].r;
  assert.equal(again.outcome, 'unchanged');
  assert.equal((await row(db, 'CONN_retry')).status, 'paid');
});

test('payment references are unique', async () => {
  const db = await freshDb();
  await newPurchase(db, 'CONN_same');
  await assert.rejects(newPurchase(db, 'CONN_same'), /purchases_reference_key/);
});

test('amount must be positive', async () => {
  const db = await freshDb();
  await assert.rejects(newPurchase(db, 'CONN_zero', { amount: 0 }), /purchases_amount_kobo_positive/);
});

test('deleting a plan with purchases is blocked; history kept', async () => {
  const db = await freshDb();
  await assert.rejects(db.query(`delete from plans where id = $1`, [PLAN]), /foreign key/);
  assert.equal((await db.query(`select count(*)::int n from purchases`)).rows[0].n, 2);
});

test('deleting a customer keeps their purchases', async () => {
  const db = await freshDb();
  await newPurchase(db, 'CONN_cust');
  await confirm(db, 'CONN_cust', 25000);
  await db.query(`delete from customers`);
  const p = await row(db, 'CONN_cust');
  assert.equal(p.status, 'paid');
  assert.equal(p.customer_id, null);
});

test('one confirmation SMS per purchase', async () => {
  const db = await freshDb();
  await newPurchase(db, 'CONN_sms');
  const id = (await row(db, 'CONN_sms')).id;
  const ins = `insert into notifications (purchase_id, recipient, template, body) values ($1, '234803', 'payment_confirmed', 'x') on conflict do nothing`;
  await db.query(ins, [id]);
  await db.query(ins, [id]);
  assert.equal((await db.query(`select count(*)::int n from notifications`)).rows[0].n, 1);
});

test('identical webhook payloads are stored once', async () => {
  const db = await freshDb();
  const ins = `insert into payment_events (event_type, reference, payload_sha256, payload) values ('charge.success', 'R', 'abc', '{}') on conflict do nothing`;
  await db.query(ins);
  await db.query(ins);
  assert.equal((await db.query(`select count(*)::int n from payment_events`)).rows[0].n, 1);
});

test('browser roles cannot read the ledger or change payment state', async () => {
  const db = await freshDb();
  for (const role of ['anon', 'authenticated']) {
    for (const sql of [
      `select * from payment_events`,
      `select * from notifications`,
      `select confirm_payment('X', 1, 'NGN')`,
      `select mark_payment_failed('X', 'y')`,
    ]) {
      await db.exec(`set role ${role}`);
      const res = await db.query(sql).then((r) => r.rows.length, (e) => e.message);
      await db.exec(`reset role`);
      const allowedButEmpty = role === 'authenticated' && /from (payment_events|notifications)/.test(sql) && res === 0;
      assert.ok(typeof res === 'string' || allowedButEmpty, `${role}: ${sql} -> ${res}`);
    }
  }
  await db.exec(`set role anon`);
  await assert.rejects(db.query(`update purchases set status = 'paid'`), /permission denied/);
  await db.exec(`reset role`);
});

test('service_role can confirm payments', async () => {
  const db = await freshDb();
  await newPurchase(db, 'CONN_svc');
  await db.exec(`set role service_role`);
  const out = (await db.query(`select confirm_payment('CONN_svc', 25000, 'NGN') r`)).rows[0].r;
  await db.exec(`reset role`);
  assert.equal(out.outcome, 'paid');
});

test('rollback restores the exact pre-migration schema', async () => {
  const before = await fingerprint(await freshDb({ upTo: '20261116120000_security_lockdown.sql' }));
  const db = await freshDb();
  await db.exec(fs.readFileSync(path.resolve(import.meta.dirname, '../rollbacks/20261117090000_payment_ledger.rollback.sql'), 'utf8'));
  const after = await fingerprint(db);
  assert.equal(after, before);
  assert.equal((await db.query(`select count(*)::int n from purchases`)).rows[0].n, 2);
});
