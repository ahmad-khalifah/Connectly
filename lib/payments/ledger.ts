import { db } from '@/lib/db/client';
import { sendTermiiSMS } from '@/lib/sms';
import { verifyCharge } from './korapay';

// The only code path that changes a purchase's payment state.
// Every caller (webhook, customer return page, admin "check with Korapay")
// goes through reconcilePurchase, which trusts Korapay's verify API, never
// the browser, and relies on the idempotent database functions
// confirm_payment / mark_payment_failed (migration 20261117090000).

export type ReconcileOutcome =
  | 'paid'
  | 'already_paid'
  | 'failed'
  | 'still_pending'
  | 'unknown_reference'
  | 'not_found_at_korapay'
  | 'amount_mismatch'
  | 'currency_mismatch'
  | 'not_payable'
  | 'unchanged';

export async function reconcilePurchase(reference: string): Promise<{ outcome: ReconcileOutcome; purchaseId?: string }> {
  const { data: purchase } = await db
    .from('purchases')
    .select('id, status')
    .eq('reference', reference)
    .maybeSingle();

  if (!purchase) return { outcome: 'unknown_reference' };
  if (purchase.status === 'paid') return { outcome: 'already_paid', purchaseId: purchase.id };

  const charge = await verifyCharge(reference); // throws on network errors -> caller retries
  if (!charge) return { outcome: 'not_found_at_korapay', purchaseId: purchase.id };

  if (charge.status === 'success') {
    const { data, error } = await db.rpc('confirm_payment', {
      p_reference: reference,
      p_amount_paid_kobo: charge.amountPaidKobo,
      p_currency: charge.currency,
      p_fee_kobo: charge.feeKobo,
      p_provider_reference: charge.providerReference,
    });
    if (error) throw new Error(`confirm_payment failed: ${error.message}`);
    const outcome = (data as { outcome: ReconcileOutcome }).outcome;
    if (outcome === 'paid') await sendPaymentConfirmation(purchase.id);
    if (outcome === 'amount_mismatch' || outcome === 'currency_mismatch') {
      console.error('[PAYMENT_MISMATCH]', reference, JSON.stringify(data));
      await logActivity('payment_mismatch', 'error', `Payment ${reference} did not match: ${outcome}`, data);
    }
    return { outcome, purchaseId: purchase.id };
  }

  if (charge.status === 'failed') {
    const { data, error } = await db.rpc('mark_payment_failed', {
      p_reference: reference,
      p_reason: 'Korapay reported the charge as failed',
    });
    if (error) throw new Error(`mark_payment_failed failed: ${error.message}`);
    return { outcome: (data as { outcome: ReconcileOutcome }).outcome, purchaseId: purchase.id };
  }

  return { outcome: 'still_pending', purchaseId: purchase.id };
}

export type SweepSummary = { checked: number; confirmed: number; failed: number; errors: number };

/**
 * Re-checks recent pending Korapay purchases with Korapay's verify API.
 * Safety net for a webhook that never arrived (network fault, or Vercel's
 * login wall on preview URLs) when the customer also closed the page
 * before it re-checked. Bounded: newest `limit` purchases from the last
 * `maxAgeHours`, in parallel. Each check goes through reconcilePurchase,
 * so it is idempotent and can never pay twice. Never throws.
 */
export async function reconcileRecentPending({ limit = 10, maxAgeHours = 24 } = {}): Promise<SweepSummary> {
  const summary: SweepSummary = { checked: 0, confirmed: 0, failed: 0, errors: 0 };
  try {
    const since = new Date(Date.now() - maxAgeHours * 3_600_000).toISOString();
    const { data, error } = await db
      .from('purchases')
      .select('reference')
      .eq('status', 'pending')
      .eq('payment_gateway', 'korapay')
      .like('reference', 'CONN_%')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);

    const refs = ((data ?? []) as { reference: string }[]).map((r) => r.reference);
    const results = await Promise.allSettled(refs.map((ref) => reconcilePurchase(ref)));
    summary.checked = refs.length;
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        summary.errors += 1;
        console.error('[RECONCILE_SWEEP_ERROR]', refs[i], r.reason);
      } else if (r.value.outcome === 'paid') {
        summary.confirmed += 1;
      } else if (r.value.outcome === 'failed') {
        summary.failed += 1;
      }
    });
  } catch (err) {
    summary.errors += 1;
    console.error('[RECONCILE_SWEEP_ERROR]', err);
  }
  return summary;
}

/**
 * Sends the payment confirmation SMS once per purchase. The notifications
 * row (unique per purchase + template) is claimed first, so a duplicate
 * webhook cannot send a second SMS. An SMS failure is recorded and never
 * changes the purchase.
 */
export async function sendPaymentConfirmation(purchaseId: string): Promise<void> {
  const { data: p } = await db
    .from('purchases')
    .select('id, reference, phone_number, amount_kobo, expires_at, plans(name), locations(name)')
    .eq('id', purchaseId)
    .single();
  if (!p?.phone_number) return;
  // The access grant is created in the same transaction as the payment (trigger
  // trg_purchases_grant_access), so its voucher exists by now.
  const { data: grant } = await db.from('network_authorizations').select('voucher_code').eq('purchase_id', purchaseId).maybeSingle();
  const voucher = grant?.voucher_code ? String(grant.voucher_code) : null;

  const plan = (Array.isArray(p.plans) ? p.plans[0] : p.plans) as { name?: string } | null;
  const location = (Array.isArray(p.locations) ? p.locations[0] : p.locations) as { name?: string } | null;
  const until = p.expires_at
    ? new Date(p.expires_at).toLocaleString('en-NG', { timeZone: 'Africa/Lagos', dateStyle: 'medium', timeStyle: 'short' })
    : 'n/a';
  const body =
    `Connectly: NGN ${((p.amount_kobo ?? 0) / 100).toLocaleString('en-NG')} received for ` +
    `${plan?.name ?? 'your plan'}${location?.name ? ` at ${location.name}` : ''}. ` +
    (voucher ? `Your WiFi code: ${voucher} (use it as username and password). ` : '') +
    `Valid until ${until}. Ref ${p.reference}`;

  const { data: claimed, error } = await db
    .from('notifications')
    .insert({ purchase_id: p.id, recipient: p.phone_number, template: 'payment_confirmed', body })
    .select('id')
    .maybeSingle();
  if (error) {
    if (error.code === '23505') return; // already sent or in progress
    console.error('[NOTIFICATION_INSERT_ERROR]', error);
    return;
  }
  if (!claimed) return;

  await deliverNotification(claimed.id, p.phone_number, body);
}

export async function deliverNotification(notificationId: string, phone: string, body: string) {
  const result = await sendTermiiSMS(phone, body);
  const { data: current } = await db.from('notifications').select('attempts').eq('id', notificationId).single();
  await db
    .from('notifications')
    .update(
      result.ok
        ? { status: 'sent', sent_at: new Date().toISOString(), provider_message_id: result.messageId, attempts: (current?.attempts ?? 0) + 1, last_error: null }
        : { status: 'failed', attempts: (current?.attempts ?? 0) + 1, last_error: result.error }
    )
    .eq('id', notificationId);
  if (!result.ok) console.error('[SMS_FAILED]', notificationId, result.error);
  return result;
}

async function logActivity(eventType: string, severity: 'info' | 'warn' | 'error', message: string, metadata: unknown) {
  await db.from('activity_logs').insert({ event_type: eventType, severity, message, metadata: metadata ?? {} });
}
