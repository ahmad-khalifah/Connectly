// Logs in to the STAGING database as connectly_controller, the way the VPS
// will, and tries every action the controller needs plus actions it must
// never be able to do. Each attempt runs in its own savepoint.
import pg from 'pg';
const hosts = (process.env.PGHOSTS || '').split(',');
let client, usedHost;
for (const host of hosts) {
  const c = new pg.Client({ host, port: 5432, database: 'postgres', user: `connectly_controller.${process.env.REF}`,
    password: process.env.PGPASSWORD, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 8000 });
  try { await c.connect(); client = c; usedHost = host; break; } catch (e) { console.log(JSON.stringify({ connect: host, error: e.message })); }
}
if (!client) process.exit(2);
const who = (await client.query('select current_user, session_user, current_setting(\'ssl\', true) ssl')).rows[0];
console.log(JSON.stringify({ connected_via: usedHost, ...who }));

const results = [];
async function attempt(name, expectAllowed, sql, params = []) {
  await client.query('begin');
  try {
    const r = await client.query(sql, params);
    results.push({ name, expected: expectAllowed ? 'allowed' : 'refused', actual: 'allowed', rows: r.rowCount, pass: expectAllowed });
    return r;
  } catch (e) {
    results.push({ name, expected: expectAllowed ? 'allowed' : 'refused', actual: `refused (${e.code})`, pass: !expectAllowed && e.code === '42501' });
  } finally {
    await client.query('rollback');
  }
}

// --- what the controller needs
await attempt('read its settings', true, 'select tunnel_cidr, credential_key_id from network_settings');
await attempt('read routers incl. encrypted credential', true, 'select id, tunnel_ip, credential_ciphertext from routers');
await attempt('read purchase timing (no phone, no amount)', true, 'select id, plan_id, router_id, status, expires_at, mac_address from purchases limit 5');
await attempt('read plan limits (no price)', true, 'select duration_seconds, download_limit_kbps, upload_limit_kbps from plans');
await attempt('claim a job', true, "select id, kind, status, attempts from claim_next_job('ctrl-check')");
await client.query('begin');
const job = (await client.query("select * from claim_next_job('ctrl-check')")).rows[0];
let okFlow = false;
if (job) {
  await client.query("update network_authorizations set status = 'active', provisioned_at = now(), last_router_response = '{\"check\":true}' where id = $1", [job.authorization_id]);
  await client.query("update routers set status = 'online', last_seen_at = now(), routeros_version = '7.x-check' where id = $1", [job.router_id]);
  await client.query("insert into network_sessions (router_id, mac_address, ip_address, router_session_id, authorization_id) values ($1, 'aa:bb:cc:00:98:01', '10.5.50.9', '*CHK', $2)", [job.router_id, job.authorization_id]);
  await client.query("insert into controller_instances (id, version) values ('ctrl-check', 'check') on conflict (id) do update set last_heartbeat_at = now()");
  await client.query("insert into activity_logs (event_type, message) values ('controller.check', 'controller permission check')");
  const done = (await client.query("select complete_job($1, 'ctrl-check', true, '{\"check\":true}'::jsonb) r", [job.id])).rows[0].r;
  okFlow = done.outcome === 'succeeded';
}
await client.query('rollback');
results.push({ name: 'full job cycle: claim, mark grant active, router health, session, heartbeat, log, complete', expected: 'allowed', actual: okFlow ? 'allowed' : 'failed', pass: okFlow });
await attempt('queue expiry revokes', true, 'select enqueue_expired_revocations()');

// --- what it must never do
await attempt('read customer phone numbers', false, 'select phone_number from purchases limit 1');
await attempt('read amounts paid', false, 'select amount_paid from purchases limit 1');
await attempt('read plan prices', false, 'select price_kobo from plans limit 1');
await attempt('read customers', false, 'select * from customers limit 1');
await attempt('read payment notifications', false, 'select * from payment_events limit 1');
await attempt('read SMS records', false, 'select * from notifications limit 1');
await attempt('read the activity log', false, 'select * from activity_logs limit 1');
await attempt('mark a purchase paid', false, "update purchases set status = 'paid'");
await attempt('call confirm_payment', false, "select confirm_payment('x', 1, 'NGN')");
await attempt('activate a router', false, "update routers set lifecycle_status = 'active'");
await attempt('change a router credential', false, "update routers set credential_ciphertext = 'x'");
await attempt('extend an access grant', false, "update network_authorizations set expires_at = now() + interval '1 year'");
await attempt('write jobs directly', false, "update controller_jobs set status = 'succeeded'");
await attempt('delete a router', false, 'delete from routers');
await attempt('change the tunnel range', false, "update network_settings set tunnel_cidr = '10.0.0.0/8'");
await attempt('create a role', false, 'create role x');
await attempt('read auth users', false, 'select * from auth.users limit 1');

for (const r of results) console.log(JSON.stringify(r));
console.log(JSON.stringify({ total: results.length, passed: results.filter((r) => r.pass).length }));
await client.end();
