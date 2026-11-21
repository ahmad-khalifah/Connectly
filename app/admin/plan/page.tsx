import { Suspense } from 'react';
import View from './view';
import { Loading } from '@/components/admin/admin-data';

// Edit a plan: /admin/plan?id=<plan id>.
// Static page; the data loads in the browser from /api/admin/view (lib/admin/views.ts).
export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <View />
    </Suspense>
  );
}
