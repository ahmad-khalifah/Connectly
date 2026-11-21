import { Suspense } from 'react';
import View from './view';
import { Loading } from '@/components/admin/admin-data';

// Locations: each site, its routers, the plans running there and what it has taken.
// Static page; the data loads in the browser from /api/admin/view (lib/admin/views.ts).
export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <View />
    </Suspense>
  );
}
