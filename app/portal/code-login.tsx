'use client';

import { useState } from 'react';
import { normaliseWifiCode, codeLoginHref } from '@/lib/network/code-login';

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
    window.location.href = codeLoginHref(loginUrl, code);
  };

  return (
    <form onSubmit={submit} className="w-full" aria-label="Log in with a WiFi code">
      <label htmlFor="wifi-code" className="block text-sm font-medium text-gray-700 mb-2">{heading}</label>
      <div className="flex gap-2">
        <input
          id="wifi-code"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          inputMode="text"
          placeholder="K7M2Q9XP"
          className="min-w-0 flex-1 border border-gray-300 rounded-lg p-3 font-mono tracking-widest uppercase focus:outline-none focus:ring-2 focus:ring-[#6d1825]"
        />
        <button
          type="submit"
          disabled={busy || raw.trim() === ''}
          className="shrink-0 rounded-lg border border-[#6d1825] px-4 font-semibold text-[#6d1825] hover:bg-[#6d1825]/5 disabled:opacity-50"
        >
          {busy ? 'Connecting...' : 'Connect'}
        </button>
      </div>
      {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
      <p className="mt-2 text-xs text-gray-500">Your code is on the payment confirmation page. A plan for several devices uses the same code on each.</p>
    </form>
  );
}
