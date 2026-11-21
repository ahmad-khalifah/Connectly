'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LOCATION_STATUSES, LOCATION_TYPES, slugify, type LocationInput } from '@/lib/admin/inputs';
import { Field, inputClass, selectClass } from '@/components/ui/field';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { adminFetch, refreshAdminData } from '@/components/admin/admin-data';

type Institution = { id: string; name: string };
type Props =
  | { mode: 'create'; institutions: Institution[] }
  | { mode: 'edit'; locationId: string; initial: LocationInput; institutions: Institution[] };


const TYPE_LABELS: Record<string, string> = {
  campus_facility: 'Campus facility', hostel: 'Hostel', market: 'Market', office: 'Office',
  public_space: 'Public space', other: 'Other',
};

export default function LocationForm(props: Props) {
  const router = useRouter();
  const initial = props.mode === 'edit' ? props.initial : null;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [slugTouched, setSlugTouched] = useState(props.mode === 'edit');
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    slug: initial?.slug ?? '',
    building: initial?.building ?? '',
    address: initial?.address ?? '',
    contactPhone: initial?.contactPhone ? '0' + initial.contactPhone.slice(3) : '',
    locationType: initial?.locationType ?? 'campus_facility',
    status: initial?.status ?? 'active',
    isActive: initial?.isActive ?? true,
    institutionId: initial?.institutionId ?? '',
  });
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  const [slugOk, setSlugOk] = useState(false);
  const slugChanged = props.mode === 'edit' && initial !== null && form.slug !== initial.slug;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (slugChanged && !slugOk) {
      setError('Tick the box to confirm the link change, or put the old link name back.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await adminFetch(props.mode === 'edit' ? `/api/admin/locations/${props.locationId}` : '/api/admin/locations', {
        method: props.mode === 'edit' ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, institutionId: form.institutionId || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'The location was not saved.');
      const id = props.mode === 'edit' ? props.locationId : data.data?.id;
      router.push(id ? `/admin/location?id=${id}` : '/admin/locations');
      refreshAdminData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The location was not saved.');
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-5 rounded-[var(--radius-panel)] border border-line bg-surface p-6">
      <Field label="Location name" htmlFor="loc-name" hint="As customers know it, for example “Garki Market, Aliyu Modibbo Block”.">
        <input id="loc-name" type="text" required maxLength={255} className={inputClass}
          value={form.name}
          onChange={(e) => set(slugTouched ? { name: e.target.value } : { name: e.target.value, slug: slugify(e.target.value) })} />
      </Field>

      <Field label="Link name" htmlFor="loc-slug" hint={<>Used in the information link: /connect?loc={form.slug || '…'}. Lowercase letters, numbers and dashes.</>}>
        <input id="loc-slug" type="text" required maxLength={100} pattern="[a-z0-9]+(-[a-z0-9]+)*" className={inputClass} value={form.slug}
          onChange={(e) => { setSlugTouched(true); setSlugOk(false); set({ slug: e.target.value.toLowerCase() }); }} />
      </Field>
      {slugChanged && (
        <Notice tone="warn" title="This changes the location's information link">
          Posters and QR codes printed with /connect?loc={initial?.slug} will stop working.
          <label className="mt-2 flex items-center gap-2 font-semibold">
            <input type="checkbox" className="h-4 w-4" checked={slugOk} onChange={(e) => setSlugOk(e.target.checked)} /> I understand, change it
          </label>
        </Notice>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Building or zone" htmlFor="loc-building" optional>
          <input id="loc-building" type="text" maxLength={100} className={inputClass} value={form.building} onChange={(e) => set({ building: e.target.value })} />
        </Field>
        <Field label="Type of place" htmlFor="loc-type">
          <select id="loc-type" className={selectClass} value={form.locationType} onChange={(e) => set({ locationType: e.target.value })}>
            {LOCATION_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
          </select>
        </Field>
      </div>

      <Field label="Address" htmlFor="loc-address" optional>
        <input id="loc-address" type="text" maxLength={500} className={inputClass} value={form.address} onChange={(e) => set({ address: e.target.value })} />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Site contact phone" htmlFor="loc-phone" optional>
          <input id="loc-phone" type="tel" inputMode="tel" placeholder="0803 000 0000" className={inputClass} value={form.contactPhone} onChange={(e) => set({ contactPhone: e.target.value })} />
        </Field>
        <Field label="Institution" htmlFor="loc-inst">
          <select id="loc-inst" className={selectClass} value={form.institutionId} onChange={(e) => set({ institutionId: e.target.value })}>
            <option value="">None (independent site)</option>
            {props.institutions.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-2">
        <Field label="Site status" htmlFor="loc-status" hint="Your own note on the site. Router health is measured separately.">
          <select id="loc-status" className={selectClass} value={form.status} onChange={(e) => set({ status: e.target.value as typeof form.status })}>
            {LOCATION_STATUSES.map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
          </select>
        </Field>
        <label className="flex items-center gap-2 pb-7 text-sm font-semibold">
          <input type="checkbox" className="h-4 w-4 accent-[var(--color-brand)]" checked={form.isActive} onChange={(e) => set({ isActive: e.target.checked })} />
          Selling plans here
        </label>
      </div>

      {error && <Notice tone="bad" title="Not saved">{error}</Notice>}

      <div className="flex gap-2">
        <Button type="submit" disabled={loading}>{loading ? 'Saving…' : props.mode === 'edit' ? 'Save changes' : 'Create location'}</Button>
        <Button variant="secondary" onClick={() => router.back()}>Cancel</Button>
      </div>
    </form>
  );
}
