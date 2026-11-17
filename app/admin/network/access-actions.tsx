'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function RevokeButton({ grantId, voucher }: { grantId: string; voucher: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const revoke = async () => {
    if (!window.confirm(`End access for voucher ${voucher ?? ''} now? The customer is disconnected and cannot log in again. This does not refund the payment.`)) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/network/access/${grantId}/revoke`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data.message || 'That did not work.');
      else router.refresh();
    } catch {
      setError('Network error.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button disabled={busy} onClick={revoke}
        className="px-2 py-1 text-xs font-semibold rounded border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50">
        {busy ? 'Queuing...' : 'Revoke now'}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}

export function ResendButton({ grantId }: { grantId: string }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  const resend = async () => {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch(`/api/admin/network/access/${grantId}/resend`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      setNote(res.ok ? { ok: true, text: 'Sent to the paying phone.' } : { ok: false, text: data.message || 'That did not work.' });
    } catch {
      setNote({ ok: false, text: 'Network error.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button disabled={busy} onClick={resend}
        className="px-2 py-1 text-xs font-semibold rounded border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50">
        {busy ? 'Sending...' : 'Resend code'}
      </button>
      {note && <span className={`text-xs ${note.ok ? 'text-emerald-700' : 'text-red-600'}`}>{note.text}</span>}
    </div>
  );
}
