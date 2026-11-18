// Client-safe helpers for logging a device in with its WiFi code.
// No database or server imports: the portal's code form uses these in the
// browser, and connectLink (server) builds the same link.

/** Codes come from public.new_voucher_code(): 8 characters, no I, O, 0 or 1. */
const CODE_RE = /^[A-HJ-NP-Z2-9]{8}$/;

/** Uppercases and drops spaces and dashes; null when it cannot be a WiFi code. */
export function normaliseWifiCode(raw: string): string | null {
  const code = raw.toUpperCase().replace(/[\s-]+/g, '');
  return CODE_RE.test(code) ? code : null;
}

/**
 * Link that logs a device in with its code. RouterOS accepts the login form
 * as a GET with username and password (login-by http-pap). It is plain HTTP
 * on the customer's own WiFi network, which is how a hotspot login works;
 * the code only opens this plan, never an account.
 */
export function codeLoginHref(loginUrl: string, code: string, dst = 'https://getconnectly.net'): string {
  const q = new URLSearchParams({ username: code, password: code, dst });
  return `${loginUrl}?${q.toString()}`;
}
