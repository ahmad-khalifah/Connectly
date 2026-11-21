'use client';

import SmsTestCard from './sms-test-card';
import NetworkSettingsCard from './network-settings-card';
import { PageHeader } from '@/components/admin/page-header';
import { Panel } from '@/components/ui/panel';
import { Notice } from '@/components/ui/notice';
import { useAdminView, viewUrl, ViewState } from '@/components/admin/admin-data';

type Data = { network: { portalUrl: string; hosts: string[] } | null; networkError: boolean; admins: string[]; smsConfigured: boolean };

export default function SettingsView() {
  const { loaded, reload } = useAdminView<Data>(viewUrl('settings'));
  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Settings shared by every router, the SMS check, and who can sign in here." />
      <ViewState loaded={loaded} reload={reload}>
        {(d) => (
          <>
            {d.network ? (
              <NetworkSettingsCard portalUrl={d.network.portalUrl} hosts={d.network.hosts} />
            ) : (
              <Notice tone="warn" title="Network settings are not available">
                {d.networkError ? 'The database did not answer.' : 'They arrive with the network management migration.'}
              </Notice>
            )}
            <SmsTestCard configured={d.smsConfigured} />
            <Panel title="Who can sign in" description="Only these accounts can open the admin console. The list is set in the ADMIN_EMAILS environment setting, not here, so a stolen session cannot add itself.">
              <ul className="space-y-1 text-sm font-semibold text-ink">{d.admins.map((e) => <li key={e}>{e}</li>)}</ul>
            </Panel>
          </>
        )}
      </ViewState>
    </div>
  );
}
