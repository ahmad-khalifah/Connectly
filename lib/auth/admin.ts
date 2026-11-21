// Admin checks for the admin API handlers. They work on the plain Request
// (the Supabase Auth session cookie, verified by Supabase Auth, and the
// ADMIN_EMAILS allow-list: lib/auth/request-admin.ts), so the same handler
// runs under Next.js and in the Cloudflare Worker's front door.
//
// The admin pages are static files: they hold no data, and every request for
// data or a change goes through one of these checks.

import { adminFromRequest, type RequestAdmin } from './request-admin';

/** A 401 response when the caller is not an admin, or null when the request may continue. */
export async function adminApiGuard(request: Request): Promise<Response | null> {
  const admin = await adminFromRequest(request);
  return admin ? null : Response.json({ message: 'Unauthorized' }, { status: 401 });
}

/** Like adminApiGuard, but also returns the admin so writes can be attributed. */
export async function requireAdminApi(
  request: Request
): Promise<{ user: RequestAdmin; denied: null } | { user: null; denied: Response }> {
  const user = await adminFromRequest(request);
  if (!user) return { user: null, denied: Response.json({ message: 'Unauthorized' }, { status: 401 }) };
  return { user, denied: null };
}
