'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

const NEXT: Record<string, { to: string; label: string }[]> = {
  open: [{ to: 'in_progress', label: 'Start' }, { to: 'resolved', label: 'Resolve' }],
  in_progress: [{ to: 'resolved', label: 'Resolve' }, { to: 'open', label: 'Reopen' }],
  resolved: [{ to: 'open', label: 'Reopen' }],
};

export default function TicketStatus({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const move = async (to: string) => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/support/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: to }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data.message || 'Not changed.');
      else router.refresh();
    } catch {
      setError('No connection. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        {(NEXT[status] ?? NEXT.open).map((n) => (
          <Button key={n.to} size="sm" variant={n.to === 'resolved' ? 'primary' : 'secondary'} disabled={busy} onClick={() => move(n.to)}>{n.label}</Button>
        ))}
      </div>
      {error && <span className="text-[12px] text-bad">{error}</span>}
    </div>
  );
}
