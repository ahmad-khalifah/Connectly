import { db } from '../../lib/db/client';
import PortalClient from './portal-client';
import CodeLogin from './code-login';
import { hotspotLoginUrl } from '@/lib/network/customer-access';
import { CheckCircle2 } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function PortalPage({
  searchParams,
}: {
  searchParams: Promise<{ mac?: string; ip?: string; router?: string }>;
}) {
  const resolvedParams = await searchParams;
  const { mac, ip, router: routerIdentifier } = resolvedParams;

  if (!mac || !routerIdentifier) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 text-center">
        <p className="text-gray-600">
          Invalid network context. Please connect directly to the WiFi network.
        </p>
      </div>
    );
  }

  // The router's own login page, worked out here from the registered router,
  // so the code form never sends a code to an address taken from the URL.
  const { data: anyRouter } = await db
    .from('routers')
    .select('id')
    .eq('identifier', routerIdentifier)
    .maybeSingle();
  const loginUrl = anyRouter ? await hotspotLoginUrl(anyRouter.id) : null;

  // 1. Check if the device is already authorized
  const { data: device } = await db
    .from('devices')
    .select('id')
    .eq('mac_address', mac)
    .maybeSingle();

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
        <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-6 text-center">
          <div className="rounded-full bg-green-100 p-4">
            <CheckCircle2 className="h-12 w-12 text-green-600" />
          </div>
          <h1 className="mt-6 text-2xl font-bold text-gray-900">Your plan is active</h1>
          <p className="mt-2 text-gray-600">This device has a WiFi plan that is still running.</p>
          <p className="mt-6 text-sm text-gray-500">
            Expires at: <strong>{new Date(activeAuth.expires_at).toLocaleString('en-NG', { timeZone: 'Africa/Lagos', dateStyle: 'medium', timeStyle: 'short' })}</strong>
          </p>
          {loginUrl && (
            <div className="mt-8 w-full max-w-md rounded-xl border border-gray-100 bg-white p-6 text-left shadow-sm">
              <CodeLogin loginUrl={loginUrl} heading="Not browsing? Enter your WiFi code to reconnect" />
            </div>
          )}
        </main>
      );
    }
  }

  // 2. Fetch the router and its location
  const { data: routerData } = await db
    .from('routers')
    .select('id, locations(id, name, slug)')
    .eq('identifier', routerIdentifier)
    .eq('lifecycle_status', 'active') // only an activated router sells plans
    .maybeSingle();

  if (!routerData || !routerData.locations) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <p className="text-red-600">Unrecognized network equipment.</p>
      </div>
    );
  }

  const locationRaw = routerData.locations as
    | { id: string; name: string; slug: string }
    | { id: string; name: string; slug: string }[]
    | null;
  const location = Array.isArray(locationRaw) ? locationRaw[0] : locationRaw;

  if (!location) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <p className="text-red-600">Unrecognized network equipment.</p>
      </div>
    );
  }

  // 3. Fetch active plans
  const { data: plans } = await db
    .from('plans')
    .select('id, name, price_kobo, speed_down_mbps, duration_seconds, device_limit')
    .eq('is_active', true)
    .or(`allowed_location_ids.is.null,allowed_location_ids.cs.{${location.id}}`)
    .order('price_kobo', { ascending: true });

  return (
    <PortalClient 
      mac={mac} 
      ip={ip || ''} 
      routerId={routerData.id} 
      location={location} 
      plans={plans || []} 
      loginUrl={loginUrl}
    />
  );
}