import Link from 'next/link';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { Alert } from '@/lib/admin/alerts';

export default function AlertsPanel({ alerts, quietText = 'No problems found.' }: { alerts: Alert[]; quietText?: string }) {
  if (alerts.length === 0) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-lg border border-emerald-200 bg-emerald-50 text-sm text-emerald-800">
        <CheckCircle2 className="h-4 w-4" /> {quietText}
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {alerts.map((a) => (
        <Link key={a.title} href={a.href}
          className={`flex items-start gap-2 p-3 rounded-lg border text-sm ${a.severity === 'error' ? 'border-red-200 bg-red-50 text-red-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span><span className="font-semibold">{a.title}.</span> {a.detail}</span>
        </Link>
      ))}
    </div>
  );
}
