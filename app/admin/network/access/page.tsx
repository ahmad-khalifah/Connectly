import Link from 'next/link';
import { KeyRound } from 'lucide-react';
import { db } from '@/lib/db/client';
import { isUuid } from '@/lib/admin/inputs';
import { GRANT_LABELS, GRANT_STATUSES } from '@/lib/network/access';
import RevokeButton from '../access-actions';
import { fmtTime } from '../badges';

export const dynamic = 'force-dynamic';

const PAGE = 50;
type Search = { status?: string; router?: string; page?: string };

const STATUS_STYLE: Record<string, string> = {
  pending_device: 'bg-amber-50 text-amber-800 border-amber-200',
  active: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  revoked: 'bg-slate-100 text-slate-600 border-slate-200',
  expired: 'bg-slate-100 text-slate-600 border-slate-200',
};

type Grant = {
  id: string; status: string; voucher_code: string | null; expires_at: string; created_at: string;
  provisioned_at: string | null; revoked_at: string | null; revoke_reason: string | null; last_error: string | null;
  routers: { id: string; name: string | null; identifier: string } | null;
  purchases: { id: string; reference: string } | null;
};

/** Whether a grant can still be revoked, judged against the time the page was built. */
function isLive(g: Grant, at: number): boolean {
  return !g.revoked_at && (g.status === 'pending_device' || g.status === 'active') && Date.parse(g.expires_at) > at;
}

function pageTime(): number {
  return Date.now();
}

export default async function AccessPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const status = (GRANT_STATUSES as readonly string[]).includes(sp.status ?? '') ? sp.status! : '';
  const routerId = isUuid(sp.router) ? sp.router! : '';
  const page = Math.max(1, Number(sp.page) || 1);

  let q = db
    .from('network_authorizations')
    .select('id, status, voucher_code, expires_at, created_at, provisioned_at, revoked_at, revoke_reason, last_error, routers(id, name, identifier), purchases(id, reference)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * PAGE, page * PAGE - 1);
  if (status) q = q.eq('status', status);
  if (routerId) q = q.eq('router_id', routerId);
  const { data, count, error } = await q;
  const grants = (data ?? []) as unknown as Grant[];

  // Revokes already queued for these grants, so the page says so instead of offering the button again.
  const ids = grants.map((g) => g.id);
  const { data: revokeJobs } = ids.length
    ? await db.from('controller_jobs').select('authorization_id, status').eq('kind', 'access.revoke').in('authorization_id', ids)
    : { data: [] as { authorization_id: string; status: string }[] };
  const revokeStatus = new Map((revokeJobs ?? []).map((j) => [j.authorization_id, j.status]));

  const now = pageTime();
  const pages = count ? Math.ceil(count / PAGE) : 1;
  const href = (patch: Partial<Search>) => {
    const p = new URLSearchParams();
    Object.entries({ status, router: routerId, ...patch }).forEach(([k, v]) => v && p.set(k, String(v)));
    const s = p.toString();
    return s ? `/admin/network/access?${s}` : '/admin/network/access';
  };

  return (
    <div className="space-y-6">
      <Link href="/admin/network" className="text-sm font-bold text-slate-500 hover:text-[#6d1825]">&larr; Back to Network</Link>
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2"><KeyRound className="h-6 w-6 text-[#6d1825]" /> Access grants</h1>
        <p className="text-sm text-slate-500">
          One per paid purchase on a router. The controller puts the voucher on the router, and removes it when the time is up or when you revoke it.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        <Link href={href({ status: '', page: '' })} className={`px-3 py-1.5 rounded-full border ${!status ? 'bg-[#6d1825] text-white border-[#6d1825]' : 'border-slate-300 text-slate-700'}`}>All</Link>
        {GRANT_STATUSES.map((s) => (
          <Link key={s} href={href({ status: s, page: '' })} className={`px-3 py-1.5 rounded-full border ${status === s ? 'bg-[#6d1825] text-white border-[#6d1825]' : 'border-slate-300 text-slate-700'}`}>{GRANT_LABELS[s]}</Link>
        ))}
        {routerId && <Link href={href({ router: '', page: '' })} className="px-3 py-1.5 rounded-full border border-slate-300 text-slate-700">Clear router filter</Link>}
      </div>

      {error && <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-sm text-red-700">Could not load access grants.</div>}

      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-500 uppercase">
            <tr>
              <th className="px-4 py-3">Voucher</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Router</th>
              <th className="px-4 py-3">Payment</th><th className="px-4 py-3">Ends</th><th className="px-4 py-3">On router since</th>
              <th className="px-4 py-3">Notes</th><th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {grants.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">No access grants{status ? ` with status "${GRANT_LABELS[status]}"` : ''} yet. They appear when a customer pays on an active router.</td></tr>
            )}
            {grants.map((g) => {
              const queued = revokeStatus.get(g.id);
              return (
                <tr key={g.id} className="align-top">
                  <td className="px-4 py-3 font-mono font-semibold text-slate-900">{g.voucher_code ?? '-'}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full border text-xs font-semibold ${STATUS_STYLE[g.status] ?? ''}`}>{GRANT_LABELS[g.status] ?? g.status}</span></td>
                  <td className="px-4 py-3">{g.routers ? <Link href={`/admin/network/routers/${g.routers.id}`} className="hover:text-[#6d1825]">{g.routers.name ?? g.routers.identifier}</Link> : '-'}</td>
                  <td className="px-4 py-3">{g.purchases ? <Link href={`/admin/transactions?search=${encodeURIComponent(g.purchases.reference)}`} className="font-mono text-xs hover:text-[#6d1825]">{g.purchases.reference}</Link> : '-'}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{fmtTime(g.revoked_at ?? g.expires_at)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{fmtTime(g.provisioned_at)}</td>
                  <td className="px-4 py-3 text-xs text-slate-600 max-w-xs">
                    {g.revoke_reason && <div>Ended: {g.revoke_reason === 'admin' ? 'revoked by an admin' : g.revoke_reason}</div>}
                    {g.last_error && <div className="text-red-700">{g.last_error}</div>}
                    {queued && !g.revoked_at && <div className="text-amber-700">Revoke {queued === 'failed' ? 'retrying' : queued === 'dead' ? 'failed: see Controller jobs' : 'queued'}</div>}
                  </td>
                  <td className="px-4 py-3 text-right">{isLive(g, now) && !queued && <RevokeButton grantId={g.id} voucher={g.voucher_code} />}</td>
                </tr>
              );
            })}
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
