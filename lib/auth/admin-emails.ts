// Admin allow-list. Pure functions with no Next.js server imports, so the
// same check runs in proxy.ts, route handlers and server components.
//
// ADMIN_EMAILS is a comma-separated list of Supabase Auth emails that may
// use /admin and /api/admin. If it is unset, NOBODY is an admin (fail closed).

export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const allowed = adminEmails();
  if (allowed.length === 0) {
    console.error('[AUTH] ADMIN_EMAILS is not set; all admin access is denied.');
    return false;
  }
  return allowed.includes(email.trim().toLowerCase());
}
