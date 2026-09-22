import { NextResponse } from 'next/server';
import { db } from '../../../../lib/db/client';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ref = searchParams.get('ref');

  if (!ref) return NextResponse.json({ message: 'Reference required' }, { status: 400 });

  try {
    const { data: payment } = await db
      .from('payments')
      .select(`status, purchases ( status, expires_at, claim_token, plans ( name ) )`)
      .eq('paystack_reference', ref)
      .single();

    if (!payment) return NextResponse.json({ status: 'pending' });

    const purchase = payment.purchases as any;
    return NextResponse.json({
      status: purchase.status,
      expiresAt: purchase.expires_at,
      requiresWiFiConnection: !!purchase.claim_token,
      planName: purchase.plans?.name || 'Internet Plan',
    });
  } catch (error) {
    return NextResponse.json({ message: 'Error fetching status' }, { status: 500 });
  }
}