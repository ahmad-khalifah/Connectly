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
