// Server-only Supabase client with the service-role key (bypasses RLS).
// Use it only in route handlers, Server Functions and server components.
//
// Created lazily on first use, so that:
//   * the environment guard (lib/env.ts) runs before any query: a preview
//     deployment can never reach the production database;
//   * builds no longer fail when Supabase env vars are absent at build time.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { assertSafeEnvironment } from '@/lib/env';

let client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (!client) {
    assertSafeEnvironment();
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('Supabase is not configured (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).');
    client = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  }
  return client;
}

export const db = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const c = getClient();
    const value = Reflect.get(c, prop, c);
    return typeof value === 'function' ? value.bind(c) : value;
  },
});
