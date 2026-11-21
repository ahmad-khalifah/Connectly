// Admin checks for the admin API handlers. They work on the plain Request
// (the Supabase Auth session cookie, verified by Supabase Auth, and the
// ADMIN_EMAILS allow-list: lib/auth/request-admin.ts), so the same handler
// runs under Next.js and in the Cloudflare Worker's front door.
//
// The admin pages are static files: they hold no data, and every request for
// data or a change goes through one of these checks.

import { checkAdmin, type AdminCheck, type RequestAdmin } from './request-admin';

/**
 * The refusal for a caller who is not an admin: 401 when signed out (or the
 * session expired), 403 with reason "not_admin" for a signed-in account that
 * is not on ADMIN_EMAILS, so the browser can say so on the sign-in page.
 */
export function refusal(check: AdminCheck): Response {
  return check.reason === 'not_admin'
    ? Response.json({ message: 'This account is not on the admin list.', reason: 'not_admin' }, { status: 403 })
    : Response.json({ message: 'Unauthorized' }, { status: 401 });
}

/** A refusal when the caller is not an admin, or null when the request may continue. */
export async function adminApiGuard(request: Request): Promise<Response | null> {
  const check = await checkAdmin(request);
  return check.admin ? null : refusal(check);
}

/** Like adminApiGuard, but also returns the admin so writes can be attributed. */
export async function requireAdminApi(
  request: Request
): Promise<{ user: RequestAdmin; denied: null } | { user: null; denied: Response }> {
  const check = await checkAdmin(request);
  if (!check.admin) return { user: null, denied: refusal(check) };
  return { user: check.admin, denied: null };
}
