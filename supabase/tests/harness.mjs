// Disposable local Postgres (PGlite) with the production public schema as of
// 2026-11-16 plus every migration in order. Never touches the live database.
// Seed rows are synthetic; no customer data lives in this repo.
import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(import.meta.dirname, '..');
export const PLAN = '4a09bac2-6777-4000-9b4c-dc4fa370c33b';
export const LOC = '7c42e724-c318-4586-9b2f-2bf695121037';

const MIGRATIONS = fs.readdirSync(path.join(ROOT, 'migrations')).filter((f) => f.endsWith('.sql')).sort();

export async function freshDb({ upTo } = {}) {
  const db = new PGlite();
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema auth; create table auth.users(id uuid primary key, email text);
    create function public.uuid_generate_v4() returns uuid language sql as 'select gen_random_uuid()';
    create publication supabase_realtime;
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
    alter default privileges in schema public grant all on functions to anon, authenticated, service_role;`);
  await db.exec(fs.readFileSync(path.join(ROOT, 'baseline/20261116_production_public_schema.sql'), 'utf8'));
  await db.exec(`
    insert into locations (id, name, slug) values ('${LOC}', 'Test Hostel', 'test-hostel');
    insert into plans (id, name, price_kobo, duration_seconds) values ('${PLAN}', 'Test Day Pass', 25000, 86400);
    insert into purchases (plan_id, location_id, reference, phone_number, net_amount_ngn, payment_gateway)
      values ('${PLAN}', '${LOC}', 'TRX_LEGACY_1', '08000000001', 250, 'paystack'),
             ('${PLAN}', '${LOC}', 'TRX_LEGACY_2', '08000000002', 250, 'monnify');`);
  for (const m of MIGRATIONS) {
    if (upTo && m > upTo) break;
    await db.exec(fs.readFileSync(path.join(ROOT, 'migrations', m), 'utf8'));
  }
  return db;
}

export async function fingerprint(db) {
  const q = async (sql) => JSON.stringify((await db.query(sql)).rows);
  return [
    await q(`select table_name, column_name, data_type, is_nullable, column_default from information_schema.columns where table_schema='public' order by 1,2`),
    await q(`select conname, pg_get_constraintdef(oid) from pg_constraint where connamespace='public'::regnamespace order by 1`),
    await q(`select indexname, indexdef from pg_indexes where schemaname='public' order by 1`),
    await q(`select relname, relrowsecurity from pg_class where relnamespace='public'::regnamespace and relkind='r' order by 1`),
    await q(`select proname from pg_proc where pronamespace='public'::regnamespace order by 1`),
    await q(`select tablename, policyname, cmd, roles::text from pg_policies where schemaname='public' order by 1,2`),
    await q(`select tgrelid::regclass::text, tgname from pg_trigger where not tgisinternal order by 1,2`),
    await q(`select rolname from pg_roles where rolname like 'connectly%' order by 1`),
  ].join('\n');
}
