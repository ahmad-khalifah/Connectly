'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { RouterInput } from '@/lib/network/routers';
import { PRE_REGISTRATION_STEPS } from '@/lib/network/setup-script';

type LocationOption = { id: string; name: string };
type Props =
  | { mode: 'create'; locations: LocationOption[] }
  | { mode: 'edit'; routerId: string; initial: RouterInput; locations: LocationOption[] };

const input =
  'w-full rounded-lg border border-gray-300 p-2.5 text-sm outline-none transition-all focus:ring-1 focus:ring-[#6d1825] focus:border-[#6d1825]';

export default function RouterForm(props: Props) {
  const router = useRouter();
  const initial = props.mode === 'edit' ? props.initial : null;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    locationId: initial?.locationId ?? props.locations[0]?.id ?? '',
    identifier: initial?.identifier ?? '',
    connectionMethod: initial?.connectionMethod ?? 'wireguard',
    wgPublicKey: initial?.wgPublicKey ?? '',
    managementHost: initial?.managementHost ?? '',
    hotspotServerName: initial?.hotspotServerName ?? 'hs-main',
    model: initial?.model ?? '',
  });
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  const wireguard = form.connectionMethod === 'wireguard';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch(props.mode === 'edit' ? `/api/admin/network/routers/${props.routerId}` : '/api/admin/network/routers', {
        method: props.mode === 'edit' ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          wgPublicKey: wireguard ? form.wgPublicKey || null : null,
          managementHost: wireguard ? null : form.managementHost || null,
          model: form.model || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Could not save the router.');
      const id = props.mode === 'edit' ? props.routerId : data.id;
      router.push(`/admin/network/routers/${id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the router.');
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="r-name">Name</label>
          <input id="r-name" required maxLength={100} placeholder="e.g., Garki Market main" className={input}
            value={form.name} onChange={(e) => set({ name: e.target.value })} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="r-loc">Location</label>
          <select id="r-loc" required className={`${input} bg-white`} value={form.locationId} onChange={(e) => set({ locationId: e.target.value })}>
            {props.locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="r-ident">Identifier</label>
          <input id="r-ident" required maxLength={64} placeholder="garki-01" className={`${input} font-mono`}
            value={form.identifier} onChange={(e) => set({ identifier: e.target.value.toLowerCase() })} />
          <p className="text-xs text-gray-500 mt-1">The router&apos;s identity name; the captive portal uses it to find the location.</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="r-method">Connection</label>
          <select id="r-method" className={`${input} bg-white`} value={form.connectionMethod}
            onChange={(e) => set({ connectionMethod: e.target.value as typeof form.connectionMethod })}>
            <option value="wireguard">WireGuard tunnel to the controller (recommended)</option>
            <option value="direct_https">Direct HTTPS (management network or public IP)</option>
          </select>
        </div>
      </div>

      {wireguard ? (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="r-wg">Router&apos;s WireGuard public key</label>
          <input id="r-wg" maxLength={44} placeholder="44 characters ending in =" className={`${input} font-mono`}
            value={form.wgPublicKey} onChange={(e) => set({ wgPublicKey: e.target.value.trim() })} />
          <details className="text-xs text-gray-500 mt-1">
            <summary className="cursor-pointer">How the engineer gets this</summary>
            <p className="mt-1">On the router, run these two commands and copy the <span className="font-mono">public-key</span> value:</p>
            <pre className="mt-1 p-2 bg-slate-900 text-slate-100 rounded overflow-x-auto">{PRE_REGISTRATION_STEPS}</pre>
            <p className="mt-1">You can register now and add the key later. The router can&apos;t be activated without it.</p>
          </details>
        </div>
      ) : (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="r-host">Management address (IP or hostname)</label>
          <input id="r-host" required maxLength={253} className={`${input} font-mono`}
            value={form.managementHost} onChange={(e) => set({ managementHost: e.target.value.trim() })} />
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="r-model">Model (optional)</label>
          <input id="r-model" maxLength={100} placeholder="e.g., hAP ax3" className={input}
            value={form.model} onChange={(e) => set({ model: e.target.value })} />
        </div>
      </div>

      {props.mode === 'create' && (
        <p className="text-xs text-gray-600 bg-slate-50 border border-slate-200 rounded-lg p-3">
          Connectly generates this router&apos;s API password and stores it encrypted for the controller.
          Nobody sees it: the controller sends it to the router through the tunnel during setup.
        </p>
      )}

      {error && <p className="text-sm text-red-600 font-medium" role="alert">{error}</p>}

      <button type="submit" disabled={loading}
        className="w-full rounded-lg py-2.5 text-sm font-bold text-white transition-opacity disabled:opacity-50 shadow-sm bg-[#6d1825]">
        {loading ? 'Saving…' : props.mode === 'edit' ? 'Save changes' : 'Register router'}
      </button>
    </form>
  );
}
