import { Suspense } from 'react';
import { PortalShell } from '@/components/portal/portal-shell';
import { ReturnPage } from './return-page';

// Korapay redirects the customer here after checkout. The redirect itself
// proves nothing; the status shown comes from our ledger, which only a
// Korapay-verified payment can mark as paid. Static: the browser reads the
// reference and polls /api/purchase/status.
export default function SuccessPage() {
  return (
    <PortalShell>
      <Suspense fallback={null}>
        <ReturnPage />
      </Suspense>
    </PortalShell>
  );
}
