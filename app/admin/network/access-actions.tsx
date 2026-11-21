'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { adminFetch, refreshAdminData } from '@/components/admin/admin-data';

/** End a live code now. Two steps; the warning is shown before confirming. */
export default function RevokeButton({ grantId, voucher }: { grantId: string; voucher: string | null }) {
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const revoke = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await adminFetch(`/api/admin/network/access/${grantId}/revoke`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data.message || 'That did not work.');
      else refreshAdminData();
    } catch {
      setError('No connection. Try again.');
    } finally {
      setBusy(false);
      setArmed(false);
    }
  };

  if (armed) {
    return (
      <div className="w-56 rounded-[var(--radius-control)] border border-bad/30 bg-bad-soft p-3 text-left" role="alertdialog" aria-label="Confirm revoke">
        <p className="text-[13px] leading-snug text-ink">End {voucher ?? 'this code'} now? The customer is disconnected and cannot sign in again. The payment is not refunded.</p>
        <div className="mt-2 flex gap-2">
          <Button size="sm" variant="danger" disabled={busy} onClick={revoke}>{busy ? 'Queuing…' : 'Revoke'}</Button>
          <Button size="sm" variant="secondary" onClick={() => setArmed(false)}>Keep</Button>
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-end gap-1">
      <Button size="sm" variant="danger" onClick={() => setArmed(true)}>Revoke</Button>
      {error && <span className="text-[12px] text-bad">{error}</span>}
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
      const res = await adminFetch(`/api/admin/network/access/${grantId}/resend`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      setNote(res.ok ? { ok: true, text: 'Sent to the paying phone.' } : { ok: false, text: data.message || 'That did not work.' });
    } catch {
      setNote({ ok: false, text: 'No connection. Try again.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <Button size="sm" variant="secondary" disabled={busy} onClick={resend}>{busy ? 'Sending…' : 'Resend code by SMS'}</Button>
      {note && <span className={`max-w-56 text-right text-[12px] ${note.ok ? 'text-ok' : 'text-bad'}`}>{note.text}</span>}
    </div>
  );
}
