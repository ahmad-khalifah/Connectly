import { Suspense } from 'react';
import CustomerView from './customer-view';
import { Loading } from '@/components/admin/admin-data';

// /admin/customer?id=<customer id>. Static page; the data loads in the browser.
export default function CustomerPage() {
  return (
    <Suspense fallback={<Loading />}>
      <CustomerView />
    </Suspense>
  );
}
