// Small display helpers shared by the network pages (server components).

const LIFECYCLE: Record<string, string> = {
  registered: 'text-slate-600 bg-slate-50 border-slate-200',
  active: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  suspended: 'text-amber-700 bg-amber-50 border-amber-200',
  retired: 'text-slate-400 bg-slate-50 border-slate-200',
};
const JOB: Record<string, string> = {
  queued: 'text-slate-600 bg-slate-50 border-slate-200',
  running: 'text-blue-700 bg-blue-50 border-blue-200',
  succeeded: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  failed: 'text-amber-700 bg-amber-50 border-amber-200',
  dead: 'text-red-700 bg-red-50 border-red-200',
};
const JOB_WORD: Record<string, string> = { failed: 'retrying', dead: 'failed' };

const pill = (cls: string, text: string) => (
  <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-bold uppercase border ${cls}`}>{text}</span>
);

export function LifecycleBadge({ value }: { value: string }) {
  return pill(LIFECYCLE[value] ?? LIFECYCLE.registered, value);
}

export function JobStatusBadge({ value }: { value: string }) {
  return pill(JOB[value] ?? JOB.queued, JOB_WORD[value] ?? value);
}

/** Health comes only from the controller; a router it has never reached is "unknown". */
export function HealthBadge({ value, lastSeen, lifecycle }: { value: string | null; lastSeen: string | null; lifecycle?: string }) {
  // Health is checked only for active routers; before that, show when it was last reached (Test Connection).
  if (lifecycle && lifecycle !== 'active') {
    return <span className="text-xs text-slate-500">Checked once active{lastSeen ? <span className="text-slate-400"> · last reached {ago(lastSeen)}</span> : null}</span>;
  }
  if (!lastSeen) return <span className="text-xs text-slate-400">Never seen</span>;
  const cls = value === 'online' ? 'text-emerald-700' : value === 'degraded' ? 'text-amber-700' : 'text-red-700';
  return <span className={`text-xs font-semibold ${cls}`}>{value ?? 'unknown'} <span className="font-normal text-slate-400">· {ago(lastSeen)}</span></span>;
}

export const fmtTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('en-NG', { timeZone: 'Africa/Lagos', dateStyle: 'medium', timeStyle: 'short' }) : '—';

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
