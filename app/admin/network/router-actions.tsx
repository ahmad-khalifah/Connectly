'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { adminFetch, refreshAdminData } from '@/components/admin/admin-data';

type Props = {
  routerId: string;
  lifecycle: 'registered' | 'active' | 'suspended' | 'retired';
  hasCredential: boolean;
  activationBlockers: string[];
  testPending: boolean;
};

type Action = 'test' | 'activate' | 'suspend' | 'retire' | 'credential';

/** What each action does, said before it is confirmed (no browser dialogs). */
const CONFIRM: Partial<Record<Action, { title: string; body: string; cta: string; danger?: boolean }>> = {
  activate: { title: 'Activate this router?', body: 'Its location starts selling plans through it straight away.', cta: 'Activate' },
  suspend: { title: 'Suspend this router?', body: 'New sales stop now. Customers already online keep access until their time runs out.', cta: 'Suspend', danger: true },
  retire: { title: 'Retire this router permanently?', body: 'Its tunnel address is released and it cannot be activated again.', cta: 'Retire', danger: true },
};

export default function RouterActions({ routerId, lifecycle, hasCredential, activationBlockers, testPending }: Props) {
  const [busy, setBusy] = useState<Action | null>(null);
  const [asking, setAsking] = useState<Action | null>(null);
  const [message, setMessage] = useState<{ tone: 'ok' | 'bad'; text: string; reasons?: string[] } | null>(null);

  const run = async (action: Action) => {
    setAsking(null);
    setBusy(action);
    setMessage(null);
    try {
      const res = await adminFetch(`/api/admin/network/routers/${routerId}/${action}`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ tone: 'bad', text: data.message || 'That did not work.', reasons: data.reasons });
      } else {
        setMessage({
          tone: 'ok',
          text: action === 'test'
            ? data.created === false ? 'A test is already waiting for the controller.' : 'Test queued. The result appears on this page once the controller has reached the router.'
            : action === 'credential' ? 'Credential issued and stored encrypted.' : 'Done.',
        });
        refreshAdminData();
      }
    } catch {
      setMessage({ tone: 'bad', text: 'No connection. Try again.' });
    } finally {
      setBusy(null);
    }
  };

  const ask = (a: Action) => (CONFIRM[a] ? setAsking(a) : run(a));
  const retired = lifecycle === 'retired';
  const confirm = asking ? CONFIRM[asking] : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" disabled={retired || testPending || busy !== null} onClick={() => ask('test')}>
          {busy === 'test' ? 'Queuing…' : testPending ? 'Test waiting for controller' : 'Test connection'}
        </Button>
        {lifecycle === 'registered' && !hasCredential && (
          <Button variant="secondary" disabled={busy !== null} onClick={() => ask('credential')}>
            {busy === 'credential' ? 'Issuing…' : 'Issue API credential'}
          </Button>
        )}
        {(lifecycle === 'registered' || lifecycle === 'suspended') && (
          <Button disabled={activationBlockers.length > 0 || busy !== null} title={activationBlockers.join(' ')} onClick={() => ask('activate')}>
            {busy === 'activate' ? 'Activating…' : 'Activate'}
          </Button>
        )}
        {lifecycle === 'active' && (
          <Button variant="danger" disabled={busy !== null} onClick={() => ask('suspend')}>{busy === 'suspend' ? 'Suspending…' : 'Suspend'}</Button>
        )}
        {(lifecycle === 'registered' || lifecycle === 'suspended') && (
          <Button variant="danger" disabled={busy !== null} onClick={() => ask('retire')}>{busy === 'retire' ? 'Retiring…' : 'Retire'}</Button>
        )}
      </div>

      {confirm && asking && (
        <div className={`rounded-[var(--radius-control)] border p-4 ${confirm.danger ? 'border-bad/30 bg-bad-soft' : 'border-line bg-canvas'}`} role="alertdialog" aria-label={confirm.title}>
          <p className="text-sm font-semibold text-ink">{confirm.title}</p>
          <p className="mt-0.5 text-sm text-muted">{confirm.body}</p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant={confirm.danger ? 'danger' : 'primary'} onClick={() => run(asking)}>{confirm.cta}</Button>
            <Button size="sm" variant="secondary" onClick={() => setAsking(null)}>Cancel</Button>
          </div>
        </div>
      )}

      {(lifecycle === 'registered' || lifecycle === 'suspended') && activationBlockers.length > 0 && (
        <Notice tone="info" title="Before this router can be activated">
          <ul className="list-disc space-y-0.5 pl-5">{activationBlockers.map((r) => <li key={r}>{r}</li>)}</ul>
        </Notice>
      )}

      {message && (
        <Notice tone={message.tone} title={message.text}>
          {message.reasons && <ul className="list-disc pl-5">{message.reasons.map((r) => <li key={r}>{r}</li>)}</ul>}
        </Notice>
      )}
    </div>
  );
}
