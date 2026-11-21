'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import ReconcileButton from './reconcile-button';
import { PageHeader } from '@/components/admin/page-header';
import { EmptyRow, lagos, Pager, SearchBox, TableFrame, td, th, tr } from '@/components/admin/table';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { Notice } from '@/components/ui/notice';
import { cn } from '@/lib/utils';
import { adminFetch, refreshAdminData, useAdminView, viewUrl, ViewState } from '@/components/admin/admin-data';

type Named = { name: string } | { name: string }[] | null;
type Row = {
  id: string; reference: string; status: string; amount_kobo: number | null; amount_paid: number | string | null;
  gateway_fee_ngn: number | string | null; net_amount_ngn: number | string | null; created_at: string; paid_at: string | null;
  failure_reason: string | null; phone_number: string | null; plans: Named; locations: Named;
};
type Data = { rows: Row[]; total: number; failed: boolean };
type Sweep = { checked: number; confirmed: number; failed: number };

const PER_PAGE = 30; // lib/admin/views.ts PAYMENTS_PER_PAGE
const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v);
const naira = (n: number) => `₦${n.toLocaleString('en-NG', { maximumFractionDigits: 2 })}`;
const STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  paid: { label: 'Paid', tone: 'ok' },
  pending: { label: 'Not completed', tone: 'warn' },
  failed: { label: 'Failed', tone: 'bad' },
};
const FILTERS = [
  { id: '', label: 'All' },
  { id: 'paid', label: 'Paid' },
  { id: 'pending', label: 'Not completed' },
  { id: 'failed', label: 'Failed' },
];

export default function PaymentsView() {
  const sp = useSearchParams();
  const page = Math.max(1, Number(sp.get('page')) || 1);
  const status = FILTERS.some((f) => f.id === sp.get('status')) ? sp.get('status') ?? '' : '';
  const raw = (sp.get('search') ?? '').replace(/[^0-9A-Za-z_+ -]/g, '').trim();
  const { loaded, reload } = useAdminView<Data>(viewUrl('transactions', { page: String(page), status, search: raw }));
  const [sweep, setSweep] = useState<Sweep | null>(null);

  // Payments Korapay confirmed but whose notification never reached us are
  // settled in the background; the list reloads if any changed.
  useEffect(() => {
    adminFetch('/api/admin/sweep', { method: 'POST' })
      .then((r) => (r.ok ? (r.json() as Promise<Sweep>) : null))
      .then((s) => {
        if (s && (s.confirmed || s.failed)) {
          setSweep(s);
          refreshAdminData();
        }
      })
      .catch(() => {});
  }, []);

  const q = (o: Record<string, string>) => `?${new URLSearchParams({ ...(raw ? { search: raw } : {}), ...(status ? { status } : {}), ...o }).toString()}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments"
        description="Every checkout and its payment state, as Korapay confirmed it. Pending ones from the last day are re-checked with Korapay when this page opens."
        actions={<SearchBox defaultValue={raw} placeholder="Phone number or reference" hidden={{ status }} />}
      />

      <nav aria-label="Payment status" className="inline-flex flex-wrap rounded-[var(--radius-control)] border border-line bg-surface p-0.5">
        {FILTERS.map((f) => {
          const href = `?${new URLSearchParams({ ...(raw ? { search: raw } : {}), ...(f.id ? { status: f.id } : {}) }).toString()}`;
          return (
            <Link key={f.id || 'all'} href={href} prefetch={false} aria-current={f.id === status ? 'true' : undefined}
              className={cn('rounded-md px-3 py-1.5 text-[13px] font-semibold', f.id === status ? 'bg-brand text-white' : 'text-muted hover:bg-canvas hover:text-ink')}>
              {f.label}
            </Link>
          );
        })}
      </nav>

      {sweep && (
        <Notice tone="ok" title="Settled with Korapay just now">
          Re-checked {sweep.checked} pending payment{sweep.checked === 1 ? '' : 's'}: {sweep.confirmed} confirmed paid{sweep.failed > 0 ? `, ${sweep.failed} failed` : ''}.
        </Notice>
      )}

      <ViewState loaded={loaded} reload={reload}>
        {({ rows, total, failed }) => (
          <>
            {failed && <Notice tone="bad" title="Payments could not be loaded">The database did not answer. Refresh to try again.</Notice>}
            <TableFrame footer={<Pager page={page} pages={Math.max(1, Math.ceil(total / PER_PAGE))} total={total} noun="payment" href={(n) => q({ page: String(n) })} />}>
              <thead>
                <tr>
                  <th className={th}>Started</th>
                  <th className={th}>Customer</th>
                  <th className={th}>Plan and location</th>
                  <th className={th}>Status</th>
                  <th className={`${th} text-right`}>Price</th>
                  <th className={`${th} text-right`}>Korapay fee</th>
                  <th className={`${th} text-right`}>After fee</th>
                  <th className={th}><span className="sr-only">Action</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((tx) => {
                  const price = tx.amount_kobo ? tx.amount_kobo / 100 : Number(tx.net_amount_ngn || 0);
                  const paid = tx.status === 'paid' ? Number(tx.amount_paid || price) : 0;
                  const fee = tx.status === 'paid' ? Number(tx.gateway_fee_ngn || 0) : 0;
                  const st = STATUS[tx.status] ?? { label: tx.status, tone: 'neutral' as BadgeTone };
                  return (
                    <tr key={tx.id} className={tr}>
                      <td className={td}>
                        <span className="tnum block whitespace-nowrap">{lagos(tx.created_at)}</span>
                        <span className="mt-0.5 block max-w-[200px] break-all text-[12px] text-subtle" title={tx.reference}>{tx.reference}</span>
                      </td>
                      <td className={`${td} tnum font-semibold`}>{tx.phone_number ? `+${tx.phone_number}` : '—'}</td>
                      <td className={td}>
                        {one(tx.plans)?.name ?? '—'}
                        <span className="block text-[12.5px] text-muted">{one(tx.locations)?.name ?? '—'}</span>
                      </td>
                      <td className={td}>
                        <Badge tone={st.tone}>{st.label}</Badge>
                        {tx.paid_at && <span className="tnum mt-1 block text-[12px] text-subtle">Paid {lagos(tx.paid_at)}</span>}
                        {tx.failure_reason && <span className="mt-1 block max-w-[200px] text-[12px] text-bad">{tx.failure_reason}</span>}
                      </td>
                      <td className={`${td} tnum text-right`}>{naira(price)}</td>
                      <td className={`${td} tnum text-right text-muted`}>{fee ? naira(fee) : '—'}</td>
                      <td className={`${td} tnum text-right font-semibold`}>{paid ? naira(paid - fee) : '—'}</td>
                      <td className={`${td} text-right`}>
                        {tx.status === 'pending' && /^CONN_/.test(tx.reference) ? <ReconcileButton reference={tx.reference} /> : null}
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 && <EmptyRow cols={8}>{raw || status ? 'No payments match.' : 'No payments yet.'}</EmptyRow>}
              </tbody>
            </TableFrame>
          </>
        )}
      </ViewState>
    </div>
  );
}
