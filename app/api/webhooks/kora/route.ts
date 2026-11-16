import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { db } from '@/lib/db/client';
import { verifyWebhookSignature, KorapayConfigError } from '@/lib/payments/korapay';
import { reconcilePurchase } from '@/lib/payments/ledger';

// Korapay webhook: https://developers.korapay.com/docs/webhooks
//
// 1. Verify the signature (HMAC of the `data` object). Unsigned or forged
//    requests are rejected and NOT stored.
// 2. Store the event once (identical redeliveries collapse on a hash).
// 3. Never trust the payload's amount or status: re-check the charge with
//    Korapay's verify API, then let the idempotent database functions move
//    the purchase (lib/payments/ledger.ts).
// Responds 200 when the event is handled or deliberately ignored, and 500
// on transient failures so Korapay retries.

export async function POST(request: Request) {
  const rawBody = await request.text();

  let body: { event?: string; data?: Record<string, unknown> } | null;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ message: 'Invalid payload' }, { status: 400 });
  }

  try {
    if (!verifyWebhookSignature(body, request.headers.get('x-korapay-signature'))) {
      return NextResponse.json({ message: 'Invalid signature' }, { status: 401 });
    }
  } catch (error) {
    if (error instanceof KorapayConfigError) {
      console.error('[KORA_WEBHOOK] KORA_SECRET_KEY missing');
      return NextResponse.json({ message: 'Not configured' }, { status: 500 });
    }
    throw error;
  }

  const event = String(body?.event ?? '');
  const data = body?.data ?? {};
  // Hosted checkout puts our reference in payment_reference; other flows in reference.
  const reference = String(data.payment_reference ?? data.reference ?? '');
  const sha = crypto.createHash('sha256').update(rawBody).digest('hex');

  // Store once. If this exact payload was already fully processed, stop.
  const { data: inserted, error: insertError } = await db
    .from('payment_events')
    .insert({ provider: 'korapay', event_type: event, reference: reference || null, payload_sha256: sha, payload: body })
    .select('id')
    .maybeSingle();

  let eventId = inserted?.id as string | undefined;
  if (insertError) {
    if (insertError.code !== '23505') {
      console.error('[KORA_WEBHOOK] event insert failed', insertError);
      return NextResponse.json({ message: 'Retry later' }, { status: 500 });
    }
    const { data: existing } = await db
      .from('payment_events')
      .select('id, processed_at')
      .eq('provider', 'korapay')
      .eq('payload_sha256', sha)
      .single();
    if (existing?.processed_at) return NextResponse.json({ received: true, duplicate: true });
    eventId = existing?.id; // earlier attempt crashed before finishing; process again
  }

  let outcome = 'ignored';
  try {
    if ((event === 'charge.success' || event === 'charge.failed') && reference) {
      outcome = (await reconcilePurchase(reference)).outcome;
    }
  } catch (error) {
    console.error('[KORA_WEBHOOK] processing failed', reference, error);
    if (eventId) {
      await db.from('payment_events').update({ error: String(error).slice(0, 1000) }).eq('id', eventId);
    }
    return NextResponse.json({ message: 'Retry later' }, { status: 500 });
  }

  if (eventId) {
    await db
      .from('payment_events')
      .update({ processed_at: new Date().toISOString(), outcome, error: null })
      .eq('id', eventId);
  }
  return NextResponse.json({ received: true, outcome });
}
