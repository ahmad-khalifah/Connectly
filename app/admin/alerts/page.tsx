import { loadAlerts } from '@/lib/admin/alerts';
import AlertsPanel from '../components/alerts-panel';
import { PageHeader } from '@/components/admin/page-header';

export const dynamic = 'force-dynamic';

export default async function AlertsPage() {
  const alerts = await loadAlerts();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Alerts"
        description="Problems worked out from what the platform already records: the controller, routers, waiting customers, failed jobs, payments that did not match, and SMS."
      />
      <AlertsPanel alerts={alerts} quietText="Nothing needs attention right now." />
    </div>
  );
}
