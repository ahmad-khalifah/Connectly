'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Props = {
  routerId: string;
  lifecycle: 'registered' | 'active' | 'suspended' | 'retired';
  hasCredential: boolean;
  activationBlockers: string[];
  testPending: boolean;
};

const btn = 'px-3 py-2 rounded-lg text-sm font-semibold border transition-colors disabled:opacity-40 disabled:cursor-not-allowed';

export default function RouterActions({ routerId, lifecycle, hasCredential, activationBlockers, testPending }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string; reasons?: string[] } | null>(null);

  const run = async (action: string, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(action);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/network/routers/${routerId}/${action}`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ tone: 'error', text: data.message || 'That did not work.', reasons: data.reasons });
      } else {
        setMessage({
          tone: 'ok',
          text: action === 'test'
            ? data.created === false ? 'A test is already waiting for the controller.' : 'Test queued. The result appears here once the controller has reached the router.'
            : 'Done.',
        });
        router.refresh();
      }
    } catch {
      setMessage({ tone: 'error', text: 'Network error. Please try again.' });
    } finally {
      setBusy(null);
    }
  };

  const retired = lifecycle === 'retired';
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button className={`${btn} border-slate-300 text-slate-700 hover:bg-slate-50`} disabled={retired || testPending || busy !== null}
          onClick={() => run('test')}>
          {busy === 'test' ? 'Queuing…' : testPending ? 'Test waiting for controller' : 'Test connection'}
        </button>
        {(lifecycle === 'registered' || lifecycle === 'suspended') && (
          <button className={`${btn} border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700`}
            disabled={activationBlockers.length > 0 || busy !== null}
            title={activationBlockers.join(' ')}
            onClick={() => run('activate', 'Activate this router? Its location will start selling plans through it.')}>
            {busy === 'activate' ? 'Activating…' : 'Activate'}
          </button>
        )}
        {lifecycle === 'active' && (
          <button className={`${btn} border-amber-500 text-amber-700 hover:bg-amber-50`} disabled={busy !== null}
            onClick={() => run('suspend', 'Suspend this router? New sales stop now. Customers already online keep access until their time runs out.')}>
            {busy === 'suspend' ? 'Suspending…' : 'Suspend'}
          </button>
        )}
        {(lifecycle === 'registered' || lifecycle === 'suspended') && (
          <button className={`${btn} border-red-300 text-red-700 hover:bg-red-50`} disabled={busy !== null}
            onClick={() => run('retire', 'Retire this router permanently? Its tunnel address is released and it cannot be reactivated.')}>
            {busy === 'retire' ? 'Retiring…' : 'Retire'}
          </button>
        )}
        {lifecycle === 'registered' && !hasCredential && (
          <button className={`${btn} border-slate-300 text-slate-700 hover:bg-slate-50`} disabled={busy !== null} onClick={() => run('credential')}>
            {busy === 'credential' ? 'Generating…' : 'Generate API credential'}
          </button>
        )}
      </div>

      {(lifecycle === 'registered' || lifecycle === 'suspended') && activationBlockers.length > 0 && (
        <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-3">
          <p className="font-semibold mb-1">Before this router can be activated:</p>
          <ul className="list-disc pl-5 space-y-0.5">{activationBlockers.map((r) => <li key={r}>{r}</li>)}</ul>
        </div>
      )}

      {message && (
        <div role="status" className={`text-sm rounded-lg p-3 border ${message.tone === 'ok' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-700'}`}>
          {message.text}
          {message.reasons && <ul className="list-disc pl-5 mt-1">{message.reasons.map((r) => <li key={r}>{r}</li>)}</ul>}
        </div>
      )}
    </div>
  );
}
