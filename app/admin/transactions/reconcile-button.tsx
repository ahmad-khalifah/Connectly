'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';

// Asks the server to re-check a pending payment with Korapay's verify API.
// The server decides; this button never sets a status itself.
export default function ReconcileButton({ reference }: { reference: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const run = async () => {
    setBusy(true);
    setMessage('');
    try {
      const res = await fetch('/api/admin/payments/reconcile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference }),
      });
      const json = await res.json().catch(() => ({}));
      setMessage(res.ok ? String(json.outcome ?? 'done').replace(/_/g, ' ') : json.message || 'Check failed');
      router.refresh();
    } catch {
      setMessage('Network error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={run}
        disabled={busy}
        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide rounded-md border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50"
        title="Ask Korapay for the current status of this payment"
      >
        <RefreshCw className={`h-3 w-3 ${busy ? 'animate-spin' : ''}`} /> Check with Korapay
      </button>
      {message && <span className="text-[11px] text-slate-500">{message}</span>}
    </div>
  );
}
