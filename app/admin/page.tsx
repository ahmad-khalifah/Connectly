import React from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
  DollarSign, Users, Activity, Wifi, AlertTriangle, 
  ArrowUpRight, ArrowDownRight, Radio, Server, Clock 
} from 'lucide-react';
import RealtimeActivityFeed from './components/realtime-activity-feed';
import { MetricTimelineChart } from './components/metric-timeline-chart';

export const dynamic = 'force-dynamic';

export default async function AdminDashboardOverview() {
  
  // Initialize Supabase with the Service Role Key to bypass Row Level Security
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseRoleKey) {
    return <div className="p-6 text-red-500">Critical Error: Missing Supabase Admin Keys</div>;
  }

  const supabase = createClient(supabaseUrl, supabaseRoleKey);

  // Fetch telemetry and business state concurrently
  const [
    revenueData,
    customerCounts,
    activeSessions,
    locationsHealth,
    routersHealth,
    recentEvents
  ] = await Promise.all([
    supabase.from('purchases').select('payment_gateway, gateway_fee_ngn, net_amount_ngn, created_at').order('created_at', { ascending: false }),
    supabase.from('subscriptions').select('id, status'),
    supabase.from('network_sessions').select('id', { count: 'exact' }).eq('status', 'active'),
    supabase.from('locations').select('id, name, status'),
    supabase.from('routers').select('id, identifier, status, cpu_usage_pct, wan_status'),
    supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(8)
  ]);

  // Financial calculations
  const successfulPurchases = revenueData.data?.filter(p => p.payment_gateway === 'paystack') || [];
  
  const grossRevenue = successfulPurchases.reduce((acc, curr) => acc + Number(curr.net_amount_ngn || 0), 0);
  const totalFees = successfulPurchases.reduce((acc, curr) => acc + Number(curr.gateway_fee_ngn || 0), 0);
  const netRevenue = grossRevenue - totalFees;

  // Network infrastructure stats
  const totalLocations = locationsHealth.data?.length || 0;
  const offlineLocations = locationsHealth.data?.filter(l => l.status === 'offline').length || 0;
  const totalRouters = routersHealth.data?.length || 0;
  const healthyRouters = routersHealth.data?.filter(r => r.status === 'online').length || 0;

  const totalActiveSubs = customerCounts.data?.filter(s => s.status === 'active').length || 0;
  const activeUsersOnline = activeSessions.count || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">System Operations Console</h1>
          <p className="text-sm text-slate-500">Live operational oversight across network infrastructure, roaming sessions, and revenue.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wide">Infrastructure Synchronized</span>
          </div>
        </div>
      </div>

      {/* Primary KPI Command Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Module A: Financial Position */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Revenue Operations</h2>
            <DollarSign className="h-4 w-4 text-[#6d1825]" />
          </div>
          <div className="space-y-2">
            <div>
              <span className="text-xs text-slate-400 font-medium">Net Recognized Revenue</span>
              <p className="text-2xl font-extrabold text-slate-900 font-mono tracking-tight">
                ₦{netRevenue.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs text-slate-600">
              <div>
                <span className="text-slate-400 block text-[11px]">Gross Billed</span>
                <span className="font-semibold text-slate-800">₦{grossRevenue.toLocaleString('en-NG')}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Processing Fees</span>
                <span className="font-semibold text-red-600">-₦{totalFees.toLocaleString('en-NG')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Module B: Subscriber Base */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Subscribers & Sessions</h2>
            <Users className="h-4 w-4 text-[#cfa253]" />
          </div>
          <div className="space-y-2">
            <div>
              <span className="text-xs text-slate-400 font-medium">Currently Connected</span>
              <p className="text-2xl font-extrabold text-slate-900 font-mono tracking-tight flex items-center gap-2">
                {activeUsersOnline}
                <span className="text-xs font-normal text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">Live</span>
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs text-slate-600">
              <div>
                <span className="text-slate-400 block text-[11px]">Active Plans</span>
                <span className="font-semibold text-slate-800">{totalActiveSubs}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Network Penetration</span>
                <span className="font-semibold text-slate-800">
                  {totalActiveSubs > 0 ? Math.round((activeUsersOnline / totalActiveSubs) * 100) : 0}% Concurrent
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Module C: Hardware & Backhaul Health */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Network Integrity</h2>
            <Radio className="h-4 w-4 text-[#6d1825]" />
          </div>
          <div className="space-y-2">
            <div>
              <span className="text-xs text-slate-400 font-medium">Locations Active</span>
              <p className="text-2xl font-extrabold text-slate-900 font-mono tracking-tight">
                {totalLocations - offlineLocations} / {totalLocations}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs text-slate-600">
              <div>
                <span className="text-slate-400 block text-[11px]">Edge Routers</span>
                <span className={`font-semibold ${healthyRouters === totalRouters ? 'text-slate-800' : 'text-amber-600'}`}>
                  {healthyRouters} / {totalRouters} Operational
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Network State</span>
                <span className={`font-semibold ${offlineLocations > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                  {offlineLocations > 0 ? `${offlineLocations} Site Down` : 'Nominal'}
                </span>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Main Analytics Engine */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
        <MetricTimelineChart transactions={successfulPurchases} />
      </div>

      {/* Split Operations: Live Feed & Hardware Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Real-time Event Stream */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <Activity className="h-4 w-4 text-[#6d1825]" /> Network & Transaction Event Stream
            </h3>
            <span className="text-[11px] font-mono text-slate-400">PostgreSQL WebSocket Active</span>
          </div>
          <div className="p-4 flex-1">
            <RealtimeActivityFeed initialLogs={recentEvents.data || []} />
          </div>
        </div>

        {/* Physical Node Health */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-200 bg-slate-50">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <Server className="h-4 w-4 text-[#cfa253]" /> Edge Node Heartbeats
            </h3>
          </div>
          <div className="divide-y divide-slate-100 p-2 overflow-y-auto max-h-[360px]">
            {routersHealth.data?.map(router => (
              <div key={router.id} className="p-3 flex items-center justify-between text-xs">
                <div>
                  <p className="font-semibold text-slate-800">{router.identifier}</p>
                  <p className="text-[11px] text-slate-400 font-mono">CPU Load: {router.cpu_usage_pct}%</p>
                </div>
                <div className="text-right">
                  <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                    router.status === 'online' 
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                      : 'bg-red-50 text-red-700 border border-red-200'
                  }`}>
                    {router.status}
                  </span>
                </div>
              </div>
            ))}
            {(!routersHealth.data || routersHealth.data.length === 0) && (
              <p className="p-6 text-center text-xs text-slate-400">No hardware nodes discovered.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}