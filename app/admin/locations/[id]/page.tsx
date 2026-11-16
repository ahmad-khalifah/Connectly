import { db } from '@/lib/db/client';
import { 
  MapPin, Router as RouterIcon, Wifi, Radio, ArrowDown, ArrowUp, 
  Clock
} from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Pencil, QrCode, Receipt } from 'lucide-react';
import { appUrl } from '@/lib/env';
import { isUuid } from '@/lib/admin/inputs';

export const dynamic = 'force-dynamic';

export default async function LocationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const [locationRes, backhaulRes, routersRes, apRes, sessionsRes, purchasesRes, plansRes] = await Promise.all([
    db.from('locations').select('*, institutions(name)').eq('id', id).single(),
    db.from('backhauls').select('*').eq('location_id', id),
    db.from('routers').select('id, name, identifier, lifecycle_status, status, model, tunnel_ip, management_ip, api_ip, uptime_seconds, cpu_usage_pct, memory_usage_pct, wan_status, last_heartbeat, last_seen_at, is_online').eq('location_id', id),
    db.from('access_points').select('*').eq('location_id', id),
    db.from('network_sessions').select('id', { count: 'exact' }).eq('location_id', id).eq('status', 'active'),
    db.from('purchases')
      .select('id, reference, status, amount_paid, amount_kobo, net_amount_ngn, created_at, paid_at, expires_at, plans(name)')
      .eq('location_id', id).order('created_at', { ascending: false }).limit(10),
    db.from('plans').select('id, name, price_kobo, allowed_location_ids').eq('is_active', true).order('price_kobo'),
  ]);

  const location = locationRes.data;
  if (!location) notFound();

  const { data: paidRows } = await db.from('purchases').select('amount_paid, net_amount_ngn').eq('location_id', id).eq('status', 'paid');
  const paidRevenue = (paidRows ?? []).reduce((acc, p) => acc + Number(p.amount_paid || p.net_amount_ngn || 0), 0);
  const plansHere = (plansRes.data ?? []).filter((p) => !p.allowed_location_ids?.length || p.allowed_location_ids.includes(id));
  const portalLink = `${appUrl()}/connect?loc=${location.slug}`;

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
        <div className="flex flex-wrap items-center gap-3">
          {location.is_active === false && (
            <span className="px-3 py-1 rounded-full text-xs font-bold uppercase bg-slate-100 text-slate-600 border border-slate-200">Not accepting payments</span>
          )}
          <Link href={`/admin/locations/${id}/edit`}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#6d1825] rounded-lg hover:bg-[#5a141e]">
            <Pencil className="h-3.5 w-3.5" /> Edit
          </Link>
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

      {/* Sales: portal link, plans on sale, recent purchases */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <div>
            <span className="text-xs text-slate-400 block mb-1">Paid revenue (gross)</span>
            <p className="text-2xl font-bold text-slate-900 font-mono">₦{paidRevenue.toLocaleString('en-NG')}</p>
          </div>
          <div>
            <span className="text-xs text-slate-400 block mb-1 flex items-center gap-1"><QrCode className="h-3.5 w-3.5" /> Portal link</span>
            <a href={portalLink} target="_blank" rel="noreferrer" className="text-xs font-mono font-bold text-[#6d1825] break-all hover:underline">{portalLink}</a>
          </div>
          <div>
            <span className="text-xs text-slate-400 block mb-1">Plans on sale here</span>
            {plansHere.length === 0 ? (
              <p className="text-xs text-red-600">No active plan is available at this location.</p>
            ) : (
              <ul className="text-sm text-slate-700 space-y-1">
                {plansHere.map((p) => (
                  <li key={p.id} className="flex justify-between"><span>{p.name}</span><span className="font-mono">₦{(p.price_kobo / 100).toLocaleString('en-NG')}</span></li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
            <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <Receipt className="h-4 w-4 text-[#6d1825]" /> Recent purchases
            </h2>
            <Link href="/admin/transactions" className="text-xs font-semibold text-slate-500 hover:text-[#6d1825]">All transactions</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-100">
                {(purchasesRes.data ?? []).map((p) => {
                  const plan = Array.isArray(p.plans) ? p.plans[0] : p.plans;
                  const amount = p.status === 'paid' ? Number(p.amount_paid || p.net_amount_ngn || 0) : Number(p.amount_kobo ?? 0) / 100 || Number(p.net_amount_ngn || 0);
                  return (
                    <tr key={p.id}>
                      <td className="px-4 py-2 text-slate-500 whitespace-nowrap">{new Date(p.created_at).toLocaleString('en-NG', { dateStyle: 'short', timeStyle: 'short' })}</td>
                      <td className="px-4 py-2 text-slate-900">{plan?.name ?? '—'}</td>
                      <td className="px-4 py-2 font-mono">₦{amount.toLocaleString('en-NG')}</td>
                      <td className="px-4 py-2"><span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${p.status === 'paid' ? 'bg-emerald-50 text-emerald-700' : p.status === 'pending' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>{p.status}</span></td>
                    </tr>
                  );
                })}
                {(purchasesRes.data ?? []).length === 0 && (
                  <tr><td className="p-6 text-center text-xs text-slate-400">No purchases at this location yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
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