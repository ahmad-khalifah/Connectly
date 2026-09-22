import { db } from '@/lib/db/client';
import { Activity, BarChart3, Wifi, ArrowDown, ArrowUp, Clock } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function UsageAnalyticsPage() {
  const { data: sessions, count } = await db
    .from('network_sessions')
    .select('bytes_in, bytes_out, session_start, session_end, status', { count: 'exact' })
    .order('session_start', { ascending: false })
    .limit(1000); // Limit for performance without external charting

  const activeSessions = sessions?.filter(s => s.status === 'active').length || 0;
  
  let totalBytesIn = 0;
  let totalBytesOut = 0;
  
  sessions?.forEach(session => {
    totalBytesIn += Number(session.bytes_in || 0);
    totalBytesOut += Number(session.bytes_out || 0);
  });

  const totalDataGB = ((totalBytesIn + totalBytesOut) / (1024 ** 3)).toFixed(2);
  const downloadGB = (totalBytesIn / (1024 ** 3)).toFixed(2);
  const uploadGB = (totalBytesOut / (1024 ** 3)).toFixed(2);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Activity className="h-6 w-6 text-[#6d1825]" /> Usage Analytics
        </h1>
        <p className="text-sm text-slate-500">Monitor bandwidth consumption, active sessions, and data limits.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Total Data Processed</span>
          <p className="text-2xl font-bold text-slate-900 font-mono">{totalDataGB} GB</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Download Traffic</span>
          <p className="text-2xl font-bold text-emerald-600 font-mono flex items-center gap-2">
            <ArrowDown className="h-5 w-5" /> {downloadGB} GB
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Upload Traffic</span>
          <p className="text-2xl font-bold text-blue-600 font-mono flex items-center gap-2">
            <ArrowUp className="h-5 w-5" /> {uploadGB} GB
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs bg-[#cfa253]/5 border-[#cfa253]/20">
          <span className="text-xs font-bold text-[#6d1825] uppercase tracking-wider block mb-2">Live Connections</span>
          <p className="text-2xl font-bold text-[#6d1825] font-mono flex items-center gap-2">
            <Wifi className="h-5 w-5" /> {activeSessions} Users
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-slate-500" />
          <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Session Duration Trends</h2>
        </div>
        <div className="p-12 text-center flex flex-col items-center justify-center text-slate-400 min-h-[300px]">
          <Clock className="h-8 w-8 mb-3 opacity-50" />
          <p className="text-sm">Detailed timeseries usage charts require a visualization library.</p>
          <p className="text-xs mt-1">Implement Recharts to visualize daily peaks and trough traffic across locations.</p>
        </div>
      </div>
    </div>
  );
}