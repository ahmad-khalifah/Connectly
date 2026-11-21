'use client';

import { useState } from 'react';
import { Field, inputClass } from '@/components/ui/field';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { Panel } from '@/components/ui/panel';
import { adminFetch } from '@/components/admin/admin-data';

export default function SmsTestCard({ configured }: { configured: boolean }) {
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      const res = await adminFetch('/api/admin/sms/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const json = await res.json().catch(() => ({}));
      setResult(
        res.ok
          ? { ok: true, text: `Sent. Termii message ID: ${json.messageId ?? 'not returned'}` }
          : { ok: false, text: json.message || 'Sending failed.' }
      );
    } catch {
      setResult({ ok: false, text: 'No connection. Try again.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel title="SMS delivery test" description="Sends a fixed test message through Termii and records it. Use your own number.">
      <div className="space-y-4">
        {!configured && (
          <Notice tone="info" title="Pending provider approval">
            Termii has not approved the sender ID yet, so SMS is not active. Payments and WiFi access work as normal, and customers see their code on the payment page.
            Once approved, set TERMII_API_KEY, TERMII_SENDER_ID and TERMII_BASE_URL, redeploy, and send a test here.
          </Notice>
        )}
        <form onSubmit={send} className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <Field label="Phone number" htmlFor="sms-phone" className="flex-1">
            <input id="sms-phone" type="tel" inputMode="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0803 123 4567" className={inputClass} />
          </Field>
          <Button type="submit" variant="secondary" size="lg" disabled={busy}>{busy ? 'Sending…' : 'Send test SMS'}</Button>
        </form>
        {result && <Notice tone={result.ok ? 'ok' : 'bad'} title={result.text} />}
      </div>
    </Panel>
  );
}
