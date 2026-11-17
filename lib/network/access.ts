// Access grants: one per paid purchase on a router (created by the database
// when the payment is confirmed). Admins can see them and revoke one early.
// A revoke is a controller job like any other: the controller removes the
// hotspot user and any live session, then marks the grant revoked.

import { db } from '@/lib/db/client';

export const GRANT_STATUSES = ['pending_device', 'active', 'revoked', 'expired'] as const;

export const GRANT_LABELS: Record<string, string> = {
  pending_device: 'Waiting for router',
  active: 'On router',
  revoked: 'Revoked',
  expired: 'Expired',
};

export type RevokeResult =
  | { ok: true; jobId: string; created: boolean }
  | { ok: false; status: number; message: string };

/**
 * Queues the revoke. Its idempotency key is the same one the expiry sweep
 * uses ("revoke:<grant>"), so a grant is revoked once, whoever asks first.
 */
export async function requestRevoke(grantId: string, admin: string): Promise<RevokeResult> {
  const { data: grant } = await db
    .from('network_authorizations')
    .select('id, router_id, status, revoked_at, expires_at')
    .eq('id', grantId)
    .maybeSingle();
  if (!grant) return { ok: false, status: 404, message: 'Access grant not found.' };
  if (grant.revoked_at || grant.status === 'revoked' || grant.status === 'expired') {
    return { ok: false, status: 409, message: 'This access has already ended.' };
  }

  const { data, error } = await db.rpc('enqueue_job', {
    p_kind: 'access.revoke',
    p_router_id: grant.router_id,
    p_authorization_id: grant.id,
    p_payload: { reason: 'admin' },
    p_idempotency_key: `revoke:${grant.id}`,
    p_requested_by: admin,
  });
  if (error) {
    console.error('[ACCESS_REVOKE_ENQUEUE_ERROR]', error.code, error.message);
    return { ok: false, status: 500, message: 'Could not queue the revoke.' };
  }
  const r = data as { job_id: string; created: boolean };
  return { ok: true, jobId: r.job_id, created: r.created };
}

// ------------------------------------------------------------------ search
export type GrantSearch =
  | { kind: 'voucher'; value: string }
  | { kind: 'reference'; value: string }
  | { kind: 'phone'; value: string }
  | { kind: 'invalid' }
  | null;

/** What support typed: a WiFi code, a payment reference or a phone number. */
export function classifyGrantSearch(raw: string | undefined, normalisePhone: (s: string) => string | null): GrantSearch {
  const q = (raw ?? '').trim();
  if (!q) return null;
  if (/^[A-HJ-NP-Z2-9]{8}$/i.test(q)) return { kind: 'voucher', value: q.toUpperCase() };
  if (/^CONN_[0-9a-f-]{36}$/i.test(q)) return { kind: 'reference', value: q };
  const phone = normalisePhone(q);
  return phone ? { kind: 'phone', value: phone } : { kind: 'invalid' };
}

// ------------------------------------------------------------------ resend
export const RESEND_GAP_MS = 2 * 60 * 1000;

export type ResendResult = { ok: true; sent: boolean } | { ok: false; status: number; message: string };

/**
 * Texts the WiFi code again to the phone that paid for it (never to a number
 * typed by support). At most once per two minutes per grant: the
 * notifications row for this two-minute slot is claimed first.
 */
export async function resendVoucher(grantId: string, now = Date.now()): Promise<ResendResult> {
  const { data: g } = await db
    .from('network_authorizations')
    .select('id, status, revoked_at, expires_at, voucher_code, purchases(id, phone_number, plans(name))')
    .eq('id', grantId)
    .maybeSingle();
  if (!g?.voucher_code) return { ok: false, status: 404, message: 'Access grant not found.' };
  if (g.revoked_at || g.status === 'revoked' || g.status === 'expired' || Date.parse(g.expires_at) <= now) {
    return { ok: false, status: 409, message: 'This access has ended; there is no code to resend.' };
  }
  const p = (Array.isArray(g.purchases) ? g.purchases[0] : g.purchases) as { id: string; phone_number: string | null; plans?: unknown } | null;
  if (!p?.phone_number) return { ok: false, status: 409, message: 'No phone number is recorded for this payment.' };
  const plan = (Array.isArray(p.plans) ? p.plans[0] : p.plans) as { name?: string } | null;
  const until = new Date(g.expires_at).toLocaleString('en-NG', { timeZone: 'Africa/Lagos', dateStyle: 'medium', timeStyle: 'short' });
  const body = `Connectly: your WiFi code is ${g.voucher_code} (use it as username and password) for ${plan?.name ?? 'your plan'}, valid until ${until}.`;

  const slot = Math.floor(now / RESEND_GAP_MS);
  const { data: claimed, error } = await db
    .from('notifications')
    .insert({ purchase_id: p.id, recipient: p.phone_number, template: `voucher_resend:${slot}`, body })
    .select('id')
    .maybeSingle();
  if (error?.code === '23505') return { ok: false, status: 429, message: 'The code was just sent. Wait two minutes before sending again.' };
  if (error || !claimed) {
    console.error('[VOUCHER_RESEND_ERROR]', error?.code, error?.message);
    return { ok: false, status: 500, message: 'Could not send the code.' };
  }
  const { deliverNotification } = await import('@/lib/payments/ledger');
  const result = await deliverNotification(claimed.id, p.phone_number, body);
  return result.ok ? { ok: true, sent: true } : { ok: false, status: 502, message: 'The SMS provider did not accept the message. Check Settings → SMS test.' };
}
