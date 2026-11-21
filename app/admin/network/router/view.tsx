'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Check } from 'lucide-react';
import type { ConnectionMethod, Lifecycle } from '@/lib/network/routers';
import { CONTROLLER_ADDRESS_PLACEHOLDER, type SetupScript } from '@/lib/network/setup-script';
import { JOB_LABELS } from '@/lib/network/labels';
import type { HotspotState } from '@/lib/network/hotspot';
import RouterActions from '../router-actions';
import CopyBlock from '../copy-block';
import HotspotCard from '../hotspot-card';
import { LifecycleBadge, HealthBadge, JobStatusBadge, fmtTime } from '../badges';
import { PageHeader } from '@/components/admin/page-header';
import { Panel } from '@/components/ui/panel';
import { Notice } from '@/components/ui/notice';
import { Badge } from '@/components/ui/badge';
import { EmptyRow, TableFrame, td, th, tr } from '@/components/admin/table';
import { cn } from '@/lib/utils';
import { NotFoundNotice, useAdminView, viewUrl, ViewState } from '@/components/admin/admin-data';

type Hotspot = { lan_interface: string; gateway_cidr: string; dns_name: string; extra_walled_garden: string[]; version: number; applied_version: number | null; applied_at: string | null; last_error: string | null };
type Data = {
  router: {
    id: string; name: string; identifier: string; model: string | null; location: string | null; lifecycle: Lifecycle; status: string | null; last_seen_at: string | null;
    connection_method: ConnectionMethod; tunnel_ip: string | null; management_ip: string | null; wg_public_key: string | null;
    routeros_version: string | null; board_name: string | null; last_test_at: string | null; last_test_result: { ok?: boolean; error?: string } | null;
    last_error: string | null; api_user: string | null; credential_key_id: string | null;
  };
  hasCredential: boolean;
  blockers: string[];
  jobs: { id: string; kind: string; status: string; attempts: number; max_attempts: number; created_at: string; last_error: string | null }[];
  hotspot: Hotspot | null;
  hotspotState: HotspotState;
  portalUrl: string;
  sharedWalledGarden: string[];
  setup: SetupScript | null;
  directSetupLines: string | null;
};

export default function RouterView() {
  const id = useSearchParams().get('id');
  const { loaded, reload } = useAdminView<Data>(id ? viewUrl('router', { id }) : null);
  if (!id) return <NotFoundNotice what="Router" />;
  return <ViewState loaded={loaded} reload={reload} what="Router">{(d) => <RouterDetail {...d} />}</ViewState>;
}

function RouterDetail({ router: r, hasCredential, blockers, jobs, hotspot, hotspotState: hState, portalUrl, sharedWalledGarden, setup, directSetupLines }: Data) {
  const lifecycle = r.lifecycle;
  const testPending = jobs.some((j) => j.kind === 'router.test' && (j.status === 'queued' || j.status === 'running'));
  const test = r.last_test_result;
  const hotspotPending = jobs.some((j) => j.kind === 'router.configure_hotspot' && (j.status === 'queued' || j.status === 'running'));
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
        back={<Link prefetch={false} href="/admin/network" className="font-semibold text-muted hover:text-brand">Routers</Link>}
        title={r.name}
        description={[r.identifier, r.location, r.model].filter(Boolean).join(', ')}
        actions={
          <>
            <LifecycleBadge value={lifecycle} />
            {(lifecycle === 'registered' || lifecycle === 'suspended') && (
              <Link prefetch={false} href={`/admin/network/router/edit?id=${r.id}`} className="text-sm font-semibold text-brand hover:underline">Edit</Link>
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
          saved={hotspot}
          state={hState}
          appliedAtText={hotspot?.applied_at ? fmtTime(hotspot.applied_at) : null}
          applyPending={hotspotPending}
          canApply={Boolean(hotspot) && hasCredential}
          applyBlockedReason={!hotspot ? 'Save the settings first.' : !hasCredential ? 'Waiting for the API credential.' : null}
          portalUrl={portalUrl}
          sharedWalledGarden={sharedWalledGarden}
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
          <CopyBlock text={directSetupLines ?? ''} />
        </Panel>
      )}

      <section className="space-y-3" aria-labelledby="jobs">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="jobs" className="text-lg font-bold text-ink">Recent jobs</h2>
          <span className="flex gap-4 text-sm">
            <Link prefetch={false} href={`/admin/network/jobs?router=${r.id}`} className="font-semibold text-brand hover:underline">All jobs for this router</Link>
            <Link prefetch={false} href={`/admin/network/access?router=${r.id}`} className="font-semibold text-brand hover:underline">Access grants here</Link>
          </span>
        </div>
        <TableFrame>
          <thead><tr><th className={th}>Job</th><th className={th}>Status</th><th className={th}>Attempts</th><th className={th}>Created</th><th className={th}>Error</th></tr></thead>
          <tbody>
            {jobs.map((j) => (
              <tr key={j.id} className={tr}>
                <td className={td}>{JOB_LABELS[j.kind] ?? j.kind}</td>
                <td className={td}><JobStatusBadge value={j.status} /></td>
                <td className={`${td} tnum`}>{j.attempts} of {j.max_attempts}</td>
                <td className={`${td} tnum whitespace-nowrap text-muted`}>{fmtTime(j.created_at)}</td>
                <td className={`${td} max-w-xs truncate text-[13px] text-bad`} title={j.last_error ?? ''}>{j.last_error ?? ''}</td>
              </tr>
            ))}
            {jobs.length === 0 && <EmptyRow cols={5}>No jobs yet.</EmptyRow>}
          </tbody>
        </TableFrame>
      </section>
    </div>
  );
}
