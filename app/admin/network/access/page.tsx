import Link from 'next/link';
import { db } from '@/lib/db/client';
import { isUuid } from '@/lib/admin/inputs';
import { GRANT_LABELS, GRANT_STATUSES, classifyGrantSearch } from '@/lib/network/access';
import { normaliseNigerianMobile } from '@/lib/phone';
import RevokeButton, { ResendButton } from '../access-actions';
import { fmtTime } from '../badges';
import { PageHeader } from '@/components/admin/page-header';
import { EmptyRow, Pager, SearchBox, TableFrame, td, th, tr } from '@/components/admin/table';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { Notice } from '@/components/ui/notice';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const PAGE = 50;
type Search = { status?: string; router?: string; page?: string; q?: string };

const STATUS_TONE: Record<string, BadgeTone> = { pending_device: 'warn', active: 'ok', revoked: 'neutral', expired: 'neutral' };

type Grant = {
  id: string; status: string; voucher_code: string | null; expires_at: string; created_at: string;
  provisioned_at: string | null; revoked_at: string | null; revoke_reason: string | null; last_error: string | null;
  routers: { id: string; name: string | null; identifier: string } | null;
  purchases: { id: string; reference: string; phone_number: string | null } | null;
};

/** Last four digits only: enough to confirm with the caller. */
const maskPhone = (p: string | null) => (p ? `···${p.slice(-4)}` : '-');

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
  const search = classifyGrantSearch(sp.q, normaliseNigerianMobile);
  const byPurchase = search?.kind === 'reference' || search?.kind === 'phone';

  let q = db
    .from('network_authorizations')
    .select(`id, status, voucher_code, expires_at, created_at, provisioned_at, revoked_at, revoke_reason, last_error, routers(id, name, identifier), purchases${byPurchase ? '!inner' : ''}(id, reference, phone_number)`, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * PAGE, page * PAGE - 1);
  if (status) q = q.eq('status', status);
  if (routerId) q = q.eq('router_id', routerId);
  if (search?.kind === 'voucher') q = q.eq('voucher_code', search.value);
  if (search?.kind === 'reference') q = q.eq('purchases.reference', search.value);
  if (search?.kind === 'phone') q = q.eq('purchases.phone_number', search.value);
  const { data, count, error } = search?.kind === 'invalid' ? { data: [], count: 0, error: null } : await q;
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
    Object.entries({ status, router: routerId, q: sp.q ?? '', ...patch }).forEach(([k, v]) => v && p.set(k, String(v)));
    const s = p.toString();
    return s ? `/admin/network/access?${s}` : '/admin/network/access';
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Access grants"
        description="One per paid purchase on a router. The controller puts the WiFi code on the router, and removes it when the time is up or when you revoke it."
        actions={<SearchBox name="q" defaultValue={sp.q ?? ''} placeholder="WiFi code, reference or phone" hidden={{ status, router: routerId }} />}
      />
      {search?.kind === 'invalid' && <Notice tone="warn">Type a WiFi code (8 letters and numbers), a payment reference (CONN_…) or a Nigerian phone number.</Notice>}

      <div className="flex flex-wrap items-center gap-3">
        <nav aria-label="Status" className="inline-flex flex-wrap rounded-[var(--radius-control)] border border-line bg-surface p-0.5">
          {[{ id: '', label: 'All' }, ...GRANT_STATUSES.map((g) => ({ id: g, label: GRANT_LABELS[g] }))].map((f) => (
            <Link key={f.id || 'all'} href={href({ status: f.id, page: '' })} aria-current={f.id === status ? 'true' : undefined}
              className={cn('rounded-md px-3 py-1.5 text-[13px] font-semibold', f.id === status ? 'bg-brand text-white' : 'text-muted hover:bg-canvas hover:text-ink')}>
              {f.label}
            </Link>
          ))}
        </nav>
        {routerId && <Link href={href({ router: '', page: '' })} className="text-sm font-semibold text-brand hover:underline">Show all routers</Link>}
        {sp.q && <Link href={href({ q: '', page: '' })} className="text-sm font-semibold text-brand hover:underline">Clear search</Link>}
      </div>

      {error && <Notice tone="bad" title="Access grants could not be loaded">Refresh to try again.</Notice>}

      <TableFrame footer={<Pager page={page} pages={pages} total={count ?? 0} noun="grant" href={(n) => href({ page: String(n) })} />}>
        <thead>
          <tr>
            <th className={th}>WiFi code</th><th className={th}>Status</th><th className={th}>Router</th>
            <th className={th}>Payment</th><th className={th}>Phone</th><th className={th}>Ends</th><th className={th}>On router since</th>
            <th className={th}>Notes</th><th className={th}><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {grants.length === 0 && (
            <EmptyRow cols={9}>No access grants{status ? ` with status "${GRANT_LABELS[status]}"` : ''}{search ? ' match this search' : ' yet'}. They appear when a customer pays on an active router.</EmptyRow>
          )}
          {grants.map((g) => {
            const queued = revokeStatus.get(g.id);
            return (
              <tr key={g.id} className={tr}>
                <td className={`${td} font-semibold tracking-wider text-ink`}>{g.voucher_code ?? '—'}</td>
                <td className={td}><Badge tone={STATUS_TONE[g.status] ?? 'neutral'}>{GRANT_LABELS[g.status] ?? g.status}</Badge></td>
                <td className={td}>{g.routers ? <Link href={`/admin/network/routers/${g.routers.id}`} className="hover:text-brand">{g.routers.name ?? g.routers.identifier}</Link> : '—'}</td>
                <td className={td}>{g.purchases ? <Link href={`/admin/transactions?search=${encodeURIComponent(g.purchases.reference)}`} className="break-all text-[12.5px] text-muted hover:text-brand">{g.purchases.reference}</Link> : '—'}</td>
                <td className={`${td} tnum text-[13px]`}>{maskPhone(g.purchases?.phone_number ?? null)}</td>
                <td className={`${td} tnum whitespace-nowrap`}>{fmtTime(g.revoked_at ?? g.expires_at)}</td>
                <td className={`${td} tnum whitespace-nowrap text-muted`}>{fmtTime(g.provisioned_at)}</td>
                <td className={`${td} max-w-xs text-[13px] text-muted`}>
                  {g.revoke_reason && <span className="block">Ended: {g.revoke_reason === 'admin' ? 'revoked by an admin' : g.revoke_reason === 'expired' ? 'time ran out' : g.revoke_reason}</span>}
                  {g.last_error && <span className="block text-bad">{g.last_error}</span>}
                  {queued && !g.revoked_at && <span className="block text-warn">Revoke {queued === 'failed' ? 'retrying' : queued === 'dead' ? 'gave up: see Controller jobs' : 'queued'}</span>}
                </td>
                <td className={`${td} text-right`}>{isLive(g, now) && !queued && (
                  <div className="flex flex-col items-end gap-2">
                    <ResendButton grantId={g.id} />
                    <RevokeButton grantId={g.id} voucher={g.voucher_code} />
                  </div>
                )}</td>
              </tr>
            );
          })}
        </tbody>
      </TableFrame>
    </div>
  );
}
