'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

const ASK = {
  retry: { text: 'Retry now? It gets up to 3 more attempts.', cta: 'Retry' },
  cancel: { text: 'Cancel this job? It will not run again unless retried.', cta: 'Cancel job' },
};

export default function JobActions({ jobId, status }: { jobId: string; status: string }) {
  const router = useRouter();
  const [asking, setAsking] = useState<'retry' | 'cancel' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const run = async (action: 'retry' | 'cancel') => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/network/jobs/${jobId}/${action}`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data.message || 'That did not work.');
      else router.refresh();
    } catch {
      setError('No connection. Try again.');
    } finally {
      setBusy(false);
      setAsking(null);
    }
  };

  const canRetry = status === 'failed' || status === 'dead';
  const canCancel = status === 'queued' || status === 'failed';
  if (!canRetry && !canCancel) return null;
  if (asking) {
    return (
      <div className="w-52 text-left">
        <p className="text-[12.5px] text-ink">{ASK[asking].text}</p>
        <div className="mt-1.5 flex gap-2">
          <Button size="sm" variant={asking === 'cancel' ? 'danger' : 'primary'} disabled={busy} onClick={() => run(asking)}>{busy ? 'Working…' : ASK[asking].cta}</Button>
          <Button size="sm" variant="secondary" onClick={() => setAsking(null)}>Back</Button>
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        {canRetry && <Button size="sm" variant="secondary" onClick={() => setAsking('retry')}>Retry</Button>}
        {canCancel && <Button size="sm" variant="danger" onClick={() => setAsking('cancel')}>Cancel</Button>}
      </div>
      {error && <span className="text-[12px] text-bad">{error}</span>}
    </div>
  );
}
