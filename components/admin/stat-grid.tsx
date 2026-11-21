import { cn } from '@/lib/utils';

/** Figures in one bordered block, separated by hairlines (not a card each). */
export function StatGrid({ children, cols = 4, className }: { children: React.ReactNode; cols?: 2 | 3 | 4 | 5; className?: string }) {
  const grid = { 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3', 4: 'sm:grid-cols-2 lg:grid-cols-4', 5: 'sm:grid-cols-2 lg:grid-cols-5' }[cols];
  return (
    <div className={cn('overflow-hidden rounded-[var(--radius-panel)] border border-line bg-line', className)}>
      <dl className={cn('grid grid-cols-1 gap-px', grid)}>{children}</dl>
    </div>
  );
}

/**
 * One figure. `how` is its definition (shown on hover and kept for screen
 * readers). `unmeasured` shows an honest "Not yet measured" instead of a number.
 */
export function Stat({
  label,
  value,
  note,
  how,
  tone,
  unmeasured,
}: {
  label: string;
  value?: React.ReactNode;
  note?: React.ReactNode;
  how?: string;
  tone?: 'ok' | 'bad' | 'warn';
  unmeasured?: boolean;
}) {
  return (
    <div className="bg-surface px-5 py-4" title={how}>
      <dt className="text-[13px] font-medium text-muted">{label}</dt>
      <dd className="mt-1">
        {unmeasured ? (
          <span className="text-[15px] font-semibold text-subtle">Not yet measured</span>
        ) : (
          <span className={cn('tnum text-[26px] font-bold leading-tight tracking-[-0.01em]', tone === 'ok' ? 'text-ok' : tone === 'bad' ? 'text-bad' : tone === 'warn' ? 'text-warn' : 'text-ink')}>
            {value}
          </span>
        )}
        {note && <span className="mt-0.5 block text-[12.5px] leading-snug text-subtle">{note}</span>}
        {how && <span className="sr-only">{how}</span>}
      </dd>
    </div>
  );
}
