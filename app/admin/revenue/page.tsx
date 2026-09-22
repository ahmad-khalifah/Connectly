import { db } from '@/lib/db/client';
import { TrendingUp, DollarSign, PieChart, Activity } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function RevenueAnalyticsPage() {
  const { data: revenueData } = await db
    .from('purchases')
    .select('amount, gateway_fee_ngn, net_amount_ngn, status, created_at, plans(name), locations(name)')
    .in('status', ['paid', 'success']);

  const transactions = revenueData || [];
  const grossRevenue = transactions.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
  const totalFees = transactions.reduce((acc, curr) => acc + Number(curr.gateway_fee_ngn || 0), 0);
  const netRevenue = grossRevenue - totalFees;
  const avgTransactionValue = transactions.length > 0 ? grossRevenue / transactions.length : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <TrendingUp className="h-6 w-6 text-[#6d1825]" /> Revenue Analytics
        </h1>
        <p className="text-sm text-slate-500">Financial performance, gateway fees, and net operating income.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Gross Billed</span>
          <p className="text-2xl font-bold text-slate-900 font-mono">₦{grossRevenue.toLocaleString('en-NG')}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Gateway Fees</span>
          <p className="text-2xl font-bold text-red-600 font-mono">- ₦{totalFees.toLocaleString('en-NG')}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs bg-[#6d1825]/5 border-[#6d1825]/20">
          <span className="text-xs font-bold text-[#6d1825] uppercase tracking-wider block mb-2">Net Recognized</span>
          <p className="text-2xl font-bold text-[#6d1825] font-mono">₦{netRevenue.toLocaleString('en-NG')}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Average Txn</span>
          <p className="text-2xl font-bold text-slate-900 font-mono">₦{Math.round(avgTransactionValue).toLocaleString('en-NG')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
            <PieChart className="h-4 w-4 text-slate-500" />
            <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Historical Performance</h2>
          </div>
          <div className="p-12 text-center flex flex-col items-center justify-center text-slate-400 min-h-[250px]">
            <Activity className="h-8 w-8 mb-3 opacity-50" />
            <p className="text-sm">Aggregate charting requires a visualization library.</p>
            <p className="text-xs mt-1">Integrate Recharts to render monthly revenue distributions.</p>
          </div>
        </div>
      </div>
    </div>
  );
}