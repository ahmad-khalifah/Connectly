import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js'; 
import { MockNetworkAdapter } from '../../../../lib/network/mock';

export async function POST(request: Request) {
  try {
    const payload = await request.text();
    // Paystack uses a different header for signature verification
    const signature = request.headers.get('x-paystack-signature');
    const secretKey = process.env.PAYSTACK_SECRET_KEY!;

    const expectedSignature = crypto
      .createHmac('sha512', secretKey)
      .update(payload)
      .digest('hex');

    if (signature !== expectedSignature) {
      return NextResponse.json({ message: 'Invalid signature' }, { status: 401 });
    }

    const body = JSON.parse(payload);

    // Paystack events are structured differently than Monnify
    if (body.event === 'charge.success') {
      const reference = body.data.reference;
      // Paystack sends the amount in kobo. Convert back to Naira for your database.
      const amountPaid = body.data.amount / 100;

      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      const { data: purchase, error: fetchError } = await supabaseAdmin
        .from('purchases')
        .select('mac_address, location_id, plan_id')
        .eq('reference', reference)
        .single();

      if (fetchError || !purchase) {
        console.error('Purchase not found for reference:', reference);
        // Return 200 so Paystack stops retrying, even if we can't find the record
        return NextResponse.json({ received: true });
      }

      const { data: plan, error: planError } = await supabaseAdmin
        .from('plans')
        .select('duration_seconds')
        .eq('id', purchase.plan_id)
        .single();

      if (planError || !plan) {
        throw new Error(`Plan details not found for purchase: ${reference}`);
      }

      const expiresAt = new Date(Date.now() + plan.duration_seconds * 1000).toISOString();

      // Trigger the mock Mikrotik API
      const isAuthorized = await MockNetworkAdapter.authorizeDevice({
        macAddress: purchase.mac_address,
        routerId: purchase.location_id,
        reference: reference,
      });

      const finalStatus = isAuthorized ? 'success' : 'failed';

      const { error: updateError } = await supabaseAdmin
        .from('purchases')
        .update({ 
          status: finalStatus, 
          amount_paid: amountPaid,
          expires_at: expiresAt
        })
        .eq('reference', reference);

      if (updateError) throw updateError;
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('[PAYSTACK_WEBHOOK_ERROR]', error);
    return NextResponse.json({ message: 'Webhook processing failed' }, { status: 500 });
  }
}