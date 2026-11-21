import { cn } from '@/lib/utils';

/** A bordered section. Header is optional; body padding can be turned off for tables. */
export function Panel({
  title,
  description,
  action,
  children,
  flush = false,
  className,
  id,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  flush?: boolean;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn('rounded-[var(--radius-panel)] border border-line bg-surface', className)}>
      {(title || action) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            {title && <h2 className="text-[15px] font-semibold text-ink">{title}</h2>}
            {description && <p className="mt-0.5 text-[13px] leading-snug text-muted">{description}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      <div className={cn(!flush && 'p-5')}>{children}</div>
    </section>
  );
}
