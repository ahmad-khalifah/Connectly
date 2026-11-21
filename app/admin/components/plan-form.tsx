'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { PlanInput } from '@/lib/admin/inputs';
import { Field, inputClass, selectClass } from '@/components/ui/field';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { naira, planData, planDevices, planDuration, planSpeed } from '@/lib/plan-format';

type LocationOption = { id: string; name: string; is_active: boolean | null };

type Props =
  | { mode: 'create'; locations: LocationOption[] }
  | { mode: 'edit'; planId: string; initial: PlanInput; locations: LocationOption[] };

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
  const factor = form.durationUnit === 'days' ? 1440 : form.durationUnit === 'hours' ? 60 : 1;
  const minutes = Math.round(Number(form.durationValue || 0) * factor);

  const toggleLocation = (id: string) =>
    set({ allowedLocationIds: form.allowedLocationIds.includes(id) ? form.allowedLocationIds.filter((x) => x !== id) : [...form.allowedLocationIds, id] });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.everywhere && form.allowedLocationIds.length === 0) {
      setError('Choose at least one location, or make the plan available everywhere.');
      return;
    }
    setLoading(true);
    const payload = {
      name: form.name,
      priceNaira: Number(form.priceNaira),
      durationMinutes: minutes,
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
      if (!res.ok) throw new Error(data.message || 'The plan was not saved.');
      router.push('/admin/plans');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The plan was not saved.');
      setLoading(false);
    }
  };

  const details = [planDuration(minutes * 60), planData(form.dataLimitMb ? Number(form.dataLimitMb) : null), planDevices(Number(form.deviceLimit) || 1), planSpeed(Number(form.downloadMbps) || null)].filter(Boolean);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <form onSubmit={handleSubmit} className="space-y-5 rounded-[var(--radius-panel)] border border-line bg-surface p-6">
        <Field label="Plan name" htmlFor="plan-name" hint="Customers see this name, so say what they get, for example “1 day” or “Weekly, 2 devices”.">
          <input id="plan-name" type="text" required maxLength={100} placeholder="1 day" className={inputClass} value={form.name} onChange={(e) => set({ name: e.target.value })} />
        </Field>

        <Field label="Price (₦)" htmlFor="plan-price" hint={props.mode === 'edit' ? 'Applies to new purchases only. Past purchases keep what they paid.' : 'At least ₦50.'}>
          <input id="plan-price" type="number" required min="50" step="1" placeholder="500" className={inputClass} value={form.priceNaira} onChange={(e) => set({ priceNaira: e.target.value })} />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Duration" htmlFor="plan-duration">
            <input id="plan-duration" type="number" required min="1" placeholder="24" className={inputClass} value={form.durationValue} onChange={(e) => set({ durationValue: e.target.value })} />
          </Field>
          <Field label="Unit" htmlFor="plan-unit">
            <select id="plan-unit" className={selectClass} value={form.durationUnit} onChange={(e) => set({ durationUnit: e.target.value as typeof form.durationUnit })}>
              <option value="minutes">Minutes</option>
              <option value="hours">Hours</option>
              <option value="days">Days</option>
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Download speed (Mbps)" htmlFor="plan-dl">
            <input id="plan-dl" type="number" required min="1" max="1000" step="1" className={inputClass} value={form.downloadMbps} onChange={(e) => set({ downloadMbps: e.target.value })} />
          </Field>
          <Field label="Upload speed (Mbps)" htmlFor="plan-ul">
            <input id="plan-ul" type="number" required min="1" max="1000" step="1" className={inputClass} value={form.uploadMbps} onChange={(e) => set({ uploadMbps: e.target.value })} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Devices per purchase" htmlFor="plan-devices" hint="Enforced by the router.">
            <input id="plan-devices" type="number" required min="1" max="10" step="1" className={inputClass} value={form.deviceLimit} onChange={(e) => set({ deviceLimit: e.target.value })} />
          </Field>
          <Field label="Data cap (MB)" htmlFor="plan-cap" optional hint="Empty for unlimited. 1 GB = 1024 MB.">
            <input id="plan-cap" type="number" min="1" step="1" placeholder="Unlimited" className={inputClass} value={form.dataLimitMb} onChange={(e) => set({ dataLimitMb: e.target.value })} />
          </Field>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold text-ink">Where customers can buy it</legend>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4 accent-[var(--color-brand)]" checked={form.everywhere} onChange={(e) => set({ everywhere: e.target.checked })} />
            Every location
          </label>
          {!form.everywhere && (
            <div className="max-h-48 space-y-2 overflow-y-auto rounded-[var(--radius-control)] border border-line p-3">
              {props.locations.length === 0 && <p className="text-[13px] text-muted">No locations yet.</p>}
              {props.locations.map((loc) => (
                <label key={loc.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" className="h-4 w-4 accent-[var(--color-brand)]" checked={form.allowedLocationIds.includes(loc.id)} onChange={() => toggleLocation(loc.id)} />
                  {loc.name}
                  {loc.is_active === false && <span className="text-[12px] text-subtle">(not selling)</span>}
                </label>
              ))}
            </div>
          )}
        </fieldset>

        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" className="h-4 w-4 accent-[var(--color-brand)]" checked={form.isActive} onChange={(e) => set({ isActive: e.target.checked })} />
          On sale
        </label>

        {error && <Notice tone="bad" title="Not saved">{error}</Notice>}

        <div className="flex gap-2">
          <Button type="submit" disabled={loading}>{loading ? 'Saving…' : props.mode === 'edit' ? 'Save changes' : 'Create plan'}</Button>
          <Button variant="secondary" onClick={() => router.push('/admin/plans')}>Cancel</Button>
        </div>
      </form>

      <aside className="h-fit space-y-2 lg:sticky lg:top-6">
        <p className="text-sm font-semibold text-muted">How customers see it</p>
        <div className="rounded-[var(--radius-panel)] border border-line bg-surface px-4 py-4">
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-semibold text-ink">{form.name || 'Plan name'}</span>
            <span className="tnum text-lg font-bold text-ink">{form.priceNaira ? naira(Number(form.priceNaira)) : '₦—'}</span>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-muted">
            {details.map((d) => <span key={d as string}>{d}</span>)}
          </div>
        </div>
        {!form.isActive && <p className="text-[13px] text-warn">Not on sale: customers will not see it.</p>}
      </aside>
    </div>
  );
}
