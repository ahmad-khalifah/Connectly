import Link from 'next/link';
import { Network, Server, Plus, ListChecks, Cpu, AlertTriangle, Radio, KeyRound } from 'lucide-react';
import { db } from '@/lib/db/client';
import { isControllerLive } from '@/lib/network/jobs';
import { LifecycleBadge, HealthBadge, fmtTime, ago } from './badges';

export const dynamic = 'force-dynamic';

type RouterRow = {
  id: string; name: string | null; identifier: string; lifecycle_status: string; status: string | null;
  connection_method: string; tunnel_ip: string | null; last_seen_at: string | null; last_test_at: string | null;
  last_test_result: { ok?: boolean } | null; locations: { name: string } | { name: string }[] | null;
};

export default async function NetworkPage() {
  const [routersRes, instancesRes, settingsRes, jobsRes, backhaulRes] = await Promise.all([
    db.from('routers')
      .select('id, name, identifier, lifecycle_status, status, connection_method, tunnel_ip, last_seen_at, last_test_at, last_test_result, locations(name)')
      .order('created_at', { ascending: false }),
    db.from('controller_instances').select('id, version, started_at, last_heartbeat_at, info').order('last_heartbeat_at', { ascending: false }).limit(3),
    db.from('network_settings').select('controller_endpoint, controller_wg_public_key, credential_key_id, tunnel_cidr').maybeSingle(),
    db.from('controller_jobs').select('status'),
    db.from('backhauls').select('id, provider, identifier, status, current_latency_ms, locations(name)').order('provider'),
  ]);

  const routers = (routersRes.data ?? []) as RouterRow[];
  const instances = instancesRes.data ?? [];
  const settings = settingsRes.data;
  const jobCounts = (jobsRes.data ?? []).reduce<Record<string, number>>((acc, j) => ((acc[j.status] = (acc[j.status] ?? 0) + 1), acc), {});
  const live = instances.find((i) => isControllerLive(i.last_heartbeat_at));
  const loadError = routersRes.error || instancesRes.error || settingsRes.error || jobsRes.error;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Network className="h-6 w-6 text-[#6d1825]" /> Network
          </h1>
          <p className="text-sm text-slate-500">Routers, the Network Controller and every action it takes on them.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/network/access" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            <KeyRound className="h-4 w-4" /> Access grants
          </Link>
          <Link href="/admin/network/jobs" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            <ListChecks className="h-4 w-4" /> Controller jobs
          </Link>
          <Link href="/admin/network/routers/new" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#6d1825] text-white text-sm font-semibold hover:bg-[#5a141e]">
            <Plus className="h-4 w-4" /> Register router
          </Link>
        </div>
      </div>

      {loadError && (
        <div className="p-4 rounded-lg border border-red-200 bg-red-50 text-sm text-red-700">Some network data could not be loaded. Check the server logs.</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5"><Cpu className="h-3.5 w-3.5" /> Controller</p>
          {live ? (
            <>
              <p className="mt-2 text-lg font-bold text-emerald-700">Running</p>
              {(live.info as { production?: boolean; environment?: string } | null)?.production !== true && (
                <p className="text-xs font-semibold text-amber-700">Test controller ({(live.info as { environment?: string } | null)?.environment ?? 'unknown'}): not for paying customers</p>
              )}
              <p className="text-xs text-slate-500">{live.id} · v{live.version ?? '?'} · heartbeat {ago(live.last_heartbeat_at)}</p>
            </>
          ) : (
            <>
              <p className="mt-2 text-lg font-bold text-slate-500">{instances.length ? 'Not responding' : 'Not deployed yet'}</p>
              <p className="text-xs text-slate-500">
                {instances.length ? `Last heartbeat ${ago(instances[0].last_heartbeat_at)}. Jobs wait in the queue until it is back.` : 'Router actions wait in the queue until the controller runs.'}
              </p>
            </>
          )}
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5"><ListChecks className="h-3.5 w-3.5" /> Jobs</p>
          <p className="mt-2 text-sm text-slate-700">
            <span className="font-bold">{jobCounts.queued ?? 0}</span> queued · <span className="font-bold">{jobCounts.running ?? 0}</span> running ·{' '}
            <span className="font-bold text-amber-700">{jobCounts.failed ?? 0}</span> retrying · <span className="font-bold text-red-700">{jobCounts.dead ?? 0}</span> failed
          </p>
          <Link href="/admin/network/jobs" className="text-xs font-semibold text-[#6d1825] hover:underline">Open the jobs dashboard</Link>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5"><Radio className="h-3.5 w-3.5" /> Tunnel</p>
          <p className="mt-2 text-sm text-slate-700">Range <span className="font-mono">{settings?.tunnel_cidr ?? '—'}</span></p>
          <p className="text-xs text-slate-500">
            {settings?.controller_endpoint ? `Controller at ${settings.controller_endpoint}` : 'Controller address: set when the VPS is deployed'}
            {' · '}
            {settings?.credential_key_id ? `credential key ${settings.credential_key_id}` : 'no credential key yet'}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
          <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2"><Server className="h-4 w-4 text-[#6d1825]" /> Routers</h2>
          <span className="text-xs text-slate-500">{routers.length} registered</span>
        </div>
        {routers.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">No routers yet. Register one to start.</p>
        ) : (
          <table className="w-full min-w-[760px] text-left text-sm text-slate-600">
            <thead className="text-xs uppercase tracking-wider text-slate-500 border-b border-slate-200">
              <tr><th className="px-4 py-3">Router</th><th className="px-4 py-3">Location</th><th className="px-4 py-3">State</th><th className="px-4 py-3">Health</th><th className="px-4 py-3">Tunnel</th><th className="px-4 py-3">Last test</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {routers.map((r) => {
                const loc = Array.isArray(r.locations) ? r.locations[0] : r.locations;
                return (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link href={`/admin/network/routers/${r.id}`} className="font-semibold text-slate-900 hover:text-[#6d1825]">{r.name ?? r.identifier}</Link>
                      <div className="text-xs font-mono text-slate-500">{r.identifier}</div>
                    </td>
                    <td className="px-4 py-3">{loc?.name ?? '—'}</td>
                    <td className="px-4 py-3"><LifecycleBadge value={r.lifecycle_status} /></td>
                    <td className="px-4 py-3"><HealthBadge value={r.status} lastSeen={r.last_seen_at} /></td>
                    <td className="px-4 py-3 font-mono text-xs">{r.connection_method === 'wireguard' ? r.tunnel_ip ?? '—' : 'direct HTTPS'}</td>
                    <td className="px-4 py-3 text-xs">
                      {r.last_test_at ? <>{r.last_test_result?.ok ? <span className="text-emerald-700 font-semibold">Passed</span> : <span className="text-red-700 font-semibold">Failed</span>} {fmtTime(r.last_test_at)}</> : 'Never'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {(backhaulRes.data?.length ?? 0) > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50">
            <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-[#6d1825]" /> Backhaul circuits</h2>
          </div>
          <ul className="divide-y divide-slate-100 text-sm">
            {backhaulRes.data!.map((b) => {
              const loc = Array.isArray(b.locations) ? b.locations[0] : b.locations;
              return (
                <li key={b.id} className="px-4 py-3 flex justify-between">
                  <span><span className="font-semibold text-slate-900">{b.provider}</span> <span className="text-slate-500">· {loc?.name ?? '—'}</span></span>
                  <span className="text-xs text-slate-500">{b.status}{b.current_latency_ms != null ? ` · ${b.current_latency_ms} ms` : ''}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
