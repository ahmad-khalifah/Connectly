'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { PlanInput } from '@/lib/admin/inputs';

type LocationOption = { id: string; name: string; is_active: boolean | null };

type Props =
  | { mode: 'create'; locations: LocationOption[] }
  | { mode: 'edit'; planId: string; initial: PlanInput; locations: LocationOption[] };

const input =
  'w-full rounded-lg border border-gray-300 p-2.5 text-sm outline-none transition-all focus:ring-1 focus:ring-[#6d1825] focus:border-[#6d1825]';

function splitDuration(minutes: number): { value: string; unit: 'minutes' | 'hours' | 'days' } {
  if (minutes > 0 && minutes % 1440 === 0) return { value: String(minutes / 1440), unit: 'days' };
  if (minutes > 0 && minutes % 60 === 0) return { value: String(minutes / 60), unit: 'hours' };
  return { value: minutes ? String(minutes) : '', unit: minutes ? 'minutes' : 'hours' };
}

export default function PlanForm(props: Props) {
  const router = useRouter();
  const initial = props.mode === 'edit' ? props.initial : null;
  const startDuration = splitDuration(initial?.durationMinutes ?? 0);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    priceNaira: initial ? String(initial.priceNaira) : '',
    durationValue: startDuration.value,
    durationUnit: startDuration.unit,
    downloadMbps: String(initial?.downloadMbps ?? 7),
    uploadMbps: String(initial?.uploadMbps ?? 3),
    deviceLimit: String(initial?.deviceLimit ?? 1),
    dataLimitMb: initial?.dataLimitMb ? String(initial.dataLimitMb) : '',
    everywhere: !initial?.allowedLocationIds,
    allowedLocationIds: initial?.allowedLocationIds ?? [],
    isActive: initial?.isActive ?? true,
  });
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const toggleLocation = (id: string) =>
    set({
      allowedLocationIds: form.allowedLocationIds.includes(id)
        ? form.allowedLocationIds.filter((x) => x !== id)
        : [...form.allowedLocationIds, id],
    });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.everywhere && form.allowedLocationIds.length === 0) {
      setError('Choose at least one location, or make the plan available everywhere.');
      return;
    }
    setLoading(true);

    const factor = form.durationUnit === 'days' ? 1440 : form.durationUnit === 'hours' ? 60 : 1;
    const payload = {
      name: form.name,
      priceNaira: Number(form.priceNaira),
      durationMinutes: Math.round(Number(form.durationValue) * factor),
      downloadMbps: Number(form.downloadMbps),
      uploadMbps: Number(form.uploadMbps),
      deviceLimit: Number(form.deviceLimit),
      dataLimitMb: form.dataLimitMb === '' ? null : Number(form.dataLimitMb),
      allowedLocationIds: form.everywhere ? null : form.allowedLocationIds,
      isActive: form.isActive,
    };

    try {
      const res = await fetch(props.mode === 'edit' ? `/api/admin/plans/${props.planId}` : '/api/admin/plans', {
        method: props.mode === 'edit' ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Failed to save the plan.');
      router.push('/admin/plans');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save the plan.');
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
      <h2 className="font-semibold text-gray-900 mb-2 border-b pb-2">
        {props.mode === 'edit' ? 'Edit Plan' : 'Create New Plan'}
      </h2>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="plan-name">Plan Name</label>
        <input id="plan-name" type="text" required maxLength={100} placeholder="e.g., 7 Days Unlimited" className={input}
          value={form.name} onChange={(e) => set({ name: e.target.value })} />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="plan-price">Price (₦)</label>
        <input id="plan-price" type="number" required min="50" step="1" placeholder="500" className={input}
          value={form.priceNaira} onChange={(e) => set({ priceNaira: e.target.value })} />
        {props.mode === 'edit' && (
          <p className="text-xs text-gray-500 mt-1">Price changes apply to new purchases only. Past purchases keep what they were charged.</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="plan-duration">Duration</label>
          <input id="plan-duration" type="number" required min="1" placeholder="24" className={input}
            value={form.durationValue} onChange={(e) => set({ durationValue: e.target.value })} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="plan-unit">Unit</label>
          <select id="plan-unit" className={`${input} bg-white`} value={form.durationUnit}
            onChange={(e) => set({ durationUnit: e.target.value as typeof form.durationUnit })}>
            <option value="minutes">Minutes</option>
            <option value="hours">Hours</option>
            <option value="days">Days</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="plan-dl">Download (Mbps)</label>
          <input id="plan-dl" type="number" required min="1" max="1000" step="1" className={input}
            value={form.downloadMbps} onChange={(e) => set({ downloadMbps: e.target.value })} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="plan-ul">Upload (Mbps)</label>
          <input id="plan-ul" type="number" required min="1" max="1000" step="1" className={input}
            value={form.uploadMbps} onChange={(e) => set({ uploadMbps: e.target.value })} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="plan-devices">Devices per purchase</label>
          <input id="plan-devices" type="number" required min="1" max="10" step="1" className={input}
            value={form.deviceLimit} onChange={(e) => set({ deviceLimit: e.target.value })} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="plan-cap">Data cap (MB)</label>
          <input id="plan-cap" type="number" min="1" step="1" placeholder="Unlimited" className={input}
            value={form.dataLimitMb} onChange={(e) => set({ dataLimitMb: e.target.value })} />
        </div>
      </div>

      <fieldset className="space-y-2">
        <legend className="block text-sm font-medium text-gray-700 mb-1">Where can customers buy it?</legend>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={form.everywhere} onChange={(e) => set({ everywhere: e.target.checked })} />
          Every location
        </label>
        {!form.everywhere && (
          <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-200 p-3 space-y-2">
            {props.locations.length === 0 && <p className="text-xs text-gray-500">No locations yet.</p>}
            {props.locations.map((loc) => (
              <label key={loc.id} className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={form.allowedLocationIds.includes(loc.id)} onChange={() => toggleLocation(loc.id)} />
                {loc.name}
                {loc.is_active === false && <span className="text-[10px] uppercase text-gray-400">inactive</span>}
              </label>
            ))}
          </div>
        )}
      </fieldset>

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={form.isActive} onChange={(e) => set({ isActive: e.target.checked })} />
        Available for sale
      </label>

      {error && <p className="text-sm text-red-600 font-medium" role="alert">{error}</p>}

      <button type="submit" disabled={loading}
        className="w-full rounded-lg py-2.5 text-sm font-bold text-white transition-opacity disabled:opacity-50 shadow-sm bg-[#6d1825]">
        {loading ? 'Saving Plan...' : props.mode === 'edit' ? 'Save Changes' : 'Save Plan'}
      </button>
    </form>
  );
}
