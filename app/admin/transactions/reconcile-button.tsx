'use client';

import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { adminFetch, refreshAdminData } from '@/components/admin/admin-data';

const OUTCOME: Record<string, string> = {
  paid: 'Confirmed paid',
  already_paid: 'Already paid',
  failed: 'Korapay says it failed',
  still_pending: 'Still waiting at Korapay',
  not_found_at_korapay: 'Korapay has no record',
  amount_mismatch: 'Amount did not match',
  currency_mismatch: 'Currency did not match',
};

// Asks the server to re-check a pending payment with Korapay's verify API.
// The server decides; this button never sets a status itself.
export default function ReconcileButton({ reference }: { reference: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const run = async () => {
    setBusy(true);
    setMessage('');
    try {
      const res = await adminFetch('/api/admin/payments/reconcile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference }),
      });
      const json = await res.json().catch(() => ({}));
      setMessage(res.ok ? OUTCOME[json.outcome] ?? String(json.outcome ?? 'Done').replace(/_/g, ' ') : json.message || 'Check failed');
      refreshAdminData();
    } catch {
      setMessage('No connection. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="secondary" size="sm" onClick={run} disabled={busy} title="Ask Korapay for the current status of this payment">
        <RefreshCw className={busy ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} /> Check with Korapay
      </Button>
      {message && <span className="text-[12px] text-muted" role="status">{message}</span>}
    </div>
  );
}
