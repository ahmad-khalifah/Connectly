import { db } from '@/lib/db/client';
import { deliverNotification } from '@/lib/payments/ledger';

// Expiry reminders by SMS. Safe to call as often as you like: each purchase
// gets each reminder at most once, because the notifications row (unique per
// purchase + template) is claimed before anything is sent.
//
//   expiry_soon: the plan ends within the next hour
//   expired:     the plan ended within the last hour
//
// Skipped when access was revoked early, or when the same phone already has a
// newer paid plan running past this one (they have topped up).

export const REMINDER_WINDOW_MS = 60 * 60 * 1000;
const BATCH = 200;

type Row = {
  id: string;
  phone_number: string | null;
  expires_at: string | null;
  plans: { name?: string } | { name?: string }[] | null;
  locations: { name?: string } | { name?: string }[] | null;
};

export type ReminderSummary = { considered: number; sent: number; skipped: number; failed: number };

const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

export function reminderText(kind: 'expiry_soon' | 'expired', planName: string, locationName: string | null, expiresAt: Date): string {
  const at = expiresAt.toLocaleTimeString('en-NG', { timeZone: 'Africa/Lagos', hour: 'numeric', minute: '2-digit', hour12: true });
  const where = locationName ? ` at ${locationName}` : '';
  return kind === 'expiry_soon'
    ? `Connectly: your ${planName}${where} ends at ${at}. To stay online, join the Connectly WiFi and buy a new plan on the login page.`
    : `Connectly: your ${planName}${where} has ended. Join the Connectly WiFi and buy a new plan on the login page to reconnect.`;
}

export async function sendExpiryReminders(now = new Date()): Promise<ReminderSummary> {
  const summary: ReminderSummary = { considered: 0, sent: 0, skipped: 0, failed: 0 };
  const t = now.getTime();
  const windows = [
    { kind: 'expiry_soon' as const, from: new Date(t), to: new Date(t + REMINDER_WINDOW_MS) },
    { kind: 'expired' as const, from: new Date(t - REMINDER_WINDOW_MS), to: new Date(t) },
  ];

  for (const w of windows) {
    const { data, error } = await db
      .from('purchases')
      .select('id, phone_number, expires_at, plans(name), locations(name)')
      .eq('status', 'paid')
      .gt('expires_at', w.from.toISOString())
      .lte('expires_at', w.to.toISOString())
      .order('expires_at', { ascending: true })
      .limit(BATCH);
    if (error) throw new Error(`reminder query failed: ${error.message}`);

    for (const p of (data ?? []) as Row[]) {
      summary.considered += 1;
      if (!p.phone_number || !p.expires_at) { summary.skipped += 1; continue; }
      if (await shouldSkip(p)) { summary.skipped += 1; continue; }

      const body = reminderText(w.kind, one(p.plans)?.name ?? 'WiFi plan', one(p.locations)?.name ?? null, new Date(p.expires_at));
      const { data: claimed, error: claimError } = await db
        .from('notifications')
        .insert({ purchase_id: p.id, recipient: p.phone_number, template: w.kind, body })
        .select('id')
        .maybeSingle();
      if (claimError) {
        if (claimError.code === '23505') { summary.skipped += 1; continue; } // already reminded
        throw new Error(`reminder claim failed: ${claimError.message}`);
      }
      if (!claimed) { summary.skipped += 1; continue; }
      const result = await deliverNotification(claimed.id, p.phone_number, body);
      if (result.ok) summary.sent += 1;
      else summary.failed += 1;
    }
  }
  return summary;
}

async function shouldSkip(p: Row): Promise<boolean> {
  const { data: grant } = await db.from('network_authorizations').select('status, revoked_at').eq('purchase_id', p.id).maybeSingle();
  if (grant && (grant.revoked_at || grant.status === 'revoked')) return true;
  const { data: newer } = await db
    .from('purchases')
    .select('id')
    .eq('phone_number', p.phone_number)
    .eq('status', 'paid')
    .gt('expires_at', p.expires_at!)
    .limit(1)
    .maybeSingle();
  return Boolean(newer);
}
