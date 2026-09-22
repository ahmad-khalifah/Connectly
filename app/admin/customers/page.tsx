import { db } from '@/lib/db/client';
import { Users, Search, Wifi, Clock, MoreVertical, CreditCard } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string }>;
}) {
  const resolvedParams = await searchParams;
  const currentPage = Number(resolvedParams.page) || 1;
  const searchQuery = resolvedParams.search || '';
  const ITEMS_PER_PAGE = 20;
  const from = (currentPage - 1) * ITEMS_PER_PAGE;
  const to = from + ITEMS_PER_PAGE - 1;

  // Build the query
  let query = db
    .from('customers')
    .select(`
      id,
      phone_number,
      created_at,
      subscriptions (id, status, expires_at, plans(name)),
      network_sessions (id, status, location_id, locations(name))
    `, { count: 'exact' })
    .order('created_at', { ascending: false });

  if (searchQuery) {
    query = query.ilike('phone_number', `%${searchQuery}%`);
  }

  const { data: customers, count } = await query.range(from, to);
  const totalPages = count ? Math.ceil(count / ITEMS_PER_PAGE) : 1;

  // Format data for the operational table
  const formattedCustomers = customers?.map((customer) => {
    const subs = (customer.subscriptions as any[]) || [];
    const activeSub = subs.find(s => s.status === 'active' && new Date(s.expires_at) > new Date());
    
    const sessions = (customer.network_sessions as any[]) || [];
    const liveSession = sessions.find(s => s.status === 'active');

    return {
      id: customer.id,
      phone: customer.phone_number,
      joined: customer.created_at,
      planName: activeSub?.plans?.name || 'No Active Plan',
      isOnline: !!liveSession,
      currentLocation: liveSession?.locations?.name || 'Offline',
      expiry: activeSub ? new Date(activeSub.expires_at).toLocaleDateString('en-NG') : 'N/A'
    };
  }) || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="h-6 w-6 text-[#6d1825]" /> Customers 360
          </h1>
          <p className="text-sm text-slate-500">Manage roaming subscribers, active sessions, and access plans.</p>
        </div>
        
        <form className="w-full md:w-auto flex items-center gap-2">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input 
              type="text"
              name="search"
              placeholder="Search phone number..."
              defaultValue={searchQuery}
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#6d1825] focus:border-[#6d1825] outline-none"
            />
          </div>
          <button type="submit" className="px-4 py-2 bg-[#6d1825] text-white text-sm font-semibold rounded-lg hover:bg-[#5a141e] transition-colors">
            Search
          </button>
        </form>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-900 text-xs uppercase tracking-wider font-semibold">
            <tr>
              <th className="px-6 py-4">Subscriber</th>
              <th className="px-6 py-4">Active Plan</th>
              <th className="px-6 py-4">Network Status</th>
              <th className="px-6 py-4">Location</th>
              <th className="px-6 py-4">Valid Until</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {formattedCustomers.map((customer) => (
              <tr key={customer.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 font-mono font-bold text-slate-900">{customer.phone}</td>
                <td className="px-6 py-4">
                  <span className="flex items-center gap-1.5">
                    <CreditCard className="h-3.5 w-3.5 text-slate-400" />
                    {customer.planName}
                  </span>
                </td>
                <td className="px-6 py-4">
                  {customer.isOnline ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold uppercase rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Online
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold uppercase rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                      Offline
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 text-slate-500 text-xs font-medium">{customer.currentLocation}</td>
                <td className="px-6 py-4 text-xs font-mono">{customer.expiry}</td>
                <td className="px-6 py-4 text-right">
                  <button className="p-1 text-slate-400 hover:text-[#6d1825] transition-colors">
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
            {formattedCustomers.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                  No customers found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50">
            <Link 
              href={`?page=${currentPage - 1}${searchQuery ? `&search=${searchQuery}` : ''}`}
              className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg border transition-colors ${
                currentPage <= 1 ? 'pointer-events-none text-slate-400 border-slate-200 bg-slate-100' : 'text-slate-700 border-slate-300 bg-white hover:bg-slate-50'
              }`}
            >
              Prev
            </Link>
            <span className="text-xs font-bold text-slate-500">Page {currentPage} of {totalPages}</span>
            <Link 
              href={`?page=${currentPage + 1}${searchQuery ? `&search=${searchQuery}` : ''}`}
              className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg border transition-colors ${
                currentPage >= totalPages ? 'pointer-events-none text-slate-400 border-slate-200 bg-slate-100' : 'text-slate-700 border-slate-300 bg-white hover:bg-slate-50'
              }`}
            >
              Next
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}