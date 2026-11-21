'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { inputClass } from '@/components/ui/field';
import { cn } from '@/lib/utils';

const NEXT: Record<string, { to: string; label: string }[]> = {
  open: [{ to: 'in_progress', label: 'Start' }, { to: 'resolved', label: 'Resolve' }],
  in_progress: [{ to: 'resolved', label: 'Resolve' }, { to: 'open', label: 'Reopen' }],
  resolved: [{ to: 'open', label: 'Reopen' }],
};

export default function TicketStatus({ id, status, number }: { id: string; status: string; number: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [resolving, setResolving] = useState(false);
  const [note, setNote] = useState('');

  const move = async (to: string, withNote?: string) => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/support/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(withNote ? { status: to, note: withNote } : { status: to }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data.message || 'Not changed.');
      else {
        setResolving(false);
        setNote('');
        router.refresh();
      }
    } catch {
      setError('No connection. Try again.');
    } finally {
      setBusy(false);
    }
  };

  if (resolving) {
    return (
      <form className="flex w-64 flex-col items-stretch gap-2 text-left" onSubmit={(e) => { e.preventDefault(); move('resolved', note.trim() || undefined); }}>
        <label htmlFor={`note-${id}`} className="text-[12px] font-semibold text-ink">Note for ticket #{number} <span className="font-normal text-subtle">(optional)</span></label>
        <input id={`note-${id}`} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} placeholder="What was done" className={cn(inputClass, 'h-9 text-[13px]')} autoFocus />
        <div className="flex justify-end gap-2">
          <Button type="button" size="sm" variant="quiet" disabled={busy} onClick={() => { setResolving(false); setNote(''); }}>Cancel</Button>
          <Button type="submit" size="sm" disabled={busy}>{busy ? 'Saving…' : 'Mark resolved'}</Button>
        </div>
        {error && <span className="text-[12px] text-bad">{error}</span>}
      </form>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        {(NEXT[status] ?? NEXT.open).map((n) => (
          <Button key={n.to} size="sm" variant={n.to === 'resolved' ? 'primary' : 'secondary'} disabled={busy}
            onClick={() => (n.to === 'resolved' ? setResolving(true) : move(n.to))}>{n.label}</Button>
        ))}
      </div>
      {error && <span className="text-[12px] text-bad">{error}</span>}
    </div>
  );
}
