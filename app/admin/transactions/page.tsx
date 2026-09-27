import { ArrowLeftRight, Search, CheckCircle2, XCircle, Clock } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string }>;
}) {
  const resolvedParams = await searchParams;
  const currentPage = Number(resolvedParams.page) || 1;
  const searchQuery = resolvedParams.search || '';
  const ITEMS_PER_PAGE = 30;
  const from = (currentPage - 1) * ITEMS_PER_PAGE;
  const to = from + ITEMS_PER_PAGE - 1;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseRoleKey) {
    return <div className="p-6 text-red-500">Critical Error: Missing Supabase Admin Keys</div>;
  }

  const supabase = createClient(supabaseUrl, supabaseRoleKey);

  // Added 'status' back to the select array since we know it exists
  let query = supabase
    .from('purchases')
    .select(`
      id,
      gateway_fee_ngn,
      net_amount_ngn,
      payment_gateway,
      created_at,
      phone_number,
      status, 
      locations(name)
    `, { count: 'exact' })
    .order('created_at', { ascending: false });

  if (searchQuery) {
    query = query.ilike('phone_number', `%${searchQuery}%`);
  }

  const { data: transactions, count, error } = await query.range(from, to);
  
  if (error) {
    console.error('[TRANSACTIONS_FETCH_ERROR]', error);
  }

  const totalPages = count ? Math.ceil(count / ITEMS_PER_PAGE) : 1;

  // Accurately render based on the actual database status ENUM
  const renderStatus = (status: string) => {
    if (status === 'completed') {
      return <span className="flex items-center w-fit gap-1 text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded text-[11px] font-bold uppercase border border-emerald-200"><CheckCircle2 className="h-3 w-3" /> Success</span>;
    }
    return <span className="flex items-center w-fit gap-1 text-amber-600 bg-amber-50 px-2 py-0.5 rounded text-[11px] font-bold uppercase border border-amber-200"><Clock className="h-3 w-3" /> Pending</span>;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ArrowLeftRight className="h-6 w-6 text-[#6d1825]" /> Transactions
          </h1>
          <p className="text-sm text-slate-500">Monitor raw payment gateway logs and billing events.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-900 text-xs uppercase tracking-wider font-semibold">
            <tr>
              <th className="px-6 py-4">Timestamp</th>
              <th className="px-6 py-4">Customer</th>
              <th className="px-6 py-4">Location</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Gross (NGN)</th>
              <th className="px-6 py-4 text-right">Net (NGN)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {transactions?.map((tx) => {
              const loc = tx.locations as any;
              const locName = Array.isArray(loc) ? loc[0]?.name : loc?.name;
              
              const netAmount = Number(tx.net_amount_ngn || 0);
              const feeAmount = Number(tx.gateway_fee_ngn || 0);
              const grossAmount = netAmount + feeAmount;

              return (
                <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 text-xs font-mono text-slate-500">
                    {new Date(tx.created_at).toLocaleString('en-NG')}
                  </td>
                  <td className="px-6 py-4 font-mono font-bold text-slate-900">
                    {tx.phone_number || 'Unknown'}
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-500">
                    {locName || 'Remote'}
                  </td>
                  <td className="px-6 py-4">{renderStatus(tx.status)}</td>
                  <td className="px-6 py-4 text-right font-mono font-bold text-slate-900">
                    ₦{grossAmount.toLocaleString('en-NG')}
                  </td>
                  <td className="px-6 py-4 text-xs font-mono text-slate-500">
  {new Date(tx.created_at).toLocaleString('en-NG', { timeZone: 'Africa/Lagos' })}
</td>
                </tr>
              );
            })}
            {(!transactions || transactions.length === 0) && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                  No transactions found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50">
            <Link 
              href={`?page=${currentPage - 1}`}
              className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg border transition-colors ${
                currentPage <= 1 ? 'pointer-events-none text-slate-400 border-slate-200 bg-slate-100' : 'text-slate-700 border-slate-300 bg-white hover:bg-slate-50'
              }`}
            >
              Prev
            </Link>
            <span className="text-xs font-bold text-slate-500">Page {currentPage} of {totalPages}</span>
            <Link 
              href={`?page=${currentPage + 1}`}
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