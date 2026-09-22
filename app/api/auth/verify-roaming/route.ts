import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';

export async function POST(req: NextRequest) {
  const { phone_number, mac_address, router_identifier, access_point_mac } = await req.json();

  if (!phone_number || !mac_address) {
    return NextResponse.json({ error: 'Missing hardware or identity context' }, { status: 400 });
  }

  // 1. Identify Customer
  const { data: customer } = await db
    .from('customers')
    .select('id')
    .eq('phone_number', phone_number)
    .single();

  if (!customer) {
    return NextResponse.json({ authorized: false, reason: 'Customer record not found' }, { status: 404 });
  }

  // 2. Identify the Router and its Physical Location
  const { data: router } = await db
    .from('routers')
    .select('id, location_id, locations (id, name, status)')
    .eq('identifier', router_identifier)
    .single();

  // 3. Find any active, valid subscription across the entire Connectly network
  const now = new Date().toISOString();
  const { data: validSubscription } = await db
    .from('subscriptions')
    .select(`
      id, 
      status, 
      expires_at, 
      device_limit,
      plans (id, name, speed_down_mbps, speed_up_mbps, allowed_location_ids)
    `)
    .eq('customer_id', customer.id)
    .eq('status', 'active')
    .gt('expires_at', now)
    .order('expires_at', { ascending: false })
    .limit(1)
    .single();

  if (!validSubscription) {
    return NextResponse.json({ 
      authorized: false, 
      reason: 'No active subscription. Please purchase an access plan.' 
    }, { status: 403 });
  }

  // 4. Validate Location Roaming Entitlement
  const plan = validSubscription.plans as any;
  if (plan.allowed_location_ids && router?.location_id) {
    if (!plan.allowed_location_ids.includes(router.location_id)) {
      return NextResponse.json({ 
        authorized: false, 
        reason: 'Your current plan does not grant access to this facility.' 
      }, { status: 403 });
    }
  }

  // 5. Enforce Hardware Device Limits
  const { count: currentActiveDevices } = await db
    .from('network_sessions')
    .select('id', { count: 'exact' })
    .eq('subscription_id', validSubscription.id)
    .eq('status', 'active')
    .neq('mac_address', mac_address);

  if (currentActiveDevices && currentActiveDevices >= validSubscription.device_limit) {
    return NextResponse.json({ 
      authorized: false, 
      reason: `Device concurrency limit reached (${validSubscription.device_limit} active). Please disconnect an older device.` 
    }, { status: 429 });
  }

  // 6. Record Roaming Session
  const { data: session } = await db
    .from('network_sessions')
    .insert({
      subscription_id: validSubscription.id,
      customer_id: customer.id,
      location_id: router?.location_id,
      router_id: router?.id,
      mac_address,
      ip_address: req.headers.get('x-forwarded-for') || '127.0.0.1',
      status: 'active'
    })
    .select('id')
    .single();

  // 7. Log roaming event for administrative visibility
  await db.from('activity_logs').insert({
    event_type: 'customer_roam',
    severity: 'info',
    location_id: router?.location_id,
    message: `Customer ${phone_number} authenticated at ${router?.locations ? (router.locations as any).name : 'Remote Node'}`,
    metadata: { mac: mac_address, session_id: session?.id }
  });

  return NextResponse.json({
    authorized: true,
    speed_down_mbps: plan.speed_down_mbps,
    speed_up_mbps: plan.speed_up_mbps,
    session_id: session?.id
  });
}