'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LOCATION_STATUSES, LOCATION_TYPES, slugify, type LocationInput } from '@/lib/admin/inputs';

type Institution = { id: string; name: string };
type Props =
  | { mode: 'create'; institutions: Institution[] }
  | { mode: 'edit'; locationId: string; initial: LocationInput; institutions: Institution[] };

const input =
  'w-full rounded-lg border border-gray-300 p-2.5 text-sm outline-none transition-all focus:ring-1 focus:ring-[#6d1825] focus:border-[#6d1825]';

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (props.mode === 'edit' && initial && form.slug !== initial.slug &&
      !window.confirm('Changing the slug changes this location’s portal link. Printed QR codes that use the old link will stop working. Continue?')) {
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(props.mode === 'edit' ? `/api/admin/locations/${props.locationId}` : '/api/admin/locations', {
        method: props.mode === 'edit' ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, institutionId: form.institutionId || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Failed to save the location.');
      const id = props.mode === 'edit' ? props.locationId : data.data?.id;
      router.push(id ? `/admin/locations/${id}` : '/admin/locations');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save the location.');
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="loc-name">Location Name</label>
        <input id="loc-name" type="text" required maxLength={255} placeholder="e.g., Silver Hostel Block B" className={input}
          value={form.name}
          onChange={(e) => set(slugTouched ? { name: e.target.value } : { name: e.target.value, slug: slugify(e.target.value) })} />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="loc-slug">URL Slug</label>
        <input id="loc-slug" type="text" required maxLength={100} pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="silver-hostel-b"
          className={`${input} bg-gray-50 font-mono`} value={form.slug}
          onChange={(e) => { setSlugTouched(true); set({ slug: e.target.value.toLowerCase() }); }} />
        <p className="text-xs text-gray-500 mt-1">Forms the portal and QR code link: /connect?loc={form.slug || '…'}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="loc-building">Building / Zone</label>
          <input id="loc-building" type="text" maxLength={100} placeholder="e.g., Block B" className={input}
            value={form.building} onChange={(e) => set({ building: e.target.value })} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="loc-type">Type</label>
          <select id="loc-type" className={`${input} bg-white`} value={form.locationType} onChange={(e) => set({ locationType: e.target.value })}>
            {LOCATION_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="loc-address">Address</label>
        <input id="loc-address" type="text" maxLength={500} className={input} value={form.address} onChange={(e) => set({ address: e.target.value })} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="loc-phone">Site contact phone</label>
          <input id="loc-phone" type="tel" inputMode="tel" placeholder="0803 000 0000" className={input}
            value={form.contactPhone} onChange={(e) => set({ contactPhone: e.target.value })} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="loc-inst">Institution</label>
          <select id="loc-inst" className={`${input} bg-white`} value={form.institutionId} onChange={(e) => set({ institutionId: e.target.value })}>
            <option value="">Independent facility</option>
            {props.institutions.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="loc-status">Network status</label>
          <select id="loc-status" className={`${input} bg-white`} value={form.status} onChange={(e) => set({ status: e.target.value as typeof form.status })}>
            {LOCATION_STATUSES.map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700 pb-2.5">
          <input type="checkbox" checked={form.isActive} onChange={(e) => set({ isActive: e.target.checked })} />
          Accepting payments
        </label>
      </div>

      {error && <p className="text-sm text-red-600 font-medium" role="alert">{error}</p>}

      <button type="submit" disabled={loading}
        className="w-full rounded-lg py-2.5 text-sm font-bold text-white transition-opacity disabled:opacity-50 shadow-sm bg-[#6d1825]">
        {loading ? 'Saving…' : props.mode === 'edit' ? 'Save Changes' : 'Save Location'}
      </button>
    </form>
  );
}
