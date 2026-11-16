import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { isAdminEmail } from '@/lib/auth/admin-emails';

// Optimistic gate for the admin console. Every admin route handler and the
// admin layout ALSO verify the caller (lib/auth/admin.ts), as Next.js
// recommends: Proxy alone is not an authorization boundary.
export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Validates the JWT with the Supabase Auth server and refreshes the session.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isAdminApi = path.startsWith('/api/admin') || path.startsWith('/admin/api');
  const isAdminPage = !isAdminApi && (path === '/admin' || path.startsWith('/admin/'));

  if ((isAdminApi || isAdminPage) && !isAdminEmail(user?.email)) {
    if (isAdminApi) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = user ? '?error=not_authorized' : '';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

// Only the admin console and login need the auth round-trip. Keeping the
// captive portal and marketing pages out of the matcher avoids a Supabase
// Auth call on every customer request.
export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*', '/login'],
};
