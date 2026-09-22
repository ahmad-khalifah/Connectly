'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { ShieldX, AlertTriangle, Info } from 'lucide-react';

interface ActivityLog {
  id: string;
  event_type: string;
  severity: 'info' | 'warn' | 'error' | 'critical';
  message: string;
  created_at: string;
}

// Initialize the public client explicitly for browser-side WebSocket connections
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const publicDb = createClient(supabaseUrl, supabaseAnonKey);

export default function RealtimeActivityFeed({ initialLogs }: { initialLogs: ActivityLog[] }) {
  const [logs, setLogs] = useState<ActivityLog[]>(initialLogs);

  useEffect(() => {
    const channel = publicDb
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'activity_logs',
        },
        (payload) => {
          setLogs((prev) => [payload.new as ActivityLog, ...prev.slice(0, 19)]);
        }
      )
      .subscribe();

    return () => {
      publicDb.removeChannel(channel);
    };
  }, []);

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
      case 'error':
        return <ShieldX className="h-4 w-4 text-red-600" />;
      case 'warn':
        return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      default:
        return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  return (
    <div className="space-y-2">
      {logs.map((log) => (
        <div 
          key={log.id} 
          className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-colors"
        >
          <div className="mt-0.5">{getSeverityIcon(log.severity)}</div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-slate-800 break-words">{log.message}</p>
            <span className="text-[10px] text-slate-400 font-mono">
              {new Date(log.created_at).toLocaleTimeString('en-NG')} &bull; {log.event_type}
            </span>
          </div>
        </div>
      ))}
      {logs.length === 0 && (
        <div className="py-8 text-center text-xs text-slate-400">
          No live activity recorded in this window.
        </div>
      )}
    </div>
  );
}