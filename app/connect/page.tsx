import { db } from '../../lib/db/client';
import PortalClient from '../portal/portal-client';
import CodeLogin from '../portal/code-login';
import { hotspotLoginUrl } from '@/lib/network/customer-access';
import { CheckCircle2 } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function ConnectPage({
  searchParams,
}: {
  searchParams: Promise<{ mac?: string; ip?: string; router?: string; loc?: string }>;
}) {
  const { mac, ip, router: routerIdentifier, loc } = await searchParams;

  let locationData = null;
  let routerIdStr = '';

  // 1. Resolve Location (Either by Admin URL 'loc' or Router Redirect)
  if (loc) {
    const { data } = await db.from('locations').select('id, name, slug').eq('slug', loc).single();
    locationData = data;
  } else if (routerIdentifier) {
    const { data: routerData } = await db
      .from('routers')
      .select('id, locations(id, name, slug)')
      .eq('identifier', routerIdentifier)
      .eq('lifecycle_status', 'active') // only an activated router sells plans
      .maybeSingle();
    
    if (routerData && routerData.locations) {
      routerIdStr = routerData.id;
      const locationRaw = routerData.locations as { id: string; name: string; slug: string } | { id: string; name: string; slug: string }[];
      locationData = Array.isArray(locationRaw) ? locationRaw[0] : locationRaw;
    }
  }

  if (!locationData) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 text-center">
        <p className="text-red-600">Unrecognized network location.</p>
      </div>
    );
  }

  // Plans are bought from the WiFi login page, which identifies the router.
  // A location link alone cannot grant access, so it does not sell.
  if (!routerIdStr) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-6 text-center">
        <h1 className="text-2xl font-bold text-gray-900">Connectly WiFi at {locationData.name}</h1>
        <p className="mt-2 max-w-sm text-gray-600">Join the Connectly WiFi network on your phone. The login page opens and you can buy a plan there.</p>
      </main>
    );
  }

  const loginUrl = await hotspotLoginUrl(routerIdStr);

  // 2. Check existing authorization (Only possible if MAC is provided)
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
          <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-6 text-center">
            <div className="rounded-full bg-green-100 p-4">
              <CheckCircle2 className="h-12 w-12 text-green-600" />
            </div>
            <h1 className="mt-6 text-2xl font-bold text-gray-900">Your plan is active</h1>
            <p className="mt-2 text-gray-600">This device has a WiFi plan that is still running.</p>
            <div className="mt-8 w-full max-w-md rounded-xl border border-gray-100 bg-white p-6 text-left shadow-sm">
              <CodeLogin loginUrl={loginUrl} heading="Not browsing? Enter your WiFi code to reconnect" />
            </div>
          </main>
        );
      }
    }
  }

  // 3. Fetch active plans
  const { data: plans } = await db
    .from('plans')
    .select('id, name, price_kobo, speed_down_mbps, duration_seconds, device_limit')
    .eq('is_active', true)
    .or(`allowed_location_ids.is.null,allowed_location_ids.cs.{${locationData.id}}`)
    .order('price_kobo', { ascending: true });

  return (
    <PortalClient 
      mac={mac || ''} 
      ip={ip || ''} 
      routerId={routerIdStr} 
      location={locationData} 
      plans={plans || []} 
      loginUrl={loginUrl}
    />
  );
}