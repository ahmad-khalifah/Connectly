'use server';

import { randomUUID } from 'crypto';
import { db } from '@/lib/db/client';

// This is a public Server Function: anyone can call it with any arguments.
// So it trusts nothing from the browser. The price comes from the database,
// the plan must be active, and the phone number must be a Nigerian mobile.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Normalises 080..., 23480..., +23480... to 23480XXXXXXXX, or null if invalid. */
function normaliseNigerianMobile(input: string): string | null {
  const digits = input.replace(/[\s()-]/g, '').replace(/^\+/, '');
  const local = digits.startsWith('234') ? '0' + digits.slice(3) : digits;
  return /^0[789][01]\d{8}$/.test(local) ? '234' + local.slice(1) : null;
}

export async function initializeKoraCheckout(payload: {
  planId: string;
  phone: string;
  mac?: string;
  ip?: string;
  routerId?: string;
}): Promise<CheckoutResult> {
  try {
    return { ok: true, checkoutUrl: await startCheckout(payload) };
  } catch (error) {
    // Thrown messages are hidden in production builds, so return them instead.
    const message = error instanceof CheckoutError ? error.message : 'Unable to start payment. Please try again.';
    if (!(error instanceof CheckoutError)) console.error('[KORA_INIT_ERROR]', error);
    return { ok: false, error: message };
  }
}

export type CheckoutResult = { ok: true; checkoutUrl: string } | { ok: false; error: string };

class CheckoutError extends Error {}

async function startCheckout(payload: {
  planId: string;
  phone: string;
  mac?: string;
  ip?: string;
  routerId?: string;
}): Promise<string> {
  const secretKey = process.env.KORA_SECRET_KEY;
  if (!secretKey) throw new CheckoutError('Payments are not configured.');

  if (typeof payload?.planId !== 'string' || !UUID_RE.test(payload.planId)) {
    throw new CheckoutError('Please select a valid plan.');
  }
  const phone = typeof payload.phone === 'string' ? normaliseNigerianMobile(payload.phone) : null;
  if (!phone) throw new CheckoutError('Please enter a valid Nigerian mobile number.');

  const { data: plan, error: planError } = await db
    .from('plans')
    .select('id, price_kobo, is_active')
    .eq('id', payload.planId)
    .single();

  if (planError || !plan || plan.is_active === false) {
    throw new CheckoutError('This plan is not available.');
  }
  const amountNaira = Number(plan.price_kobo) / 100;
  if (!Number.isFinite(amountNaira) || amountNaira <= 0) {
    throw new CheckoutError('This plan is not available.');
  }

  const safeMac = typeof payload.mac === 'string' && payload.mac ? payload.mac : '00:00:00:00:00:00';
  const safeIp = typeof payload.ip === 'string' && payload.ip ? payload.ip : '127.0.0.1';
  const safeRouter = typeof payload.routerId === 'string' && payload.routerId ? payload.routerId : 'local_test_router';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  const response = await fetch('https://api.korapay.com/merchant/api/v1/charges/initialize', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      reference: `CONN_${randomUUID()}`,
      amount: amountNaira,
      currency: 'NGN',
      customer: {
        name: 'Connectly User',
        email: 'user@getconnectly.net',
      },
      metadata: {
        mac_address: safeMac,
        ip_address: safeIp,
        router_id: safeRouter,
        plan_id: plan.id,
        customer_phone: phone,
      },
      redirect_url: `${appUrl}/success`,
      notification_url: `${appUrl}/api/webhooks/kora`,
    }),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok || !data?.status || !data?.data?.checkout_url) {
    console.error('[KORA_INIT_ERROR]', response.status, JSON.stringify(data));
    throw new CheckoutError('Unable to start payment. Please try again.');
  }

  return data.data.checkout_url as string;
}
