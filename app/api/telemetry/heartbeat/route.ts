import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';

export async function POST(req: NextRequest) {
  // Edge nodes use a secure preshared authentication token
  const authHeader = req.headers.get('x-connectly-node-key');
  if (authHeader !== process.env.NODE_HEARTBEAT_SECRET) {
    return NextResponse.json({ error: 'Unauthorized hardware heartbeat' }, { status: 401 });
  }

  const { 
    router_identifier, 
    uptime_seconds, 
    cpu_usage_pct, 
    memory_usage_pct, 
    active_users,
    wan_status,
    backhaul_latency_ms 
  } = await req.json();

  // 1. Update router stats
  const { data: router } = await db
    .from('routers')
    .update({
      uptime_seconds,
      cpu_usage_pct,
      memory_usage_pct,
      wan_status,
      status: 'online',
      last_heartbeat: new Date().toISOString()
    })
    .eq('identifier', router_identifier)
    .select('id, location_id, backhaul_id')
    .single();

  if (!router) {
    return NextResponse.json({ error: 'Node not registered in console' }, { status: 404 });
  }

  // 2. If backhaul latency reported, update backhaul metrics
  if (router.backhaul_id && backhaul_latency_ms !== undefined) {
    await db
      .from('backhauls')
      .update({
        current_latency_ms: backhaul_latency_ms,
        status: backhaul_latency_ms > 150 ? 'degraded' : 'online',
        last_seen: new Date().toISOString()
      })
      .eq('id', router.backhaul_id);
  }

  // 3. Automated Alert Trigger: Detect Overloaded Nodes
  if (cpu_usage_pct > 90) {
    await db.from('activity_logs').insert({
      event_type: 'node_overload',
      severity: 'warn',
      location_id: router.location_id,
      message: `Router ${router_identifier} reporting critical CPU threshold: ${cpu_usage_pct}%`,
      metadata: { memory_pct: memory_usage_pct, active_users }
    });
  }

  return NextResponse.json({ status: 'telemetry_acknowledged' });
}