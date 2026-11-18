'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Field, inputClass, textareaClass } from '@/components/ui/field';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { Panel } from '@/components/ui/panel';
import { cn } from '@/lib/utils';

export default function NetworkSettingsCard({ portalUrl, hosts }: { portalUrl: string; hosts: string[] }) {
  const router = useRouter();
  const [form, setForm] = useState({ portal_url: portalUrl, walled_garden_hosts: hosts.join('\n') });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const dirty = form.portal_url !== portalUrl || form.walled_garden_hosts.split(/\s+/).filter(Boolean).join(',') !== hosts.join(',');

  const save = async () => {
    setAsking(false);
    setBusy(true); setErrors({}); setMessage(null);
    try {
      const res = await fetch('/api/admin/network/settings', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(form) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setErrors(data.errors ?? {}); setMessage({ ok: false, text: data.message || 'Not saved.' }); }
      else {
        setMessage({ ok: true, text: data.routersQueued == null ? 'Saved. Routers pick it up when their hotspot is next applied.' : `Saved. Hotspot update queued on ${data.routersQueued} router${data.routersQueued === 1 ? '' : 's'}.` });
        router.refresh();
      }
    } catch { setMessage({ ok: false, text: 'No connection. Try again.' }); }
    finally { setBusy(false); }
  };

  return (
    <Panel title="Customer portal and sites allowed before paying" description="Used by every router. Each router's sign-in page sends customers to the portal; the sites below open before paying (the portal's own site is always included).">
      <div className="space-y-5">
        <Field label="Portal address" htmlFor="ns-portal" error={errors.portal_url}>
          <input id="ns-portal" className={inputClass} value={form.portal_url} onChange={(e) => setForm({ ...form, portal_url: e.target.value })} />
        </Field>
        <Field label="Sites allowed before paying" htmlFor="ns-wg" error={errors.walled_garden_hosts}
          hint="One per line. Include every host Korapay's checkout loads, or payment pages will not open on the WiFi.">
          <textarea id="ns-wg" className={cn(textareaClass, 'min-h-28')} value={form.walled_garden_hosts} onChange={(e) => setForm({ ...form, walled_garden_hosts: e.target.value })} />
        </Field>
        {asking ? (
          <div className="rounded-[var(--radius-control)] border border-line bg-canvas p-4" role="alertdialog" aria-label="Confirm">
            <p className="text-sm font-semibold text-ink">Change these for every router?</p>
            <p className="mt-0.5 text-sm text-muted">The controller updates the hotspot on each configured router.</p>
            <div className="mt-3 flex gap-2">
              <Button size="sm" onClick={save}>Save for all routers</Button>
              <Button size="sm" variant="secondary" onClick={() => setAsking(false)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <Button disabled={busy || !dirty} onClick={() => setAsking(true)}>{busy ? 'Saving…' : 'Save for all routers'}</Button>
        )}
        {message && <Notice tone={message.ok ? 'ok' : 'bad'} title={message.text} />}
      </div>
    </Panel>
  );
}
