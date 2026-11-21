// Router agent migration (20261122090000) against a disposable local Postgres.
// Synthetic data only. Covers: off by default, token auth, the full
// pay -> provision -> report -> expire -> revoke cycle, backend-offline
// behaviour (nothing changes without a poll), the Mac controller's claim
// exclusion, retries, and the rollback.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { freshDb, fingerprint, PLAN, LOC } from './harness.mjs';

const ROLLBACK = path.resolve(import.meta.dirname, '../rollbacks/20261122090000_router_agent.rollback.sql');
const sha = (t) => createHash('sha256').update(t).digest('hex');
const one = async (db, sql, params = []) => (await db.query(sql, params)).rows[0];
const count = async (db, sql, params = []) => Number((await one(db, sql, params)).n);

async function addRouter(db, ident, { lifecycle = 'active' } = {}) {
  return one(db,
    `insert into routers (location_id, identifier, name, connection_method, lifecycle_status, management_ip, credential_ciphertext, credential_key_id)
     values ($1, $2::text, $2::text, 'direct_https', $3, '192.168.88.1', 'ct', 'k1') returning *`, [LOC, ident, lifecycle]);
}
async function paid(db, ref, routerId, mac = 'aa:bb:cc:dd:ee:01') {
  await db.query(
    `insert into purchases (plan_id, location_id, router_id, reference, phone_number, mac_address, amount_kobo, net_amount_ngn, payment_gateway)
     values ($1, $2, $3, $4, '2348031110000', $5, 25000, 250, 'korapay')`, [PLAN, LOC, routerId, ref, mac]);
  await db.query(`select confirm_payment($1, 25000::bigint, 'NGN')`, [ref]);
  return one(db, `select a.* from network_authorizations a join purchases p on p.id = a.purchase_id where p.reference = $1`, [ref]);
}
const token = async (db, routerId, enable = true) => {
  const t = (await one(db, `select router_agent_issue_token($1) t`, [routerId])).t;
  if (enable) await db.query(`update routers set agent_enabled = true where id = $1`, [routerId]);
  return t;
};
const sync = async (db, t, results = [], status = {}) =>
  (await one(db, `select router_agent_sync($1, $2::jsonb, $3::jsonb) r`, [sha(t), JSON.stringify(results), JSON.stringify(status)])).r;

test('off by default: no token works, and the Mac controller still claims provision jobs', async () => {
  const db = await freshDb();
  const r = await addRouter(db, 'R1');
  await paid(db, 'REF1', r.id);
  assert.equal(r.agent_enabled, false);
  assert.deepEqual(await sync(db, 'cxa_' + 'a'.repeat(64)), { ok: false });
  const t = await token(db, r.id, false); // token issued but agent not enabled
  assert.deepEqual(await sync(db, t), { ok: false });
  const claimed = await db.query(`select * from claim_next_job('mac')`);
  assert.equal(claimed.rows.length, 1);
  assert.equal(claimed.rows[0].kind, 'access.provision');
});

test('token: stored only as a hash; rotating invalidates the old one; retired routers are refused', async () => {
  const db = await freshDb();
  const r = await addRouter(db, 'R1');
  const t1 = await token(db, r.id);
  assert.match(t1, /^cxa_[0-9a-f]{64}$/);
  const row = await one(db, `select * from router_agent_tokens where router_id = $1`, [r.id]);
  assert.equal(row.token_hash, sha(t1));
  assert.ok(!JSON.stringify(row).includes(t1));
  assert.equal((await sync(db, t1)).ok, true);
  const t2 = await token(db, r.id);
  assert.notEqual(t1, t2);
  assert.deepEqual(await sync(db, t1), { ok: false });
  assert.equal((await sync(db, t2)).ok, true);
  await db.query(`update routers set lifecycle_status = 'retired', retired_at = now() where id = $1`, [r.id]);
  assert.deepEqual(await sync(db, t2), { ok: false });
});

