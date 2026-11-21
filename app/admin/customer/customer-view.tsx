'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { smsStatusLabel } from '@/lib/sms';
import { PageHeader } from '@/components/admin/page-header';
import { Stat, StatGrid } from '@/components/admin/stat-grid';
import { EmptyRow, lagos, TableFrame, td, th, tr } from '@/components/admin/table';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { Panel } from '@/components/ui/panel';
import { useAdminView, viewUrl, ViewState } from '@/components/admin/admin-data';

// One customer's history. Data: /api/admin/view/customer?id= (lib/http/admin-api.ts).

type Named = { name: string } | { name: string }[] | null;
type Grant = { status: string; revoked_at: string | null; voucher_code: string | null };
type Purchase = {
  id: string; reference: string; status: string; amount_paid: number | string | null; amount_kobo: number | null; net_amount_ngn: number | string | null;
  created_at: string; paid_at: string | null; expires_at: string | null; failure_reason: string | null;
  plans: Named; locations: Named; network_authorizations: Grant | Grant[] | null;
};
type Data = {
  customer: { id: string; phone_number: string; created_at: string };
  purchases: Purchase[];
  devices: { id: string; mac_address: string; last_seen_at: string | null }[];
  sms: { id: string; purchase_id: string; status: string; created_at: string; last_error: string | null }[];
};

const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);
const STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  paid: { label: 'Paid', tone: 'ok' },
  pending: { label: 'Not completed', tone: 'warn' },
  failed: { label: 'Failed', tone: 'bad' },
};
const SMS_TONE: Record<string, BadgeTone> = { ok: 'ok', bad: 'bad', neutral: 'neutral', waiting: 'warn' };

export default function CustomerView() {
  const id = useSearchParams().get('id');
  const { loaded, reload } = useAdminView<Data>(id ? viewUrl('customer', { id }) : null);
  if (!id) return <ViewState loaded={{ state: 'not_found' }} reload={reload} what="Customer">{() => null}</ViewState>;
  return <ViewState loaded={loaded} reload={reload} what="Customer">{(d) => <Customer {...d} />}</ViewState>;
}

function Customer({ customer, purchases, devices, sms }: Data) {
  const list = purchases;
  const smsByPurchase = new Map(sms.map((n) => [n.purchase_id, n]));
  const [now] = useState(() => Date.now()); // time the history was loaded
  const grantOf = (p: Purchase) => one(p.network_authorizations);
  const paid = list.filter((p) => p.status === 'paid');
  const amountOf = (p: Purchase) =>
    p.amount_paid !== null && p.amount_paid !== undefined ? Number(p.amount_paid) : Number(p.amount_kobo ?? 0) / 100 || Number(p.net_amount_ngn || 0);
  const totalSpent = paid.reduce((acc, p) => acc + amountOf(p), 0);
  // A plan is current only if its end time is ahead and it was not revoked.
  const current = paid.find((p) => p.expires_at && Date.parse(p.expires_at) > now && !(grantOf(p)?.revoked_at || grantOf(p)?.status === 'revoked'));

  return (
    <div className="space-y-6">
      <PageHeader
        back={<Link href="/admin/customers" className="font-semibold text-muted hover:text-brand">Customers</Link>}
        title={<span className="tnum">+{customer.phone_number}</span>}
        description={`Customer since ${lagos(customer.created_at)}`}
      />

      <StatGrid cols={3}>
        <Stat label="Current plan" value={current ? one(current.plans)?.name ?? 'Running' : 'None running'} note={current ? `Ends ${lagos(current.expires_at)}` : undefined} tone={current ? 'ok' : undefined} />
        <Stat label="Paid purchases" value={paid.length} />
        <Stat label="Total paid" value={`₦${totalSpent.toLocaleString('en-NG')}`} />
      </StatGrid>

      <TableFrame>
        <thead>
          <tr>
            <th className={th}>Date</th><th className={th}>Plan</th><th className={th}>Location</th>
            <th className={`${th} text-right`}>Amount</th><th className={th}>Payment</th><th className={th}>WiFi code</th><th className={th}>Ends</th>
            <th className={th}>SMS</th><th className={th}>Reference</th>
          </tr>
        </thead>
        <tbody>
          {list.map((p) => {
            const note = smsByPurchase.get(p.id);
            const label = note ? smsStatusLabel(note.status, note.last_error) : null;
            const grant = grantOf(p);
            const st = STATUS[p.status] ?? { label: p.status, tone: 'neutral' as BadgeTone };
            return (
              <tr key={p.id} className={tr}>
                <td className={`${td} tnum whitespace-nowrap text-muted`}>{lagos(p.created_at)}</td>
                <td className={td}>{one(p.plans)?.name ?? '—'}</td>
                <td className={`${td} text-muted`}>{one(p.locations)?.name ?? '—'}</td>
                <td className={`${td} tnum text-right`}>₦{amountOf(p).toLocaleString('en-NG')}</td>
                <td className={td}>
                  <Badge tone={st.tone}>{st.label}</Badge>
                  {p.failure_reason && <span className="mt-1 block text-[12px] text-subtle">{p.failure_reason}</span>}
                </td>
                <td className={td}>
                  {grant?.voucher_code ? (
                    <span className="font-semibold tracking-wider">{grant.voucher_code}</span>
                  ) : '—'}
                  {grant && <span className="block text-[12px] text-subtle">{grant.status === 'revoked' ? 'Revoked' : grant.status === 'expired' ? 'Ended' : grant.status === 'active' ? 'On the router' : 'Being added'}</span>}
                </td>
                <td className={`${td} tnum whitespace-nowrap text-muted`}>{lagos(p.expires_at)}</td>
                <td className={td}>{label ? <span title={note?.last_error ?? undefined}><Badge tone={SMS_TONE[label.tone]}>{label.text}</Badge></span> : '—'}</td>
                <td className={`${td} break-all text-[12px] text-subtle`}>{p.reference}</td>
              </tr>
            );
          })}
          {list.length === 0 && <EmptyRow cols={9}>No purchases.</EmptyRow>}
        </tbody>
      </TableFrame>

      {(devices ?? []).length > 0 && (
        <Panel title="Devices" description="Device addresses seen at checkout.">
          <ul className="divide-y divide-line text-sm">
            {(devices ?? []).map((d) => (
              <li key={d.id} className="flex justify-between py-2"><span className="tnum">{String(d.mac_address)}</span><span className="text-muted">Last seen {lagos(d.last_seen_at)}</span></li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
