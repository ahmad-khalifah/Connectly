'use client';

import { useState } from 'react';
import { adminFetch, refreshAdminData } from '@/components/admin/admin-data';

/** Take a plan off sale (archive) or put it back. Plans are never deleted. Two steps, no browser dialog. */
export default function PlanStatusButton({ planId, isActive }: { planId: string; isActive: boolean }) {
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const toggle = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await adminFetch(`/api/admin/plans/${planId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !isActive }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message || 'Not changed.');
      } else {
        refreshAdminData();
      }
    } catch {
      setError('No connection. Try again.');
    } finally {
      setBusy(false);
      setArmed(false);
    }
  };

  if (error) return <span className="text-[12px] text-bad">{error}</span>;
  if (!armed) {
    return (
      <button onClick={() => setArmed(true)} className="text-[13px] font-semibold text-muted hover:text-brand">
        {isActive ? 'Take off sale' : 'Put on sale'}
      </button>
    );
  }
  return (
    <span className="inline-flex items-center gap-2 text-[13px]">
      <button onClick={toggle} disabled={busy} className="font-semibold text-brand hover:underline disabled:opacity-50">
        {busy ? 'Saving…' : isActive ? 'Confirm: hide from customers' : 'Confirm: sell again'}
      </button>
      <button onClick={() => setArmed(false)} className="text-muted hover:underline">Cancel</button>
    </span>
  );
}
