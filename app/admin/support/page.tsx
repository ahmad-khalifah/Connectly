import { db } from '@/lib/db/client';
import { LifeBuoy, Clock, CheckCircle2, AlertCircle } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function SupportPage() {
  const { data: tickets } = await db
    .from('support_tickets')
    .select('*, customers(phone_number), locations(name)')
    .order('created_at', { ascending: false });

  const formattedTickets = tickets || [];

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'open':
        return <span className="flex items-center gap-1 text-red-700 bg-red-50 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border border-red-200"><AlertCircle className="h-3 w-3" /> Open</span>;
      case 'in_progress':
        return <span className="flex items-center gap-1 text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border border-amber-200"><Clock className="h-3 w-3" /> In Progress</span>;
      case 'resolved':
        return <span className="flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border border-emerald-200"><CheckCircle2 className="h-3 w-3" /> Resolved</span>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <LifeBuoy className="h-6 w-6 text-[#6d1825]" /> Support Desk
        </h1>
        <p className="text-sm text-slate-500">Manage customer connection issues and network incidents.</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-900 text-xs uppercase tracking-wider font-semibold">
            <tr>
              <th className="px-6 py-4">Ticket ID</th>
              <th className="px-6 py-4">Customer</th>
              <th className="px-6 py-4">Subject</th>
              <th className="px-6 py-4">Location</th>
              <th className="px-6 py-4">Created</th>
              <th className="px-6 py-4 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {formattedTickets.map((ticket) => (
              <tr key={ticket.id} className="hover:bg-slate-50 transition-colors cursor-pointer">
                <td className="px-6 py-4 font-mono font-bold text-slate-900">#{ticket.ticket_number}</td>
                <td className="px-6 py-4 font-mono text-slate-700">{ticket.customers?.phone_number || 'Guest'}</td>
                <td className="px-6 py-4 font-medium text-slate-900">
                  {ticket.subject}
                  <span className="block text-xs font-normal text-slate-400 mt-0.5 truncate max-w-xs">{ticket.description}</span>
                </td>
                <td className="px-6 py-4 text-xs text-slate-500">{ticket.locations?.name || 'General'}</td>
                <td className="px-6 py-4 text-xs font-mono text-slate-500">{new Date(ticket.created_at).toLocaleDateString('en-NG')}</td>
                <td className="px-6 py-4 text-right flex justify-end">{getStatusBadge(ticket.status)}</td>
              </tr>
            ))}
            {formattedTickets.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                  No support tickets found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}