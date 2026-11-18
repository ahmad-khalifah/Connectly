import { cn } from '@/lib/utils';

/**
 * The Connectly mark: two rings and the lens where they overlap.
 * `state` changes only the lens: "on" = ochre (connected), "off" = empty,
 * "pending" = ochre outline. Decorative unless `title` is given.
 */
export function LensMark({
  className,
  state = 'on',
  tone = 'brand',
  title,
}: {
  className?: string;
  state?: 'on' | 'off' | 'pending';
  tone?: 'brand' | 'indigo' | 'light';
  title?: string;
}) {
  const ring = tone === 'indigo' ? 'var(--color-indigo)' : tone === 'light' ? '#ffffff' : 'var(--color-brand)';
  const lens = 'M50 24.02 A30 30 0 0 1 50 75.98 A30 30 0 0 1 50 24.02 Z';
  return (
    <svg viewBox="0 0 100 100" className={cn('shrink-0', className)} role={title ? 'img' : undefined} aria-hidden={title ? undefined : true}>
      {title && <title>{title}</title>}
      <path
        d={lens}
        fill={state === 'on' ? 'var(--color-ochre)' : 'none'}
        stroke={state === 'pending' ? 'var(--color-ochre)' : 'none'}
        strokeWidth={state === 'pending' ? 4 : 0}
        style={{ transition: 'fill 400ms ease' }}
      />
      <circle cx="35" cy="50" r="30" fill="none" stroke={ring} strokeWidth="9" />
      <circle cx="65" cy="50" r="30" fill="none" stroke={ring} strokeWidth="9" />
    </svg>
  );
}

/** Mark plus the word, for headers. */
export function Wordmark({ className, tone = 'brand' }: { className?: string; tone?: 'brand' | 'light' }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <LensMark className="h-7 w-7" tone={tone} />
      <span className={cn('text-[17px] font-bold tracking-[-0.01em]', tone === 'light' ? 'text-white' : 'text-brand')}>Connectly</span>
    </span>
  );
}
