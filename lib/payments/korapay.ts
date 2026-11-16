import crypto from 'crypto';
import { secretMatches } from '@/lib/auth/shared-secret';

// Korapay merchant API. Docs: https://developers.korapay.com
const BASE_URL = 'https://api.korapay.com/merchant/api/v1';
const TIMEOUT_MS = 15_000;

export class KorapayConfigError extends Error {}

function secretKey(): string {
  const key = process.env.KORA_SECRET_KEY;
  if (!key) throw new KorapayConfigError('KORA_SECRET_KEY is not set');
  return key;
}

/** Korapay sends money as strings or numbers in naira ("2000.00"). */
export function nairaToKobo(value: unknown): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

/**
 * Webhook signature: HMAC-SHA256 of JSON.stringify(body.data) with the secret
 * key, hex-encoded, in the x-korapay-signature header (Korapay signs only
 * the data object). https://developers.korapay.com/docs/webhooks
 */
export function verifyWebhookSignature(body: { data?: unknown } | null, signature: string | null): boolean {
  const expected = crypto
    .createHmac('sha256', secretKey())
    .update(JSON.stringify(body?.data ?? null))
    .digest('hex');
  return secretMatches(signature, expected);
}

export type InitializeChargeInput = {
  reference: string;
  amountKobo: number;
  currency: 'NGN';
  customer: { name: string; email: string };
  metadata: Record<string, string>;
  redirectUrl: string;
  notificationUrl: string;
};

/** Starts a hosted checkout and returns the checkout URL. */
/** Korapay rejects empty metadata values (422), so blank fields are left out. */
export function cleanMetadata(metadata: Record<string, string>): Record<string, string> | undefined {
  const entries = Object.entries(metadata).filter(([, v]) => typeof v === 'string' && v.trim() !== '');
  return entries.length ? Object.fromEntries(entries) : undefined;
}

export async function initializeCharge(input: InitializeChargeInput): Promise<string> {
  const res = await fetch(`${BASE_URL}/charges/initialize`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${secretKey()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      reference: input.reference,
      amount: input.amountKobo / 100,
      currency: input.currency,
      customer: input.customer,
      metadata: cleanMetadata(input.metadata),
      redirect_url: input.redirectUrl,
      notification_url: input.notificationUrl,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.status || typeof json?.data?.checkout_url !== 'string') {
    throw new Error(`Korapay initialize failed (${res.status}): ${JSON.stringify(json)?.slice(0, 500)}`);
  }
  return json.data.checkout_url;
}

export type VerifiedCharge = {
  reference: string;
  status: 'success' | 'failed' | 'processing' | 'pending' | string;
  amountPaidKobo: number | null;
  feeKobo: number | null;
  currency: string | null;
  providerReference: string | null;
};

/**
 * Asks Korapay for the authoritative state of a charge (our reference).
 * Returns null if Korapay does not know the reference.
 * Throws on network or server errors so callers can retry.
 */
export async function verifyCharge(reference: string): Promise<VerifiedCharge | null> {
  const res = await fetch(`${BASE_URL}/charges/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${secretKey()}` },
    cache: 'no-store',
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (res.status === 404) return null;
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.status || !json?.data) {
    throw new Error(`Korapay verify failed (${res.status}): ${JSON.stringify(json)?.slice(0, 500)}`);
  }
  const d = json.data;
  // amount_paid can be 0 or missing for some payment methods; fall back to amount.
  const paid = nairaToKobo(d.amount_paid);
  return {
    reference: String(d.payment_reference ?? d.reference ?? reference),
    status: String(d.status ?? '').toLowerCase(),
    amountPaidKobo: paid && paid > 0 ? paid : nairaToKobo(d.amount),
    feeKobo: nairaToKobo(d.fee),
    currency: typeof d.currency === 'string' ? d.currency : null,
    providerReference: typeof d.reference === 'string' ? d.reference : null,
  };
}
