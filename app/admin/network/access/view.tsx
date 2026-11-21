'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { isUuid } from '@/lib/admin/inputs';
import { GRANT_LABELS, GRANT_STATUSES } from '@/lib/network/labels';
import RevokeButton, { ResendButton } from '../access-actions';
import { fmtTime } from '../badges';
import { PageHeader } from '@/components/admin/page-header';
import { EmptyRow, Pager, SearchBox, TableFrame, td, th, tr } from '@/components/admin/table';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { Notice } from '@/components/ui/notice';
import { cn } from '@/lib/utils';
import { useAdminView, viewUrl, ViewState } from '@/components/admin/admin-data';

const PAGE = 50; // lib/admin/views.ts GRANTS_PER_PAGE
type Search = { status?: string; router?: string; page?: string; q?: string };

const STATUS_TONE: Record<string, BadgeTone> = { pending_device: 'warn', active: 'ok', revoked: 'neutral', expired: 'neutral' };

type Grant = {
  id: string; status: string; voucher_code: string | null; expires_at: string; provisioned_at: string | null;
  revoked_at: string | null; revoke_reason: string | null; last_error: string | null;
  router: { id: string; name: string | null; identifier: string } | null;
  reference: string | null; phoneLast4: string | null;
};
type Data = { grants: Grant[]; total: number; revokeStatus: Record<string, string>; failed: boolean; invalidSearch: boolean };

/** Whether a grant can still be revoked, judged against the time the page was opened. */
function isLive(g: Grant, at: number): boolean {
  return !g.revoked_at && (g.status === 'pending_device' || g.status === 'active') && Date.parse(g.expires_at) > at;
}

export default function AccessView() {
  const sp = useSearchParams();
  const status = (GRANT_STATUSES as readonly string[]).includes(sp.get('status') ?? '') ? sp.get('status')! : '';
  const routerId = isUuid(sp.get('router')) ? sp.get('router')! : '';
  const page = Math.max(1, Number(sp.get('page')) || 1);
  const search = (sp.get('q') ?? '').trim();
  const { loaded, reload } = useAdminView<Data>(viewUrl('access', { status, router: routerId, page: String(page), q: search }));
  const [now] = useState(() => Date.now());

  const href = (patch: Partial<Search>) => {
    const p = new URLSearchParams();
    Object.entries({ status, router: routerId, q: search, ...patch }).forEach(([k, v]) => v && p.set(k, String(v)));
    const s = p.toString();
    return s ? `/admin/network/access?${s}` : '/admin/network/access';
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Access grants"
        description="One per paid purchase on a router. The controller puts the WiFi code on the router, and removes it when the time is up or when you revoke it."
        actions={<SearchBox name="q" defaultValue={search} placeholder="WiFi code, reference or phone" hidden={{ status, router: routerId }} />}
      />
      {loaded.state === 'ready' && loaded.data.invalidSearch && <Notice tone="warn">Type a WiFi code (8 letters and numbers), a payment reference (CONN_…) or a Nigerian phone number.</Notice>}

      <div className="flex flex-wrap items-center gap-3">
        <nav aria-label="Status" className="inline-flex flex-wrap rounded-[var(--radius-control)] border border-line bg-surface p-0.5">
          {[{ id: '', label: 'All' }, ...GRANT_STATUSES.map((g) => ({ id: g, label: GRANT_LABELS[g] }))].map((f) => (
            <Link key={f.id || 'all'} prefetch={false} href={href({ status: f.id, page: '' })} aria-current={f.id === status ? 'true' : undefined}
              className={cn('rounded-md px-3 py-1.5 text-[13px] font-semibold', f.id === status ? 'bg-brand text-white' : 'text-muted hover:bg-canvas hover:text-ink')}>
              {f.label}
            </Link>
          ))}
        </nav>
        {routerId && <Link prefetch={false} href={href({ router: '', page: '' })} className="text-sm font-semibold text-brand hover:underline">Show all routers</Link>}
        {search && <Link prefetch={false} href={href({ q: '', page: '' })} className="text-sm font-semibold text-brand hover:underline">Clear search</Link>}
      </div>

      <ViewState loaded={loaded} reload={reload}>
        {({ grants, total, revokeStatus, failed }) => (
          <>
      {failed && <Notice tone="bad" title="Access grants could not be loaded">Refresh to try again.</Notice>}

      <TableFrame footer={<Pager page={page} pages={Math.max(1, Math.ceil(total / PAGE))} total={total} noun="grant" href={(n) => href({ page: String(n) })} />}>
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
            const queued = revokeStatus[g.id];
            return (
              <tr key={g.id} className={tr}>
                <td className={`${td} font-semibold tracking-wider text-ink`}>{g.voucher_code ?? '—'}</td>
                <td className={td}><Badge tone={STATUS_TONE[g.status] ?? 'neutral'}>{GRANT_LABELS[g.status] ?? g.status}</Badge></td>
                <td className={td}>{g.router ? <Link prefetch={false} href={`/admin/network/router?id=${g.router.id}`} className="hover:text-brand">{g.router.name ?? g.router.identifier}</Link> : '—'}</td>
                <td className={td}>{g.reference ? <Link prefetch={false} href={`/admin/transactions?search=${encodeURIComponent(g.reference)}`} className="break-all text-[12.5px] text-muted hover:text-brand">{g.reference}</Link> : '—'}</td>
                <td className={`${td} tnum text-[13px]`}>{g.phoneLast4 ? `···${g.phoneLast4}` : '-'}</td>
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
          </>
        )}
      </ViewState>
    </div>
  );
}
