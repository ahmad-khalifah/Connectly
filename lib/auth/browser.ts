'use client';

// The browser's Supabase Auth client (session kept in cookies, as the
// server-side checks expect). One per page.
import { createBrowserClient } from '@supabase/ssr';

let client: ReturnType<typeof createBrowserClient> | null = null;

export function browserAuth() {
  client ??= createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  return client.auth;
}

/**
 * Makes sure the session cookie holds a current access token (refreshing an
 * expired one), so the next admin data request is accepted.
 */
export async function freshSession(force = false): Promise<boolean> {
  const auth = browserAuth();
  if (force) {
    const { data } = await auth.refreshSession();
    return Boolean(data.session);
  }
  const { data } = await auth.getSession();
  return Boolean(data.session);
}
