'use client';

import { useSearchParams } from 'next/navigation';
import PaymentStatus from './payment-status';
import { Notice } from '@/components/ui/notice';
import { ourReference } from '@/lib/payment-reference';

export function ReturnPage() {
  const reference = ourReference(useSearchParams().getAll('reference'));
  if (!reference) {
    return (
      <Notice tone="warn" title="No payment reference">
        Join the Connectly WiFi to choose a plan. If you have paid, open the link from your payment again.
      </Notice>
    );
  }
  return (
    <>
      <PaymentStatus reference={reference} />
      <p className="mt-8 border-t border-line pt-4 text-[13px] text-muted">
        Payment reference
        <span className="mt-0.5 block break-all font-semibold text-ink">{reference}</span>
      </p>
    </>
  );
}
