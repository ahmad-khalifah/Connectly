import Link from 'next/link';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import type { Alert } from '@/lib/admin/alerts';
import { cn } from '@/lib/utils';

const TONE = {
  error: { cls: 'border-bad/25 bg-bad-soft text-bad', Icon: XCircle },
  warn: { cls: 'border-warn/25 bg-warn-soft text-warn', Icon: AlertTriangle },
  info: { cls: 'border-line bg-surface text-ink', Icon: Info },
};

export default function AlertsPanel({ alerts, quietText = 'No problems found.' }: { alerts: Alert[]; quietText?: string }) {
  if (alerts.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-[var(--radius-control)] border border-ok/25 bg-ok-soft p-3.5 text-sm font-semibold text-ok" role="status">
        <CheckCircle2 className="h-4 w-4" aria-hidden /> {quietText}
      </div>
    );
  }
  return (
    <ul className="space-y-2" aria-label="Alerts">
      {alerts.map((a) => {
        const { cls, Icon } = TONE[a.severity];
        return (
          <li key={a.title}>
            <Link prefetch={false} href={a.href} className={cn('flex items-start gap-3 rounded-[var(--radius-control)] border p-3.5 text-sm transition-colors hover:brightness-[0.98]', cls)}>
              <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span className="min-w-0">
                <span className="font-semibold">{a.title}</span>
                <span className={cn('block leading-relaxed', a.severity === 'info' ? 'text-muted' : 'opacity-90')}>{a.detail}</span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
