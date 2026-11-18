import { Settings, Shield } from 'lucide-react';
import { db } from '@/lib/db/client';
import { adminEmails } from '@/lib/auth/admin-emails';
import SmsTestCard from './sms-test-card';
import { smsConfigured } from '@/lib/sms';
import NetworkSettingsCard from './network-settings-card';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const { data: ns, error } = await db.from('network_settings').select('portal_url, walled_garden_hosts').maybeSingle();
  const admins = adminEmails();

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Settings className="h-6 w-6 text-[#6d1825]" /> Settings
        </h1>
        <p className="text-sm text-slate-500">Network-wide settings, SMS check and who can sign in here.</p>
      </div>

      {ns ? (
        <NetworkSettingsCard portalUrl={ns.portal_url} hosts={(ns.walled_garden_hosts as string[]) ?? []} />
      ) : (
        <div className="p-4 rounded-lg border border-amber-200 bg-amber-50 text-sm text-amber-800">
          Network settings are not available{error ? ' (database error)' : ''}. They arrive with the network management migration.
        </div>
      )}

      <SmsTestCard configured={smsConfigured()} />

      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-2">
        <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2"><Shield className="h-4 w-4 text-[#6d1825]" /> Admin access</h2>
        <p className="text-xs text-slate-600">Only these accounts can open the admin console. The list is set in the ADMIN_EMAILS environment setting, not here, so a stolen session cannot add itself.</p>
        <ul className="text-sm font-mono text-slate-800">{admins.map((e) => <li key={e}>{e}</li>)}</ul>
      </div>
    </div>
  );
}
