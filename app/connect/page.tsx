import { db } from '../../lib/db/client';
import PortalClient from '../portal/portal-client';
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
      .single();
    
    if (routerData && routerData.locations) {
      routerIdStr = routerData.id;
      const locationRaw = routerData.locations as any;
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

  // 2. Check existing authorization (Only possible if MAC is provided)
  if (mac) {
    const { data: device } = await db.from('devices').select('id').eq('mac_address', mac).single();

    if (device) {
      const { data: activeAuth } = await db
        .from('network_authorizations')
        .select('expires_at')
        .eq('device_id', device.id)
        .eq('status', 'active')
        .gt('expires_at', new Date().toISOString())
        .single();

      if (activeAuth) {
        return (
          <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-6 text-center">
            <div className="rounded-full bg-green-100 p-4">
              <CheckCircle2 className="h-12 w-12 text-green-600" />
            </div>
            <h1 className="mt-6 text-2xl font-bold text-gray-900">You Are Connected</h1>
            <p className="mt-2 text-gray-600">Your internet access is active.</p>
          </main>
        );
      }
    }
  }

  // 3. Fetch active plans
  const { data: plans } = await db
    .from('plans')
    .select('id, name, price_kobo, download_limit_kbps')
    .eq('is_active', true)
    .order('price_kobo', { ascending: true });

  return (
    <PortalClient 
      mac={mac || ''} 
      ip={ip || ''} 
      routerId={routerIdStr} 
      location={locationData} 
      plans={plans || []} 
    />
  );
}