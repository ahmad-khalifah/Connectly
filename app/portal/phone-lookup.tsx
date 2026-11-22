'use client';

import { useState } from 'react';
import { normaliseNigerianMobile } from '@/lib/phone';
import { Button } from '@/components/ui/button';
import { inputClass } from '@/components/ui/field';

/**
 * "Use my phone number": for a customer who paid on THIS phone and lost the
 * connection. The server only finds a plan when the number, the router and
 * this device all match the purchase, then returns a login link for this
 * device (the code is never shown). Anyone else is sent to the code box or
 * to WhatsApp.
 */
export default function PhoneLookup({ routerId, mac }: { routerId: string; mac: string }) {
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!normaliseNigerianMobile(phone.trim())) {
      setError('Enter the mobile number you paid with, for example 08031234567.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const res = await fetch('/api/portal/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ routerId, mac, phone: phone.trim() }),
      });
      const data = (await res.json()) as { ok: boolean; connectUrl?: string; error?: string };
      if (data.ok && data.connectUrl) {
        window.location.assign(data.connectUrl);
        return;
      }
      setError(data.error ?? 'Something went wrong. Please try again.');
    } catch {
      setError('Could not reach the server. Check your WiFi and try again.');
    }
    setBusy(false);
  };

  return (
    <form onSubmit={submit} className="w-full" aria-label="Get back online with your phone number">
      <label htmlFor="paid-phone" className="block text-[15px] font-semibold text-ink">The phone number you paid with</label>
      <p className="mt-1 text-[13px] text-muted">Works on the same phone you paid from.</p>
      <div className="mt-3 flex gap-2">
        <input
          id="paid-phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={phone}
          onChange={(e) => { setPhone(e.target.value); setError(null); }}
          placeholder="08031234567"
          aria-invalid={error ? true : undefined}
          className={`${inputClass} min-w-0 flex-1`}
        />
        <Button type="submit" size="lg" disabled={busy || phone.trim() === ''}>
          {busy ? 'Checking…' : 'Get online'}
        </Button>
      </div>
      {error && <p role="alert" className="mt-2 text-[13px] text-bad">{error}</p>}
    </form>
  );
}
