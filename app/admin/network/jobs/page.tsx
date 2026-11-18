import Link from 'next/link';
import { db } from '@/lib/db/client';
import { isUuid } from '@/lib/admin/inputs';
import { JOB_KINDS, JOB_LABELS, JOB_STATUSES, isControllerLive } from '@/lib/network/jobs';
import JobActions from '../job-actions';
import { JobStatusBadge, fmtTime, ago } from '../badges';
import { PageHeader } from '@/components/admin/page-header';
import { EmptyRow, Pager, TableFrame, td, th, tr } from '@/components/admin/table';
import { Notice } from '@/components/ui/notice';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const PAGE = 50;
type Search = { status?: string; kind?: string; router?: string; page?: string };
const STATUS_WORD: Record<string, string> = { queued: 'Queued', running: 'Running', succeeded: 'Succeeded', failed: 'Retrying', dead: 'Gave up' };

export default async function JobsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const status = (JOB_STATUSES as readonly string[]).includes(sp.status ?? '') ? sp.status! : '';
  const kind = (JOB_KINDS as readonly string[]).includes(sp.kind ?? '') ? sp.kind! : '';
  const routerId = isUuid(sp.router) ? sp.router! : '';
  const page = Math.max(1, Number(sp.page) || 1);

  let q = db
    .from('controller_jobs')
    .select('id, kind, status, attempts, max_attempts, run_after, locked_by, locked_at, created_at, updated_at, finished_at, last_error, requested_by, routers(id, name, identifier)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * PAGE, page * PAGE - 1);
  if (status) q = q.eq('status', status);
  if (kind) q = q.eq('kind', kind);
  if (routerId) q = q.eq('router_id', routerId);

  const countFor = (s: string | null) => {
    let c = db.from('controller_jobs').select('id', { count: 'exact', head: true });
    if (s) c = c.eq('status', s);
    if (routerId) c = c.eq('router_id', routerId);
    return c;
  };

  const [{ data: jobs, count, error }, instancesRes, allCount, ...statusCounts] = await Promise.all([
    q,
    db.from('controller_instances').select('id, last_heartbeat_at').order('last_heartbeat_at', { ascending: false }).limit(1),
    countFor(null),
    ...JOB_STATUSES.map((s) => countFor(s)),
  ]);
  const totals = Object.fromEntries(JOB_STATUSES.map((s, i) => [s, statusCounts[i].count ?? 0]));
  const controller = instancesRes.data?.[0];
  const controllerLive = controller ? isControllerLive(controller.last_heartbeat_at) : false;
  const href = (patch: Partial<Search>) => {
    const p = new URLSearchParams();
    Object.entries({ status, kind, router: routerId, ...patch }).forEach(([k, v]) => v && p.set(k, String(v)));
    const s = p.toString();
    return s ? `/admin/network/jobs?${s}` : '/admin/network/jobs';
  };
  const pages = count ? Math.ceil(count / PAGE) : 1;
  const chip = (active: boolean) => cn('rounded-md px-3 py-1.5 text-[13px] font-semibold', active ? 'bg-brand text-white' : 'text-muted hover:bg-canvas hover:text-ink');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Controller jobs"
        description="Every action the controller takes on a router: tests, hotspot set-up, adding and removing WiFi codes. Failed jobs retry on their own with growing delays."
      />

      <Notice tone={controllerLive ? 'ok' : 'warn'} title={controllerLive ? `Controller running, heartbeat ${ago(controller!.last_heartbeat_at)}` : controller ? `Controller not responding since ${fmtTime(controller.last_heartbeat_at)}` : 'Controller not started yet'}>
        {controllerLive ? controller!.id : 'Jobs are kept and run when it is back.'}
      </Notice>

      <div className="space-y-2">
        <nav aria-label="Status" className="inline-flex flex-wrap rounded-[var(--radius-control)] border border-line bg-surface p-0.5">
          <Link href={href({ status: '', page: '' })} aria-current={!status ? 'true' : undefined} className={chip(!status)}>All ({allCount.count ?? 0})</Link>
          {JOB_STATUSES.map((s) => (
            <Link key={s} href={href({ status: s, page: '' })} aria-current={status === s ? 'true' : undefined} className={chip(status === s)}>{STATUS_WORD[s] ?? s} ({totals[s]})</Link>
          ))}
        </nav>
        <nav aria-label="Kind" className="flex flex-wrap gap-2 text-[13px]">
          {JOB_KINDS.map((k) => (
            <Link key={k} href={href({ kind: kind === k ? '' : k, page: '' })} aria-current={kind === k ? 'true' : undefined}
              className={cn('rounded-md border px-2.5 py-1 font-semibold', kind === k ? 'border-brand bg-brand-soft text-brand' : 'border-line text-muted hover:text-ink')}>
              {JOB_LABELS[k]}
            </Link>
          ))}
          {routerId && <Link href={href({ router: '' })} className="px-2.5 py-1 font-semibold text-brand hover:underline">Show all routers</Link>}
        </nav>
      </div>

      {error && <Notice tone="bad" title="Jobs could not be loaded">Refresh to try again.</Notice>}

      <TableFrame footer={<Pager page={page} pages={pages} total={count ?? 0} noun="job" href={(n) => href({ page: String(n) })} />}>
        <thead>
          <tr>
            <th className={th}>Created</th><th className={th}>Job</th><th className={th}>Router</th><th className={th}>Status</th>
            <th className={th}>Attempts</th><th className={th}>Next try or finished</th><th className={th}>Last error</th><th className={th}>Asked by</th><th className={th}><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {(jobs ?? []).length === 0 && <EmptyRow cols={9}>No jobs match.</EmptyRow>}
          {(jobs ?? []).map((j) => {
            const r = Array.isArray(j.routers) ? j.routers[0] : j.routers;
            return (
              <tr key={j.id} className={tr}>
                <td className={`${td} tnum whitespace-nowrap text-muted`}>{fmtTime(j.created_at)}</td>
                <td className={td}>{JOB_LABELS[j.kind] ?? j.kind}<span className="block text-[12px] text-subtle">{j.id.slice(0, 8)}</span></td>
                <td className={td}>{r ? <Link href={`/admin/network/routers/${r.id}`} className="hover:text-brand">{r.name ?? r.identifier}</Link> : '—'}</td>
                <td className={td}><JobStatusBadge value={j.status} />{j.status === 'running' && j.locked_by && <span className="mt-1 block text-[12px] text-subtle">{j.locked_by}</span>}</td>
                <td className={`${td} tnum`}>{j.attempts} of {j.max_attempts}</td>
                <td className={`${td} tnum whitespace-nowrap text-[13px] text-muted`}>
                  {j.finished_at ? `Finished ${fmtTime(j.finished_at)}` : j.status === 'running' ? `Started ${fmtTime(j.locked_at)}` : `Next try ${fmtTime(j.run_after)}`}
                </td>
                <td className={`${td} max-w-[240px] break-words text-[13px] text-bad`}>{j.last_error ?? ''}</td>
                <td className={`${td} text-[13px] text-muted`}>{j.requested_by ?? '—'}</td>
                <td className={`${td} text-right`}><JobActions jobId={j.id} status={j.status} /></td>
              </tr>
            );
          })}
        </tbody>
      </TableFrame>
    </div>
  );
}
