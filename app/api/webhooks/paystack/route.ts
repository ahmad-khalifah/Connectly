import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js'; 
import { MockNetworkAdapter } from '../../../../lib/network/mock';

export async function POST(request: Request) {
  try {
    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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
        .select('mac_address, location_id, plan_id, phone_number, status')
        .eq('reference', reference)
        .single();

      if (fetchError || !purchase) {
        throw new Error(`Purchase record not found in Supabase for reference: ${reference}`);
      }

      // Exit early if Paystack is retrying a webhook we already completed
      if (purchase.status === 'completed') {
        return NextResponse.json({ received: true });
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
      const phone = purchase.phone_number || 'unknown_phone';

      await MockNetworkAdapter.createHotspotUser({
        routerId: purchase.location_id,
        username: phone,
        password: phone,
        durationSeconds: plan.duration_seconds,
        reference: reference
      });

      // 1. Get or Create Customer Profile
      let customerId;
      const { data: existingCustomer } = await supabaseAdmin
        .from('customers')
        .select('id')
        .eq('phone_number', phone)
        .single();

      if (existingCustomer) {
        customerId = existingCustomer.id;
      } else {
        const { data: newCustomer, error: customerError } = await supabaseAdmin
          .from('customers')
          .insert({ phone_number: phone })
          .select('id')
          .single();
        
        if (customerError) throw new Error(`Customer creation failed: ${customerError.message}`);
        customerId = newCustomer.id;
      }

      // 2. Safely Handle Subscription 
      const { data: existingSub } = await supabaseAdmin
        .from('subscriptions')
        .select('id')
        .eq('reference', reference)
        .maybeSingle();

      const now = new Date().toISOString();

      const subPayload = {
        customer_id: customerId,
        plan_id: purchase.plan_id,
        status: 'active',
        starts_at: now, 
        expires_at: expiresAt,
        reference: reference
      };

      if (existingSub) {
        const { error: updateSubError } = await supabaseAdmin
          .from('subscriptions')
          .update(subPayload)
          .eq('reference', reference);
        if (updateSubError) throw new Error(`Subscription update failed: ${updateSubError.message}`);
      } else {
        const { error: insertSubError } = await supabaseAdmin
          .from('subscriptions')
          .insert(subPayload);
        if (insertSubError) throw new Error(`Subscription insert failed: ${insertSubError.message}`);
      }

      // 3. Insert Active Network Session 
      const { error: sessionError } = await supabaseAdmin
        .from('network_sessions')
        .insert({
          customer_id: customerId,
          location_id: purchase.location_id,
          status: 'active',
          mac_address: purchase.mac_address || '00:00:00:00:00:00',
          ip_address: '0.0.0.0'
        });

      if (sessionError) throw new Error(`Session insert failed: ${sessionError.message}`);

      // 4. Update Original Purchase Record to Completed
      const { error: updateError } = await supabaseAdmin
        .from('purchases')
        .update({ 
          net_amount_ngn: amountPaid,
          payment_gateway: 'paystack',
          status: 'completed'
        })
        .eq('reference', reference);

      if (updateError) {
        throw new Error(`Supabase purchase update failed: ${updateError.message}`);
      }
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