test('one router cannot use another router\'s token or see its jobs', async () => {
  const db = await freshDb();
  const a = await addRouter(db, 'RA');
  const b = await addRouter(db, 'RB');
  const ta = await token(db, a.id);
  const tb = await token(db, b.id);
  await paid(db, 'REFA', a.id, 'aa:bb:cc:dd:ee:0a');
  const fromB = await sync(db, tb);
  assert.equal(fromB.jobs.length, 0);
  const fromA = await sync(db, ta);
  assert.equal(fromA.jobs.length, 1);
});

test('payment -> agent receives the provision job with everything it needs, then reports success', async () => {
  const db = await freshDb();
  const r = await addRouter(db, 'R1');
  const t = await token(db, r.id);
  const grant = await paid(db, 'REF1', r.id);
  const res = await sync(db, t, [], { version: '7.21.5', uptime_seconds: 100, cpu: 3, memory: 40, router_epoch: Math.floor(Date.now() / 1000) + 5, agent_version: '1' });
  assert.equal(res.ok, true);
  assert.equal(res.poll_after_seconds, 15);
  assert.equal(res.jobs.length, 1);
  const job = res.jobs[0];
  assert.equal(job.kind, 'access.provision');
  assert.equal(job.username, grant.hotspot_username);
  assert.equal(job.password, grant.voucher_code);
  assert.equal(job.comment, `connectly:${grant.id}`);
  assert.equal(job.device_mac.toLowerCase(), 'aa:bb:cc:dd:ee:01');
  assert.match(job.profile.name, /^cx-\d+M-\d+M-\d+d$/);
  assert.ok(job.remaining_seconds > 86000 && job.remaining_seconds <= 86400);
  assert.equal(job.expires_epoch, Math.floor(new Date(grant.expires_at).getTime() / 1000));
  // heartbeat recorded
  const rt = await one(db, `select * from routers where id = $1`, [r.id]);
  assert.equal(rt.status, 'online');
  assert.equal(rt.routeros_version, '7.21.5');
  assert.equal(rt.agent_version, '1');
  assert.ok(rt.agent_last_seen_at);
  assert.ok(rt.agent_clock_offset_seconds >= 3 && rt.agent_clock_offset_seconds <= 7);

  // not yet reported: the job is running, not handed out again within 90 s
  assert.equal((await sync(db, t)).jobs.length, 0);

  // report success
  const done = await sync(db, t, [{ job_id: job.job_id, ok: true, response: { username: job.username, auto_login: { status: 'logged_in', ip: '10.10.0.20' } } }]);
  assert.equal(done.accepted, 1);
  const g = await one(db, `select * from network_authorizations where id = $1`, [grant.id]);
  assert.equal(g.status, 'active');
  assert.ok(g.provisioned_at);
  assert.match(g.rate_limit_rule, /^\d+M\/\d+M$/);
  assert.equal(g.last_router_response.auto_login.status, 'logged_in');
  assert.equal((await one(db, `select status from controller_jobs where id = $1`, [job.job_id])).status, 'succeeded');
});

test('results from a different router, an unknown job, or a repeat are ignored', async () => {
  const db = await freshDb();
  const a = await addRouter(db, 'RA');
  const b = await addRouter(db, 'RB');
  const ta = await token(db, a.id);
  const tb = await token(db, b.id);
  await paid(db, 'REFA', a.id);
  const job = (await sync(db, ta)).jobs[0];
  const stolen = await sync(db, tb, [{ job_id: job.job_id, ok: true }]);
  assert.equal(stolen.ignored, 1);
  assert.equal((await one(db, `select status from controller_jobs where id = $1`, [job.job_id])).status, 'running');
  const bogus = await sync(db, ta, [{ job_id: '00000000-0000-4000-8000-000000000000', ok: true }, { job_id: 'not-a-uuid', ok: true }]);
  assert.equal(bogus.ignored, 2);
  await sync(db, ta, [{ job_id: job.job_id, ok: true }]);
  const again = await sync(db, ta, [{ job_id: job.job_id, ok: false, error: 'late' }]);
  assert.equal(again.ignored, 1);
  assert.equal((await one(db, `select status from controller_jobs where id = $1`, [job.job_id])).status, 'succeeded');
});

