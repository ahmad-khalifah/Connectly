import { ArrowLeftRight, Search, CheckCircle2, XCircle, Clock } from 'lucide-react';
import Link from 'next/link';
import { db } from '@/lib/db/client';
import ReconcileButton from './reconcile-button';
import { reconcileRecentPending } from '@/lib/payments/ledger';

export const dynamic = 'force-dynamic';

type Row = {
  id: string;
  reference: string;
  status: string;
  amount_kobo: number | null;
  amount_paid: number | string | null;
  gateway_fee_ngn: number | string | null;
  net_amount_ngn: number | string | null;
  created_at: string;
  paid_at: string | null;
  failure_reason: string | null;
  phone_number: string | null;
  plans: { name: string } | { name: string }[] | null;
  locations: { name: string } | { name: string }[] | null;
};

const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v);

const STATUS_STYLES: Record<string, string> = {
  paid: 'text-emerald-600 bg-emerald-50 border-emerald-200',
  pending: 'text-amber-600 bg-amber-50 border-amber-200',
  failed: 'text-red-600 bg-red-50 border-red-200',
  expired: 'text-slate-500 bg-slate-50 border-slate-200',
  cancelled: 'text-slate-500 bg-slate-50 border-slate-200',
};

function StatusBadge({ status }: { status: string }) {
  const Icon = status === 'paid' ? CheckCircle2 : status === 'pending' ? Clock : XCircle;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold uppercase border ${STATUS_STYLES[status] ?? STATUS_STYLES.expired}`}>
      <Icon className="h-3 w-3" /> {status}
    </span>
  );
}

const naira = (n: number) => `₦${n.toLocaleString('en-NG', { maximumFractionDigits: 2 })}`;

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string }>;
}) {
  const resolvedParams = await searchParams;
  const currentPage = Math.max(1, Number(resolvedParams.page) || 1);
  const searchQuery = resolvedParams.search || '';
  const ITEMS_PER_PAGE = 30;
  const from = (currentPage - 1) * ITEMS_PER_PAGE;
  const to = from + ITEMS_PER_PAGE - 1;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseRoleKey) {
    return <div className="p-6 text-red-500">Critical Error: Missing Supabase Admin Keys</div>;
  }

  const supabase = db;

  // Payments Korapay confirmed but whose notification never reached us are
  // settled here, before the list is read, so the page shows the truth.
  const sweep = await reconcileRecentPending();

  let query = supabase
    .from('purchases')
    .select(
      `id, reference, status, amount_kobo, amount_paid, gateway_fee_ngn, net_amount_ngn,
       created_at, paid_at, failure_reason, phone_number, plans(name), locations(name)`,
      { count: 'exact' }
    )
    .order('created_at', { ascending: false });

  // Search by phone number or payment reference (characters limited so the
  // term cannot alter the PostgREST filter).
  const term = searchQuery.replace(/[^0-9A-Za-z_-]/g, '');
  if (term) {
    query = query.or(`phone_number.ilike.%${term}%,reference.ilike.%${term}%`);
  }

  const { data, count, error } = await query.range(from, to);
  if (error) console.error('[TRANSACTIONS_FETCH_ERROR]', error);
  const transactions = (data ?? []) as Row[];

  const totalPages = count ? Math.ceil(count / ITEMS_PER_PAGE) : 1;
  const pageHref = (page: number) => `?page=${page}${term ? `&search=${encodeURIComponent(term)}` : ''}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ArrowLeftRight className="h-6 w-6 text-[#6d1825]" /> Transactions
          </h1>
          <p className="text-sm text-slate-500">Every checkout and its verified payment state.</p>
        </div>
        <form className="w-full md:w-auto flex items-center gap-2">
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              name="search"
              placeholder="Phone number or reference"
              defaultValue={searchQuery}
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#6d1825] focus:border-[#6d1825] outline-none"
            />
          </div>
          <button type="submit" className="px-4 py-2 bg-[#6d1825] text-white text-sm font-semibold rounded-lg hover:bg-[#5a141e] transition-colors">
            Search
          </button>
        </form>
      </div>

      {(sweep.confirmed > 0 || sweep.failed > 0) && (
        <div className="p-4 rounded-lg border border-emerald-200 bg-emerald-50 text-sm text-emerald-800">
          Re-checked {sweep.checked} pending payment{sweep.checked === 1 ? '' : 's'} with Korapay:{' '}
          {sweep.confirmed} confirmed paid{sweep.failed > 0 ? `, ${sweep.failed} failed` : ''}.
        </div>
      )}

      {error && (
        <div className="p-4 rounded-lg border border-red-200 bg-red-50 text-sm text-red-700">
          Could not load transactions. Check the server logs.
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto shadow-xs">
        <table className="w-full min-w-[900px] text-left text-sm text-slate-600">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-900 text-xs uppercase tracking-wider font-semibold">
            <tr>
              <th className="px-4 py-4">Created</th>
              <th className="px-4 py-4">Customer</th>
              <th className="px-4 py-4">Plan · Location</th>
              <th className="px-4 py-4">Status</th>
              <th className="px-4 py-4 text-right">Price</th>
              <th className="px-4 py-4 text-right">Fee</th>
              <th className="px-4 py-4 text-right">Net</th>
              <th className="px-4 py-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {transactions.map((tx) => {
              const price = tx.amount_kobo ? tx.amount_kobo / 100 : Number(tx.net_amount_ngn || 0);
              const paid = tx.status === 'paid' ? Number(tx.amount_paid || price) : 0;
              const fee = tx.status === 'paid' ? Number(tx.gateway_fee_ngn || 0) : 0;
              return (
                <tr key={tx.id} className="hover:bg-slate-50 transition-colors align-top">
                  <td className="px-4 py-4 text-xs font-mono text-slate-500">
                    {new Date(tx.created_at).toLocaleString('en-NG')}
                    <div className="mt-1 text-[10px] text-slate-400 break-all max-w-[180px]" title={tx.reference}>
                      {tx.reference}
                    </div>
                  </td>
                  <td className="px-4 py-4 font-mono font-bold text-slate-900">{tx.phone_number || 'Unknown'}</td>
                  <td className="px-4 py-4 text-xs text-slate-600">
                    {one(tx.plans)?.name ?? '—'}
                    <div className="text-slate-400">{one(tx.locations)?.name ?? '—'}</div>
                  </td>
                  <td className="px-4 py-4">
                    <StatusBadge status={tx.status} />
                    {tx.failure_reason && <div className="mt-1 text-[11px] text-red-500 max-w-[180px]">{tx.failure_reason}</div>}
                  </td>
                  <td className="px-4 py-4 text-right font-mono text-slate-900">{naira(price)}</td>
                  <td className="px-4 py-4 text-right font-mono text-red-600">{fee ? `-${naira(fee)}` : '—'}</td>
                  <td className="px-4 py-4 text-right font-mono font-bold text-emerald-700">{paid ? naira(paid - fee) : '—'}</td>
                  <td className="px-4 py-4 text-right">
                    {tx.status === 'pending' && /^CONN_/.test(tx.reference) ? <ReconcileButton reference={tx.reference} /> : null}
                  </td>
                </tr>
              );
            })}
            {transactions.length === 0 && (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                  No transactions found.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50">
            <Link
              href={pageHref(currentPage - 1)}
              className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg border transition-colors ${
                currentPage <= 1 ? 'pointer-events-none text-slate-400 border-slate-200 bg-slate-100' : 'text-slate-700 border-slate-300 bg-white hover:bg-slate-50'
              }`}
            >
              Prev
            </Link>
            <span className="text-xs font-bold text-slate-500">Page {currentPage} of {totalPages}</span>
            <Link
              href={pageHref(currentPage + 1)}
              className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg border transition-colors ${
                currentPage >= totalPages ? 'pointer-events-none text-slate-400 border-slate-200 bg-slate-100' : 'text-slate-700 border-slate-300 bg-white hover:bg-slate-50'
              }`}
            >
              Next
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
