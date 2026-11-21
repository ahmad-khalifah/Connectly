// Admin check for the Cloudflare Worker's front door: works on a plain
// Request, without Next.js or the Supabase SDK.
//
// The browser keeps the Supabase Auth session in a cookie written by
// @supabase/ssr (sb-<project>-auth-token, possibly split into .0, .1, ...
// chunks, value "base64-" + base64url(JSON)). The access token from it is
// checked by Supabase Auth itself (GET /auth/v1/user), exactly as
// supabase.auth.getUser() does, so a forged or expired token is refused.
// The email must then be on the ADMIN_EMAILS allow-list.

import { isAdminEmail } from './admin-emails';

export type RequestAdmin = { id: string; email: string };

function parseCookies(header: string | null): Map<string, string> {
  const out = new Map<string, string>();
  for (const part of (header ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const name = part.slice(0, i).trim();
    const raw = part.slice(i + 1).trim();
    try {
      out.set(name, decodeURIComponent(raw));
    } catch {
      out.set(name, raw);
    }
  }
  return out;
}

function base64UrlDecode(s: string): string {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** The Supabase Auth cookie's name for this project. */
export function authCookieName(supabaseUrl: string): string {
  return `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`;
}

/** The access token from the session cookie, or null. Does not verify it. */
export function sessionAccessToken(cookieHeader: string | null, supabaseUrl: string): string | null {
  const cookies = parseCookies(cookieHeader);
  const name = authCookieName(supabaseUrl);
  let value = cookies.get(name) ?? '';
  if (!value) {
    for (let i = 0; cookies.has(`${name}.${i}`); i++) value += cookies.get(`${name}.${i}`);
  }
  if (!value) return null;
  try {
    const json = value.startsWith('base64-') ? base64UrlDecode(value.slice('base64-'.length)) : value;
    const session = JSON.parse(json) as { access_token?: unknown } | [unknown];
    const token = Array.isArray(session) ? session[0] : session.access_token;
    return typeof token === 'string' && token.length > 20 ? token : null;
  } catch {
    return null;
  }
}

// Supabase Auth answers in an isolate are kept for at most a minute, so the
// several data requests a page makes at once cost one check, not several.
const CACHE_MS = 60_000;
export type AdminCheck = { admin: RequestAdmin; reason: null } | { admin: null; reason: 'signed_out' | 'not_admin' };
const cache = new Map<string, { check: AdminCheck; until: number }>();

/**
 * Who is calling: an admin, someone signed out (no session, or an expired
 * or invalid token), or a signed-in account that is not on the allow-list.
 */
export async function checkAdmin(request: Request): Promise<AdminCheck> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return { admin: null, reason: 'signed_out' };
  const token = sessionAccessToken(request.headers.get('cookie'), url);
  if (!token) return { admin: null, reason: 'signed_out' };

  const now = Date.now();
  const hit = cache.get(token);
  if (hit && hit.until > now) return hit.check;

  const res = await fetch(new URL('auth/v1/user', url.endsWith('/') ? url : `${url}/`), {
    headers: { apikey: anon, Authorization: `Bearer ${token}` },
  });
  let check: AdminCheck = { admin: null, reason: 'signed_out' };
  if (res.ok) {
    const body = (await res.json()) as { id?: string; email?: string };
    if (body.id && isAdminEmail(body.email)) check = { admin: { id: body.id, email: String(body.email) }, reason: null };
    else if (body.id) check = { admin: null, reason: 'not_admin' };
  } else {
    await res.body?.cancel();
  }
  if (cache.size > 200) cache.clear();
  cache.set(token, { check, until: now + CACHE_MS });
  return check;
}

/** The signed-in admin, or null when signed out, expired, or not on the allow-list. */
export async function adminFromRequest(request: Request): Promise<RequestAdmin | null> {
  return (await checkAdmin(request)).admin;
}
