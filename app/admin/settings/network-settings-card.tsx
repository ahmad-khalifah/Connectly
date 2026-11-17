'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Globe } from 'lucide-react';

const field = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#6d1825]/30';

export default function NetworkSettingsCard({ portalUrl, hosts }: { portalUrl: string; hosts: string[] }) {
  const router = useRouter();
  const [form, setForm] = useState({ portal_url: portalUrl, walled_garden_hosts: hosts.join('\n') });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const save = async () => {
    if (!window.confirm('Change these for every router? Each configured router gets its hotspot updated by the controller.')) return;
    setBusy(true); setErrors({}); setMessage(null);
    try {
      const res = await fetch('/api/admin/network/settings', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(form) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setErrors(data.errors ?? {}); setMessage({ ok: false, text: data.message || 'Could not save.' }); }
      else {
        setMessage({ ok: true, text: data.routersQueued == null ? 'Saved. Routers pick it up when their hotspot is next applied.' : `Saved. Hotspot update queued on ${data.routersQueued} router${data.routersQueued === 1 ? '' : 's'}.` });
        router.refresh();
      }
    } catch { setMessage({ ok: false, text: 'Network error. Please try again.' }); }
    finally { setBusy(false); }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
      <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2"><Globe className="h-4 w-4 text-[#6d1825]" /> Customer portal and walled garden</h2>
      <p className="text-xs text-slate-600">Used by every router. The login page sends customers to the portal; the sites below open before paying (the portal&apos;s own site is always included).</p>
      <label className="block space-y-1 text-sm">
        <span className="font-semibold text-slate-700">Portal address</span>
        <input className={field} value={form.portal_url} onChange={(e) => setForm({ ...form, portal_url: e.target.value })} />
        {errors.portal_url && <span className="block text-xs text-red-700">{errors.portal_url}</span>}
      </label>
      <label className="block space-y-1 text-sm">
        <span className="font-semibold text-slate-700">Sites allowed before paying</span>
        <textarea className={`${field} h-28`} value={form.walled_garden_hosts} onChange={(e) => setForm({ ...form, walled_garden_hosts: e.target.value })} />
        <span className="block text-xs text-slate-500">One per line. Include every host Korapay&apos;s checkout loads, or payment pages will not open on the WiFi.</span>
        {errors.walled_garden_hosts && <span className="block text-xs text-red-700">{errors.walled_garden_hosts}</span>}
      </label>
      <button disabled={busy} onClick={save} className="px-4 py-2 rounded-lg bg-[#6d1825] text-white text-sm font-semibold hover:bg-[#561320] disabled:opacity-50">
        {busy ? 'Saving…' : 'Save for all routers'}
      </button>
      {message && <p className={`text-sm ${message.ok ? 'text-emerald-700' : 'text-red-700'}`}>{message.text}</p>}
    </div>
  );
}
