import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const { planId, phoneNumber, location_id, macAddress, routerId } = await request.json();

    if (!location_id || !planId) {
      throw new Error('Missing required payload parameters.');
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseRoleKey) {
      throw new Error('Missing Supabase environment variables in Vercel.');
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseRoleKey);

    const { data: plan, error: planError } = await supabaseAdmin
      .from('plans')
      .select('price_kobo')
      .eq('id', planId)
      .single();

    if (planError || !plan) {
      throw new Error('Associated data plan could not be resolved.');
    }

    const priceInNaira = plan.price_kobo / 100;
    const reference = `TRX_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const paystackEmail = `${phoneNumber}@connectly.app`;

    // Strip unconstrained columns and match exact Supabase schema
    const { data: insertedRow, error: insertError } = await supabaseAdmin
      .from('purchases')
      .insert({
        reference,
        plan_id: planId,
        phone_number: phoneNumber,
        location_id: location_id,
        mac_address: macAddress || '00:00:00:00:00:00',
        net_amount_ngn: priceInNaira, 
      })
      .select()
      .single();

      if (insertError || !insertedRow) {
        console.error('[SUPABASE_INSERT_ERROR]', insertError);
        throw new Error(`Database failed to create purchase record: ${insertError?.message || 'Unknown database error'}`);
      }

    return NextResponse.json({ 
      reference,
      amount_kobo: plan.price_kobo,
      email: paystackEmail
    });
  } catch (error: any) {
    console.error('[INITIATE_ERROR]', error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}