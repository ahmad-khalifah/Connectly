import { routerHealth } from '@/lib/admin/router-health';
// Dashboard figures. Pure functions over rows the loader fetches, so every
// number has one written definition (DEFINITIONS) and a unit test.
// Days are Lagos days (UTC+1, no daylight saving).

export type Period = 'today' | '7d' | '30d' | 'month' | 'all';
export const PERIODS: { id: Period; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: '7d', label: 'Last 7 days' },
  { id: '30d', label: 'Last 30 days' },
  { id: 'month', label: 'This month' },
  { id: 'all', label: 'All time' },
];
export const isPeriod = (v: unknown): v is Period => PERIODS.some((p) => p.id === v);

const LAGOS_OFFSET_MS = 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Midnight in Lagos at or before `d`, as a UTC instant. */
export function lagosDayStart(d: Date): Date {
  const local = d.getTime() + LAGOS_OFFSET_MS;
  return new Date(Math.floor(local / DAY_MS) * DAY_MS - LAGOS_OFFSET_MS);
}

/** YYYY-MM-DD of the Lagos day containing `d`. */
export function lagosDateKey(d: Date): string {
  return new Date(d.getTime() + LAGOS_OFFSET_MS).toISOString().slice(0, 10);
}

/** [from, to) for a period; `from` is null for all time. */
export function periodRange(period: Period, now: Date): { from: Date | null; to: Date } {
  const today = lagosDayStart(now);
  switch (period) {
    case 'today': return { from: today, to: now };
    case '7d': return { from: new Date(today.getTime() - 6 * DAY_MS), to: now };
    case '30d': return { from: new Date(today.getTime() - 29 * DAY_MS), to: now };
    case 'month': {
      const key = lagosDateKey(now); // YYYY-MM-DD
      return { from: new Date(Date.parse(`${key.slice(0, 8)}01T00:00:00Z`) - LAGOS_OFFSET_MS), to: now };
    }
    case 'all': return { from: null, to: now };
  }
}

// ---------------------------------------------------------------- inputs

export type PurchaseRow = {
  status: string;
  amount_paid: number | string | null;
  amount_kobo: number | null;
  gateway_fee_ngn: number | string | null;
  paid_at: string | null;
  created_at: string;
  expires_at: string | null;
  location_id: string | null;
  phone_number: string | null;
};
export type ExpenseRow = { amount_ngn: number | string; expense_date: string; location_id: string | null };
export type GrantRow = { status: string; expires_at: string; revoked_at: string | null; revoke_reason: string | null; location_id: string | null; phone: string | null };
export type CustomerRow = { created_at: string | null };
export type RouterRow = { status: string | null; lifecycle_status: string; location_id: string | null; last_seen_at: string | null };
export type JobRow = { status: string; updated_at: string | null; finished_at: string | null; location_id: string | null };
export type LocationRow = { id: string; is_active: boolean | null };

export type SessionRow = { location_id: string | null; last_seen_at: string | null };

/** Paid and failed purchases grouped by period bucket, location and/or plan (admin_paid_totals). */
export type PaidBucket = { bucket: string | null; location_id: string | null; plan_id: string | null; payments: number; revenue: number; fees: number; failed: number };
export type GrantCounts = { running: number; customersOnPlans: number; ended: number; endedEarly: number };
export type CustomerCounts = { registered: number; newCustomers: number };
export type RevenueWindows = { today: number; last7: number; month: number; all: number };

/**
 * What the dashboard needs. Money, plan and customer figures arrive already
 * totalled by the database for the chosen period and location; only small
 * tables (expenses, routers, jobs, locations, sessions) arrive as rows.
 */
export type MetricInput = {
  /** The chosen period and location, one row per Lagos day (or month for all time). */
  paid: PaidBucket[];
  /** Revenue for the fixed windows, for the chosen location. */
  windows: RevenueWindows;
  grants: GrantCounts;
  customers: CustomerCounts;
  expenses: ExpenseRow[];
  routers: RouterRow[];
  jobs: JobRow[];
  locations: LocationRow[];
  controllerLive: boolean;
  /** Router sessions the controller recorded as active (network_sessions). */
  sessions?: SessionRow[];
};

// ---------------------------------------------------------------- output

export type Metrics = {
  money: {
    revenue: number; fees: number; afterFees: number; expenses: number; netProfit: number;
    successfulPayments: number; failedPayments: number;
    windows: { today: number; last7: number; month: number; all: number };
  };
  customers: { plansRunning: number; customersOnPlans: number; plansEnded: number; endedEarly: number; registered: number; newCustomers: number };
  network: { locationsOpen: number; locationsTotal: number; routersOnline: number; routersOffline: number; routersUnchecked: number; routersNotActive: number; controllerLive: boolean; jobsWaiting: number; jobsGaveUp: number; devicesOnline: number };
  /** Revenue per Lagos day (or month for all time), oldest first, zero-filled. */
  series: { key: string; label: string; revenue: number; payments: number }[];
  seriesUnit: 'day' | 'month';
};

