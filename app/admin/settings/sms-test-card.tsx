'use client';

import { useState } from 'react';
import { MessageSquare } from 'lucide-react';

export default function SmsTestCard({ configured }: { configured: boolean }) {
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch('/api/admin/sms/test', {
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
      setResult({ ok: false, text: 'Network error.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6">
      <h2 className="text-lg font-bold text-slate-900 mb-1 flex items-center gap-2">
        <MessageSquare className="h-5 w-5 text-[#6d1825]" /> SMS delivery test
      </h2>
      <p className="text-xs text-slate-500 mb-4">
        Sends a fixed test message through Termii and records it. Use your own number.
      </p>
      {!configured && (
        <p className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          <span className="font-semibold">Pending provider approval.</span> Termii has not approved the sender ID yet, so SMS is not active.
          Payments and WiFi access work as normal, and customers see their code on the payment page.
          Once approved, set TERMII_API_KEY, TERMII_SENDER_ID and TERMII_BASE_URL, redeploy, and send a test here.
        </p>
      )}
      <form onSubmit={send} className="flex flex-col sm:flex-row gap-2">
        <input
          type="tel"
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="080XXXXXXXX"
          className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6d1825]"
        />
        <button
          type="submit"
          disabled={busy}
          className="px-4 py-2 bg-slate-900 text-white text-sm font-semibold rounded-lg hover:bg-slate-800 disabled:opacity-50"
        >
          {busy ? 'Sending…' : 'Send test SMS'}
        </button>
      </form>
      {result && <p className={`mt-3 text-sm ${result.ok ? 'text-emerald-700' : 'text-red-600'}`}>{result.text}</p>}
    </div>
  );
}
