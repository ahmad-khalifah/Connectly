// Server-only module. Do NOT add 'use server': that would turn this into a
// public Server Function anyone could call to send SMS on our account.

import { normaliseNigerianMobile } from '@/lib/phone';

/**
 * True once Termii is set up. Until Termii approves the sender ID, the key and
 * sender ID stay unset: every SMS is recorded as not sent, and payments and
 * WiFi access carry on as normal.
 */
export function smsConfigured(): boolean {
  return Boolean(process.env.TERMII_API_KEY && process.env.TERMII_SENDER_ID);
}

/** The error recorded when an SMS was attempted before Termii was set up. */
export const SMS_NOT_CONFIGURED = 'Termii is not configured (TERMII_API_KEY / TERMII_SENDER_ID)';

/** How an SMS record reads to an admin: "pending approval" rather than "failed" when Termii was not set up yet. */
export function smsStatusLabel(status: string, lastError: string | null): { text: string; tone: 'ok' | 'bad' | 'neutral' | 'waiting' } {
  if (status === 'sent') return { text: 'sent', tone: 'ok' };
  if (status === 'failed' && lastError?.startsWith('Termii is not configured')) return { text: 'not sent: pending approval', tone: 'neutral' };
  if (status === 'failed') return { text: 'failed', tone: 'bad' };
  return { text: status, tone: 'waiting' };
}

export type SmsResult = { ok: true; messageId: string | null } | { ok: false; error: string };

/**
 * Sends one SMS through Termii.
 * TERMII_CHANNEL defaults to "dnd": transactional messages on the generic
 * route are not delivered to numbers on Do-Not-Disturb, which is most
 * Nigerian lines. The dnd route needs an approved Sender ID.
 */
export async function sendTermiiSMS(phone: string, message: string): Promise<SmsResult> {
  const apiKey = process.env.TERMII_API_KEY;
  const senderId = process.env.TERMII_SENDER_ID;
  const baseUrl = (process.env.TERMII_BASE_URL || 'https://api.ng.termii.com').replace(/\/+$/, '');
  const channel = process.env.TERMII_CHANNEL || 'dnd';

  if (!apiKey || !senderId) return { ok: false, error: SMS_NOT_CONFIGURED };

  const to = normaliseNigerianMobile(phone);
  if (!to) return { ok: false, error: 'Invalid Nigerian mobile number' };

  try {
    const res = await fetch(`${baseUrl}/api/sms/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, from: senderId, sms: message, type: 'plain', channel, api_key: apiKey }),
      signal: AbortSignal.timeout(10_000),
    });
    const data = await res.json().catch(() => null);
    if (res.ok && data && (data.message_id || data.message === 'Successfully Sent')) {
      return { ok: true, messageId: data.message_id ? String(data.message_id) : null };
    }
    return { ok: false, error: `Termii ${res.status}: ${JSON.stringify(data)?.slice(0, 300)}` };
  } catch (error) {
    return { ok: false, error: `Termii request failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}
