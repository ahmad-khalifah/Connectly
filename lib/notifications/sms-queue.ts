import { db } from '@/lib/db/client';
import { sendTermiiSMS } from '@/lib/sms';
import { confirmationText, reconcilePurchase } from '@/lib/payments/ledger';
import { reminderText } from '@/lib/notifications/reminders';

// Scheduled work, in slices small enough for one run of a Cloudflare Cron
// Trigger on Workers Free (10 ms of CPU, about 1 ms per database call).
//
//   sendDueTexts      : payment confirmations the payment page never asked
//                       for, and expiry reminders. Two database calls
//                       (claim_due_sms, record_sms_results) plus one Termii
//                       call per text, sent in parallel.
//   checkOnePending   : one pending Korapay checkout from the last 24 hours,
//                       re-checked with Korapay in case its webhook never came.
//
// Which texts are due, and the rule that each is sent at most once, live in
// the database (supabase/migrations/20261121120000_sms_queue.sql).

export const TEXTS_PER_RUN = 5;

type Claimed = {
  notification_id: string;
  template: 'payment_confirmed' | 'expiry_soon' | 'expired';
  purchase_id: string;
  recipient: string;
  reference: string;
  amount_kobo: number | string | null;
  expires_at: string | null;
  plan_name: string | null;
  location_name: string | null;
  voucher_code: string | null;
};

export type TextsSummary = { claimed: number; sent: number; failed: number };

export function textFor(c: Claimed): string {
  if (c.template === 'payment_confirmed') {
    return confirmationText({
      amountKobo: c.amount_kobo,
      planName: c.plan_name,
      locationName: c.location_name,
      voucher: c.voucher_code,
      expiresAt: c.expires_at,
      reference: c.reference,
    });
  }
  return reminderText(c.template, c.plan_name ?? 'WiFi plan', c.location_name, new Date(c.expires_at ?? Date.now()));
}

/** Claims up to `limit` due texts, sends them and records the results. Throws only if the database cannot be reached. */
export async function sendDueTexts({ now = new Date(), limit = TEXTS_PER_RUN } = {}): Promise<TextsSummary> {
  const { data, error } = await db.rpc('claim_due_sms', { p_now: now.toISOString(), p_limit: limit });
  if (error) throw new Error(`claim_due_sms failed: ${error.message}`);
  const claimed = (data ?? []) as Claimed[];
  if (claimed.length === 0) return { claimed: 0, sent: 0, failed: 0 };

  const results = await Promise.all(
    claimed.map(async (c) => {
      const body = textFor(c);
      const r = await sendTermiiSMS(c.recipient, body).catch((e: unknown) => ({ ok: false as const, error: String(e) }));
      return r.ok
        ? { id: c.notification_id, status: 'sent', body, provider_message_id: r.messageId }
        : { id: c.notification_id, status: 'failed', body, error: r.error };
    })
  );
  const { error: recordError } = await db.rpc('record_sms_results', { p_results: results });
  // Not thrown: the texts went out (or failed) either way. The claims stay
  // queued and are marked failed after 15 minutes, never sent twice.
  if (recordError) console.error('[SMS_RECORD_ERROR]', recordError.message);

  const sent = results.filter((r) => r.status === 'sent').length;
  for (const r of results) if (r.status === 'failed') console.error('[SMS_FAILED]', r.id, r.error);
  return { claimed: claimed.length, sent, failed: results.length - sent };
}

export type PendingCheck = { checked: string | null; outcome: string | null };

/**
 * Re-checks one pending Korapay checkout from the last 24 hours. Runs take
 * turns through the newest ten (by `turn`), so each is re-checked every few
 * runs. The text, if it is now paid, goes out with the next sendDueTexts.
 */
export async function checkOnePending(turn: number): Promise<PendingCheck> {
  const since = new Date(Date.now() - 24 * 3_600_000).toISOString();
  const { data, error } = await db
    .from('purchases')
    .select('reference')
    .eq('status', 'pending')
    .eq('payment_gateway', 'korapay')
    .like('reference', 'CONN_%')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(10);
  if (error) throw new Error(`pending query failed: ${error.message}`);
  const refs = ((data ?? []) as { reference: string }[]).map((r) => r.reference);
  if (refs.length === 0) return { checked: null, outcome: null };
  const ref = refs[Math.abs(Math.trunc(turn)) % refs.length];
  const { outcome } = await reconcilePurchase(ref, { notify: false });
  return { checked: ref, outcome };
}
