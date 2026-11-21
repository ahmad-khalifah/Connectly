'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { RouterInput } from '@/lib/network/routers';
import { PRE_REGISTRATION_STEPS } from '@/lib/network/setup-script';
import { Field, inputClass, selectClass } from '@/components/ui/field';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { adminFetch, refreshAdminData } from '@/components/admin/admin-data';

type LocationOption = { id: string; name: string };
type Props =
  | { mode: 'create'; locations: LocationOption[] }
  | { mode: 'edit'; routerId: string; initial: RouterInput; locations: LocationOption[] };


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
      const res = await adminFetch(props.mode === 'edit' ? `/api/admin/network/routers/${props.routerId}` : '/api/admin/network/routers', {
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
      if (!res.ok) throw new Error(data.message || 'The router was not saved.');
      const id = props.mode === 'edit' ? props.routerId : data.id;
      router.push(`/admin/network/router?id=${id}`);
      refreshAdminData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The router was not saved.');
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="max-w-2xl space-y-5 rounded-[var(--radius-panel)] border border-line bg-surface p-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="r-name" hint="For people, for example “Garki Market main”.">
          <input id="r-name" required maxLength={100} className={inputClass} value={form.name} onChange={(e) => set({ name: e.target.value })} />
        </Field>
        <Field label="Location" htmlFor="r-loc">
          <select id="r-loc" required className={selectClass} value={form.locationId} onChange={(e) => set({ locationId: e.target.value })}>
            {props.locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Identifier" htmlFor="r-ident" hint="Set as the router's identity. The sign-in page uses it to find the location, so it must match exactly.">
          <input id="r-ident" required maxLength={64} placeholder="cx-garki-01" className={inputClass} value={form.identifier} onChange={(e) => set({ identifier: e.target.value.toLowerCase() })} />
        </Field>
        <Field label="How the controller reaches it" htmlFor="r-method">
          <select id="r-method" className={selectClass} value={form.connectionMethod} onChange={(e) => set({ connectionMethod: e.target.value as typeof form.connectionMethod })}>
            <option value="wireguard">WireGuard tunnel to the controller (for live sites)</option>
            <option value="direct_https">Direct HTTPS on the site&apos;s management network</option>
          </select>
        </Field>
      </div>

      {wireguard ? (
        <Field label="Router's WireGuard public key" htmlFor="r-wg" optional hint="44 characters ending in =. You can register now and add it later; the router cannot be activated without it.">
          <input id="r-wg" maxLength={44} className={inputClass} value={form.wgPublicKey} onChange={(e) => set({ wgPublicKey: e.target.value.trim() })} />
          <details className="mt-2 text-[13px] text-muted">
            <summary className="cursor-pointer font-semibold text-brand">How the engineer gets the key</summary>
            <p className="mt-1">On the router, run these two commands and copy the public-key value:</p>
            <pre className="mt-1 overflow-x-auto rounded-md bg-ink p-2 text-[12px] text-white">{PRE_REGISTRATION_STEPS}</pre>
          </details>
        </Field>
      ) : (
        <Field label="Management address (IP or hostname)" htmlFor="r-host" hint="The router's address on the site's private management network, for example 192.168.88.1.">
          <input id="r-host" required maxLength={253} className={inputClass} value={form.managementHost} onChange={(e) => set({ managementHost: e.target.value.trim() })} />
        </Field>
      )}

      <Field label="Model" htmlFor="r-model" optional>
        <input id="r-model" maxLength={100} placeholder="L009UiGS-RM" className={inputClass} value={form.model} onChange={(e) => set({ model: e.target.value })} />
      </Field>

      {props.mode === 'create' && (
        <Notice tone="info">
          Connectly generates this router&apos;s API password and stores it encrypted for the controller. Nobody sees it: the router collects it from the controller during set-up.
        </Notice>
      )}

      {error && <Notice tone="bad" title="Not saved">{error}</Notice>}

      <div className="flex gap-2">
        <Button type="submit" disabled={loading}>{loading ? 'Saving…' : props.mode === 'edit' ? 'Save changes' : 'Register router'}</Button>
        <Button variant="secondary" onClick={() => router.back()}>Cancel</Button>
      </div>
    </form>
  );
}
