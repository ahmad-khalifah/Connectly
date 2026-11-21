import { db } from '../../lib/db/client';
import PortalClient from '../portal/portal-client';
import CodeLogin from '../portal/code-login';
import { hotspotLoginUrl } from '@/lib/network/customer-access';
import { PortalShell } from '@/components/portal/portal-shell';
import { LensMark } from '@/components/ui/lens-mark';
import { Notice } from '@/components/ui/notice';

export const dynamic = 'force-dynamic';

type Loc = { id: string; name: string; slug: string };

/**
 * Location link (/connect?loc=<slug>, printed on QR codes) and the older
 * router redirect (/connect?router=...). Only the router form sells plans:
 * a location link alone cannot grant access, so it explains how to join.
 */
export default async function ConnectPage({
  searchParams,
}: {
  searchParams: Promise<{ mac?: string; ip?: string; router?: string; loc?: string }>;
}) {
  const { mac, ip, router: routerIdentifier, loc } = await searchParams;

  let location: Loc | null = null;
  let routerId = '';

  if (loc) {
    const { data } = await db.from('locations').select('id, name, slug').eq('slug', loc).maybeSingle();
    location = data;
  } else if (routerIdentifier) {
    const { data: routerData } = await db
      .from('routers')
      .select('id, locations(id, name, slug)')
      .eq('identifier', routerIdentifier)
      .eq('lifecycle_status', 'active') // only an activated router sells plans
      .maybeSingle();
    if (routerData?.locations) {
      routerId = routerData.id;
      const raw = routerData.locations as Loc | Loc[];
      location = Array.isArray(raw) ? raw[0] : raw;
    }
  }

  if (!location) {
    return (
      <PortalShell>
        <Notice tone="bad" title="We do not recognise this location">
          Check the link or QR code, or join the Connectly WiFi on site to see the plans.
        </Notice>
      </PortalShell>
    );
  }

  if (!routerId) {
    return (
      <PortalShell place={location.name}>
        <div className="flex items-start gap-4">
          <LensMark className="h-12 w-12" state="off" />
          <div>
            <h1 className="text-xl font-bold tracking-[-0.01em] text-ink">Join the WiFi to get online</h1>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">
              On your phone, open WiFi settings and join <span className="font-semibold text-ink">Connectly WiFi</span>. The sign-in page opens by itself and shows the plans for {location.name}.
            </p>
          </div>
        </div>
      </PortalShell>
    );
  }

  const loginUrl = await hotspotLoginUrl(routerId);

  if (mac) {
    const { data: device } = await db.from('devices').select('id').eq('mac_address', mac).maybeSingle();
    if (device) {
      const { data: activeAuth } = await db
        .from('network_authorizations')
        .select('expires_at')
        .eq('device_id', device.id)
        .eq('status', 'active')
        .gt('expires_at', new Date().toISOString())
        .limit(1)
        .maybeSingle();
      if (activeAuth) {
        return (
          <PortalShell place={location.name}>
            <div className="flex items-start gap-4">
              <LensMark className="h-12 w-12" state="on" />
              <h1 className="pt-2 text-xl font-bold tracking-[-0.01em] text-ink">Your plan is still running</h1>
            </div>
            <section className="mt-6 rounded-[var(--radius-panel)] border border-line bg-surface p-5">
              <CodeLogin loginUrl={loginUrl} heading="Not browsing? Enter your WiFi code to reconnect" />
            </section>
          </PortalShell>
        );
      }
    }
  }

  const { data: plans } = await db
    .from('plans')
    .select('id, name, price_kobo, speed_down_mbps, duration_seconds, device_limit, data_limit_mb')
    .eq('is_active', true)
    .or(`allowed_location_ids.is.null,allowed_location_ids.cs.{${location.id}}`)
    .order('price_kobo', { ascending: true });

  return (
    <PortalShell place={location.name}>
      <PortalClient mac={mac || ''} ip={ip || ''} routerId={routerId} location={location} plans={plans || []} loginUrl={loginUrl} />
    </PortalShell>
  );
}
