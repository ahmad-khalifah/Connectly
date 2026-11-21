import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

type Tone = 'info' | 'ok' | 'warn' | 'bad';

const tones: Record<Tone, string> = {
  info: 'border-line bg-surface text-ink',
  ok: 'border-ok/25 bg-ok-soft text-ok',
  warn: 'border-warn/25 bg-warn-soft text-warn',
  bad: 'border-bad/25 bg-bad-soft text-bad',
};
const icons = { info: Info, ok: CheckCircle2, warn: AlertTriangle, bad: XCircle };

export function Notice({ tone = 'info', title, children, className }: { tone?: Tone; title?: string; children?: React.ReactNode; className?: string }) {
  const Icon = icons[tone];
  return (
    <div role={tone === 'bad' ? 'alert' : 'status'} className={cn('flex gap-3 rounded-[var(--radius-control)] border p-3.5 text-sm leading-relaxed', tones[tone], className)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn(title && 'mt-0.5', tone === 'info' ? 'text-muted' : 'opacity-90')}>{children}</div>}
      </div>
    </div>
  );
}
