'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/** Two-step remove (no browser dialog): "Remove", then "Confirm". */
export default function DeleteExpenseButton({ id }: { id: string }) {
  const router = useRouter();
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const remove = async () => {
    setBusy(true);
    setError('');
    const res = await fetch(`/api/admin/expenses/${id}`, { method: 'DELETE' });
    if (res.ok) { router.refresh(); return; }
    const data = await res.json().catch(() => ({}));
    setError(data.message || 'Could not remove it.');
    setBusy(false);
    setArmed(false);
  };

  if (error) return <span className="text-xs text-red-600">{error}</span>;
  if (!armed) {
    return <button onClick={() => setArmed(true)} className="text-xs font-semibold text-slate-500 hover:text-red-700">Remove</button>;
  }
  return (
    <span className="inline-flex gap-2">
      <button onClick={remove} disabled={busy} className="text-xs font-semibold text-red-700 hover:underline disabled:opacity-50">
        {busy ? 'Removing…' : 'Confirm'}
      </button>
      <button onClick={() => setArmed(false)} className="text-xs text-slate-500 hover:underline">Keep</button>
    </span>
  );
}
