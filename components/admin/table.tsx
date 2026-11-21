import Link from 'next/link';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { inputClass } from '@/components/ui/field';
import { buttonClass } from '@/components/ui/button';

/** Bordered, horizontally scrollable table frame. */
export function TableFrame({ children, footer, className }: { children: React.ReactNode; footer?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('overflow-hidden rounded-[var(--radius-panel)] border border-line bg-surface', className)}>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">{children}</table>
      </div>
      {footer && <div className="border-t border-line px-4 py-3">{footer}</div>}
    </div>
  );
}

export const th = 'whitespace-nowrap border-b border-line bg-canvas/60 px-4 py-2.5 text-[12.5px] font-semibold text-muted';
export const td = 'px-4 py-3 align-top';
export const tr = 'border-t border-line first:border-t-0 hover:bg-canvas/50';

export function EmptyRow({ cols, children }: { cols: number; children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={cols} className="px-4 py-12 text-center text-sm text-muted">{children}</td>
    </tr>
  );
}

/** Previous / next with page count. `href(n)` builds the link for page n. */
export function Pager({ page, pages, total, noun, href }: { page: number; pages: number; total: number; noun: string; href: (n: number) => string }) {
  const off = 'pointer-events-none opacity-40';
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-[13px] text-muted">
      <span className="tnum">{total.toLocaleString('en-NG')} {noun}{total === 1 ? '' : 's'}{pages > 1 ? `, page ${page} of ${pages}` : ''}</span>
      {pages > 1 && (
        <span className="flex gap-2">
          <Link href={href(page - 1)} className={cn(buttonClass({ variant: 'secondary', size: 'sm' }), page <= 1 && off)} aria-disabled={page <= 1}>Previous</Link>
          <Link href={href(page + 1)} className={cn(buttonClass({ variant: 'secondary', size: 'sm' }), page >= pages && off)} aria-disabled={page >= pages}>Next</Link>
        </span>
      )}
    </div>
  );
}

/** GET search box. Extra hidden fields keep other filters. */
export function SearchBox({ name = 'search', defaultValue, placeholder, hidden }: { name?: string; defaultValue?: string; placeholder: string; hidden?: Record<string, string | undefined> }) {
  return (
    <form className="flex w-full items-center gap-2 sm:w-auto" role="search">
      {hidden && Object.entries(hidden).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
      <div className="relative w-full sm:w-72">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" aria-hidden />
        <input type="search" name={name} defaultValue={defaultValue} placeholder={placeholder} aria-label={placeholder} className={cn(inputClass, 'h-10 pl-9 text-sm')} />
      </div>
      <button type="submit" className={buttonClass({ variant: 'secondary' })}>Search</button>
    </form>
  );
}

/** Lagos date and time, short. */
export const lagos = (iso: string | null | undefined, withTime = true) =>
  iso
    ? new Date(iso).toLocaleString('en-NG', { timeZone: 'Africa/Lagos', day: 'numeric', month: 'short', year: 'numeric', ...(withTime ? { hour: 'numeric', minute: '2-digit' } : {}) })
    : '—';
