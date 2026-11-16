'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Archive, RotateCcw } from 'lucide-react';

/** Archive (hide from customers) or restore a plan. Plans are never deleted. */
export default function PlanStatusButton({ planId, isActive }: { planId: string; isActive: boolean }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const toggle = async () => {
    const question = isActive
      ? 'Archive this plan? It will be hidden from customers; its purchase history is kept.'
      : 'Restore this plan? Customers will be able to buy it again.';
    if (!window.confirm(question)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/plans/${planId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !isActive }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.message || 'Could not update the plan.');
      } else {
        router.refresh();
      }
    } catch {
      alert('Network error. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const Icon = isActive ? Archive : RotateCcw;
  return (
    <button onClick={toggle} disabled={busy}
      className="flex items-center gap-1 px-2 py-1 text-xs font-semibold text-slate-500 hover:text-[#6d1825] hover:bg-slate-50 rounded-md transition-colors disabled:opacity-50"
      title={isActive ? 'Archive plan' : 'Restore plan'}>
      <Icon className="h-3.5 w-3.5" /> {isActive ? 'Archive' : 'Restore'}
    </button>
  );
}
