import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { User } from '@supabase/supabase-js';
import { isAdminEmail } from './admin-emails';

/** Supabase client bound to the signed-in user's cookies (anon key, never the service role). */
export async function createSessionClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Called from a Server Component, where cookies are read-only.
            // proxy.ts refreshes the session cookie on admin requests.
          }
        },
      },
    }
  );
}

/** The signed-in user if, and only if, they are on the admin allow-list. */
export async function getAdminUser(): Promise<User | null> {
  const supabase = await createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user && isAdminEmail(user.email) ? user : null;
}

/**
 * For route handlers: returns a 401 response when the caller is not an admin,
 * or null when the request may continue.
 */
export async function adminApiGuard(): Promise<NextResponse | null> {
  const user = await getAdminUser();
  if (!user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }
  return null;
}

/** Like adminApiGuard, but also returns the admin so writes can be attributed. */
export async function requireAdminApi(): Promise<
  { user: User; denied: null } | { user: null; denied: NextResponse }
> {
  const user = await getAdminUser();
  if (!user) return { user: null, denied: NextResponse.json({ message: 'Unauthorized' }, { status: 401 }) };
  return { user, denied: null };
}
