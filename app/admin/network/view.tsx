'use client';

import Link from 'next/link';
import type { Alert } from '@/lib/admin/alerts';
import { LifecycleBadge, HealthBadge, fmtTime, ago } from './badges';
import AlertsPanel from '../components/alerts-panel';
import { PageHeader } from '@/components/admin/page-header';
import { Stat, StatGrid } from '@/components/admin/stat-grid';
import { EmptyRow, TableFrame, td, th, tr } from '@/components/admin/table';
import { ButtonLink } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Notice } from '@/components/ui/notice';
import { useAdminView, viewUrl, ViewState } from '@/components/admin/admin-data';

type RouterRow = {
  id: string; name: string | null; identifier: string; lifecycle_status: string; status: string | null;
  connection_method: string; tunnel_ip: string | null; management_ip: string | null; last_seen_at: string | null; last_test_at: string | null;
  last_test_result: { ok?: boolean } | null; location: string | null;
};
type Data = {
  routers: RouterRow[];
  controller:
    | { state: 'running'; id: string; version: string | null; heartbeat: string; info: { production?: boolean; environment?: string } | null }
    | { state: 'stopped'; heartbeat: string }
    | { state: 'never' };
  settings: { controller_endpoint: string | null; credential_key_id: string | null; tunnel_cidr: string | null } | null;
  jobCounts: Record<string, number>;
  failed: boolean;
};

export default function RoutersView() {
  const { loaded, reload } = useAdminView<Data>(viewUrl('network'));
  const alerts = useAdminView<Alert[]>(viewUrl('alerts'));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Routers"
        description="The routers at each location and whether they are working."
        actions={<ButtonLink href="/admin/network/routers/new">Register a router</ButtonLink>}
      />
      <ViewState loaded={loaded} reload={reload}>
        {({ routers, controller, settings, jobCounts, failed }) => (
          <>
      {failed && <Notice tone="bad" title="Some network data could not be loaded">Refresh to try again.</Notice>}

      {alerts.loaded.state === 'ready' && <AlertsPanel alerts={alerts.loaded.data} quietText="Everything is working. Customers can pay and get online." />}

      <StatGrid cols={2}>
        <Stat
          label="Routers online"
          value={`${routers.filter((r) => r.lifecycle_status === 'active' && r.status === 'online').length} of ${routers.filter((r) => r.lifecycle_status === 'active').length}`}
          tone={routers.some((r) => r.lifecycle_status === 'active' && r.status !== 'online') ? 'bad' : 'ok'}
          note="Routers that are on and have reported in recently."
        />
        <Stat
          label="Router tasks waiting"
          value={(jobCounts.queued ?? 0) + (jobCounts.running ?? 0) + (jobCounts.failed ?? 0)}
          note={<>{jobCounts.failed ?? 0} retrying, {jobCounts.dead ?? 0} gave up. <Link prefetch={false} href="/admin/network/jobs" className="font-semibold text-brand hover:underline">See all</Link></>}
          tone={(jobCounts.dead ?? 0) > 0 ? 'bad' : undefined}
        />
      </StatGrid>

      <TableFrame>
        <thead>
          <tr>
            <th className={th}>Router</th>
            <th className={th}>Location</th>
            <th className={th}>Status</th>
            <th className={th}>Working</th>
            <th className={th}>Connected</th>
            <th className={th}>Last check</th>
          </tr>
        </thead>
        <tbody>
          {routers.map((r) => {
            return (
              <tr key={r.id} className={tr}>
                <td className={td}>
                  <Link prefetch={false} href={`/admin/network/router?id=${r.id}`} className="font-semibold text-ink hover:text-brand">{r.name ?? r.identifier}</Link>
                  <span className="block text-[12.5px] text-muted">{r.identifier}</span>
                </td>
                <td className={td}>{r.location ?? '—'}</td>
                <td className={td}><LifecycleBadge value={r.lifecycle_status} /></td>
                <td className={td}><HealthBadge value={r.status} lastSeen={r.last_seen_at} lifecycle={r.lifecycle_status} /></td>
                <td className={`${td} tnum text-[13px]`}>{r.connection_method === 'wireguard' ? `Tunnel ${r.tunnel_ip ?? '—'}` : `Direct, ${r.management_ip ?? '—'}`}</td>
                <td className={`${td} text-[13px]`}>
                  {r.last_test_at ? <span className="inline-flex items-center gap-2">{r.last_test_result?.ok ? <Badge tone="ok">Passed</Badge> : <Badge tone="bad">Failed</Badge>}<span className="text-muted">{fmtTime(r.last_test_at)}</span></span> : <span className="text-muted">Never</span>}
                </td>
              </tr>
            );
          })}
          {routers.length === 0 && <EmptyRow cols={6}>No routers yet. Register the first one to start.</EmptyRow>}
        </tbody>
      </TableFrame>

      <details className="rounded-[var(--radius-panel)] border border-line bg-surface">
        <summary className="min-h-12 cursor-pointer list-none px-5 py-3.5 text-sm font-semibold text-ink">Technical details</summary>
        <dl className="grid gap-x-8 gap-y-3 border-t border-line px-5 py-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="font-semibold text-ink">Old network controller</dt>
            <dd className="mt-0.5 text-muted">
              {controller.state === 'running'
                ? `Running, last heard ${ago(controller.heartbeat)}.`
                : controller.state === 'stopped' ? `Stopped (last heard ${ago(controller.heartbeat)}). Not needed while routers run their own agent.` : 'Not started. Not needed while routers run their own agent.'}
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-ink">Connection method</dt>
            <dd className="mt-0.5 text-muted">
              {settings?.controller_endpoint ? `Tunnel to ${settings.controller_endpoint}` : 'Local network'}. Tunnel range {settings?.tunnel_cidr ?? '—'}{settings?.credential_key_id ? `, key ${settings.credential_key_id}` : ''}.
            </dd>
          </div>
        </dl>
      </details>
          </>
        )}
      </ViewState>
    </div>
  );
}
