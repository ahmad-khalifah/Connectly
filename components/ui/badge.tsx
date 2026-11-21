import { cn } from '@/lib/utils';

export type BadgeTone = 'neutral' | 'ok' | 'warn' | 'bad' | 'brand' | 'indigo';

const tones: Record<BadgeTone, string> = {
  neutral: 'bg-canvas text-muted ring-line',
  ok: 'bg-ok-soft text-ok ring-ok/20',
  warn: 'bg-warn-soft text-warn ring-warn/20',
  bad: 'bg-bad-soft text-bad ring-bad/20',
  brand: 'bg-brand-soft text-brand ring-brand/15',
  indigo: 'bg-indigo-soft text-indigo ring-indigo/15',
};

/** Short status word. Sentence case, never all caps. */
export function Badge({ tone = 'neutral', children, className }: { tone?: BadgeTone; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ring-inset', tones[tone], className)}>
      {children}
    </span>
  );
}
