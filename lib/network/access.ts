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
