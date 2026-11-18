import { db } from '@/lib/db/client';
import { adminEmails } from '@/lib/auth/admin-emails';
import SmsTestCard from './sms-test-card';
import NetworkSettingsCard from './network-settings-card';
import { smsConfigured } from '@/lib/sms';
import { PageHeader } from '@/components/admin/page-header';
import { Panel } from '@/components/ui/panel';
import { Notice } from '@/components/ui/notice';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const { data: ns, error } = await db.from('network_settings').select('portal_url, walled_garden_hosts').maybeSingle();
  const admins = adminEmails();

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Settings shared by every router, the SMS check, and who can sign in here." />

      {ns ? (
        <NetworkSettingsCard portalUrl={ns.portal_url} hosts={(ns.walled_garden_hosts as string[]) ?? []} />
      ) : (
        <Notice tone="warn" title="Network settings are not available">
          {error ? 'The database did not answer.' : 'They arrive with the network management migration.'}
        </Notice>
      )}

      <SmsTestCard configured={smsConfigured()} />

      <Panel title="Who can sign in" description="Only these accounts can open the admin console. The list is set in the ADMIN_EMAILS environment setting, not here, so a stolen session cannot add itself.">
        <ul className="space-y-1 text-sm font-semibold text-ink">{admins.map((e) => <li key={e}>{e}</li>)}</ul>
      </Panel>
    </div>
  );
}
