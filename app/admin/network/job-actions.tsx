'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function JobActions({ jobId, status }: { jobId: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const run = async (action: 'retry' | 'cancel') => {
    const question = action === 'retry'
      ? 'Retry this job now? It gets up to 3 more attempts.'
      : 'Cancel this job? It will not run again unless retried.';
    if (!window.confirm(question)) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/network/jobs/${jobId}/${action}`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data.message || 'That did not work.');
      else router.refresh();
    } catch {
      setError('Network error.');
    } finally {
      setBusy(false);
    }
  };

  const canRetry = status === 'failed' || status === 'dead';
  const canCancel = status === 'queued' || status === 'failed';
  if (!canRetry && !canCancel) return null;
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-1">
        {canRetry && (
          <button disabled={busy} onClick={() => run('retry')}
            className="px-2 py-1 text-xs font-semibold rounded border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50">Retry</button>
        )}
        {canCancel && (
          <button disabled={busy} onClick={() => run('cancel')}
            className="px-2 py-1 text-xs font-semibold rounded border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50">Cancel</button>
        )}
      </div>
      {error && <span className="text-[11px] text-red-600">{error}</span>}
    </div>
  );
}
