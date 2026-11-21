import { Suspense } from 'react';
import DashboardView from './dashboard-view';
import { Loading } from '@/components/admin/admin-data';

// Static page; the figures load in the browser (dashboard-view.tsx).
export default function AdminDashboard() {
  return (
    <Suspense fallback={<Loading />}>
      <DashboardView />
    </Suspense>
  );
}
