import { Suspense } from 'react';
import { CustomerPortal, PortalLoading } from '@/components/portal/customer-portal';

// Where the router's login page sends customers: /portal?router=...&mac=...&ip=...
// A static page: the browser reads the address and loads the plans from
// /api/portal, so serving it costs no server rendering (see docs/cloudflare.md).
export default function PortalPage() {
  return (
    <Suspense fallback={<PortalLoading />}>
      <CustomerPortal page="portal" />
    </Suspense>
  );
}
