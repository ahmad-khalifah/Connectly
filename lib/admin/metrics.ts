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
export type RouterRow = { status: string | null; lifecycle_status: string; location_id: string | null };
export type JobRow = { status: string; updated_at: string | null; finished_at: string | null; location_id: string | null };
export type LocationRow = { id: string; is_active: boolean | null };

export type MetricInput = {
  purchases: PurchaseRow[];
  expenses: ExpenseRow[];
  grants: GrantRow[];
  customers: CustomerRow[];
  routers: RouterRow[];
  jobs: JobRow[];
  locations: LocationRow[];
  controllerLive: boolean;
};

// ---------------------------------------------------------------- output

export type Metrics = {
  money: {
    revenue: number; fees: number; afterFees: number; expenses: number; netProfit: number;
    successfulPayments: number; failedPayments: number;
    windows: { today: number; last7: number; month: number; all: number };
  };
  customers: { plansRunning: number; customersOnPlans: number; plansEnded: number; endedEarly: number; registered: number; newCustomers: number };
  network: { locationsOpen: number; locationsTotal: number; routersOnline: number; routersOffline: number; routersNotActive: number; controllerLive: boolean; jobsWaiting: number; jobsGaveUp: number };
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

  const purchases = atLoc(input.purchases);
  const paid = purchases.filter((p) => p.status === 'paid');
  const paidInPeriod = paid.filter((p) => inRange(paidWhen(p), from, to));
  const revenueIn = (f: Date | null) => round2(paid.filter((p) => inRange(paidWhen(p), f, now)).reduce((s, p) => s + paidAmount(p), 0));

  const revenue = round2(paidInPeriod.reduce((s, p) => s + paidAmount(p), 0));
  const fees = round2(paidInPeriod.reduce((s, p) => s + num(p.gateway_fee_ngn), 0));
  const expenses = round2(
    atLoc(input.expenses)
      .filter((e) => inRange(`${e.expense_date}T12:00:00+01:00`, from, to))
      .reduce((s, e) => s + num(e.amount_ngn), 0)
  );

  const grants = atLoc(input.grants);
  const running = grants.filter((g) => (g.status === 'active' || g.status === 'pending_device') && Date.parse(g.expires_at) > now.getTime());
  const ended = grants.filter((g) => g.status !== 'revoked' && Date.parse(g.expires_at) <= now.getTime() && inRange(g.expires_at, from, to));
  const endedEarly = grants.filter((g) => g.status === 'revoked' && g.revoke_reason !== 'expired' && inRange(g.revoked_at, from, to));

  const routers = atLoc(input.routers);
  const activeRouters = routers.filter((r) => r.lifecycle_status === 'active');
  const locations = locationId ? input.locations.filter((l) => l.id === locationId) : input.locations;
  const jobs = atLoc(input.jobs);

  // Series
  const unit: 'day' | 'month' = period === 'all' ? 'month' : 'day';
  const buckets = new Map<string, { revenue: number; payments: number }>();
  const keyOf = (iso: string) => (unit === 'day' ? lagosDateKey(new Date(iso)) : lagosDateKey(new Date(iso)).slice(0, 7));
  if (unit === 'day' && from) {
    for (let t = from.getTime(); t <= now.getTime(); t += DAY_MS) buckets.set(lagosDateKey(new Date(t)), { revenue: 0, payments: 0 });
  }
  for (const p of paidInPeriod) {
    const k = keyOf(paidWhen(p));
    const b = buckets.get(k) ?? { revenue: 0, payments: 0 };
    b.revenue = round2(b.revenue + paidAmount(p));
    b.payments += 1;
    buckets.set(k, b);
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
      successfulPayments: paidInPeriod.length,
      failedPayments: purchases.filter((p) => p.status === 'failed' && inRange(p.created_at, from, to)).length,
      windows: {
        today: revenueIn(periodRange('today', now).from),
        last7: revenueIn(periodRange('7d', now).from),
        month: revenueIn(periodRange('month', now).from),
        all: revenueIn(null),
      },
    },
    customers: {
      plansRunning: running.length,
      customersOnPlans: new Set(running.map((g) => g.phone).filter(Boolean)).size,
      plansEnded: ended.length,
      endedEarly: endedEarly.length,
      registered: input.customers.length,
      newCustomers: input.customers.filter((c) => inRange(c.created_at, from, to)).length,
    },
    network: {
      locationsOpen: locations.filter((l) => l.is_active !== false).length,
      locationsTotal: locations.length,
      routersOnline: activeRouters.filter((r) => r.status === 'online').length,
      routersOffline: activeRouters.filter((r) => r.status !== 'online').length,
      routersNotActive: routers.filter((r) => r.lifecycle_status !== 'active' && r.lifecycle_status !== 'retired').length,
      controllerLive: input.controllerLive,
      jobsWaiting: jobs.filter((j) => j.status === 'queued' || j.status === 'running' || j.status === 'failed').length,
      jobsGaveUp: jobs.filter((j) => j.status === 'dead' && inRange(j.finished_at ?? j.updated_at, from, to)).length,
    },
    series,
    seriesUnit: unit,
  };
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
  { name: 'Routers online and offline', how: 'Active routers by the controller\'s latest health check, run every minute.' },
  { name: 'Controller', how: 'Running if its last heartbeat was within the last 2 minutes.' },
  { name: 'Jobs waiting', how: 'Router jobs queued, running, or failed and waiting to retry.' },
  { name: 'Jobs that gave up', how: 'Router jobs that ran out of retries in the period.' },
  { name: 'Live sessions and data use', how: 'Not yet measured: the controller does not record router sessions or data use yet.' },
];
