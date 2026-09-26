import { Receipt } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export default async function ExpensesPage() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseRoleKey) {
    return <div className="p-6 text-red-500">Critical Error: Missing Supabase Admin Keys</div>;
  }

  const supabase = createClient(supabaseUrl, supabaseRoleKey);

  const [expensesRes, locationsRes] = await Promise.all([
    supabase.from('expenses').select('*, locations(name)').order('expense_date', { ascending: false }),
    supabase.from('locations').select('id, name')
  ]);

  if (expensesRes.error) console.error('[EXPENSES_FETCH_ERROR]', expensesRes.error);

  const expenses = expensesRes.data || [];
  const totalOpex = expenses.reduce((acc, curr) => acc + Number(curr.amount_ngn), 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Receipt className="h-6 w-6 text-[#6d1825]" /> Operating Expenditures (OPEX)
          </h1>
          <p className="text-sm text-slate-500">Track and allocate network operational overhead against revenue.</p>
        </div>
        <div className="text-right">
          <span className="text-xs text-slate-400 block uppercase">Total Documented Expenses</span>
          <span className="text-2xl font-mono font-bold text-slate-900">
            ₦{totalOpex.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-900 text-xs uppercase tracking-wider font-semibold">
            <tr>
              <th className="px-6 py-4">Expense Date</th>
              <th className="px-6 py-4">Category</th>
              <th className="px-6 py-4">Facility / Location</th>
              <th className="px-6 py-4">Description</th>
              <th className="px-6 py-4">Logged By</th>
              <th className="px-6 py-4 text-right">Amount (NGN)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {expenses.map((expense) => (
              <tr key={expense.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 font-mono text-xs">{expense.expense_date}</td>
                <td className="px-6 py-4">
                  <span className="px-2 py-0.5 rounded text-[11px] font-mono uppercase font-bold bg-slate-100 text-slate-700">
                    {expense.category}
                  </span>
                </td>
                <td className="px-6 py-4 font-medium text-slate-900">
                  {expense.locations?.name || 'General / Network-Wide'}
                </td>
                <td className="px-6 py-4 text-slate-500">{expense.description}</td>
                <td className="px-6 py-4 text-xs font-mono text-slate-400">{expense.recorded_by}</td>
                <td className="px-6 py-4 font-mono font-bold text-slate-900 text-right">
                  ₦{Number(expense.amount_ngn).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                </td>
              </tr>
            ))}
            {expenses.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                  No operating expenses logged yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}