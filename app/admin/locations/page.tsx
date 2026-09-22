import { db } from '@/lib/db/client';
import { MapPin, Router, Wifi, TrendingUp, Users, Plus, QrCode, ExternalLink } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function LocationsDirectoryPage() {
  const { data: locations } = await db
    .from('locations')
    .select(`
      id,
      name,
      slug,
      status,
      institutions(name),
      routers(id),
      access_points(id),
      network_sessions(id),
      purchases(net_amount_ngn)
    `)
    .order('name', { ascending: true });

  const formattedLocations = locations?.map(loc => {
    const activeSessions = (loc.network_sessions as any[])?.length || 0;
    const revenue = (loc.purchases as any[])?.reduce((acc, curr) => acc + Number(curr.net_amount_ngn || 0), 0) || 0;
    
    // Evaluate the array vs object mismatch from Supabase generated types
    const inst = loc.institutions as any;
    const institutionName = Array.isArray(inst) ? inst[0]?.name : inst?.name;
    
    return {
      ...loc,
      activeSessions,
      revenue,
      routerCount: (loc.routers as any[])?.length || 0,
      apCount: (loc.access_points as any[])?.length || 0,
      institutionName: institutionName || 'Independent Facility',
    };
  }) || [];

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3001');

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <MapPin className="h-6 w-6 text-[#6d1825]" /> Facilities & Campuses
          </h1>
          <p className="text-sm text-slate-500">Manage physical network zones, infrastructure deployment, and localized revenue.</p>
        </div>
        <Link 
          href="/admin/locations/new" 
          className="flex items-center gap-2 px-4 py-2 bg-[#6d1825] text-white text-sm font-semibold rounded-lg hover:bg-[#5a141e] transition-colors"
        >
          <Plus className="h-4 w-4" /> Add Facility
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {formattedLocations.map((location) => {
          const connectUrl = `${appUrl}/connect?loc=${location.slug}`;

          return (
            <div key={location.id} className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs relative flex flex-col">
              <div className="absolute top-4 right-4">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                  location.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'
                }`}>
                  {location.status}
                </span>
              </div>
              
              <Link href={`/admin/locations/${location.id}`} className="block group mb-4">
                <h2 className="text-lg font-bold text-slate-900 mb-1 group-hover:text-[#6d1825] transition-colors flex items-center gap-2">
                  {location.name} <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </h2>
                <p className="text-xs text-slate-500">{location.institutionName}</p>
              </Link>

              <div className="space-y-3 pt-4 border-t border-slate-100 flex-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-slate-600"><Users className="h-4 w-4 text-slate-400"/> Active Users</span>
                  <span className="font-mono font-bold text-slate-900">{location.activeSessions}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-slate-600"><TrendingUp className="h-4 w-4 text-emerald-500"/> Revenue</span>
                  <span className="font-mono font-bold text-slate-900">₦{location.revenue.toLocaleString('en-NG')}</span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center text-xs text-slate-500 mb-4">
                <span className="flex items-center gap-1"><Router className="h-3 w-3" /> {location.routerCount} Nodes</span>
                <span className="flex items-center gap-1"><Wifi className="h-3 w-3" /> {location.apCount} APs</span>
              </div>

              <div className="mt-auto bg-slate-50 -mx-6 -mb-6 p-4 border-t border-slate-200 flex justify-between items-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Portal Entry</span>
                <a 
                  href={connectUrl} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="flex items-center gap-1.5 text-xs font-bold text-[#cfa253] hover:text-[#6d1825] transition-colors"
                >
                  <QrCode className="h-3.5 w-3.5" /> /{location.slug}
                </a>
              </div>
            </div>
          );
        })}

        {formattedLocations.length === 0 && (
          <div className="col-span-full p-12 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
            No facilities configured. Create a location to map infrastructure.
          </div>
        )}
      </div>
    </div>
  );
}