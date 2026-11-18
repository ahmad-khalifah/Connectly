import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Server, KeyRound, Terminal, ListChecks, CheckCircle2, Circle } from 'lucide-react';
import { db } from '@/lib/db/client';
import { isUuid } from '@/lib/admin/inputs';
import { activationBlockers, ROUTER_PUBLIC_COLUMNS, type ConnectionMethod, type Lifecycle } from '@/lib/network/routers';
import { buildSetupScript, buildDirectSetupLines, CONTROLLER_ADDRESS_PLACEHOLDER } from '@/lib/network/setup-script';
import { JOB_LABELS } from '@/lib/network/jobs';
import RouterActions from '../../router-actions';
import CopyBlock from '../../copy-block';
import HotspotCard from '../../hotspot-card';
import { HOTSPOT_COLUMNS, hotspotState, type HotspotRow } from '@/lib/network/hotspot';
import { LifecycleBadge, HealthBadge, JobStatusBadge, fmtTime } from '../../badges';

export const dynamic = 'force-dynamic';

export default async function RouterDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const [{ data: r }, { data: settings }, { data: jobs }, { data: hotspotRaw }] = await Promise.all([
    db.from('routers').select(`${ROUTER_PUBLIC_COLUMNS}, locations(name)`).eq('id', id).maybeSingle(),
    db.from('network_settings').select('controller_endpoint, controller_wg_public_key, controller_tunnel_ip, tunnel_cidr, portal_url, walled_garden_hosts').maybeSingle(),
    db.from('controller_jobs')
      .select('id, kind, status, attempts, max_attempts, created_at, run_after, finished_at, last_error, requested_by')
      .eq('router_id', id).order('created_at', { ascending: false }).limit(10),
    db.from('router_hotspot_settings').select(HOTSPOT_COLUMNS).eq('router_id', id).maybeSingle(),
  ]);
  if (!r) notFound();

  const loc = Array.isArray(r.locations) ? r.locations[0] : r.locations;
  const hotspot = (hotspotRaw as HotspotRow | null) ?? null;
  const hState = hotspotState(hotspot);
  const lifecycle = r.lifecycle_status as Lifecycle;
  const hasCredential = Boolean(r.credential_key_id);
  const blockers = activationBlockers({
    lifecycle_status: lifecycle,
    connection_method: r.connection_method as ConnectionMethod,
    has_credential: hasCredential,
    wg_public_key: r.wg_public_key,
    tunnel_ip: r.tunnel_ip,
    management_ip: r.management_ip,
    last_test_at: r.last_test_at,
    last_test_result: r.last_test_result as { ok?: unknown } | null,
    hotspot: hotspot ? { version: hotspot.version, applied_version: hotspot.applied_version } : null,
  });
  const testPending = (jobs ?? []).some((j) => j.kind === 'router.test' && (j.status === 'queued' || j.status === 'running'));
  const setup = settings
    ? buildSetupScript({
        router: { id: r.id, name: r.name ?? r.identifier, identifier: r.identifier, connection_method: r.connection_method, tunnel_ip: r.tunnel_ip, wg_public_key: r.wg_public_key },
        settings: { controller_endpoint: settings.controller_endpoint, controller_wg_public_key: settings.controller_wg_public_key, controller_tunnel_ip: String(settings.controller_tunnel_ip), tunnel_cidr: String(settings.tunnel_cidr) },
      })
    : null;
  const test = r.last_test_result as { ok?: boolean; routeros_version?: string; board?: string; error?: string } | null;
  const hotspotPending = (jobs ?? []).some((j) => j.kind === 'router.configure_hotspot' && (j.status === 'queued' || j.status === 'running'));
  const testPassed = test?.ok === true;
  const steps = [
    { label: 'Registered in the portal', done: true },
    { label: r.connection_method === 'wireguard' ? 'Engineer pasted the set-up script; router joined the tunnel' : 'Router reachable on its management address', done: testPassed },
    { label: 'API credential stored', done: hasCredential },
    { label: 'Test Connection passed', done: testPassed },
    { label: 'Hotspot settings applied', done: hState === 'applied' },
    { label: 'Activated: selling plans', done: lifecycle === 'active' },
  ];
  const nextStep = steps.find((s) => !s.done);

  return (
    <div className="space-y-6">
      <Link href="/admin/network" className="text-sm font-bold text-slate-500 hover:text-[#6d1825]">&larr; Back to Network</Link>

      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2"><Server className="h-6 w-6 text-[#6d1825]" /> {r.name ?? r.identifier}</h1>
          <p className="text-sm text-slate-500"><span className="font-mono">{r.identifier}</span> · {loc?.name ?? '—'} · {r.model ?? 'model not recorded'}</p>
        </div>
        <div className="flex items-center gap-2">
          <LifecycleBadge value={lifecycle} />
          {(lifecycle === 'registered' || lifecycle === 'suspended') && (
            <Link href={`/admin/network/routers/${r.id}/edit`} className="text-sm font-semibold text-[#6d1825] hover:underline">Edit</Link>
          )}
        </div>
      </div>

      {lifecycle !== 'retired' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
          <h2 className="text-sm font-bold text-slate-900">Site set-up</h2>
          <ol className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
            {steps.map((s, i) => (
              <li key={s.label} className={`flex items-start gap-2 ${s.done ? 'text-emerald-800' : s === nextStep ? 'text-slate-900 font-semibold' : 'text-slate-500'}`}>
                {s.done ? <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" /> : <Circle className="h-4 w-4 mt-0.5 shrink-0" />}
                <span>{i + 1}. {s.label}</span>
              </li>
            ))}
          </ol>
          {nextStep && <p className="text-xs text-slate-600">Next: {nextStep.label.toLowerCase()}.</p>}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <RouterActions routerId={r.id} lifecycle={lifecycle} hasCredential={hasCredential} activationBlockers={blockers} testPending={testPending} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Connection</p>
          <p>{r.connection_method === 'wireguard' ? 'WireGuard tunnel' : 'Direct HTTPS'}</p>
          <p className="font-mono text-xs">{r.connection_method === 'wireguard' ? `tunnel ${r.tunnel_ip ?? '—'}` : r.management_ip}</p>
          {r.connection_method === 'wireguard' && (
            <p className="font-mono text-[11px] text-slate-500 break-all">{r.wg_public_key ? `key ${r.wg_public_key}` : 'router key not added yet'}</p>
          )}
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Health</p>
          <HealthBadge value={r.status} lastSeen={r.last_seen_at} lifecycle={lifecycle} />
          <p className="text-xs text-slate-500">RouterOS {r.routeros_version ?? '—'} · {r.board_name ?? 'board unknown'}</p>
          <p className="text-xs">
            Last test: {r.last_test_at ? <>{test?.ok ? <span className="text-emerald-700 font-semibold">passed</span> : <span className="text-red-700 font-semibold">failed</span>} {fmtTime(r.last_test_at)}</> : 'never run'}
          </p>
          {test && !test.ok && test.error && <p className="text-xs text-red-700">{test.error}</p>}
          {r.last_error && <p className="text-xs text-red-700">Last error: {r.last_error}</p>}
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1"><KeyRound className="h-3.5 w-3.5" /> API credential</p>
          {hasCredential ? (
            <>
              <p className="font-semibold text-emerald-700">Stored, encrypted</p>
              <p className="text-xs text-slate-500">User <span className="font-mono">{r.api_user}</span> · key {r.credential_key_id}. Only the controller can read it; it is never shown.</p>
            </>
          ) : (
            <>
              <p className="font-semibold text-slate-600">Not generated yet</p>
              <p className="text-xs text-slate-500">Waiting for the controller to publish its key.</p>
            </>
          )}
        </div>
      </div>

      {lifecycle !== 'retired' && (
        <HotspotCard
          routerId={r.id}
          saved={hotspot ? { ...hotspot, gateway_cidr: String(hotspot.gateway_cidr) } : null}
          state={hState}
          appliedAtText={hotspot?.applied_at ? fmtTime(hotspot.applied_at) : null}
          applyPending={hotspotPending}
          canApply={Boolean(hotspot) && hasCredential}
          applyBlockedReason={!hotspot ? 'Save the settings first.' : !hasCredential ? 'Waiting for the API credential.' : null}
          portalUrl={settings?.portal_url ?? 'the payment page'}
          sharedWalledGarden={(settings?.walled_garden_hosts as string[] | null) ?? []}
          readOnly={false}
        />
      )}

      {r.connection_method === 'wireguard' && lifecycle !== 'retired' && setup && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2"><Terminal className="h-4 w-4 text-[#6d1825]" /> Engineer setup script</h2>
          {setup.ready ? (
            <p className="text-xs text-slate-600">Paste into the router&apos;s terminal. It contains no passwords.</p>
          ) : (
            <p className="text-xs text-amber-700">Not ready yet. Still needed: {setup.missing.join('; ')}.</p>
          )}
          <CopyBlock text={setup.script} />
        </div>
      )}

      {r.connection_method === 'direct_https' && lifecycle !== 'retired' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2"><Terminal className="h-4 w-4 text-[#6d1825]" /> Engineer set-up lines (direct router)</h2>
          {hasCredential ? (
            <p className="text-xs text-slate-600">
              Type these in the router&apos;s terminal, replacing <span className="font-mono">{CONTROLLER_ADDRESS_PLACEHOLDER}</span> with the address of the computer running
              the controller on this router&apos;s management network. They contain no password: the router collects its credential from the controller, which
              answers only this router&apos;s management address <span className="font-mono">{r.management_ip}</span>, and only on a private network.
            </p>
          ) : (
            <p className="text-xs text-amber-700">Issue the API credential first.</p>
          )}
          <CopyBlock text={buildDirectSetupLines({ id: r.id, identifier: r.identifier })} />
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
          <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2"><ListChecks className="h-4 w-4 text-[#6d1825]" /> Recent jobs</h2>
          <Link href={`/admin/network/jobs?router=${r.id}`} className="text-xs font-semibold text-[#6d1825] hover:underline">All jobs for this router</Link>
          {' · '}
          <Link href={`/admin/network/access?router=${r.id}`} className="text-xs font-semibold text-[#6d1825] hover:underline">Access grants on this router</Link>
        </div>
        {jobs?.length ? (
          <table className="w-full min-w-[640px] text-left text-sm text-slate-600">
            <tbody className="divide-y divide-slate-100">
              {jobs.map((j) => (
                <tr key={j.id}>
                  <td className="px-4 py-2">{JOB_LABELS[j.kind] ?? j.kind}</td>
                  <td className="px-4 py-2"><JobStatusBadge value={j.status} /></td>
                  <td className="px-4 py-2 text-xs">{j.attempts}/{j.max_attempts} attempts</td>
                  <td className="px-4 py-2 text-xs">{fmtTime(j.created_at)}</td>
                  <td className="px-4 py-2 text-xs text-red-700 max-w-xs truncate" title={j.last_error ?? ''}>{j.last_error ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="p-4 text-sm text-slate-500">No jobs yet.</p>
        )}
      </div>
    </div>
  );
}
