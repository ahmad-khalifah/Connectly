'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Field, inputClass, textareaClass } from '@/components/ui/field';
import { Button } from '@/components/ui/button';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { Notice } from '@/components/ui/notice';
import { cn } from '@/lib/utils';
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

const STATE_TONE: Record<HotspotState, BadgeTone> = {
  not_set: 'neutral',
  not_applied: 'warn',
  changes_pending: 'warn',
  applied: 'ok',
  failed: 'bad',
};

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
  const [message, setMessage] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);
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
        setMessage({ tone: 'bad', text: data.message || 'Could not save.' });
      } else {
        setMessage({ tone: 'ok', text: 'Saved. Press "Apply to router" to send it to the router.' });
        router.refresh();
      }
    } catch {
      setMessage({ tone: 'bad', text: 'No connection. Try again.' });
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
      if (!res.ok) setMessage({ tone: 'bad', text: data.message || 'Could not queue it.' });
      else {
        setMessage({ tone: 'ok', text: data.created === false ? 'Already waiting for the controller.' : 'Queued. The controller applies it the next time it reaches the router.' });
        router.refresh();
      }
    } catch {
      setMessage({ tone: 'bad', text: 'No connection. Try again.' });
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
    <section className="rounded-[var(--radius-panel)] border border-line bg-surface">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold text-ink">Customer hotspot</h2>
          <p className="mt-0.5 max-w-[70ch] text-[13px] leading-snug text-muted">
            The controller sets the router up from these settings: the customer port, the address range and DHCP, the sign-in page that sends customers to{' '}
            <span className="break-all font-semibold text-ink">{p.portalUrl}</span>, and the sites they can open before paying.
          </p>
        </div>
        <Badge tone={STATE_TONE[p.state]}>{HOTSPOT_STATE_LABEL[p.state]}{p.saved ? `, version ${p.saved.version}` : ''}</Badge>
      </header>

      <div className="space-y-5 p-5">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Field label="Customer port" htmlFor="hs-port" error={errors.lan_interface} hint="The port or bridge the access points plug into, as RouterOS names it, for example ether2.">
            <input id="hs-port" className={inputClass} value={form.lan_interface} disabled={p.readOnly} onChange={(e) => setForm({ ...form, lan_interface: e.target.value })} />
          </Field>
          <Field label="Router address on the customer network" htmlFor="hs-gw" error={errors.gateway_cidr} hint={capacity ? `Room for ${capacity}.` : 'For example 10.10.0.1/22.'}>
            <input id="hs-gw" className={cn(inputClass, 'tnum')} value={form.gateway_cidr} disabled={p.readOnly} onChange={(e) => setForm({ ...form, gateway_cidr: e.target.value })} />
          </Field>
          <Field label="Hotspot name" htmlFor="hs-dns" error={errors.dns_name} hint="The address customers see for the sign-in page.">
            <input id="hs-dns" className={inputClass} value={form.dns_name} disabled={p.readOnly} onChange={(e) => setForm({ ...form, dns_name: e.target.value })} />
          </Field>
          <Field label="Extra sites allowed before paying" htmlFor="hs-wg" optional error={errors.extra_walled_garden}
            hint={`One per line, for example *.example.com. Always allowed on every router: ${p.sharedWalledGarden.join(', ') || 'none'}.`}>
            <textarea id="hs-wg" className={cn(textareaClass, 'min-h-20')} value={form.extra_walled_garden} disabled={p.readOnly}
              onChange={(e) => setForm({ ...form, extra_walled_garden: e.target.value })} />
          </Field>
        </div>

        {p.saved?.last_error && p.state === 'failed' && <Notice tone="bad" title="The router refused the last change">{p.saved.last_error}</Notice>}
        {p.appliedAtText && <p className="text-[13px] text-muted">Last applied {p.appliedAtText} (version {p.saved?.applied_version}).</p>}

        {!p.readOnly && (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" disabled={busy !== null || !dirty} onClick={save}>{busy === 'save' ? 'Saving…' : 'Save settings'}</Button>
            <Button disabled={busy !== null || dirty || !p.canApply || p.applyPending} title={p.applyBlockedReason ?? ''} onClick={apply}>
              {busy === 'apply' ? 'Queuing…' : p.applyPending ? 'Waiting for controller' : 'Apply to router'}
            </Button>
            {dirty && p.saved && <span className="text-[13px] text-warn">Unsaved changes.</span>}
            {!dirty && p.applyBlockedReason && <span className="text-[13px] text-muted">{p.applyBlockedReason}</span>}
          </div>
        )}
        {message && <Notice tone={message.tone} title={message.text} />}
      </div>
    </section>
  );
}