const num = (v: number | string | null | undefined) => (v === null || v === undefined || v === '' ? 0 : Number(v));
const inRange = (iso: string | null | undefined, from: Date | null, to: Date) => {
  if (!iso) return false;
  const t = Date.parse(iso);
  return (from === null || t >= from.getTime()) && t < to.getTime() + 1;
};
const round2 = (n: number) => Math.round(n * 100) / 100;

/** What the customer paid: the verified amount, else the price recorded at checkout. */
export const paidAmount = (p: PurchaseRow) => (p.amount_paid !== null && p.amount_paid !== undefined && p.amount_paid !== '' ? num(p.amount_paid) : num(p.amount_kobo) / 100);
const paidWhen = (p: PurchaseRow) => p.paid_at ?? p.created_at;

export function computeMetrics(input: MetricInput, opts: { period: Period; locationId: string | null; now: Date }): Metrics {
  const { period, locationId, now } = opts;
  const { from, to } = periodRange(period, now);
  const atLoc = <T extends { location_id: string | null }>(rows: T[]) => (locationId ? rows.filter((r) => r.location_id === locationId) : rows);

  const revenue = round2(input.paid.reduce((s, b) => s + num(b.revenue), 0));
  const fees = round2(input.paid.reduce((s, b) => s + num(b.fees), 0));
  const expenses = round2(
    atLoc(input.expenses)
      .filter((e) => inRange(`${e.expense_date}T12:00:00+01:00`, from, to))
      .reduce((s, e) => s + num(e.amount_ngn), 0)
  );

  const routers = atLoc(input.routers);
  const activeRouters = routers.filter((r) => r.lifecycle_status === 'active');
  const locations = locationId ? input.locations.filter((l) => l.id === locationId) : input.locations;
  const jobs = atLoc(input.jobs);

  // Series
  const unit: 'day' | 'month' = period === 'all' ? 'month' : 'day';
  const buckets = new Map<string, { revenue: number; payments: number }>();
  if (unit === 'day' && from) {
    for (let t = from.getTime(); t <= now.getTime(); t += DAY_MS) buckets.set(lagosDateKey(new Date(t)), { revenue: 0, payments: 0 });
  }
  for (const p of input.paid) {
    if (!p.bucket || num(p.payments) === 0) continue;
    const b = buckets.get(p.bucket) ?? { revenue: 0, payments: 0 };
    b.revenue = round2(b.revenue + num(p.revenue));
    b.payments += num(p.payments);
    buckets.set(p.bucket, b);
  }
  if (unit === 'month' && buckets.size > 0) {
    const keys = [...buckets.keys()].sort();
    let [y, m] = keys[0].split('-').map(Number);
    const [ly, lm] = lagosDateKey(now).slice(0, 7).split('-').map(Number);
    while (y < ly || (y === ly && m <= lm)) {
      const k = `${y}-${String(m).padStart(2, '0')}`;
      if (!buckets.has(k)) buckets.set(k, { revenue: 0, payments: 0 });
      m += 1; if (m > 12) { m = 1; y += 1; }
    }
  }
  const label = (k: string) =>
    unit === 'day'
      ? new Date(`${k}T12:00:00Z`).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', timeZone: 'UTC' })
      : new Date(`${k}-15T12:00:00Z`).toLocaleDateString('en-NG', { month: 'short', year: '2-digit', timeZone: 'UTC' });
  const series = [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, v]) => ({ key, label: label(key), ...v }));

  return {
    money: {
      revenue,
      fees,
      afterFees: round2(revenue - fees),
      expenses,
      netProfit: round2(revenue - fees - expenses),
      successfulPayments: input.paid.reduce((s, b) => s + num(b.payments), 0),
      failedPayments: input.paid.reduce((s, b) => s + num(b.failed), 0),
      windows: input.windows,
    },
    customers: {
      plansRunning: input.grants.running,
      customersOnPlans: input.grants.customersOnPlans,
      plansEnded: input.grants.ended,
      endedEarly: input.grants.endedEarly,
      registered: input.customers.registered,
      newCustomers: input.customers.newCustomers,
    },
    network: {
      locationsOpen: locations.filter((l) => l.is_active !== false).length,
      locationsTotal: locations.length,
      // A reading older than 5 minutes is not current (the controller checks every minute).
      routersOnline: activeRouters.filter((r) => routerHealth(r.status, r.last_seen_at, now.getTime()).label === 'Online').length,
      routersOffline: activeRouters.filter((r) => !routerHealth(r.status, r.last_seen_at, now.getTime()).stale && r.status !== 'online').length,
      routersUnchecked: activeRouters.filter((r) => routerHealth(r.status, r.last_seen_at, now.getTime()).stale).length,
      routersNotActive: routers.filter((r) => r.lifecycle_status !== 'active' && r.lifecycle_status !== 'retired').length,
      controllerLive: input.controllerLive,
      jobsWaiting: jobs.filter((j) => j.status === 'queued' || j.status === 'running' || j.status === 'failed').length,
      jobsGaveUp: jobs.filter((j) => j.status === 'dead' && inRange(j.finished_at ?? j.updated_at, from, to)).length,
      // Sessions the controller saw on a router in the last 5 minutes (it records them every minute).
      devicesOnline: atLoc(input.sessions ?? []).filter((x) => x.last_seen_at && now.getTime() - Date.parse(x.last_seen_at) <= 5 * 60_000).length,
    },
    series,
    seriesUnit: unit,
  };
}

