import { db } from '../../lib/db/client';
import PortalClient from './portal-client';
import CodeLogin from './code-login';
import { hotspotLoginUrl } from '@/lib/network/customer-access';
import { PortalShell } from '@/components/portal/portal-shell';
import { LensMark } from '@/components/ui/lens-mark';
import { Notice } from '@/components/ui/notice';

export const dynamic = 'force-dynamic';

const lagos = (iso: string) =>
  new Date(iso).toLocaleString('en-NG', { timeZone: 'Africa/Lagos', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

export default async function PortalPage({
  searchParams,
}: {
  searchParams: Promise<{ mac?: string; ip?: string; router?: string }>;
}) {
  const { mac, ip, router: routerIdentifier } = await searchParams;

  if (!mac || !routerIdentifier) {
    return (
      <PortalShell>
        <Notice tone="warn" title="Open this page from the Connectly WiFi">
          Join the Connectly WiFi network on your phone. The sign-in page opens by itself; if it does not, open any website and it will appear.
        </Notice>
      </PortalShell>
    );
  }

  // The router's own login page, worked out here from the registered router,
  // so the code form never sends a code to an address taken from the URL.
  const { data: anyRouter } = await db.from('routers').select('id').eq('identifier', routerIdentifier).maybeSingle();
  const loginUrl = anyRouter ? await hotspotLoginUrl(anyRouter.id) : null;

  // 1. Does this device already have a plan running?
  const { data: device } = await db.from('devices').select('id').eq('mac_address', mac).maybeSingle();
  if (device) {
    const { data: activeAuth } = await db
      .from('network_authorizations')
      .select('expires_at')
      .eq('device_id', device.id)
      .eq('status', 'active')
      .gt('expires_at', new Date().toISOString())
      .order('expires_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (activeAuth) {
      return (
        <PortalShell>
          <div className="flex items-start gap-4">
            <LensMark className="h-12 w-12" state="on" />
            <div>
              <h1 className="text-xl font-bold tracking-[-0.01em] text-ink">Your plan is still running</h1>
              <p className="mt-1 text-sm text-muted">
                It ends <span className="tnum font-semibold text-ink">{lagos(activeAuth.expires_at)}</span>.
              </p>
            </div>
          </div>
          {loginUrl && (
            <section className="mt-6 rounded-[var(--radius-panel)] border border-line bg-surface p-5">
              <CodeLogin loginUrl={loginUrl} heading="Not browsing? Enter your WiFi code to reconnect" />
            </section>
          )}
        </PortalShell>
      );
    }
  }

  // 2. The router and its location. Only an activated router sells plans.
  const { data: routerData } = await db
    .from('routers')
    .select('id, locations(id, name, slug)')
    .eq('identifier', routerIdentifier)
    .eq('lifecycle_status', 'active')
    .maybeSingle();

  const locationRaw = routerData?.locations as
    | { id: string; name: string; slug: string }
    | { id: string; name: string; slug: string }[]
    | null
    | undefined;
  const location = Array.isArray(locationRaw) ? locationRaw[0] : locationRaw;

  if (!routerData || !location) {
    return (
      <PortalShell>
        <Notice tone="bad" title="This WiFi is not taking payments yet">
          The network you joined is not set up for Connectly payments. Ask the staff on site, or message us with the WiFi name you see.
        </Notice>
      </PortalShell>
    );
  }

  // 3. Plans on sale at this location.
  const { data: plans } = await db
    .from('plans')
    .select('id, name, price_kobo, speed_down_mbps, duration_seconds, device_limit, data_limit_mb')
    .eq('is_active', true)
    .or(`allowed_location_ids.is.null,allowed_location_ids.cs.{${location.id}}`)
    .order('price_kobo', { ascending: true });

  return (
    <PortalShell place={location.name}>
      <PortalClient mac={mac} ip={ip || ''} routerId={routerData.id} location={location} plans={plans || []} loginUrl={loginUrl} />
    </PortalShell>
  );
}
