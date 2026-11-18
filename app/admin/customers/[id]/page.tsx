import Link from 'next/link';
import { notFound } from 'next/navigation';
import { User, Receipt, MessageSquare } from 'lucide-react';
import { db } from '@/lib/db/client';
import { isUuid } from '@/lib/admin/inputs';

export const dynamic = 'force-dynamic';

/** The paid purchase whose access window is still open, if any. */
function currentAccess<T extends { expires_at: string | null }>(paid: T[]): T | undefined {
  const now = Date.now();
  return paid.find((p) => p.expires_at && new Date(p.expires_at).getTime() > now);
}

const fmt = (d: string | null) => (d ? new Date(d).toLocaleString('en-NG', { timeZone: 'Africa/Lagos', dateStyle: 'medium', timeStyle: 'short' }) : '—');

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const { data: customer } = await db.from('customers').select('id, phone_number, created_at').eq('id', id).maybeSingle();
  if (!customer) notFound();

  // Purchases are matched by customer link and by phone, so purchases made
  // before the customer record existed still appear.
  const [{ data: purchases }, { data: devices }] = await Promise.all([
    db.from('purchases')
      .select('id, reference, status, amount_paid, amount_kobo, net_amount_ngn, gateway_fee_ngn, created_at, paid_at, expires_at, failure_reason, plans(name), locations(name)')
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

  const paid = list.filter((p) => p.status === 'paid');
  const totalSpent = paid.reduce((acc, p) => acc + Number(p.amount_paid || p.net_amount_ngn || 0), 0);
  const current = currentAccess(paid);
  const currentPlan = current ? (Array.isArray(current.plans) ? current.plans[0] : current.plans) : null;

  return (
    <div className="space-y-6">
      <Link href="/admin/customers" className="text-sm font-bold text-slate-500 hover:text-[#6d1825]">&larr; Back to Customers</Link>

      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <User className="h-6 w-6 text-[#6d1825]" /> <span className="font-mono">+{customer.phone_number}</span>
        </h1>
        <p className="text-sm text-slate-500">Customer since {fmt(customer.created_at)}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <span className="text-xs text-slate-400 block mb-1">Current access</span>
          {current ? (
            <>
              <p className="text-lg font-bold text-emerald-700">{currentPlan?.name ?? 'Active'}</p>
              <p className="text-xs text-slate-500">Until {fmt(current.expires_at)}</p>
            </>
          ) : (
            <p className="text-lg font-bold text-slate-500">None active</p>
          )}
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <span className="text-xs text-slate-400 block mb-1">Paid purchases</span>
          <p className="text-2xl font-bold text-slate-900 font-mono">{paid.length}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <span className="text-xs text-slate-400 block mb-1">Total paid</span>
          <p className="text-2xl font-bold text-slate-900 font-mono">₦{totalSpent.toLocaleString('en-NG')}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200">
          <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
            <Receipt className="h-4 w-4 text-[#6d1825]" /> Purchase history
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs uppercase text-slate-500 border-b border-slate-100">
              <tr>
                <th className="px-4 py-3">Date</th><th className="px-4 py-3">Plan</th><th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Amount</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Expires</th>
                <th className="px-4 py-3">SMS</th><th className="px-4 py-3">Reference</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {list.map((p) => {
                const plan = Array.isArray(p.plans) ? p.plans[0] : p.plans;
                const loc = Array.isArray(p.locations) ? p.locations[0] : p.locations;
                const amount = p.status === 'paid' ? Number(p.amount_paid || p.net_amount_ngn || 0) : Number(p.amount_kobo ?? 0) / 100 || Number(p.net_amount_ngn || 0);
                const note = smsByPurchase.get(p.id);
                return (
                  <tr key={p.id}>
                    <td className="px-4 py-2 whitespace-nowrap text-slate-500">{fmt(p.created_at)}</td>
                    <td className="px-4 py-2 text-slate-900">{plan?.name ?? '—'}</td>
                    <td className="px-4 py-2 text-slate-600">{loc?.name ?? '—'}</td>
                    <td className="px-4 py-2 font-mono">₦{amount.toLocaleString('en-NG')}</td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${p.status === 'paid' ? 'bg-emerald-50 text-emerald-700' : p.status === 'pending' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>{p.status}</span>
                      {p.failure_reason && <span className="block text-[11px] text-slate-400 mt-0.5">{p.failure_reason}</span>}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-slate-500">{fmt(p.expires_at)}</td>
                    <td className="px-4 py-2 text-xs">
                      {note ? (
                        <span className={`inline-flex items-center gap-1 ${note.status === 'sent' ? 'text-emerald-700' : note.status === 'failed' ? 'text-red-600' : 'text-amber-700'}`} title={note.last_error ?? undefined}>
                          <MessageSquare className="h-3 w-3" /> {note.status}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-2 font-mono text-[11px] text-slate-400">{p.reference}</td>
                  </tr>
                );
              })}
              {list.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-xs text-slate-400">No purchases.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {(devices ?? []).length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">Devices</h2>
          <ul className="text-sm space-y-1">
            {(devices ?? []).map((d) => (
              <li key={d.id} className="flex justify-between font-mono text-slate-700"><span>{d.mac_address}</span><span className="text-xs text-slate-400">{fmt(d.last_seen_at)}</span></li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
