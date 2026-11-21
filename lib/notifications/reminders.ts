// Expiry reminder texts. Which reminders are due, and the rule that each
// goes out at most once per purchase, live in the database function
// claim_due_sms (supabase/migrations/20261121120000_sms_queue.sql); they are
// sent by lib/notifications/sms-queue.ts.
//
//   expiry_soon: the plan ends within the next hour
//   expired:     the plan ended within the last hour
//
// Skipped when access was revoked early, or when the same phone already has a
// newer paid plan running past this one (they have topped up).

export function reminderText(kind: 'expiry_soon' | 'expired', planName: string, locationName: string | null, expiresAt: Date): string {
  const at = expiresAt.toLocaleTimeString('en-NG', { timeZone: 'Africa/Lagos', hour: 'numeric', minute: '2-digit', hour12: true });
  const where = locationName ? ` at ${locationName}` : '';
  return kind === 'expiry_soon'
    ? `Connectly: your ${planName}${where} ends at ${at}. To stay online, join the Connectly WiFi and buy a new plan on the login page.`
    : `Connectly: your ${planName}${where} has ended. Join the Connectly WiFi and buy a new plan on the login page to reconnect.`;
}