// ------------------------------------------------- reference implementations
// The database computes these figures (supabase/migrations/20261121090000_admin_totals.sql).
// The same definitions in TypeScript, over raw rows, are used by the unit tests
// and checked against the SQL functions in supabase/tests/admin_totals.test.mjs.

/** admin_paid_totals over rows. */
export function aggregatePaid(
  rows: (PurchaseRow & { plan_id?: string | null })[],
  o: { from: Date | null; to: Date; locationId: string | null; unit: 'day' | 'month' | 'none'; byLocation?: boolean; byPlan?: boolean }
): PaidBucket[] {
  const out = new Map<string, PaidBucket>();
  const add = (at: string, p: PurchaseRow & { plan_id?: string | null }, paidOne: boolean) => {
    const day = lagosDateKey(new Date(at));
    const bucket = o.unit === 'day' ? day : o.unit === 'month' ? day.slice(0, 7) : null;
    const location_id = o.byLocation ? p.location_id : null;
    const plan_id = o.byPlan ? (p.plan_id ?? null) : null;
    const k = JSON.stringify([bucket, location_id, plan_id]);
    const b = out.get(k) ?? { bucket, location_id, plan_id, payments: 0, revenue: 0, fees: 0, failed: 0 };
    if (paidOne) { b.payments += 1; b.revenue = round2(b.revenue + paidAmount(p)); b.fees = round2(b.fees + num(p.gateway_fee_ngn)); }
    else b.failed += 1;
    out.set(k, b);
  };
  for (const p of rows) {
    if (o.locationId && p.location_id !== o.locationId) continue;
    if (p.status === 'paid' && inRange(paidWhen(p), o.from, o.to)) add(paidWhen(p), p, true);
    else if (p.status === 'failed' && inRange(p.created_at, o.from, o.to)) add(p.created_at, p, false);
  }
  return [...out.values()];
}

/** Revenue for the fixed windows, from the rows. */
export function revenueWindows(rows: PurchaseRow[], now: Date, locationId: string | null): RevenueWindows {
  const rev = (from: Date | null) => round2(aggregatePaid(rows, { from, to: now, locationId, unit: 'none' }).reduce((s, b) => s + b.revenue, 0));
  return { today: rev(periodRange('today', now).from), last7: rev(periodRange('7d', now).from), month: rev(periodRange('month', now).from), all: rev(null) };
}

/** admin_grant_counts over rows. */
export function countGrants(grants: GrantRow[], o: { from: Date | null; to: Date; now: Date; locationId: string | null }): GrantCounts {
  const g = o.locationId ? grants.filter((x) => x.location_id === o.locationId) : grants;
  const running = g.filter((x) => (x.status === 'active' || x.status === 'pending_device') && Date.parse(x.expires_at) > o.now.getTime());
  return {
    running: running.length,
    customersOnPlans: new Set(running.map((x) => x.phone).filter(Boolean)).size,
    ended: g.filter((x) => x.status !== 'revoked' && Date.parse(x.expires_at) <= o.now.getTime() && inRange(x.expires_at, o.from, o.to)).length,
    endedEarly: g.filter((x) => x.status === 'revoked' && x.revoke_reason !== 'expired' && inRange(x.revoked_at, o.from, o.to)).length,
  };
}

/** admin_customer_counts over rows. */
export function countCustomers(customers: CustomerRow[], from: Date | null, to: Date): CustomerCounts {
  return { registered: customers.length, newCustomers: customers.filter((c) => inRange(c.created_at, from, to)).length };
}