test('a failed provision is retried with backoff, and a permanent failure is final', async () => {
  const db = await freshDb();
  const r = await addRouter(db, 'R1');
  const t = await token(db, r.id);
  const grant = await paid(db, 'REF1', r.id);
  const job = (await sync(db, t)).jobs[0];
  await sync(db, t, [{ job_id: job.job_id, ok: false, error: 'hotspot busy' }]);
  let j = await one(db, `select * from controller_jobs where id = $1`, [job.job_id]);
  assert.equal(j.status, 'failed');
  assert.equal(j.last_error, 'hotspot busy');
  assert.ok(new Date(j.run_after) > new Date());
  assert.equal((await one(db, `select last_error from network_authorizations where id = $1`, [grant.id])).last_error, 'hotspot busy');
  assert.equal((await sync(db, t)).jobs.length, 0); // not yet due
  await db.query(`update controller_jobs set run_after = now() where id = $1`, [job.job_id]);
  const retry = (await sync(db, t)).jobs[0];
  assert.equal(retry.job_id, job.job_id);
  await sync(db, t, [{ job_id: job.job_id, ok: false, error: 'bad user', retryable: false }]);
  j = await one(db, `select * from controller_jobs where id = $1`, [job.job_id]);
  assert.equal(j.status, 'dead');
});

test('a job handed out but never reported is handed out again after 90 s', async () => {
  const db = await freshDb();
  const r = await addRouter(db, 'R1');
  const t = await token(db, r.id);
  await paid(db, 'REF1', r.id);
  const first = (await sync(db, t)).jobs[0];
  await db.query(`update controller_jobs set locked_at = now() - interval '91 seconds' where id = $1`, [first.job_id]);
  const again = (await sync(db, t)).jobs[0];
  assert.equal(again.job_id, first.job_id);
  assert.equal((await one(db, `select attempts from controller_jobs where id = $1`, [first.job_id])).attempts, 2);
});

test('expiry: the next poll after the end time queues and hands out the revoke; reporting it closes the grant', async () => {
  const db = await freshDb();
  const r = await addRouter(db, 'R1');
  const t = await token(db, r.id);
  const grant = await paid(db, 'REF1', r.id);
  const p = (await sync(db, t)).jobs[0];
  await sync(db, t, [{ job_id: p.job_id, ok: true, response: {} }]);
  assert.equal((await sync(db, t)).jobs.length, 0); // still valid: nothing to do
  await db.query(`update network_authorizations set expires_at = now() - interval '1 minute' where id = $1`, [grant.id]);
  const res = await sync(db, t);
  assert.equal(res.jobs.length, 1);
  assert.equal(res.jobs[0].kind, 'access.revoke');
  assert.equal(res.jobs[0].username, grant.hotspot_username);
  assert.equal(res.jobs[0].reason, 'expired');
  await db.query(`insert into network_sessions (router_id, authorization_id, router_session_id, mac_address, ip_address, status) values ($1, $2, '*1', 'AA:BB:CC:DD:EE:01', '10.10.0.20', 'active')`, [r.id, grant.id]);
  await sync(db, t, [{ job_id: res.jobs[0].job_id, ok: true, response: { removed_user: true } }]);
  const g = await one(db, `select * from network_authorizations where id = $1`, [grant.id]);
  assert.equal(g.status, 'expired');
  assert.ok(g.revoked_at);
  assert.equal((await one(db, `select status from network_sessions where authorization_id = $1`, [grant.id])).status, 'terminated');
  assert.equal((await sync(db, t)).jobs.length, 0); // not queued twice
});

test('a grant that ended before the router polled is skipped, not provisioned', async () => {
  const db = await freshDb();
  const r = await addRouter(db, 'R1');
  const t = await token(db, r.id);
  const grant = await paid(db, 'REF1', r.id);
  await db.query(`update network_authorizations set expires_at = now() - interval '1 minute' where id = $1`, [grant.id]);
  const res = await sync(db, t);
  assert.ok(!res.jobs.some((j) => j.kind === 'access.provision'));
  const p = await one(db, `select status, result from controller_jobs where authorization_id = $1 and kind = 'access.provision'`, [grant.id]);
  assert.equal(p.status, 'succeeded');
  assert.match(p.result.skipped, /ended/);
});

