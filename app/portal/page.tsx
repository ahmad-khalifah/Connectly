import { db } from '../../lib/db/client';
import PortalClient from './portal-client';
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

  // 1. Check if the device is already authorized
  const { data: device } = await db
    .from('devices')
    .select('id')
    .eq('mac_address', mac)
    .single();

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
          <p className="mt-6 text-sm text-gray-500">
            Expires at: <strong>{new Date(activeAuth.expires_at).toLocaleString('en-NG')}</strong>
          </p>
        </main>
      );
    }
  }

  // 2. Fetch the router and its location
  const { data: routerData } = await db
    .from('routers')
    .select('id, locations(id, name, slug)')
    .eq('identifier', routerIdentifier)
    .single();

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
    .select('id, name, price_kobo, download_limit_kbps')
    .eq('is_active', true)
    .order('price_kobo', { ascending: true });

  return (
    <PortalClient 
      mac={mac} 
      ip={ip || ''} 
      routerId={routerData.id} 
      location={location} 
      plans={plans || []} 
    />
  );
}