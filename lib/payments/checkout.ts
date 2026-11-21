import { randomUUID } from 'crypto';
import { db } from '@/lib/db/client';
import { normaliseNigerianMobile } from '@/lib/phone';
import { appUrl, korapayWebhookUrl } from '@/lib/env';
import { initializeCharge, KorapayConfigError } from '@/lib/payments/korapay';

// Starts a Korapay checkout for the captive portal. Public: anyone can call
// it (POST /api/checkout, or the Server Function in app/actions/payment.ts)
// with any arguments, so it trusts nothing from the browser. Location,
// router and plan are checked in the database, the price comes from the
// database, and a `pending` purchase is recorded BEFORE the customer is sent
// to Korapay. Only a verified
// payment (lib/payments/ledger.ts) can move it to `paid`.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAC_RE = /^([0-9a-f]{2}[:-]){5}[0-9a-f]{2}$/i;

export type CheckoutResult = { ok: true; checkoutUrl: string; reference: string } | { ok: false; error: string };

export type CheckoutInput = {
  planId: string;
  phone: string;
  locationId: string;
  routerId: string;
  mac?: string;
  ip?: string;
};

class CheckoutError extends Error {}

export async function initializeKoraCheckout(payload: CheckoutInput): Promise<CheckoutResult> {
  try {
    return { ok: true, ...(await startCheckout(payload)) };
  } catch (error) {
    if (error instanceof CheckoutError) return { ok: false, error: error.message };
    console.error('[CHECKOUT_ERROR]', error);
    return {
      ok: false,
      error:
        error instanceof KorapayConfigError
          ? 'Payments are not configured yet.'
          : 'Unable to start payment. Please try again.',
    };
  }
}

async function startCheckout(payload: CheckoutInput): Promise<{ checkoutUrl: string; reference: string }> {
  if (typeof payload?.planId !== 'string' || !UUID_RE.test(payload.planId)) {
    throw new CheckoutError('Please select a valid plan.');
  }
  if (typeof payload.locationId !== 'string' || !UUID_RE.test(payload.locationId)) {
    throw new CheckoutError('Unrecognised network location.');
  }
  const phone = normaliseNigerianMobile(payload.phone);
  if (!phone) throw new CheckoutError('Please enter a valid Nigerian mobile number.');

  const routerId = typeof payload.routerId === 'string' && UUID_RE.test(payload.routerId) ? payload.routerId : null;
  const mac = typeof payload.mac === 'string' && MAC_RE.test(payload.mac) ? payload.mac.toLowerCase() : null;
  const ip = typeof payload.ip === 'string' && /^[0-9a-f.:]{3,45}$/i.test(payload.ip) ? payload.ip : null;

  const [{ data: location }, { data: plan }] = await Promise.all([
    db.from('locations').select('id, name, is_active').eq('id', payload.locationId).maybeSingle(),
    db.from('plans').select('id, name, price_kobo, is_active, allowed_location_ids').eq('id', payload.planId).maybeSingle(),
  ]);

  if (!location || location.is_active === false) throw new CheckoutError('This location is not accepting payments.');
  if (!plan || plan.is_active === false) throw new CheckoutError('This plan is not available.');
  const allowed = plan.allowed_location_ids as string[] | null;
  if (allowed && allowed.length > 0 && !allowed.includes(location.id)) {
    throw new CheckoutError('This plan is not available at this location.');
  }
  const amountKobo = Number(plan.price_kobo);
  if (!Number.isInteger(amountKobo) || amountKobo <= 0) throw new CheckoutError('This plan is not available.');

  // Access is granted on a router, so a purchase without one could be paid
  // and never turn into internet access. Customers buy from the WiFi login page.
  if (!routerId) throw new CheckoutError('Please connect to the Connectly WiFi network to buy a plan.');
  const { data: router } = await db.from('routers').select('id, location_id, lifecycle_status').eq('id', routerId).maybeSingle();
  if (!router || router.location_id !== location.id) throw new CheckoutError('Unrecognised network equipment.');
  if (router.lifecycle_status !== 'active') throw new CheckoutError('This network is not taking payments yet.');

  const reference = `CONN_${randomUUID()}`;
  const baseUrl = appUrl();

  // 1. Record the intent first, so every payment Korapay reports has a row.
  const { error: insertError } = await db.from('purchases').insert({
    reference,
    plan_id: plan.id,
    location_id: location.id,
    router_id: routerId,
    phone_number: phone,
    mac_address: mac ?? '00:00:00:00:00:00',
    amount_kobo: amountKobo,
    currency: 'NGN',
    net_amount_ngn: amountKobo / 100,
    payment_gateway: 'korapay',
    status: 'pending',
  });
  if (insertError) throw new Error(`purchase insert failed: ${insertError.message}`);

  // 2. Open Korapay's hosted checkout for exactly that amount.
  try {
    const checkoutUrl = await initializeCharge({
      reference,
      amountKobo,
      currency: 'NGN',
      customer: { name: 'Connectly customer', email: 'payments@getconnectly.net' },
      metadata: {
        plan_id: plan.id,
        location_id: location.id,
        router_id: routerId ?? '',
        mac_address: mac ?? '',
        ip_address: ip ?? '',
      },
      redirectUrl: `${baseUrl}/success?reference=${encodeURIComponent(reference)}`,
      notificationUrl: korapayWebhookUrl(),
    });
    return { checkoutUrl, reference };
  } catch (error) {
    await db.rpc('mark_payment_failed', { p_reference: reference, p_reason: 'Checkout could not be started' });
    throw error;
  }
}
