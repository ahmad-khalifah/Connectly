// A throwaway local PostgreSQL database per test file: the production schema
// baseline plus every migration in the repo, with synthetic seed rows.
// The controller then logs in as the real connectly_controller role, so the
// tests also prove it works with exactly the rights that role is granted.
//
// Needs CONTROLLER_TEST_PG = an admin URL for a local server, e.g.
// postgres://postgres:<pw>@127.0.0.1:5432/postgres (see controller/README.md).
// Never point it at Supabase.
//
// Local servers here run PostgreSQL 16; Supabase runs 17. The only 17-only
// syntax in the migrations is the MAINTAIN privilege in revokes from browser
// roles, so that one word is removed for local runs. Nothing else is changed.

import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = path.resolve(import.meta.dirname, '../../supabase');
export const PLAN = '4a09bac2-6777-4000-9b4c-dc4fa370c33b';
export const LOC = '7c42e724-c318-4586-9b2f-2bf695121037';

export type TestDb = { admin: pg.Pool; controllerUrl: string; name: string; drop: () => Promise<void> };

export function adminUrl(): string | null {
  const u = process.env.CONTROLLER_TEST_PG ?? '';
  if (!u) return null;
  if (/supabase\.(co|com)|pooler/.test(u)) throw new Error('CONTROLLER_TEST_PG must point at a local server, never Supabase.');
  return u;
}

const STUBS = `
  do $$ begin
    if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
    if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
  end $$;
  create schema auth; create table auth.users(id uuid primary key, email text);
  create function public.uuid_generate_v4() returns uuid language sql as 'select gen_random_uuid()';
  create publication supabase_realtime;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;`;

export async function freshDb(): Promise<TestDb> {
  const url = adminUrl();
  if (!url) throw new Error('CONTROLLER_TEST_PG is not set');
  const name = `cx_test_${crypto.randomBytes(4).toString('hex')}`;
  const root = new pg.Client({ connectionString: url });
  await root.connect();
  await root.query(`create database ${name}`);
  await root.end();

  const dbUrl = new URL(url);
  dbUrl.pathname = `/${name}`;
  const admin = new pg.Pool({ connectionString: dbUrl.toString(), max: 4 });
  await admin.query(STUBS);
  await admin.query(fs.readFileSync(path.join(ROOT, 'baseline/20261116_production_public_schema.sql'), 'utf8'));
  await admin.query(`insert into locations (id, name, slug) values ('${LOC}', 'Test Hostel', 'test-hostel');
    insert into plans (id, name, price_kobo, duration_seconds, speed_down_mbps, speed_up_mbps, device_limit)
      values ('${PLAN}', 'Test 2 Hour', 30000, 7200, 10, 3, 1);`);
  for (const m of fs.readdirSync(path.join(ROOT, 'migrations')).filter((f) => f.endsWith('.sql')).sort()) {
    const sql = fs.readFileSync(path.join(ROOT, 'migrations', m), 'utf8').replace(/,\s*maintain\b/gi, '');
    await admin.query(sql);
  }

  const password = crypto.randomBytes(18).toString('base64url');
  await admin.query(`alter role connectly_controller login password '${password}'`);
  const ctl = new URL(dbUrl.toString());
  ctl.username = 'connectly_controller';
  ctl.password = password;

  return {
    admin,
    controllerUrl: ctl.toString(),
    name,
    drop: async () => {
      await admin.end();
      const r = new pg.Client({ connectionString: url });
      await r.connect();
      await r.query(`drop database if exists ${name} with (force)`);
      await r.query(`alter role connectly_controller nologin password null`);
      await r.end();
    },
  };
}

/** Registers a WireGuard router with a credential encrypted for `publicPem`. */
export async function addRouter(admin: pg.Pool, a: { identifier: string; publicPem: string; keyId: string; password: string; lifecycle?: string }): Promise<{ id: string; tunnel_ip: string }> {
  const ciphertext = crypto
    .publicEncrypt({ key: a.publicPem, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, Buffer.from(a.password))
    .toString('base64');
  const wg = crypto.randomBytes(32).toString('base64');
  const { rows } = await admin.query(
    `insert into routers (location_id, identifier, name, connection_method, lifecycle_status, wg_public_key, api_user, api_port, credential_ciphertext, credential_key_id)
     values ($1, $2::text, $2::text, 'wireguard', 'registered', $3, 'connectly-ctrl', 443, $4, $5) returning id, host(tunnel_ip) as tunnel_ip`,
    [LOC, a.identifier, wg, ciphertext, a.keyId]);
  if (a.lifecycle && a.lifecycle !== 'registered') await admin.query('update routers set lifecycle_status = $2 where id = $1', [rows[0].id, a.lifecycle]);
  return rows[0];
}

/** A Korapay-style paid purchase on a router, confirmed through the real confirm_payment function. */
export async function paidPurchase(admin: pg.Pool, routerId: string, ref = `CONN_${crypto.randomBytes(4).toString('hex')}`): Promise<{ purchaseId: string; grantId: string; voucher: string }> {
  await admin.query(
    `insert into purchases (plan_id, location_id, router_id, reference, phone_number, mac_address, amount_kobo, net_amount_ngn, payment_gateway)
     values ($1, $2, $3, $4, '2348031110000', 'aa:bb:cc:dd:ee:01', 30000, 300, 'korapay')`, [PLAN, LOC, routerId, ref]);
  await admin.query(`select confirm_payment($1, 30000::bigint, 'NGN')`, [ref]);
  const { rows } = await admin.query(
    `select p.id as purchase_id, a.id as grant_id, a.voucher_code from purchases p join network_authorizations a on a.purchase_id = p.id where p.reference = $1`, [ref]);
  return { purchaseId: rows[0].purchase_id, grantId: rows[0].grant_id, voucher: rows[0].voucher_code };
}