/** How each figure is worked out. Shown on the dashboard. */
export const DEFINITIONS: { name: string; how: string }[] = [
  { name: 'Revenue', how: 'Sum of what customers paid on purchases Korapay confirmed as paid, counted on the day of payment. Uses the amount Korapay verified, or the checkout price if none was recorded.' },
  { name: 'Korapay fees', how: 'Sum of the fee Korapay reported on those payments.' },
  { name: 'Revenue after fees', how: 'Revenue minus Korapay fees.' },
  { name: 'Expenses', how: 'Sum of expenses recorded on the Expenses page with an expense date in the period. With a location chosen, only that location\'s expenses; general expenses are left out.' },
  { name: 'Net profit', how: 'Revenue after fees minus expenses. Only as complete as the expenses recorded.' },
  { name: 'Successful payments', how: 'Purchases Korapay confirmed as paid in the period.' },
  { name: 'Failed payments', how: 'Purchases started in the period that Korapay reported as failed or that could not open checkout. Checkouts still open are not counted.' },
  { name: 'Plans running now', how: 'Paid access grants whose end time is still ahead and that were not revoked, including ones still being added to the router.' },
  { name: 'Customers on a plan', how: 'Different phone numbers among the plans running now.' },
  { name: 'Plans ended', how: 'Access grants whose end time fell in the period (not counting ones revoked early).' },
  { name: 'Ended early', how: 'Access grants an admin revoked in the period before their end time.' },
  { name: 'Registered customers', how: 'Every phone number that has completed a payment, all time and all locations.' },
  { name: 'New customers', how: 'Customers whose first payment was in the period. Not filtered by location.' },
  { name: 'Locations open', how: 'Locations marked active (selling plans), out of all locations. Set by an admin, not measured.' },
  { name: 'Routers online and offline', how: 'Active routers by the controller\'s health check, run every minute. A router not checked in the last 5 minutes is counted as not checked, not as online.' },
  { name: 'Router service', how: 'Working when every active router is checking in (each router reports every 15 seconds, and is treated as stopped after 3 minutes of silence).' },
  { name: 'Router tasks waiting', how: 'Router tasks queued, running, or failed and waiting to retry.' },
  { name: 'Router tasks that gave up', how: 'Router tasks that ran out of retries in the period.' },
  { name: 'Devices online now', how: 'Devices logged in to a router\'s hotspot, as read from the router in the last 5 minutes. Shows 0 while the router service is stopped.' },
  { name: 'Data use', how: 'Not yet measured: the controller records each session\'s bytes, but not per period yet.' },
];

// ---------------------------------------------------------------- breakdowns

export type BreakdownPurchase = PurchaseRow & { plan_id: string | null };
export type BreakdownRow = { id: string | null; payments: number; revenue: number; fees: number; afterFees: number; expenses: number; net: number };

/**
 * Revenue in the period by location (with that location's expenses) and by plan.
 * `byLocation` and `byPlan` are admin_paid_totals rows for the period, grouped
 * by location and by plan respectively.
 */
export function revenueBreakdown(
  byLocationTotals: PaidBucket[],
  byPlanTotals: PaidBucket[],
  expenses: ExpenseRow[],
  opts: { period: Period; locationId: string | null; now: Date }
): { byLocation: BreakdownRow[]; byPlan: BreakdownRow[]; generalExpenses: number } {
  const { from, to } = periodRange(opts.period, opts.now);
  const expIn = expenses.filter((e) => inRange(`${e.expense_date}T12:00:00+01:00`, from, to) && (!opts.locationId || e.location_id === opts.locationId));

  const group = (totals: PaidBucket[], key: (b: PaidBucket) => string | null, withExpenses: boolean) => {
    const m = new Map<string | null, BreakdownRow>();
    const row = (id: string | null) => m.get(id) ?? (m.set(id, { id, payments: 0, revenue: 0, fees: 0, afterFees: 0, expenses: 0, net: 0 }), m.get(id)!);
    for (const b of totals) {
      if (num(b.payments) === 0) continue;
      const r = row(key(b));
      r.payments += num(b.payments);
      r.revenue = round2(r.revenue + num(b.revenue));
      r.fees = round2(r.fees + num(b.fees));
    }
    if (withExpenses) for (const e of expIn) if (e.location_id) { const r = row(e.location_id); r.expenses = round2(r.expenses + num(e.amount_ngn)); }
    for (const r of m.values()) { r.afterFees = round2(r.revenue - r.fees); r.net = round2(r.afterFees - r.expenses); }
    return [...m.values()].sort((a, b) => b.revenue - a.revenue || b.expenses - a.expenses);
  };

  return {
    byLocation: group(byLocationTotals, (b) => b.location_id, true),
    byPlan: group(byPlanTotals, (b) => b.plan_id, false),
    generalExpenses: opts.locationId ? 0 : round2(expIn.filter((e) => !e.location_id).reduce((s, e) => s + num(e.amount_ngn), 0)),
  };
}
