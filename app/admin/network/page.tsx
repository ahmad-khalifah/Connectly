import { db } from '@/lib/db/client';
import { Network, Server, Radio, Activity, Cpu, AlertTriangle } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function NetworkFleetPage() {
  const [routersRes, backhaulRes] = await Promise.all([
    db.from('routers').select('*, locations(name)').order('identifier', { ascending: true }),
    db.from('backhauls').select('*, locations(name)').order('provider', { ascending: true })
  ]);

  const routers = routersRes.data || [];
  const backhauls = backhaulRes.data || [];

  const offlineRouters = routers.filter(r => r.status === 'offline').length;
  const degradedBackhauls = backhauls.filter(b => b.status === 'degraded' || b.status === 'offline').length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Network className="h-6 w-6 text-[#6d1825]" /> Network Fleet
        </h1>
        <p className="text-sm text-slate-500">Monitor edge nodes, backhaul circuits, and hardware telemetry across all locations.</p>
      </div>

      {/* Global Alerts */}
      {(offlineRouters > 0 || degradedBackhauls > 0) && (
        <div className="bg-red-50 border-l-4 border-red-600 p-4 rounded-r-lg">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <div>
              <h3 className="text-sm font-bold text-red-900">Infrastructure Warning</h3>
              <p className="text-xs text-red-700 mt-0.5">
                {offlineRouters > 0 && `${offlineRouters} edge nodes are offline. `}
                {degradedBackhauls > 0 && `${degradedBackhauls} upstream circuits are experiencing high latency.`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Hardware Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Edge Nodes (MikroTik) */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
            <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <Server className="h-4 w-4 text-[#6d1825]" /> Edge Gateways
            </h2>
            <span className="text-xs text-slate-500">{routers.length} Nodes Configured</span>
          </div>
          <div className="divide-y divide-slate-100">
            {routers.map((router) => (
              <div key={router.id} className="p-4 hover:bg-slate-50 transition-colors flex flex-col md:flex-row justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">{router.identifier}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                      router.status === 'online' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'
                    }`}>
                      {router.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Location: {router.locations?.name || 'Unassigned'}</p>
                </div>
                
                <div className="flex items-center gap-4 text-xs">
                  <div className="text-right">
                    <span className="text-slate-400 block mb-0.5">Management IP</span>
                    <span className="font-mono font-medium text-slate-800">{router.management_ip || 'DHCP'}</span>
                  </div>
                  <div className="w-px h-8 bg-slate-200 hidden md:block"></div>
                  <div className="text-right">
                    <span className="text-slate-400 block mb-0.5 flex items-center gap-1 justify-end">
                      <Cpu className="h-3 w-3" /> CPU Load
                    </span>
                    <span className={`font-mono font-bold ${router.cpu_usage_pct > 80 ? 'text-red-600' : 'text-slate-800'}`}>
                      {router.cpu_usage_pct}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Upstream Backhauls */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
            <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <Radio className="h-4 w-4 text-[#cfa253]" /> Backhaul Circuits
            </h2>
            <span className="text-xs text-slate-500">{backhauls.length} Circuits Configured</span>
          </div>
          <div className="divide-y divide-slate-100">
            {backhauls.map((bh) => (
              <div key={bh.id} className="p-4 hover:bg-slate-50 transition-colors flex flex-col md:flex-row justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">{bh.provider}</span>
                    <span className="text-[11px] font-mono text-slate-400">{bh.identifier}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Location: {bh.locations?.name || 'Unassigned'}</p>
                </div>

                <div className="flex items-center gap-4 text-xs">
                  <div className="text-right">
                    <span className="text-slate-400 block mb-0.5">Ingestion</span>
                    <span className="font-mono font-bold text-slate-800">{bh.monthly_data_used_gb} GB</span>
                  </div>
                  <div className="w-px h-8 bg-slate-200 hidden md:block"></div>
                  <div className="text-right">
                    <span className="text-slate-400 block mb-0.5 flex items-center gap-1 justify-end">
                      <Activity className="h-3 w-3" /> Latency
                    </span>
                    <span className={`font-mono font-bold ${bh.current_latency_ms > 100 ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {bh.current_latency_ms} ms
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}