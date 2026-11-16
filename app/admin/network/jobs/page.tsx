import Link from 'next/link';
import { ListChecks } from 'lucide-react';
import { db } from '@/lib/db/client';
import { isUuid } from '@/lib/admin/inputs';
import { JOB_KINDS, JOB_LABELS, JOB_STATUSES, isControllerLive } from '@/lib/network/jobs';
import JobActions from '../job-actions';
import { JobStatusBadge, fmtTime, ago } from '../badges';

export const dynamic = 'force-dynamic';

const PAGE = 50;
type Search = { status?: string; kind?: string; router?: string; page?: string };

export default async function JobsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const status = (JOB_STATUSES as readonly string[]).includes(sp.status ?? '') ? sp.status! : '';
  const kind = (JOB_KINDS as readonly string[]).includes(sp.kind ?? '') ? sp.kind! : '';
  const routerId = isUuid(sp.router) ? sp.router! : '';
  const page = Math.max(1, Number(sp.page) || 1);

  let q = db
    .from('controller_jobs')
    .select('id, kind, status, attempts, max_attempts, run_after, locked_by, locked_at, created_at, updated_at, finished_at, last_error, requested_by, idempotency_key, routers(id, name, identifier)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * PAGE, page * PAGE - 1);
  if (status) q = q.eq('status', status);
  if (kind) q = q.eq('kind', kind);
  if (routerId) q = q.eq('router_id', routerId);

  const [{ data: jobs, count, error }, { data: all }, { data: instances }] = await Promise.all([
    q,
    db.from('controller_jobs').select('status'),
    db.from('controller_instances').select('id, last_heartbeat_at').order('last_heartbeat_at', { ascending: false }).limit(1),
  ]);
  const totals = (all ?? []).reduce<Record<string, number>>((acc, j) => ((acc[j.status] = (acc[j.status] ?? 0) + 1), acc), {});
  const controller = instances?.[0];
  const controllerLive = controller ? isControllerLive(controller.last_heartbeat_at) : false;
  const href = (patch: Partial<Search>) => {
    const p = new URLSearchParams();
    const next = { status, kind, router: routerId, ...patch };
    Object.entries(next).forEach(([k, v]) => v && p.set(k, String(v)));
    const s = p.toString();
    return s ? `/admin/network/jobs?${s}` : '/admin/network/jobs';
  };
  const pages = count ? Math.ceil(count / PAGE) : 1;

  return (
    <div className="space-y-6">
      <Link href="/admin/network" className="text-sm font-bold text-slate-500 hover:text-[#6d1825]">&larr; Back to Network</Link>
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2"><ListChecks className="h-6 w-6 text-[#6d1825]" /> Controller jobs</h1>
        <p className="text-sm text-slate-500">Every action the controller takes on a router: provisioning, revoking, tests. Failed jobs retry on their own with growing delays.</p>
      </div>

      <div className={`p-3 rounded-lg border text-sm ${controllerLive ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
        {controllerLive
          ? `Controller running (${controller!.id}), heartbeat ${ago(controller!.last_heartbeat_at)}.`
          : controller
            ? `Controller not responding since ${fmtTime(controller.last_heartbeat_at)}. Jobs are kept and run when it reconnects.`
            : 'Controller not deployed yet. Jobs are kept in the queue and run once it is.'}
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <Link href={href({ status: '', page: '' })} className={`px-3 py-1.5 rounded-full border ${!status ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-300 text-slate-700'}`}>
          All ({(all ?? []).length})
        </Link>
        {JOB_STATUSES.map((s) => (
          <Link key={s} href={href({ status: s, page: '' })} className={`px-3 py-1.5 rounded-full border ${status === s ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-300 text-slate-700'}`}>
            {s === 'failed' ? 'retrying' : s === 'dead' ? 'failed' : s} ({totals[s] ?? 0})
          </Link>
        ))}
        <span className="mx-1 text-slate-300">|</span>
        {JOB_KINDS.map((k) => (
          <Link key={k} href={href({ kind: kind === k ? '' : k, page: '' })} className={`px-3 py-1.5 rounded-full border ${kind === k ? 'bg-[#6d1825] text-white border-[#6d1825]' : 'border-slate-300 text-slate-700'}`}>
            {JOB_LABELS[k]}
          </Link>
        ))}
        {routerId && <Link href={href({ router: '' })} className="px-3 py-1.5 rounded-full border border-slate-300 text-slate-700">One router ✕</Link>}
      </div>

      {error && <div className="p-4 rounded-lg border border-red-200 bg-red-50 text-sm text-red-700">Could not load jobs. Check the server logs.</div>}

      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <table className="w-full min-w-[1000px] text-left text-sm text-slate-600">
          <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-3">Created</th><th className="px-4 py-3">Job</th><th className="px-4 py-3">Router</th><th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Attempts</th><th className="px-4 py-3">Next try / finished</th><th className="px-4 py-3">Last error</th><th className="px-4 py-3">Asked by</th><th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(jobs ?? []).length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-500">No jobs match.</td></tr>
            ) : (
              jobs!.map((j) => {
                const r = Array.isArray(j.routers) ? j.routers[0] : j.routers;
                return (
                  <tr key={j.id} className="align-top">
                    <td className="px-4 py-3 text-xs whitespace-nowrap">{fmtTime(j.created_at)}</td>
                    <td className="px-4 py-3">{JOB_LABELS[j.kind] ?? j.kind}<div className="text-[11px] font-mono text-slate-400">{j.id.slice(0, 8)}</div></td>
                    <td className="px-4 py-3">{r ? <Link href={`/admin/network/routers/${r.id}`} className="hover:text-[#6d1825]">{r.name ?? r.identifier}</Link> : '—'}</td>
                    <td className="px-4 py-3"><JobStatusBadge value={j.status} />{j.status === 'running' && j.locked_by && <div className="text-[11px] text-slate-400">{j.locked_by}</div>}</td>
                    <td className="px-4 py-3 text-xs">{j.attempts} of {j.max_attempts}</td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap">
                      {j.finished_at ? `finished ${fmtTime(j.finished_at)}` : j.status === 'running' ? `started ${fmtTime(j.locked_at)}` : `next try ${fmtTime(j.run_after)}`}
                    </td>
                    <td className="px-4 py-3 text-xs text-red-700 max-w-[240px] break-words">{j.last_error ?? ''}</td>
                    <td className="px-4 py-3 text-xs">{j.requested_by ?? '—'}</td>
                    <td className="px-4 py-3"><JobActions jobId={j.id} status={j.status} /></td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="flex justify-between text-sm">
          {page > 1 ? <Link href={href({ page: String(page - 1) })} className="font-semibold text-[#6d1825]">&larr; Newer</Link> : <span />}
          <span className="text-slate-500">Page {page} of {pages}</span>
          {page < pages ? <Link href={href({ page: String(page + 1) })} className="font-semibold text-[#6d1825]">Older &rarr;</Link> : <span />}
        </div>
      )}
    </div>
  );
}
