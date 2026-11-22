import { db } from '@/lib/db/client';
import { agentLive } from '@/lib/admin/alerts';
import { isControllerLive } from '@/lib/network/jobs';
import { periodRange, type CustomerCounts, type GrantCounts, type MetricInput, type PaidBucket, type Period, type RevenueWindows } from './metrics';
import { fetchAll as all } from '@/lib/db/fetch-all';

const n = (v: unknown) => (v === null || v === undefined || v === '' ? 0 : Number(v));

/** Calls a database function and throws on error, so the page says so instead of showing zeros. */
async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await db.rpc(fn, args);
  if (error) throw new Error(`${fn}: ${error.message}`);
  return data as T;
}

type PaidArgs = { from: Date | null; to: Date; locationId?: string | null; unit?: 'day' | 'month' | 'none'; byLocation?: boolean; byPlan?: boolean };

/** admin_paid_totals: only the totals travel, never the purchases. */
export async function paidTotals(a: PaidArgs): Promise<PaidBucket[]> {
  const rows = await rpc<Record<string, unknown>[]>('admin_paid_totals', {
    p_from: a.from?.toISOString() ?? null,
    p_to: a.to.toISOString(),
    p_location: a.locationId ?? null,
    p_unit: a.unit ?? 'none',
    p_by_location: a.byLocation ?? false,
    p_by_plan: a.byPlan ?? false,
  });
  return (rows ?? []).map((r) => ({
    bucket: (r.bucket as string | null) ?? null,
    location_id: (r.location_id as string | null) ?? null,
    plan_id: (r.plan_id as string | null) ?? null,
    payments: n(r.payments),
    revenue: n(r.revenue),
    fees: n(r.fees),
    failed: n(r.failed),
  }));
}

const revenueOf = (b: PaidBucket[]) => Math.round(b.reduce((s, x) => s + x.revenue, 0) * 100) / 100;

export type PaidPart = Pick<MetricInput, 'paid' | 'windows'>;
export type PeoplePart = Pick<MetricInput, 'grants' | 'customers' | 'expenses'>;
export type NetworkPart = Pick<MetricInput, 'routers' | 'jobs' | 'locations' | 'controllerLive' | 'sessions'>;

/**
 * The dashboard's figures come in three parts, so each request stays small
 * (on Cloudflare Workers Free each request has 10 ms of CPU, roughly one
 * millisecond per database call). loadMetricInput joins them.
 */
export async function loadPaidPart(period: Period, locationId: string | null, now: Date): Promise<PaidPart> {
  const { from, to } = periodRange(period, now);
  const window = (p: Period) => paidTotals({ from: periodRange(p, now).from, to: now, locationId }).then(revenueOf);
  const [paid, today, last7, month, allTime] = await Promise.all([
    paidTotals({ from, to, locationId, unit: period === 'all' ? 'month' : 'day' }),
    window('today'),
    window('7d'),
    window('month'),
    window('all'),
  ]);
  return { paid, windows: { today, last7, month, all: allTime } satisfies RevenueWindows };
}

export async function loadPeoplePart(period: Period, locationId: string | null, now: Date): Promise<PeoplePart> {
  const { from, to } = periodRange(period, now);
  const [grantRows, customerRows, expenses] = await Promise.all([
    rpc<Record<string, unknown>[]>('admin_grant_counts', { p_from: from?.toISOString() ?? null, p_to: to.toISOString(), p_now: now.toISOString(), p_location: locationId }),
    rpc<Record<string, unknown>[]>('admin_customer_counts', { p_from: from?.toISOString() ?? null, p_to: to.toISOString() }),
    all((f, t) => db.from('expenses').select('amount_ngn, expense_date, location_id').order('expense_date').range(f, t)),
  ]);
  const g = grantRows?.[0] ?? {};
  const c = customerRows?.[0] ?? {};
  const grants: GrantCounts = { running: n(g.running), customersOnPlans: n(g.customers_on_plans), ended: n(g.ended), endedEarly: n(g.ended_early) };
  const customers: CustomerCounts = { registered: n(c.registered), newCustomers: n(c.new_customers) };
  return { grants, customers, expenses: expenses as MetricInput['expenses'] };
}

export async function loadNetworkPart(now: Date): Promise<NetworkPart> {
  const [routers, jobs, locations, heartbeat, sessions] = await Promise.all([
    all<{ id: string; status: string | null; lifecycle_status: string; location_id: string | null; last_seen_at: string | null; agent_enabled: boolean | null; agent_last_seen_at: string | null }>((f, t) => db.from('routers').select('id, status, lifecycle_status, location_id, last_seen_at, agent_enabled, agent_last_seen_at').range(f, t)),
    all<{ status: string; updated_at: string | null; finished_at: string | null; router_id: string }>((f, t) => db.from('controller_jobs').select('status, updated_at, finished_at, router_id').in('status', ['queued', 'running', 'failed', 'dead']).range(f, t)),
    all((f, t) => db.from('locations').select('id, is_active').range(f, t)),
    db.from('controller_instances').select('last_heartbeat_at').order('last_heartbeat_at', { ascending: false }).limit(1),
    all<{ location_id: string | null; last_seen_at: string | null }>((f, t) => db.from('network_sessions').select('location_id, last_seen_at').eq('status', 'active').range(f, t)),
  ]);
  const routerLocation = new Map(routers.map((r) => [r.id, r.location_id]));
  const last = (heartbeat.data?.[0] as { last_heartbeat_at?: string } | undefined)?.last_heartbeat_at;
  return {
    routers: routers.map(({ status, lifecycle_status, location_id, last_seen_at }) => ({ status, lifecycle_status, location_id, last_seen_at })),
    jobs: jobs.map((j) => ({ status: j.status, updated_at: j.updated_at, finished_at: j.finished_at, location_id: routerLocation.get(j.router_id) ?? null })),
    locations: locations as MetricInput['locations'],
    // "Working" = every active router is handled by a live agent, or the old controller is running.
    controllerLive: (() => {
      const active = routers.filter((r) => r.lifecycle_status === 'active');
      const rest = active.filter((r) => !r.agent_enabled);
      const agentsOk = active.filter((r) => r.agent_enabled).every((r) => agentLive(r, now.getTime()));
      return agentsOk && (rest.length === 0 ? active.length > 0 : Boolean(last && isControllerLive(last, now.getTime())));
    })(),
    sessions,
  };
}

/** Fetches what computeMetrics needs for one period and location. Throws on a database error. */
export async function loadMetricInput(period: Period, locationId: string | null, now: Date): Promise<MetricInput> {
  const [paid, people, network] = await Promise.all([
    loadPaidPart(period, locationId, now),
    loadPeoplePart(period, locationId, now),
    loadNetworkPart(now),
  ]);
  return { ...paid, ...people, ...network };
}
