import { db } from '@/lib/db/client';
import { lagosToday } from '@/lib/admin/inputs';
import ExpenseForm from './expense-form';
import DeleteExpenseButton from './delete-expense-button';
import { PageHeader } from '@/components/admin/page-header';
import { EmptyRow, TableFrame, td, th, tr } from '@/components/admin/table';
import { Stat, StatGrid } from '@/components/admin/stat-grid';
import { Notice } from '@/components/ui/notice';

export const dynamic = 'force-dynamic';

const CATEGORY: Record<string, string> = {
  backhaul: 'Backhaul (internet)', equipment: 'Equipment', installation: 'Installation', repairs: 'Repairs',
  power: 'Power', staff: 'Staff', marketing: 'Marketing', software: 'Software', other: 'Other',
};
const naira = (n: number) => `₦${n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const day = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

export default async function ExpensesPage() {
  const [expensesRes, locationsRes] = await Promise.all([
    db.from('expenses').select('id, category, amount_ngn, description, expense_date, recorded_by, locations(name)').order('expense_date', { ascending: false }).order('created_at', { ascending: false }),
    db.from('locations').select('id, name').order('name'),
  ]);
  if (expensesRes.error) console.error('[EXPENSES_FETCH_ERROR]', expensesRes.error);

  const expenses = expensesRes.data ?? [];
  const locations = (locationsRes.data ?? []) as { id: string; name: string }[];
  const today = lagosToday();
  const month = today.slice(0, 7);
  const total = expenses.reduce((s, e) => s + Number(e.amount_ngn), 0);
  const thisMonth = expenses.filter((e) => String(e.expense_date).startsWith(month)).reduce((s, e) => s + Number(e.amount_ngn), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expenses"
        description="Running costs: internet backhaul, equipment, power, staff and the rest. They are taken off revenue to give net profit on the dashboard."
      />
      {expensesRes.error && <Notice tone="bad" title="Expenses could not be loaded">The totals below are incomplete. Refresh to try again.</Notice>}

      <StatGrid cols={3}>
        <Stat label="This month" value={naira(thisMonth)} />
        <Stat label="All time" value={naira(total)} />
        <Stat label="Entries" value={expenses.length} />
      </StatGrid>

      <ExpenseForm locations={locations} today={today} />

      <TableFrame>
        <thead>
          <tr>
            <th className={th}>Date</th>
            <th className={th}>Category</th>
            <th className={th}>Location</th>
            <th className={th}>Description</th>
            <th className={th}>Recorded by</th>
            <th className={`${th} text-right`}>Amount</th>
            <th className={th}><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {expenses.map((e) => {
            const loc = (Array.isArray(e.locations) ? e.locations[0] : e.locations) as { name?: string } | null;
            return (
              <tr key={e.id} className={tr}>
                <td className={`${td} tnum whitespace-nowrap`}>{day(String(e.expense_date))}</td>
                <td className={td}>{CATEGORY[e.category] ?? e.category}</td>
                <td className={`${td} text-muted`}>{loc?.name ?? 'General'}</td>
                <td className={`${td} max-w-[320px]`}>{e.description}</td>
                <td className={`${td} text-[13px] text-muted`}>{e.recorded_by}</td>
                <td className={`${td} tnum whitespace-nowrap text-right font-semibold`}>{naira(Number(e.amount_ngn))}</td>
                <td className={`${td} text-right`}><DeleteExpenseButton id={e.id} /></td>
              </tr>
            );
          })}
          {expenses.length === 0 && <EmptyRow cols={7}>No expenses recorded yet. Add the first one above.</EmptyRow>}
        </tbody>
      </TableFrame>
    </div>
  );
}
