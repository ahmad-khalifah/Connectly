import { Suspense } from 'react';
import View from './view';
import { Loading } from '@/components/admin/admin-data';

// Alerts: problems worked out from what the platform records.
// Static page; the data loads in the browser from /api/admin/view (lib/admin/views.ts).
export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <View />
    </Suspense>
  );
}
