import { Suspense } from 'react';
import View from './view';
import { Loading } from '@/components/admin/admin-data';

// Plans: what customers can buy, at what price and where.
// Static page; the data loads in the browser from /api/admin/view (lib/admin/views.ts).
export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <View />
    </Suspense>
  );
}
