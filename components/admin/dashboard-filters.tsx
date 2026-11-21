'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PERIODS, type Period } from '@/lib/admin/metrics';
import { selectClass } from '@/components/ui/field';
import { cn } from '@/lib/utils';

/** Period and location, kept in the URL so a view can be shared or refreshed. */
export function DashboardFilters({ period, locationId, locations, basePath = '/admin' }: { period: Period; locationId: string | null; locations: { id: string; name: string }[]; basePath?: string }) {
  const router = useRouter();
  const href = (p: Period, loc: string | null) => {
    const q = new URLSearchParams();
    if (p !== '30d') q.set('period', p);
    if (loc) q.set('location', loc);
    const s = q.toString();
    return s ? `${basePath}?${s}` : basePath;
  };
  return (
    <div className="flex flex-wrap items-center gap-3">
      <nav aria-label="Period" className="inline-flex flex-wrap rounded-[var(--radius-control)] border border-line bg-surface p-0.5">
        {PERIODS.map((p) => (
          <Link prefetch={false}
            key={p.id}
            href={href(p.id, locationId)}
            aria-current={p.id === period ? 'true' : undefined}
            className={cn('rounded-md px-3 py-1.5 text-[13px] font-semibold transition-colors', p.id === period ? 'bg-brand text-white' : 'text-muted hover:bg-canvas hover:text-ink')}
          >
            {p.label}
          </Link>
        ))}
      </nav>
      <label className="flex items-center gap-2 text-[13px] font-semibold text-muted">
        <span>Location</span>
        <select
          value={locationId ?? ''}
          onChange={(e) => router.push(href(period, e.target.value || null))}
          className={cn(selectClass, 'h-9 w-auto min-w-48 text-sm')}
        >
          <option value="">All locations</option>
          {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </label>
    </div>
  );
}
