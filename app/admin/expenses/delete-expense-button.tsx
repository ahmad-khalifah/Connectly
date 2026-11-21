'use client';

import { useState } from 'react';
import { adminFetch, refreshAdminData } from '@/components/admin/admin-data';

/** Two-step remove (no browser dialog): "Remove", then "Confirm". */
export default function DeleteExpenseButton({ id }: { id: string }) {
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const remove = async () => {
    setBusy(true);
    setError('');
    const res = await adminFetch(`/api/admin/expenses/${id}`, { method: 'DELETE' });
    if (res.ok) { refreshAdminData(); return; }
    const data = await res.json().catch(() => ({}));
    setError(data.message || 'Could not remove it.');
    setBusy(false);
    setArmed(false);
  };

  if (error) return <span className="text-[13px] text-bad">{error}</span>;
  if (!armed) {
    return <button onClick={() => setArmed(true)} className="text-[13px] font-semibold text-muted hover:text-bad">Remove</button>;
  }
  return (
    <span className="inline-flex gap-2">
      <button onClick={remove} disabled={busy} className="text-[13px] font-semibold text-bad hover:underline disabled:opacity-50">
        {busy ? 'Removing…' : 'Confirm'}
      </button>
      <button onClick={() => setArmed(false)} className="text-[13px] text-muted hover:underline">Keep</button>
    </span>
  );
}
