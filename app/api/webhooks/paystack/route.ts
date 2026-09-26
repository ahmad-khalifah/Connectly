import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js'; 
import { MockNetworkAdapter } from '../../../../lib/network/mock';

export async function POST(request: Request) {
  try {
    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    // 1. Explicitly validate environment variables before utilizing them
    if (!secretKey || !supabaseUrl || !supabaseRoleKey) {
      throw new Error('CRITICAL: Missing backend environment variables in Vercel.');
    }

    const payload = await request.text();
    const signature = request.headers.get('x-paystack-signature');

    const expectedSignature = crypto
      .createHmac('sha512', secretKey)
      .update(payload)
      .digest('hex');

    if (signature !== expectedSignature) {
      return NextResponse.json({ message: 'Invalid signature' }, { status: 401 });
    }

    const body = JSON.parse(payload);

    if (body.event === 'charge.success') {
      const reference = body.data.reference;
      const amountPaid = body.data.amount / 100;

      const supabaseAdmin = createClient(supabaseUrl, supabaseRoleKey);

      const { data: purchase, error: fetchError } = await supabaseAdmin
        .from('purchases')
        .select('mac_address, location_id, plan_id, phone_number')
        .eq('reference', reference)
        .single();

      if (fetchError || !purchase) {
        throw new Error(`Purchase record not found in Supabase for reference: ${reference}`);
      }

      const { data: plan, error: planError } = await supabaseAdmin
        .from('plans')
        .select('duration_seconds')
        .eq('id', purchase.plan_id)
        .single();

      if (planError || !plan) {
        throw new Error(`Plan details not found for plan_id: ${purchase.plan_id}`);
      }

      const expiresAt = new Date(Date.now() + plan.duration_seconds * 1000).toISOString();

      const isAuthorized = await MockNetworkAdapter.createHotspotUser({
        routerId: purchase.location_id,
        username: purchase.phone_number || 'unknown_phone',
        password: purchase.phone_number || 'unknown_phone',
        durationSeconds: plan.duration_seconds,
        reference: reference,
      });

      const finalStatus = isAuthorized ? 'completed' : 'failed';

      console.log('[WEBHOOK_UPDATING_PURCHASE]', {
        reference,
        amountPaid,
        expiresAt,
        finalStatus
      });

      const { data: updatedRecord, error: updateError } = await supabaseAdmin
        .from('purchases')
        .update({ 
          status: finalStatus, // Ensure this is mapped to your correct ENUM (e.g., 'completed')
          net_amount_ngn: amountPaid,
          payment_gateway: 'paystack'
        })
        .eq('reference', reference)
        .select();

      if (updateError) {
        console.error('[SUPABASE_UPDATE_ERROR]', updateError);
        throw new Error(`Supabase update failed: ${updateError.message} (${updateError.code})`);
      }

      console.log('[SUPABASE_UPDATE_SUCCESS]', updatedRecord);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('[CRITICAL_WEBHOOK_FAILURE]', error.message || error);
    return NextResponse.json({ 
      error: 'Webhook processing failed', 
      details: error.message || String(error) 
    }, { status: 500 });
  }
}