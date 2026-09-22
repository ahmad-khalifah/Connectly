import { NextResponse } from 'next/server';
import { db } from '../../../lib/db/client';
import { network } from '../../../lib/network';

export async function POST(request: Request) {
  try {
    const { claimToken, macAddress, ipAddress, routerId } = await request.json();

    if (!claimToken || !macAddress || !routerId) {
      return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
    }

    // 1. Verify the claim token is valid and paid
    const { data: purchase, error: purchaseError } = await db
      .from('purchases')
      .select('id, customer_id, location_id, expires_at, plans(upload_limit_kbps, download_limit_kbps)')
      .eq('claim_token', claimToken)
      .eq('status', 'paid')
      .single();

    if (purchaseError || !purchase) {
      return NextResponse.json({ message: 'Invalid or expired claim token' }, { status: 400 });
    }

    // 2. Ensure device is registered
    const { data: device } = await db
      .from('devices')
      .upsert(
        { customer_id: purchase.customer_id, mac_address: macAddress },
        { onConflict: 'mac_address' }
      )
      .select('id')
      .single();

    if (!device) {
      throw new Error('Failed to register device');
    }

    const plan = purchase.plans as any;
    const rateLimit = `${plan.upload_limit_kbps}K/${plan.download_limit_kbps}K`;

    // 3. Create network authorization
    const { data: authRecord } = await db
      .from('network_authorizations')
      .insert({
        purchase_id: purchase.id,
        device_id: device.id,
        router_id: routerId,
        assigned_ip: ipAddress,
        status: 'active',
        rate_limit_rule: rateLimit,
        expires_at: purchase.expires_at,
      })
      .select('id')
      .single();

    // 4. Invalidate the claim token so it cannot be used again
    await db
      .from('purchases')
      .update({ claim_token: null })
      .eq('id', purchase.id);

    // 5. Trigger network hardware authorization
    if (authRecord) {
      await network.authorizeDevice({
        macAddress,
        ipAddress,
        rateLimit,
        routerId,
        reference: `CLAIM_${purchase.id}`,
      });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error('[CLAIM_ERROR]', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}