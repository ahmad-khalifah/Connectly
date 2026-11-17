'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Wifi } from 'lucide-react';
import { describeNetwork, HOTSPOT_DEFAULTS, HOTSPOT_STATE_LABEL, type HotspotState } from '@/lib/network/hotspot';

type Saved = { lan_interface: string; gateway_cidr: string; dns_name: string; extra_walled_garden: string[]; version: number; applied_version: number | null; applied_at: string | null; last_error: string | null };

type Props = {
  routerId: string;
  saved: Saved | null;
  state: HotspotState;
  appliedAtText: string | null;
  applyPending: boolean;
  canApply: boolean;
  applyBlockedReason: string | null;
  portalUrl: string;
  sharedWalledGarden: string[];
  readOnly: boolean;
};

const STATE_STYLE: Record<HotspotState, string> = {
  not_set: 'bg-slate-100 text-slate-600 border-slate-200',
  not_applied: 'bg-amber-50 text-amber-800 border-amber-200',
  changes_pending: 'bg-amber-50 text-amber-800 border-amber-200',
  applied: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  failed: 'bg-red-50 text-red-700 border-red-200',
};

const field = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#6d1825]/30 disabled:bg-slate-50';

export default function HotspotCard(p: Props) {
  const router = useRouter();
  const initial = p.saved ?? HOTSPOT_DEFAULTS;
  const [form, setForm] = useState({
    lan_interface: initial.lan_interface,
    gateway_cidr: initial.gateway_cidr,
    dns_name: initial.dns_name,
    extra_walled_garden: initial.extra_walled_garden.join('\n'),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<'save' | 'apply' | null>(null);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const capacity = describeNetwork(form.gateway_cidr);

  const save = async () => {
    setBusy('save');
    setMessage(null);
    setErrors({});
    try {
      const res = await fetch(`/api/admin/network/routers/${p.routerId}/hotspot`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrors(data.errors ?? {});
        setMessage({ tone: 'error', text: data.message || 'Could not save.' });
      } else {
        setMessage({ tone: 'ok', text: 'Saved. Press "Apply to router" to send it to the router.' });
        router.refresh();
      }
    } catch {
      setMessage({ tone: 'error', text: 'Network error. Please try again.' });
    } finally {
      setBusy(null);
    }
  };

  const apply = async () => {
    setBusy('apply');
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/network/routers/${p.routerId}/apply-hotspot`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setMessage({ tone: 'error', text: data.message || 'Could not queue it.' });
      else {
        setMessage({ tone: 'ok', text: data.created === false ? 'Already waiting for the controller.' : 'Queued. The controller applies it the next time it reaches the router.' });
        router.refresh();
      }
    } catch {
      setMessage({ tone: 'error', text: 'Network error. Please try again.' });
    } finally {
      setBusy(null);
    }
  };

  const dirty = !p.saved
    || form.lan_interface !== p.saved.lan_interface
    || form.gateway_cidr !== p.saved.gateway_cidr
    || form.dns_name !== p.saved.dns_name
    || form.extra_walled_garden.split(/[\s,]+/).filter(Boolean).join(',') !== p.saved.extra_walled_garden.join(',');

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2"><Wifi className="h-4 w-4 text-[#6d1825]" /> Customer hotspot</h2>
        <span className={`px-2 py-0.5 rounded-full border text-xs font-semibold ${STATE_STYLE[p.state]}`}>
          {HOTSPOT_STATE_LABEL[p.state]}{p.saved ? ` · v${p.saved.version}` : ''}
        </span>
      </div>
      <p className="text-xs text-slate-600">
        The controller sets the router up as a hotspot from these settings: customer port, Wi-Fi address range and DHCP, the login page that sends customers to{' '}
        <span className="font-mono">{p.portalUrl}</span>, and the sites customers can open before paying.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="space-y-1 text-sm">
          <span className="font-semibold text-slate-700">Customer port</span>
          <input className={field} value={form.lan_interface} disabled={p.readOnly} onChange={(e) => setForm({ ...form, lan_interface: e.target.value })} />
          <span className="block text-xs text-slate-500">The port or bridge the access points plug into, as RouterOS names it (e.g. ether2, bridge-hotspot).</span>
          {errors.lan_interface && <span className="block text-xs text-red-700">{errors.lan_interface}</span>}
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-semibold text-slate-700">Router address on the customer network</span>
          <input className={field} value={form.gateway_cidr} disabled={p.readOnly} onChange={(e) => setForm({ ...form, gateway_cidr: e.target.value })} />
          <span className="block text-xs text-slate-500">{capacity ? `Room for ${capacity}.` : 'e.g. 10.10.0.1/22'}</span>
          {errors.gateway_cidr && <span className="block text-xs text-red-700">{errors.gateway_cidr}</span>}
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-semibold text-slate-700">Hotspot name</span>
          <input className={field} value={form.dns_name} disabled={p.readOnly} onChange={(e) => setForm({ ...form, dns_name: e.target.value })} />
          <span className="block text-xs text-slate-500">The address customers see for the login page.</span>
          {errors.dns_name && <span className="block text-xs text-red-700">{errors.dns_name}</span>}
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-semibold text-slate-700">Extra sites allowed before paying</span>
          <textarea className={`${field} h-20`} value={form.extra_walled_garden} disabled={p.readOnly} placeholder="one per line, e.g. *.example.com"
            onChange={(e) => setForm({ ...form, extra_walled_garden: e.target.value })} />
          <span className="block text-xs text-slate-500">Always allowed for every router: {p.sharedWalledGarden.join(', ')}.</span>
          {errors.extra_walled_garden && <span className="block text-xs text-red-700">{errors.extra_walled_garden}</span>}
        </label>
      </div>

      {p.saved?.last_error && p.state === 'failed' && (
        <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">Router said: {p.saved.last_error}</p>
      )}
      {p.appliedAtText && <p className="text-xs text-slate-500">Last applied {p.appliedAtText} (v{p.saved?.applied_version}).</p>}

      {!p.readOnly && (
        <div className="flex flex-wrap items-center gap-2">
          <button className="px-3 py-2 rounded-lg text-sm font-semibold border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            disabled={busy !== null || !dirty} onClick={save}>
            {busy === 'save' ? 'Saving…' : 'Save settings'}
          </button>
          <button className="px-3 py-2 rounded-lg text-sm font-semibold border border-[#6d1825] bg-[#6d1825] text-white hover:bg-[#561320] disabled:opacity-40"
            disabled={busy !== null || dirty || !p.canApply || p.applyPending} title={p.applyBlockedReason ?? ''} onClick={apply}>
            {busy === 'apply' ? 'Queuing…' : p.applyPending ? 'Waiting for controller' : 'Apply to router'}
          </button>
          {dirty && p.saved && <span className="text-xs text-amber-700">Unsaved changes.</span>}
          {!dirty && p.applyBlockedReason && <span className="text-xs text-slate-500">{p.applyBlockedReason}</span>}
        </div>
      )}
      {message && <p className={`text-sm ${message.tone === 'ok' ? 'text-emerald-700' : 'text-red-700'}`}>{message.text}</p>}
    </div>
  );
}
