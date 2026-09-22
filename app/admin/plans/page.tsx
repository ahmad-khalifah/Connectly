import { db } from '@/lib/db/client';
import { CreditCard, Plus, Wifi, Zap, Smartphone } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function PlansPage() {
  const { data: plans } = await db
    .from('plans')
    .select(`
      id,
      name,
      price,
      duration_hours,
      speed_down_mbps,
      speed_up_mbps,
      device_limit,
      is_active,
      subscriptions(id)
    `)
    .order('price', { ascending: true });

  const formattedPlans = plans?.map(plan => {
    const activeSubs = plan.subscriptions ? plan.subscriptions.length : 0;
    return { ...plan, activeSubs };
  }) || [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <CreditCard className="h-6 w-6 text-[#6d1825]" /> Plans & Pricing
          </h1>
          <p className="text-sm text-slate-500">Manage internet access tiers, speed limits, and roaming constraints.</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-[#6d1825] text-white text-sm font-semibold rounded-lg hover:bg-[#5a141e] transition-colors">
          <Plus className="h-4 w-4" /> New Plan
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {formattedPlans.map((plan) => (
          <div key={plan.id} className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs relative overflow-hidden">
            {!plan.is_active && (
              <div className="absolute top-4 right-4 px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] font-bold uppercase rounded border border-slate-200">
                Disabled
              </div>
            )}
            <h2 className="text-lg font-bold text-slate-900 mb-1">{plan.name}</h2>
            <div className="text-2xl font-extrabold text-slate-900 font-mono tracking-tight mb-4">
              ₦{Number(plan.price).toLocaleString('en-NG')}
              <span className="text-sm font-normal text-slate-500 ml-1">/ {plan.duration_hours} hrs</span>
            </div>

            <div className="space-y-3 pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-slate-600"><Zap className="h-4 w-4 text-emerald-500"/> Bandwidth</span>
                <span className="font-mono font-bold text-slate-900">{plan.speed_down_mbps}Mbps / {plan.speed_up_mbps}Mbps</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-slate-600"><Smartphone className="h-4 w-4 text-blue-500"/> Device Limit</span>
                <span className="font-mono font-bold text-slate-900">{plan.device_limit}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-slate-600"><Wifi className="h-4 w-4 text-amber-500"/> Roaming Limit</span>
                <span className="font-bold text-slate-900">Unrestricted</span>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 flex justify-between items-center">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Historical Subs</span>
              <span className="text-sm font-bold text-[#6d1825]">{plan.activeSubs}</span>
            </div>
          </div>
        ))}

        {formattedPlans.length === 0 && (
          <div className="col-span-full p-12 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
            No active plans available. Create a plan to accept payments.
          </div>
        )}
      </div>
    </div>
  );
}