import { db } from '@/lib/db/client';
import { fetchAll } from '@/lib/db/fetch-all';
import { isUuid } from '@/lib/admin/inputs';
import { DEFINITIONS, isPeriod, PERIODS, revenueBreakdown, type BreakdownPurchase, type BreakdownRow, type ExpenseRow, type Period } from '@/lib/admin/metrics';
import { PageHeader } from '@/components/admin/page-header';
import { DashboardFilters } from '@/components/admin/dashboard-filters';
import { EmptyRow, TableFrame, td, th, tr } from '@/components/admin/table';
import { Notice } from '@/components/ui/notice';

export const dynamic = 'force-dynamic';

const naira = (n: number) => `₦${n.toLocaleString('en-NG', { maximumFractionDigits: 2 })}`;

export default async function RevenuePage({ searchParams }: { searchParams: Promise<{ period?: string; location?: string }> }) {
  const sp = await searchParams;
  const period: Period = isPeriod(sp.period) ? sp.period : '30d';
  const locationId = isUuid(sp.location) ? sp.location : null;
  const periodLabel = PERIODS.find((p) => p.id === period)!.label.toLowerCase();

  const [locationsRes, plansRes, data] = await Promise.all([
    db.from('locations').select('id, name').order('name'),
    db.from('plans').select('id, name'),
    Promise.all([
      fetchAll<BreakdownPurchase>((f, t) => db.from('purchases').select('status, amount_paid, amount_kobo, gateway_fee_ngn, paid_at, created_at, expires_at, location_id, phone_number, plan_id').eq('status', 'paid').order('created_at').range(f, t)),
      fetchAll<ExpenseRow>((f, t) => db.from('expenses').select('amount_ngn, expense_date, location_id').order('expense_date').range(f, t)),
    ]).then(([p, e]) => ({ ok: true as const, p, e }), (err: Error) => ({ ok: false as const, err })),
  ]);

  const locations = (locationsRes.data ?? []) as { id: string; name: string }[];
  const locName = new Map(locations.map((l) => [l.id, l.name]));
  const planName = new Map(((plansRes.data ?? []) as { id: string; name: string }[]).map((p) => [p.id, p.name]));
  const b = data.ok ? revenueBreakdown(data.p, data.e, { period, locationId, now: new Date() }) : null;

  const totals = (rows: BreakdownRow[]) => rows.reduce((s, r) => ({ payments: s.payments + r.payments, revenue: s.revenue + r.revenue, fees: s.fees + r.fees, afterFees: s.afterFees + r.afterFees, expenses: s.expenses + r.expenses, net: s.net + r.net }), { payments: 0, revenue: 0, fees: 0, afterFees: 0, expenses: 0, net: 0 });

  return (
    <div className="space-y-6">
      <PageHeader title="Revenue" description={`Where the money came from, ${periodLabel}. Same definitions as the dashboard; days are Lagos days.`} />
      <DashboardFilters period={period} locationId={locationId} locations={locations} basePath="/admin/revenue" />

      {!b ? (
        <Notice tone="bad" title="Revenue could not be loaded">The database did not answer ({data.ok ? '' : data.err.message}). Refresh to try again.</Notice>
      ) : (
        <>
          <section className="space-y-3" aria-labelledby="by-location">
            <h2 id="by-location" className="text-lg font-bold text-ink">By location</h2>
            <TableFrame>
              <thead>
                <tr>
                  <th className={th}>Location</th>
                  <th className={`${th} text-right`}>Payments</th>
                  <th className={`${th} text-right`}>Revenue</th>
                  <th className={`${th} text-right`}>Korapay fees</th>
                  <th className={`${th} text-right`}>After fees</th>
                  <th className={`${th} text-right`}>Expenses</th>
                  <th className={`${th} text-right`}>Net</th>
                </tr>
              </thead>
              <tbody className="tnum">
                {b.byLocation.map((r) => (
                  <tr key={r.id ?? 'none'} className={tr}>
                    <td className={`${td} font-semibold`}>{r.id ? locName.get(r.id) ?? 'Unknown location' : 'No location'}</td>
                    <td className={`${td} text-right`}>{r.payments}</td>
                    <td className={`${td} text-right`}>{naira(r.revenue)}</td>
                    <td className={`${td} text-right text-muted`}>{naira(r.fees)}</td>
                    <td className={`${td} text-right`}>{naira(r.afterFees)}</td>
                    <td className={`${td} text-right text-muted`}>{naira(r.expenses)}</td>
                    <td className={`${td} text-right font-semibold ${r.net < 0 ? 'text-bad' : ''}`}>{naira(r.net)}</td>
                  </tr>
                ))}
                {b.byLocation.length === 0 && <EmptyRow cols={7}>No paid purchases or expenses {periodLabel}.</EmptyRow>}
              </tbody>
              {b.byLocation.length > 0 && (() => {
                const t = totals(b.byLocation);
                const net = t.net - b.generalExpenses;
                return (
                  <tfoot className="tnum border-t-2 border-line-strong">
                    {b.generalExpenses > 0 && (
                      <tr className="border-t border-line">
                        <td className={`${td} text-muted`}>General expenses (no location)</td>
                        <td className={td} colSpan={4} />
                        <td className={`${td} text-right text-muted`}>{naira(b.generalExpenses)}</td>
                        <td className={`${td} text-right`}>{naira(-b.generalExpenses)}</td>
                      </tr>
                    )}
                    <tr className="border-t border-line font-semibold">
                      <td className={td}>Total</td>
                      <td className={`${td} text-right`}>{t.payments}</td>
                      <td className={`${td} text-right`}>{naira(t.revenue)}</td>
                      <td className={`${td} text-right`}>{naira(t.fees)}</td>
                      <td className={`${td} text-right`}>{naira(t.afterFees)}</td>
                      <td className={`${td} text-right`}>{naira(t.expenses + b.generalExpenses)}</td>
                      <td className={`${td} text-right ${net < 0 ? 'text-bad' : ''}`}>{naira(net)}</td>
                    </tr>
                  </tfoot>
                );
              })()}
            </TableFrame>
          </section>

          <section className="space-y-3" aria-labelledby="by-plan">
            <h2 id="by-plan" className="text-lg font-bold text-ink">By plan</h2>
            <TableFrame>
              <thead>
                <tr>
                  <th className={th}>Plan</th>
                  <th className={`${th} text-right`}>Payments</th>
                  <th className={`${th} text-right`}>Revenue</th>
                  <th className={`${th} text-right`}>Share of revenue</th>
                  <th className={`${th} text-right`}>Average paid</th>
                </tr>
              </thead>
              <tbody className="tnum">
                {(() => {
                  const total = b.byPlan.reduce((s, r) => s + r.revenue, 0);
                  return b.byPlan.map((r) => (
                    <tr key={r.id ?? 'none'} className={tr}>
                      <td className={`${td} font-semibold`}>{r.id ? planName.get(r.id) ?? 'Deleted plan' : 'No plan'}</td>
                      <td className={`${td} text-right`}>{r.payments}</td>
                      <td className={`${td} text-right`}>{naira(r.revenue)}</td>
                      <td className={`${td} text-right text-muted`}>{total ? `${Math.round((r.revenue / total) * 100)}%` : '—'}</td>
                      <td className={`${td} text-right text-muted`}>{r.payments ? naira(Math.round((r.revenue / r.payments) * 100) / 100) : '—'}</td>
                    </tr>
                  ));
                })()}
                {b.byPlan.length === 0 && <EmptyRow cols={5}>No paid purchases {periodLabel}.</EmptyRow>}
              </tbody>
            </TableFrame>
          </section>

          <p className="max-w-[80ch] text-[13px] leading-relaxed text-muted">
            {DEFINITIONS.find((d) => d.name === 'Revenue')?.how} {DEFINITIONS.find((d) => d.name === 'Expenses')?.how} Net is revenue after fees minus expenses.
          </p>
        </>
      )}
    </div>
  );
}
