'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { isUuid } from '@/lib/admin/inputs';
import { JOB_KINDS, JOB_LABELS, JOB_STATUSES } from '@/lib/network/labels';
import JobActions from '../job-actions';
import { JobStatusBadge, fmtTime, ago } from '../badges';
import { PageHeader } from '@/components/admin/page-header';
import { EmptyRow, Pager, TableFrame, td, th, tr } from '@/components/admin/table';
import { Notice } from '@/components/ui/notice';
import { cn } from '@/lib/utils';
import { useAdminView, viewUrl, ViewState } from '@/components/admin/admin-data';

const PAGE = 50; // lib/admin/views.ts JOBS_PER_PAGE
type Search = { status?: string; kind?: string; router?: string; page?: string };
const STATUS_WORD: Record<string, string> = { queued: 'Queued', running: 'Running', succeeded: 'Succeeded', failed: 'Retrying', dead: 'Gave up' };

type Job = {
  id: string; kind: string; status: string; attempts: number; max_attempts: number; run_after: string | null; locked_by: string | null; locked_at: string | null;
  created_at: string; finished_at: string | null; last_error: string | null; requested_by: string | null;
  router: { id: string; name: string | null; identifier: string } | null;
};
type List = { jobs: Job[]; total: number; failed: boolean; controller: { id: string; heartbeat: string; live: boolean } | null };
type Counts = { all: number; byStatus: Record<string, number> };

export default function JobsView() {
  const sp = useSearchParams();
  const status = (JOB_STATUSES as readonly string[]).includes(sp.get('status') ?? '') ? sp.get('status')! : '';
  const kind = (JOB_KINDS as readonly string[]).includes(sp.get('kind') ?? '') ? sp.get('kind')! : '';
  const routerId = isUuid(sp.get('router')) ? sp.get('router')! : '';
  const page = Math.max(1, Number(sp.get('page')) || 1);

  const list = useAdminView<List>(viewUrl('jobs', { status, kind, router: routerId, page: String(page) }));
  const countsView = useAdminView<Counts>(viewUrl('job-counts', { router: routerId }));
  const counts = countsView.loaded.state === 'ready' ? countsView.loaded.data : null;

  const href = (patch: Partial<Search>) => {
    const p = new URLSearchParams();
    Object.entries({ status, kind, router: routerId, ...patch }).forEach(([k, v]) => v && p.set(k, String(v)));
    const s = p.toString();
    return s ? `/admin/network/jobs?${s}` : '/admin/network/jobs';
  };
  const chip = (active: boolean) => cn('rounded-md px-3 py-1.5 text-[13px] font-semibold', active ? 'bg-brand text-white' : 'text-muted hover:bg-canvas hover:text-ink');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Controller jobs"
        description="Every action the controller takes on a router: tests, hotspot set-up, adding and removing WiFi codes. Failed jobs retry on their own with growing delays."
      />

      {list.loaded.state === 'ready' && (() => {
        const controller = list.loaded.data.controller;
        return (
          <Notice tone={controller?.live ? 'ok' : 'warn'} title={controller?.live ? `Controller running, heartbeat ${ago(controller.heartbeat)}` : controller ? `Controller not responding since ${fmtTime(controller.heartbeat)}` : 'Controller not started yet'}>
            {controller?.live ? controller.id : 'Jobs are kept and run when it is back.'}
          </Notice>
        );
      })()}

      <div className="space-y-2">
        <nav aria-label="Status" className="inline-flex flex-wrap rounded-[var(--radius-control)] border border-line bg-surface p-0.5">
          <Link prefetch={false} href={href({ status: '', page: '' })} aria-current={!status ? 'true' : undefined} className={chip(!status)}>All{counts ? ` (${counts.all})` : ''}</Link>
          {JOB_STATUSES.map((s) => (
            <Link key={s} prefetch={false} href={href({ status: s, page: '' })} aria-current={status === s ? 'true' : undefined} className={chip(status === s)}>{STATUS_WORD[s] ?? s}{counts ? ` (${counts.byStatus[s] ?? 0})` : ''}</Link>
          ))}
        </nav>
        <nav aria-label="Kind" className="flex flex-wrap gap-2 text-[13px]">
          {JOB_KINDS.map((k) => (
            <Link key={k} prefetch={false} href={href({ kind: kind === k ? '' : k, page: '' })} aria-current={kind === k ? 'true' : undefined}
              className={cn('rounded-md border px-2.5 py-1 font-semibold', kind === k ? 'border-brand bg-brand-soft text-brand' : 'border-line text-muted hover:text-ink')}>
              {JOB_LABELS[k]}
            </Link>
          ))}
          {routerId && <Link prefetch={false} href={href({ router: '' })} className="px-2.5 py-1 font-semibold text-brand hover:underline">Show all routers</Link>}
        </nav>
      </div>

      <ViewState loaded={list.loaded} reload={list.reload}>
        {({ jobs, total, failed }) => (
          <>
      {failed && <Notice tone="bad" title="Jobs could not be loaded">Refresh to try again.</Notice>}

      <TableFrame footer={<Pager page={page} pages={Math.max(1, Math.ceil(total / PAGE))} total={total} noun="job" href={(n) => href({ page: String(n) })} />}>
        <thead>
          <tr>
            <th className={th}>Created</th><th className={th}>Job</th><th className={th}>Router</th><th className={th}>Status</th>
            <th className={th}>Attempts</th><th className={th}>Next try or finished</th><th className={th}>Last error</th><th className={th}>Asked by</th><th className={th}><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {jobs.length === 0 && <EmptyRow cols={9}>No jobs match.</EmptyRow>}
          {jobs.map((j) => {
            const r = j.router;
            return (
              <tr key={j.id} className={tr}>
                <td className={`${td} tnum whitespace-nowrap text-muted`}>{fmtTime(j.created_at)}</td>
                <td className={td}>{JOB_LABELS[j.kind] ?? j.kind}<span className="block text-[12px] text-subtle">{j.id.slice(0, 8)}</span></td>
                <td className={td}>{r ? <Link prefetch={false} href={`/admin/network/router?id=${r.id}`} className="hover:text-brand">{r.name ?? r.identifier}</Link> : '—'}</td>
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
          </>
        )}
      </ViewState>
    </div>
  );
}
