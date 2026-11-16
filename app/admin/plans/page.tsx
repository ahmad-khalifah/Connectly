import { CreditCard, Plus, Wifi, Zap, Smartphone, Pencil, Database } from 'lucide-react';
import Link from 'next/link';
import { db } from '@/lib/db/client';
import { formatDuration, planToInput } from '@/lib/admin/inputs';
import PlanStatusButton from '../components/plan-status-button';

export const dynamic = 'force-dynamic';

export default async function PlansPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const { show } = await searchParams;
  const showArchived = show === 'all';

  const [{ data: plans, error }, { data: locations }, { data: paid }] = await Promise.all([
    db.from('plans').select('*').order('price_kobo', { ascending: true }),
    db.from('locations').select('id, name'),
    db.from('purchases').select('plan_id').eq('status', 'paid'),
  ]);
  if (error) console.error('[PLANS_FETCH_ERROR]', error);

  const locationName = new Map((locations ?? []).map((l) => [l.id, l.name as string]));
  const paidByPlan = new Map<string, number>();
  for (const p of paid ?? []) paidByPlan.set(p.plan_id, (paidByPlan.get(p.plan_id) ?? 0) + 1);

  const all = (plans ?? []).map((row) => ({ id: row.id as string, ...planToInput(row), paidCount: paidByPlan.get(row.id) ?? 0 }));
  const archivedCount = all.filter((p) => !p.isActive).length;
  const visible = showArchived ? all : all.filter((p) => p.isActive);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <CreditCard className="h-6 w-6 text-[#6d1825]" /> Plans & Pricing
          </h1>
          <p className="text-sm text-slate-500">Internet access tiers, speeds, and where each can be bought.</p>
        </div>
        <div className="flex items-center gap-3">
          {archivedCount > 0 && (
            <Link href={showArchived ? '/admin/plans' : '/admin/plans?show=all'} className="text-sm font-semibold text-slate-500 hover:text-[#6d1825]">
              {showArchived ? 'Hide archived' : `Show archived (${archivedCount})`}
            </Link>
          )}
          <Link href="/admin/plans/new"
            className="flex items-center gap-2 px-4 py-2 bg-[#6d1825] text-white text-sm font-semibold rounded-lg hover:bg-[#5a141e] transition-colors">
            <Plus className="h-4 w-4" /> New Plan
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {visible.map((plan) => {
          const where = plan.allowedLocationIds
            ? plan.allowedLocationIds.map((id) => locationName.get(id) ?? 'Unknown location').join(', ')
            : 'All locations';
          return (
            <div key={plan.id} className={`bg-white rounded-xl border border-slate-200 p-6 shadow-xs ${plan.isActive ? '' : 'opacity-70'}`}>
              <div className="flex items-start justify-between gap-2 mb-1">
                <h2 className="text-lg font-bold text-slate-900">{plan.name}</h2>
                {!plan.isActive && (
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] font-bold uppercase rounded border border-slate-200">Archived</span>
                )}
              </div>
              <div className="text-2xl font-extrabold text-slate-900 font-mono tracking-tight mb-4">
                ₦{plan.priceNaira.toLocaleString('en-NG')}
                <span className="text-sm font-normal text-slate-500 ml-1">/ {formatDuration(plan.durationMinutes)}</span>
              </div>

              <div className="space-y-3 pt-4 border-t border-slate-100 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-slate-600"><Zap className="h-4 w-4 text-emerald-500" /> Speed</span>
                  <span className="font-mono font-bold text-slate-900">{plan.downloadMbps} / {plan.uploadMbps} Mbps</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-slate-600"><Smartphone className="h-4 w-4 text-blue-500" /> Devices</span>
                  <span className="font-mono font-bold text-slate-900">{plan.deviceLimit}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-slate-600"><Database className="h-4 w-4 text-purple-500" /> Data cap</span>
                  <span className="font-mono font-bold text-slate-900">{plan.dataLimitMb ? `${plan.dataLimitMb.toLocaleString('en-NG')} MB` : 'Unlimited'}</span>
                </div>
                <div className="flex items-start justify-between gap-2">
                  <span className="flex items-center gap-2 text-slate-600 shrink-0"><Wifi className="h-4 w-4 text-amber-500" /> Sold at</span>
                  <span className="font-semibold text-slate-900 text-right">{where}</span>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 flex justify-between items-center">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Paid purchases <span className="text-[#6d1825] ml-1">{plan.paidCount}</span>
                </span>
                <div className="flex items-center gap-1">
                  <Link href={`/admin/plans/${plan.id}`}
                    className="flex items-center gap-1 px-2 py-1 text-xs font-semibold text-slate-500 hover:text-[#6d1825] hover:bg-slate-50 rounded-md">
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </Link>
                  <PlanStatusButton planId={plan.id} isActive={plan.isActive} />
                </div>
              </div>
            </div>
          );
        })}

        {visible.length === 0 && (
          <div className="col-span-full p-12 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
            No active plans. Create a plan to accept payments.
          </div>
        )}
      </div>
    </div>
  );
}
