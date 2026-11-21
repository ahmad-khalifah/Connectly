'use server';

// Server Function kept for callers on hosts that run the full Next.js server
// (local dev, Vercel). The portal itself now calls POST /api/checkout, which
// runs the same code without rendering React (see lib/http/customer-api.ts).
import { initializeKoraCheckout as start, type CheckoutResult } from '@/lib/payments/checkout';

export async function initializeKoraCheckout(payload: Parameters<typeof start>[0]): Promise<CheckoutResult> {
  return start(payload);
}
