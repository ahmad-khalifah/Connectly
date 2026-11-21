// Server-only database client with the service-role key (bypasses RLS).
// Use it only in route handlers, Server Functions and server components.
//
// Only the database part of Supabase (PostgREST): the server never uses
// Supabase sign-in, realtime or storage, and starting those with the full
// client cost CPU on every new Cloudflare Worker instance (each Korapay
// webhook usually starts one). Queries are written exactly as before:
// db.from(...).select(...), db.rpc(...).
//
// Created lazily on first use, so that:
//   * the environment guard (lib/env.ts) runs before any query: a preview
//     deployment can never reach the production database;
//   * builds no longer fail when Supabase env vars are absent at build time.

import { PostgrestClient } from '@supabase/postgrest-js';
import { assertSafeEnvironment } from '@/lib/env';

let client: PostgrestClient | null = null;

function getClient(): PostgrestClient {
  if (!client) {
    assertSafeEnvironment();
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('Supabase is not configured (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).');
    // The same headers supabase-js sends for database requests.
    client = new PostgrestClient(new URL('rest/v1', url.endsWith('/') ? url : `${url}/`).href, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'X-Client-Info': 'connectly-server' },
      schema: 'public',
    });
  }
  return client;
}

export const db = new Proxy({} as PostgrestClient, {
  get(_target, prop) {
    const c = getClient();
    const value = Reflect.get(c, prop, c);
    return typeof value === 'function' ? value.bind(c) : value;
  },
});
