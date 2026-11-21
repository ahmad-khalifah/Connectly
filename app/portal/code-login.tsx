'use client';

import { useState } from 'react';
import { normaliseWifiCode, codeLoginHref } from '@/lib/network/code-login';
import { Button } from '@/components/ui/button';
import { inputClass } from '@/components/ui/field';
import { cn } from '@/lib/utils';

/**
 * "Already paid?" form: sends this device to the router's own login page
 * with the WiFi code. Used by a second device on a multi-device plan, and by
 * a paying device whose session ended (left the WiFi, phone slept) while the
 * plan is still running. The login URL is worked out on the server from the
 * router; nothing from the address bar decides where the code is sent.
 */
export default function CodeLogin({ loginUrl, heading = 'Already paid? Enter your WiFi code' }: { loginUrl: string; heading?: string }) {
  const [raw, setRaw] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = normaliseWifiCode(raw);
    if (!code) {
      setError('WiFi codes are 8 letters and numbers, for example K7M2Q9XP.');
      return;
    }
    setError(null);
    setBusy(true);
    window.location.assign(codeLoginHref(loginUrl, code));
  };

  return (
    <form onSubmit={submit} className="w-full" aria-label="Sign in with a WiFi code">
      <label htmlFor="wifi-code" className="block text-[15px] font-semibold text-ink">{heading}</label>
      <p className="mt-1 text-[13px] text-muted">The code is on your payment page. Plans for several devices use the same code on each.</p>
      <div className="mt-3 flex gap-2">
        <input
          id="wifi-code"
          value={raw}
          onChange={(e) => { setRaw(e.target.value); setError(null); }}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          placeholder="K7M2Q9XP"
          aria-invalid={error ? true : undefined}
          className={cn(inputClass, 'min-w-0 flex-1 font-semibold uppercase tracking-[0.18em]')}
        />
        <Button type="submit" variant="secondary" size="lg" disabled={busy || raw.trim() === ''}>
          {busy ? 'Connecting…' : 'Connect'}
        </Button>
      </div>
      {error && <p role="alert" className="mt-2 text-[13px] text-bad">{error}</p>}
    </form>
  );
}
