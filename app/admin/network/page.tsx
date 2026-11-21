import Link from 'next/link';
import { db } from '@/lib/db/client';
import { isControllerLive } from '@/lib/network/jobs';
import { LifecycleBadge, HealthBadge, fmtTime, ago } from './badges';
import { loadAlerts } from '@/lib/admin/alerts';
import AlertsPanel from '../components/alerts-panel';
import { PageHeader } from '@/components/admin/page-header';
import { Stat, StatGrid } from '@/components/admin/stat-grid';
import { EmptyRow, TableFrame, td, th, tr } from '@/components/admin/table';
import { ButtonLink } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Notice } from '@/components/ui/notice';

export const dynamic = 'force-dynamic';

type RouterRow = {
  id: string; name: string | null; identifier: string; lifecycle_status: string; status: string | null;
  connection_method: string; tunnel_ip: string | null; management_ip: string | null; last_seen_at: string | null; last_test_at: string | null;
  last_test_result: { ok?: boolean } | null; locations: { name: string } | { name: string }[] | null;
};

export default async function RoutersPage() {
  const [routersRes, instancesRes, settingsRes, jobsRes, alerts] = await Promise.all([
    db.from('routers')
      .select('id, name, identifier, lifecycle_status, status, connection_method, tunnel_ip, management_ip, last_seen_at, last_test_at, last_test_result, locations(name)')
      .order('created_at', { ascending: false }),
    db.from('controller_instances').select('id, version, started_at, last_heartbeat_at, info').order('last_heartbeat_at', { ascending: false }).limit(3),
    db.from('network_settings').select('controller_endpoint, credential_key_id, tunnel_cidr').maybeSingle(),
    db.from('controller_jobs').select('status').in('status', ['queued', 'running', 'failed', 'dead']),
    loadAlerts(),
  ]);

  const routers = (routersRes.data ?? []) as RouterRow[];
  const instances = instancesRes.data ?? [];
  const settings = settingsRes.data;
  const jobCounts = (jobsRes.data ?? []).reduce<Record<string, number>>((acc, j) => ((acc[j.status] = (acc[j.status] ?? 0) + 1), acc), {});
  const live = instances.find((i) => isControllerLive(i.last_heartbeat_at));
  const info = (live?.info ?? null) as { production?: boolean; environment?: string } | null;
  const loadError = routersRes.error || instancesRes.error || settingsRes.error || jobsRes.error;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Routers"
        description="The MikroTik routers at each site, and the Network Controller that sets them up, adds and removes customer codes, and checks their health."
        actions={<ButtonLink href="/admin/network/routers/new">Register a router</ButtonLink>}
      />
      {loadError && <Notice tone="bad" title="Some network data could not be loaded">Refresh to try again.</Notice>}

      <StatGrid cols={3}>
        <Stat
          label="Controller"
          value={live ? 'Running' : instances.length ? 'Not responding' : 'Not started'}
          tone={live ? 'ok' : 'bad'}
          note={live
            ? `${live.id}, version ${live.version ?? '?'}, heartbeat ${ago(live.last_heartbeat_at)}${info?.production !== true ? `. Test controller (${info?.environment ?? 'unknown'}): not for paying customers` : ''}`
            : instances.length ? `Last heartbeat ${ago(instances[0].last_heartbeat_at)}. Router actions wait in the queue until it is back.` : 'Router actions wait in the queue until it runs.'}
        />
        <Stat
          label="Router jobs waiting"
          value={(jobCounts.queued ?? 0) + (jobCounts.running ?? 0) + (jobCounts.failed ?? 0)}
          note={<>{jobCounts.failed ?? 0} retrying, {jobCounts.dead ?? 0} gave up. <Link href="/admin/network/jobs" className="font-semibold text-brand hover:underline">Open jobs</Link></>}
          tone={(jobCounts.dead ?? 0) > 0 ? 'bad' : undefined}
        />
        <Stat
          label="Connection"
          value={settings?.controller_endpoint ? 'WireGuard' : 'Local network'}
          note={`${settings?.controller_endpoint ? `Controller at ${settings.controller_endpoint}` : 'No public controller address yet (set when a server is deployed)'}. Tunnel range ${settings?.tunnel_cidr ?? '—'}${settings?.credential_key_id ? `, credential key ${settings.credential_key_id}` : ', no credential key yet'}.`}
        />
      </StatGrid>

      <AlertsPanel alerts={alerts} quietText="No network problems found." />

      <TableFrame>
        <thead>
          <tr>
            <th className={th}>Router</th>
            <th className={th}>Location</th>
            <th className={th}>Stage</th>
            <th className={th}>Health</th>
            <th className={th}>Reached by</th>
            <th className={th}>Last connection test</th>
          </tr>
        </thead>
        <tbody>
          {routers.map((r) => {
            const loc = Array.isArray(r.locations) ? r.locations[0] : r.locations;
            return (
              <tr key={r.id} className={tr}>
                <td className={td}>
                  <Link href={`/admin/network/routers/${r.id}`} className="font-semibold text-ink hover:text-brand">{r.name ?? r.identifier}</Link>
                  <span className="block text-[12.5px] text-muted">{r.identifier}</span>
                </td>
                <td className={td}>{loc?.name ?? '—'}</td>
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
    </div>
  );
}
