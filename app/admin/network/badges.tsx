// Small display helpers shared by the network pages.
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { routerHealth } from '@/lib/admin/router-health';
import { requestTime } from '@/lib/time';

const LIFECYCLE: Record<string, { label: string; tone: BadgeTone }> = {
  registered: { label: 'Registered', tone: 'neutral' },
  active: { label: 'Active', tone: 'ok' },
  suspended: { label: 'Suspended', tone: 'warn' },
  retired: { label: 'Retired', tone: 'neutral' },
};
const JOB: Record<string, { label: string; tone: BadgeTone }> = {
  queued: { label: 'Queued', tone: 'neutral' },
  running: { label: 'Running', tone: 'indigo' },
  succeeded: { label: 'Succeeded', tone: 'ok' },
  failed: { label: 'Retrying', tone: 'warn' },
  dead: { label: 'Gave up', tone: 'bad' },
};

export function LifecycleBadge({ value }: { value: string }) {
  const v = LIFECYCLE[value] ?? { label: value, tone: 'neutral' as BadgeTone };
  return <Badge tone={v.tone}>{v.label}</Badge>;
}

export function JobStatusBadge({ value }: { value: string }) {
  const v = JOB[value] ?? { label: value, tone: 'neutral' as BadgeTone };
  return <Badge tone={v.tone}>{v.label}</Badge>;
}

/** Health comes only from the controller; a router it has never reached is "never seen". */
export function HealthBadge({ value, lastSeen, lifecycle }: { value: string | null; lastSeen: string | null; lifecycle?: string }) {
  // Health is checked only for active routers; before that, show when it was last reached (Test connection).
  if (lifecycle && lifecycle !== 'active') {
    return <span className="text-[13px] text-muted">Checked once active{lastSeen ? <span className="text-subtle">, last reached {ago(lastSeen)}</span> : null}</span>;
  }
  if (!lastSeen) return <span className="text-[13px] text-subtle">Never seen</span>;
  const h = routerHealth(value, lastSeen, requestTime());
  return (
    <span className="inline-flex items-center gap-2" title={h.stale ? 'The controller has not checked this router in the last 5 minutes, so its last status is not shown as current.' : undefined}>
      <Badge tone={h.tone}>{h.label}</Badge><span className="text-[12.5px] text-subtle">{h.stale ? 'last checked ' : ''}{ago(lastSeen)}</span>
    </span>
  );
}

export const fmtTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('en-NG', { timeZone: 'Africa/Lagos', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';

export function ago(iso: string): string {
  const s = Math.round((Date.now() - Date.parse(iso)) / 1000);
  if (s < 0) return `in ${until(-s)}`;
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}

function until(s: number): string {
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.round(s / 60)} min`;
  return `${Math.round(s / 3600)} h`;
}
