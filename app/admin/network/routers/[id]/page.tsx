import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Check } from 'lucide-react';
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
import { PageHeader } from '@/components/admin/page-header';
import { Panel } from '@/components/ui/panel';
import { Notice } from '@/components/ui/notice';
import { Badge } from '@/components/ui/badge';
import { EmptyRow, TableFrame, td, th, tr } from '@/components/admin/table';
import { cn } from '@/lib/utils';

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
      <PageHeader
        back={<Link href="/admin/network" className="font-semibold text-muted hover:text-brand">Routers</Link>}
        title={r.name ?? r.identifier}
        description={[r.identifier, loc?.name, r.model].filter(Boolean).join(', ')}
        actions={
          <>
            <LifecycleBadge value={lifecycle} />
            {(lifecycle === 'registered' || lifecycle === 'suspended') && (
              <Link href={`/admin/network/routers/${r.id}/edit`} className="text-sm font-semibold text-brand hover:underline">Edit</Link>
            )}
          </>
        }
      />

      {lifecycle !== 'retired' && (
        <Panel title="Site set-up" description={nextStep ? `Next: ${nextStep.label.toLowerCase()}.` : 'Done. This router is selling plans.'}>
          <ol className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {steps.map((s, i) => (
              <li key={s.label} className="flex items-start gap-2.5">
                <span className={cn('tnum mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
                  s.done ? 'bg-ok text-white' : s === nextStep ? 'bg-brand text-white' : 'border border-line-strong text-subtle')}>
                  {s.done ? <Check className="h-3 w-3" strokeWidth={3} /> : i + 1}
                </span>
                <span className={s.done ? 'text-ink' : s === nextStep ? 'font-semibold text-ink' : 'text-muted'}>{s.label}</span>
              </li>
            ))}
          </ol>
        </Panel>
      )}

      <Panel title="Actions">
        <RouterActions routerId={r.id} lifecycle={lifecycle} hasCredential={hasCredential} activationBlockers={blockers} testPending={testPending} />
      </Panel>

      <div className="grid gap-4 md:grid-cols-3">
        <Panel title="Connection">
          <div className="space-y-1 text-sm">
            <p className="font-semibold">{r.connection_method === 'wireguard' ? 'WireGuard tunnel' : 'Direct HTTPS on the local network'}</p>
            <p className="tnum text-muted">{r.connection_method === 'wireguard' ? `Tunnel address ${r.tunnel_ip ?? '—'}` : `Management address ${r.management_ip ?? '—'}`}</p>
            {r.connection_method === 'wireguard' && (
              <p className="break-all text-[12.5px] text-subtle">{r.wg_public_key ? `Router key ${r.wg_public_key}` : 'Router key not added yet'}</p>
            )}
          </div>
        </Panel>
        <Panel title="Health">
          <div className="space-y-1.5 text-sm">
            <HealthBadge value={r.status} lastSeen={r.last_seen_at} lifecycle={lifecycle} />
            <p className="text-muted">{r.routeros_version ? `RouterOS ${r.routeros_version}` : 'RouterOS version not read yet'}{r.board_name ? `, ${r.board_name}` : ''}</p>
            <p className="flex flex-wrap items-center gap-2">
              Last connection test: {r.last_test_at ? <>{test?.ok ? <Badge tone="ok">Passed</Badge> : <Badge tone="bad">Failed</Badge>}<span className="text-muted">{fmtTime(r.last_test_at)}</span></> : <span className="text-muted">never run</span>}
            </p>
            {test && !test.ok && test.error && <p className="text-[13px] text-bad">{test.error}</p>}
            {r.last_error && <p className="text-[13px] text-bad">Last error: {r.last_error}</p>}
          </div>
        </Panel>
        <Panel title="API credential">
          <div className="space-y-1 text-sm">
            {hasCredential ? (
              <>
                <p className="font-semibold text-ok">Stored, encrypted</p>
                <p className="text-[13px] text-muted">User {r.api_user}, key {r.credential_key_id}. Only the controller can read it; it is never shown.</p>
              </>
            ) : (
              <>
                <p className="font-semibold">Not issued yet</p>
                <p className="text-[13px] text-muted">Issue it from Actions once the controller has published its key.</p>
              </>
            )}
          </div>
        </Panel>
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
        <Panel title="Set-up script for the engineer" description={setup.ready ? "Paste into the router's terminal. It contains no passwords." : undefined}>
          {!setup.ready && <Notice tone="warn" className="mb-3" title="Not ready yet">Still needed: {setup.missing.join('; ')}.</Notice>}
          <CopyBlock text={setup.script} />
        </Panel>
      )}

      {r.connection_method === 'direct_https' && lifecycle !== 'retired' && (
        <Panel title="Set-up lines for the engineer" description="For a router reached directly on the site's private management network.">
          {hasCredential ? (
            <p className="mb-3 text-sm leading-relaxed text-muted">
              Type these in the router&apos;s terminal, replacing <span className="font-semibold text-ink">{CONTROLLER_ADDRESS_PLACEHOLDER}</span> with the address of the computer running
              the controller on this network. They contain no password: the router collects its credential from the controller, which answers only this router&apos;s
              management address ({r.management_ip}) and only on a private network.
            </p>
          ) : (
            <Notice tone="warn" className="mb-3" title="Issue the API credential first" />
          )}
          <CopyBlock text={buildDirectSetupLines({ id: r.id, identifier: r.identifier })} />
        </Panel>
      )}

      <section className="space-y-3" aria-labelledby="jobs">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="jobs" className="text-lg font-bold text-ink">Recent jobs</h2>
          <span className="flex gap-4 text-sm">
            <Link href={`/admin/network/jobs?router=${r.id}`} className="font-semibold text-brand hover:underline">All jobs for this router</Link>
            <Link href={`/admin/network/access?router=${r.id}`} className="font-semibold text-brand hover:underline">Access grants here</Link>
          </span>
        </div>
        <TableFrame>
          <thead><tr><th className={th}>Job</th><th className={th}>Status</th><th className={th}>Attempts</th><th className={th}>Created</th><th className={th}>Error</th></tr></thead>
          <tbody>
            {(jobs ?? []).map((j) => (
              <tr key={j.id} className={tr}>
                <td className={td}>{JOB_LABELS[j.kind] ?? j.kind}</td>
                <td className={td}><JobStatusBadge value={j.status} /></td>
                <td className={`${td} tnum`}>{j.attempts} of {j.max_attempts}</td>
                <td className={`${td} tnum whitespace-nowrap text-muted`}>{fmtTime(j.created_at)}</td>
                <td className={`${td} max-w-xs truncate text-[13px] text-bad`} title={j.last_error ?? ''}>{j.last_error ?? ''}</td>
              </tr>
            ))}
            {(jobs ?? []).length === 0 && <EmptyRow cols={5}>No jobs yet.</EmptyRow>}
          </tbody>
        </TableFrame>
      </section>
    </div>
  );
}
