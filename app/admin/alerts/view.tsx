'use client';

import type { Alert } from '@/lib/admin/alerts';
import AlertsPanel from '../components/alerts-panel';
import { PageHeader } from '@/components/admin/page-header';
import { useAdminView, viewUrl, ViewState } from '@/components/admin/admin-data';

export default function AlertsView() {
  const { loaded, reload } = useAdminView<Alert[]>(viewUrl('alerts'));
  return (
    <div className="space-y-6">
      <PageHeader
        title="Alerts"
        description="Problems worked out from what the platform already records: the controller, routers, waiting customers, failed jobs, payments that did not match, and SMS."
      />
      <ViewState loaded={loaded} reload={reload}>
        {(alerts) => <AlertsPanel alerts={alerts} quietText="Nothing needs attention right now." />}
      </ViewState>
    </div>
  );
}
