import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db/client';
import { isUuid } from '@/lib/admin/inputs';
import { smsStatusLabel } from '@/lib/sms';
import { requestTime } from '@/lib/time';
import { PageHeader } from '@/components/admin/page-header';
import { Stat, StatGrid } from '@/components/admin/stat-grid';
import { EmptyRow, lagos, TableFrame, td, th, tr } from '@/components/admin/table';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { Panel } from '@/components/ui/panel';

export const dynamic = 'force-dynamic';

const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);
const STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  paid: { label: 'Paid', tone: 'ok' },
  pending: { label: 'Not completed', tone: 'warn' },
  failed: { label: 'Failed', tone: 'bad' },
};
const SMS_TONE: Record<string, BadgeTone> = { ok: 'ok', bad: 'bad', neutral: 'neutral', waiting: 'warn' };

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const { data: customer } = await db.from('customers').select('id, phone_number, created_at').eq('id', id).maybeSingle();
  if (!customer) notFound();

  // Purchases are matched by customer link and by phone, so purchases made
  // before the customer record existed still appear.
  const [{ data: purchases }, { data: devices }] = await Promise.all([
    db.from('purchases')
      .select('id, reference, status, amount_paid, amount_kobo, net_amount_ngn, created_at, paid_at, expires_at, failure_reason, plans(name), locations(name), network_authorizations(status, revoked_at, voucher_code)')
      .or(/^\d{6,20}$/.test(customer.phone_number) ? `customer_id.eq.${id},phone_number.eq.${customer.phone_number}` : `customer_id.eq.${id}`)
      .order('created_at', { ascending: false })
      .limit(100),
    db.from('devices').select('id, mac_address, last_seen_at').eq('customer_id', id),
  ]);

  const list = purchases ?? [];
  const ids = list.map((p) => p.id);
  const { data: sms } = ids.length
    ? await db.from('notifications').select('id, purchase_id, status, created_at, last_error').in('purchase_id', ids)
    : { data: [] as { id: string; purchase_id: string; status: string; created_at: string; last_error: string | null }[] };
  const smsByPurchase = new Map((sms ?? []).map((n) => [n.purchase_id, n]));

  const now = requestTime();
  const grantOf = (p: (typeof list)[number]) => one(p.network_authorizations as { status: string; revoked_at: string | null; voucher_code: string | null }[] | null);
  const paid = list.filter((p) => p.status === 'paid');
  const amountOf = (p: (typeof list)[number]) =>
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
