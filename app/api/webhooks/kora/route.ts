import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { sendTermiiSMS } from '@/lib/sms';

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('x-korapay-signature');
    const secret = process.env.KORA_SECRET_KEY;

    if (!secret) throw new Error('Missing Kora Secret Key');

    // Verify Kora's webhook signature
    const hash = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    if (hash !== signature) {
      return new NextResponse('Invalid signature', { status: 401 });
    }

    const payload = JSON.parse(rawBody);

    // Only process successful charge events
    if (payload.event === 'charge.success') {
      const data = payload.data;
      
      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      // Kora passes custom metadata differently. Extract your plan/user data.
      const reference = data.reference;
      const amountPaid = data.amount;
      const fee = data.fee;
      const netAmount = amountPaid - fee;
      const customerPhone = data.customer.phone;
      
      // Assuming you passed plan_id in the reference or metadata during checkout
      const planId = data.customer.email.split('@')[0]; // Adjust based on how you pass metadata

      const { error } = await supabaseAdmin.from('purchases').insert({
        payment_gateway: 'kora',
        transaction_reference: reference,
        amount_kobo: amountPaid * 100, // Assuming Kora returns NGN, convert to kobo for your DB
        gateway_fee_ngn: fee,
        net_amount_ngn: netAmount,
        phone_number: customerPhone,
        plan_id: planId, // Map this correctly based on your checkout logic
        status: 'successful'
      });

      if (error) throw error;
      
      // Trigger SMS provisioning here if integrated
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('[KORA_WEBHOOK_ERROR]', error);
    return new NextResponse('Webhook handler failed', { status: 500 });
  }
}