test('with the agent on, the Mac controller no longer takes grant jobs but still takes hotspot/test jobs', async () => {
  const db = await freshDb();
  const r = await addRouter(db, 'R1');
  await token(db, r.id);
  await paid(db, 'REF1', r.id);
  assert.equal((await db.query(`select * from claim_next_job('mac')`)).rows.length, 0);
  await db.query(`select enqueue_job('router.test', $1, null, '{}', 'test:1', 'admin')`, [r.id]);
  const c = await db.query(`select * from claim_next_job('mac')`);
  assert.equal(c.rows.length, 1);
  assert.equal(c.rows[0].kind, 'router.test');
  // switching the agent off hands grant jobs back to the Mac
  await db.query(`update routers set agent_enabled = false where id = $1`, [r.id]);
  await db.query(`update controller_jobs set status = 'succeeded' where kind = 'router.test'`);
  assert.equal((await db.query(`select * from claim_next_job('mac')`)).rows[0].kind, 'access.provision');
});

test('backend-side offline behaviour: without polls nothing is removed or changed', async () => {
  const db = await freshDb();
  const r = await addRouter(db, 'R1');
  const t = await token(db, r.id);
  const grant = await paid(db, 'REF1', r.id);
  const p = (await sync(db, t)).jobs[0];
  await sync(db, t, [{ job_id: p.job_id, ok: true, response: {} }]);
  const before = await one(db, `select status from network_authorizations where id = $1`, [grant.id]);
  // no polls for a long time: the database does nothing on its own
  await db.query(`update routers set agent_last_seen_at = now() - interval '3 days' where id = $1`, [r.id]);
  const after = await one(db, `select status from network_authorizations where id = $1`, [grant.id]);
  assert.deepEqual(after, before);
  assert.equal((await sync(db, t)).ok, true); // and the router can pick up where it left off
});

test('sessions report: rows are added, refreshed and ended; garbage never blocks jobs', async () => {
  const db = await freshDb();
  const r = await addRouter(db, 'R1');
  const t = await token(db, r.id);
  const grant = await paid(db, 'REF1', r.id);
  const s1 = { id: '*A1', user: grant.hotspot_username, mac: 'AA:BB:CC:DD:EE:01', ip: '10.10.0.20', uptime: 30, bytes_in: 10, bytes_out: 20 };
  const res = await sync(db, t, [], { sessions: [s1, { id: '*A2', user: 'x', mac: 'AA:BB:CC:DD:EE:02', ip: '999.1.1.1', uptime: 1, bytes_in: 0, bytes_out: 0 }] });
  assert.equal(res.jobs.length, 1); // provision still delivered
  // the row with an impossible IP is dropped; the good one is kept
  assert.equal(await count(db, `select count(*) n from network_sessions where router_id = $1 and status = 'active'`, [r.id]), 1);
  assert.equal((await one(db, `select authorization_id from network_sessions where router_session_id = '*A1'`)).authorization_id, grant.id);
  await sync(db, t, [], { sessions: [s1] });
  assert.equal(await count(db, `select count(*) n from network_sessions where router_id = $1 and status = 'active'`, [r.id]), 1);
  await sync(db, t, [], { sessions: [] });
  assert.equal(await count(db, `select count(*) n from network_sessions where router_id = $1 and status = 'active'`, [r.id]), 0);
});

test('no more than 5 jobs per poll; the rest follow', async () => {
  const db = await freshDb();
  const r = await addRouter(db, 'R1');
  const t = await token(db, r.id);
  for (let i = 0; i < 7; i++) await paid(db, `REF${i}`, r.id, `aa:bb:cc:dd:ee:${String(i).padStart(2, '0')}`);
  assert.equal((await sync(db, t)).jobs.length, 5);
  assert.equal((await sync(db, t)).jobs.length, 2);
});

test('rollback removes everything and restores the previous claim function', async () => {
  const before = await fingerprint(await freshDb({ upTo: '20261121130000_sms_short_plans.sql' }));
  const db = await freshDb();
  const r = await addRouter(db, 'R1');
  await token(db, r.id);
  await db.exec(fs.readFileSync(ROLLBACK, 'utf8'));
  assert.equal(await fingerprint(db), before);
  assert.ok(await one(db, `select id from routers where id = $1`, [r.id]));
});
