import { Suspense } from 'react';
import { CustomerPortal, PortalLoading } from '@/components/portal/customer-portal';

// Location link (/connect?loc=<slug>, printed on QR codes) and the older
// router redirect (/connect?router=...). Only the router form sells plans:
// a location link alone cannot grant access, so it explains how to join.
// Static, like /portal: the data comes from /api/portal.
export default function ConnectPage() {
  return (
    <Suspense fallback={<PortalLoading />}>
      <CustomerPortal page="connect" />
    </Suspense>
  );
}
