import { db } from '@/lib/db/client';
import { 
  MapPin, Router as RouterIcon, Wifi, Radio, ArrowDown, ArrowUp, 
  Clock, ShieldAlert, Users, DollarSign 
} from 'lucide-react';
import Link from 'next/link';

export default async function LocationDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;

  const [locationRes, backhaulRes, routersRes, apRes, sessionsRes] = await Promise.all([
    db.from('locations').select('*, institutions(name)').eq('id', id).single(),
    db.from('backhauls').select('*').eq('location_id', id),
    db.from('routers').select('*').eq('location_id', id),
    db.from('access_points').select('*').eq('location_id', id),
    db.from('network_sessions').select('id', { count: 'exact' }).eq('location_id', id).eq('status', 'active')
  ]);

  const location = locationRes.data;
  if (!location) return <div className="p-8 text-slate-500">Location not found.</div>;

  return (
    <div className="space-y-6">
      {/* Location Breadcrumb & Status */}
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <Link href="/admin/locations" className="hover:underline">Locations</Link>
            <span>/</span>
            <span>{location.institutions?.name || 'Independent Facility'}</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <MapPin className="h-6 w-6 text-[#6d1825]" /> {location.name}
          </h1>
          <p className="text-sm text-slate-500">{location.address || 'Address not registered'} &bull; Zone: {location.building || 'Campus Core'}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1 rounded-full text-xs font-mono font-bold uppercase ${
            location.status === 'active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            Site Status: {location.status}
          </span>
        </div>
      </div>

      {/* Hardware Telemetry Strip */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <span className="text-xs text-slate-400 block mb-1">Active Subscribers Online</span>
          <p className="text-2xl font-bold text-slate-900 font-mono">{sessionsRes.count || 0}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <span className="text-xs text-slate-400 block mb-1">Backhaul Links</span>
          <p className="text-2xl font-bold text-slate-900 font-mono">{backhaulRes.data?.length || 0} Upstream</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <span className="text-xs text-slate-400 block mb-1">Edge Gateways</span>
          <p className="text-2xl font-bold text-slate-900 font-mono">{routersRes.data?.length || 0} Nodes</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <span className="text-xs text-slate-400 block mb-1">Radios / Access Points</span>
          <p className="text-2xl font-bold text-slate-900 font-mono">{apRes.data?.length || 0} Radios</p>
        </div>
      </div>

      {/* Backhaul Health Matrix (Starlink / ISP) */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
          <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
            <Radio className="h-4 w-4 text-[#6d1825]" /> Upstream Backhaul Telemetry
          </h2>
          <span className="text-xs text-slate-400">Live Satellite / Circuit Stats</span>
        </div>
        <div className="divide-y divide-slate-100">
          {backhaulRes.data?.map((bh) => (
            <div key={bh.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900">{bh.provider}</span>
                  <span className="text-xs font-mono text-slate-400">({bh.identifier})</span>
                </div>
                <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-slate-400" /> Latency: <strong>{bh.current_latency_ms}ms</strong>
                  </span>
                  <span className="flex items-center gap-1">
                    <ArrowDown className="h-3.5 w-3.5 text-emerald-600" /> Down: <strong>{bh.download_mbps} Mbps</strong>
                  </span>
                  <span className="flex items-center gap-1">
                    <ArrowUp className="h-3.5 w-3.5 text-blue-600" /> Up: <strong>{bh.upload_mbps} Mbps</strong>
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <span className="text-[11px] text-slate-400 block">Monthly Ingestion</span>
                  <span className="text-xs font-mono font-bold text-slate-800">{bh.monthly_data_used_gb} GB</span>
                </div>
                <span className={`px-2.5 py-1 rounded text-xs font-mono uppercase font-bold ${
                  bh.status === 'online' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
                }`}>
                  {bh.status}
                </span>
              </div>
            </div>
          ))}
          {(!backhaulRes.data || backhaulRes.data.length === 0) && (
            <p className="p-6 text-center text-xs text-slate-400">No upstream backhaul mapped to this location.</p>
          )}
        </div>
      </div>

      {/* Routers & Radios Assigned to this Facility */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Routers */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
            <RouterIcon className="h-4 w-4 text-slate-400" /> Edge Gateways (MikroTik)
          </h3>
          <div className="space-y-3">
            {routersRes.data?.map(router => (
              <div key={router.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex justify-between items-center">
                <div>
                  <p className="font-semibold text-sm text-slate-900">{router.identifier}</p>
                  <p className="text-xs text-slate-500 font-mono">Mgmt: {router.management_ip}</p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-mono font-bold text-slate-600 block">{router.wan_status}</span>
                  <span className="text-[10px] text-slate-400 font-mono">CPU: {router.cpu_usage_pct}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Access Points */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Wifi className="h-4 w-4 text-slate-400" /> Wi-Fi Access Points
          </h3>
          <div className="space-y-3">
            {apRes.data?.map(ap => (
              <div key={ap.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex justify-between items-center">
                <div>
                  <p className="font-semibold text-sm text-slate-900">{ap.name}</p>
                  <p className="text-xs text-slate-400 font-mono">{ap.mac_address}</p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-mono font-bold text-[#6d1825]">{ap.connected_clients} Clients</span>
                  <span className="text-[10px] text-emerald-600 block font-semibold">{ap.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}