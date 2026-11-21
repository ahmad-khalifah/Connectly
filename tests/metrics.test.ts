import { describe, it, expect } from 'vitest';
import {
  aggregatePaid, computeMetrics, countCustomers, countGrants, lagosDayStart, lagosDateKey, periodRange, revenueWindows,
  type CustomerRow, type GrantRow, type MetricInput, type Period, type PurchaseRow,
} from '@/lib/admin/metrics';

// 18 Nov 2026, 18:30 in Lagos.
const NOW = new Date('2026-11-18T17:30:00Z');
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const paid = (paidAt: string, amount: number, loc = A, fee = 0, phone = '2348030000001'): PurchaseRow => ({
  status: 'paid', amount_paid: amount, amount_kobo: amount * 100, gateway_fee_ngn: fee, paid_at: paidAt, created_at: paidAt, expires_at: null, location_id: loc, phone_number: phone,
});

// Raw rows as the tests describe them; the database totals them in production.
// toInput totals them with the reference implementations, which
// supabase/tests/admin_totals.test.mjs checks against the SQL functions.
type Raw = Omit<MetricInput, 'paid' | 'windows' | 'grants' | 'customers'> & { purchases: PurchaseRow[]; grants: GrantRow[]; customers: CustomerRow[] };
const base = (over: Partial<Raw> = {}): Raw => ({
  purchases: [], expenses: [], grants: [], customers: [], routers: [], jobs: [], locations: [], controllerLive: true, ...over,
});
function toInput(raw: Raw, o: { period: Period; locationId: string | null; now: Date }): MetricInput {
  const { from, to } = periodRange(o.period, o.now);
  const { purchases, grants, customers, ...rest } = raw;
  return {
    ...rest,
    paid: aggregatePaid(purchases, { from, to, locationId: o.locationId, unit: o.period === 'all' ? 'month' : 'day' }),
    windows: revenueWindows(purchases, o.now, o.locationId),
    grants: countGrants(grants, { from, to, now: o.now, locationId: o.locationId }),
    customers: countCustomers(customers, from, to),
  };
}
const metrics = (raw: Raw, o: { period: Period; locationId: string | null; now: Date }) => computeMetrics(toInput(raw, o), o);

describe('Lagos days', () => {
  it('starts the day at midnight Lagos (23:00 UTC the day before)', () => {
    expect(lagosDayStart(new Date('2026-11-18T23:30:00Z')).toISOString()).toBe('2026-11-18T23:00:00.000Z');
    expect(lagosDayStart(NOW).toISOString()).toBe('2026-11-17T23:00:00.000Z');
    expect(lagosDateKey(new Date('2026-11-18T23:30:00Z'))).toBe('2026-11-19');
  });
  it('puts "this month" at 1 Nov 00:00 Lagos', () => {
    expect(periodRange('month', NOW).from?.toISOString()).toBe('2026-10-31T23:00:00.000Z');
    expect(periodRange('7d', NOW).from?.toISOString()).toBe('2026-11-11T23:00:00.000Z');
  });
});

describe('money', () => {
  const input = base({
    purchases: [
      paid('2026-11-18T08:00:00Z', 200, A, 2.8),            // today
      paid('2026-11-17T22:30:00Z', 500, A, 7),              // 23:30 Lagos on the 17th: yesterday
      paid('2026-11-02T10:00:00Z', 1000, B, 14),            // this month, other location
      paid('2026-10-20T10:00:00Z', 300, A),                 // last month
      { ...paid('2026-11-18T09:00:00Z', 0, A), status: 'failed', amount_paid: null, paid_at: null },
      { ...paid('2026-11-18T09:00:00Z', 0, A), status: 'pending', amount_paid: null, paid_at: null },
      { ...paid('2026-11-18T09:00:00Z', 0, A), amount_paid: null, amount_kobo: 15000 }, // no verified amount: checkout price
    ],
    expenses: [
      { amount_ngn: 100, expense_date: '2026-11-18', location_id: A },
      { amount_ngn: 50, expense_date: '2026-11-18', location_id: null },
      { amount_ngn: 999, expense_date: '2026-11-17', location_id: A },
    ],
  });

  it('counts today in Lagos time, with fees, expenses and net profit', () => {
    const m = metrics(input, { period: 'today', locationId: null, now: NOW }).money;
    expect(m).toMatchObject({ revenue: 350, fees: 2.8, afterFees: 347.2, expenses: 150, netProfit: 197.2, successfulPayments: 2, failedPayments: 1 });
  });

  it('gives fixed windows whatever the period', () => {
    const m = metrics(input, { period: 'today', locationId: null, now: NOW }).money;
    expect(m.windows).toEqual({ today: 350, last7: 850, month: 1850, all: 2150 });
  });

  it('filters money by location, leaving general expenses out', () => {
    const m = metrics(input, { period: 'month', locationId: A, now: NOW }).money;
    expect(m).toMatchObject({ revenue: 850, expenses: 1099, successfulPayments: 3 });
    expect(m.windows.all).toBe(1150);
  });

  it('draws one zero-filled bar per Lagos day', () => {
    const s = metrics(input, { period: '7d', locationId: null, now: NOW }).series;
    expect(s.map((d) => d.key)).toEqual(['2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15', '2026-11-16', '2026-11-17', '2026-11-18']);
    expect(s.find((d) => d.key === '2026-11-17')).toMatchObject({ revenue: 500, payments: 1 });
    expect(s.find((d) => d.key === '2026-11-18')).toMatchObject({ revenue: 350, payments: 2 });
  });

  it('groups all time by month with empty months shown', () => {
    const r = metrics(input, { period: 'all', locationId: null, now: NOW });
    expect(r.seriesUnit).toBe('month');
    expect(r.series.map((d) => [d.key, d.revenue])).toEqual([['2026-10', 300], ['2026-11', 1850]]);
  });
});

describe('customers and network', () => {
  it('counts running plans, endings and early revokes from access grants', () => {
    const g = (status: string, expires: string, extra: object = {}) => ({ status, expires_at: expires, revoked_at: null, revoke_reason: null, location_id: A, phone: '2348030000001', ...extra });
    const m = metrics(base({
      grants: [
        g('active', '2026-11-18T18:00:00Z'),
        g('pending_device', '2026-11-18T19:00:00Z', { phone: '2348030000002' }),
        g('expired', '2026-11-18T10:00:00Z', { revoke_reason: 'expired', revoked_at: '2026-11-18T10:00:20Z' }),
        g('revoked', '2026-11-18T20:00:00Z', { revoke_reason: 'admin', revoked_at: '2026-11-18T12:00:00Z' }),
        g('active', '2026-11-18T09:00:00Z'), // ended, controller not yet caught up
      ],
      customers: [{ created_at: '2026-11-18T08:00:00Z' }, { created_at: '2026-11-01T08:00:00Z' }],
    }), { period: 'today', locationId: null, now: NOW }).customers;
    expect(m).toEqual({ plansRunning: 2, customersOnPlans: 2, plansEnded: 2, endedEarly: 1, registered: 2, newCustomers: 1 });
  });

  it('reports routers by health, jobs waiting and jobs that gave up', () => {
    const n = metrics(base({
      routers: [
        { status: 'online', lifecycle_status: 'active', location_id: A, last_seen_at: new Date(NOW.getTime() - 60_000).toISOString() },
        { status: 'offline', lifecycle_status: 'active', location_id: A, last_seen_at: new Date(NOW.getTime() - 60_000).toISOString() },
        { status: 'online', lifecycle_status: 'active', location_id: A, last_seen_at: '2026-11-17T09:00:00Z' }, // stale: not online
        { status: null, lifecycle_status: 'registered', location_id: A, last_seen_at: null },
        { status: 'offline', lifecycle_status: 'retired', location_id: A, last_seen_at: null },
      ],
      jobs: [
        { status: 'queued', updated_at: null, finished_at: null, location_id: A },
        { status: 'failed', updated_at: null, finished_at: null, location_id: A },
        { status: 'dead', updated_at: '2026-11-18T09:00:00Z', finished_at: '2026-11-18T09:00:00Z', location_id: A },
        { status: 'succeeded', updated_at: '2026-11-18T09:00:00Z', finished_at: '2026-11-18T09:00:00Z', location_id: A },
      ],
      locations: [{ id: A, is_active: true }, { id: B, is_active: false }],
      controllerLive: false,
    }), { period: 'today', locationId: null, now: NOW }).network;
    expect(n).toEqual({ locationsOpen: 1, locationsTotal: 2, routersOnline: 1, routersOffline: 1, routersUnchecked: 1, routersNotActive: 1, controllerLive: false, jobsWaiting: 2, jobsGaveUp: 1, devicesOnline: 0 });
  });
});

import { revenueBreakdown } from '@/lib/admin/metrics';
describe('revenue breakdown', () => {
  const P = (loc: string, plan: string, amount: number, fee: number, at = '2026-11-18T08:00:00Z') => ({ ...paid(at, amount, loc, fee), plan_id: plan });
  it('groups by location with that location\'s expenses, by plan, and keeps general expenses apart', () => {
    const rows = [P(A, 'p1', 200, 3), P(A, 'p2', 500, 7), P(B, 'p1', 200, 3), P(A, 'p1', 999, 0, '2026-10-01T08:00:00Z')];
    const { from, to } = periodRange('month', NOW);
    const r = revenueBreakdown(
      aggregatePaid(rows, { from, to, locationId: null, unit: 'none', byLocation: true }),
      aggregatePaid(rows, { from, to, locationId: null, unit: 'none', byPlan: true }),
      [{ amount_ngn: 100, expense_date: '2026-11-10', location_id: A }, { amount_ngn: 40, expense_date: '2026-11-10', location_id: null }],
      { period: 'month', locationId: null, now: NOW }
    );
    expect(r.byLocation).toEqual([
      { id: A, payments: 2, revenue: 700, fees: 10, afterFees: 690, expenses: 100, net: 590 },
      { id: B, payments: 1, revenue: 200, fees: 3, afterFees: 197, expenses: 0, net: 197 },
    ]);
    expect(r.byPlan.map((x) => [x.id, x.payments, x.revenue])).toEqual([['p2', 1, 500], ['p1', 2, 400]]);
    expect(r.generalExpenses).toBe(40);
  });
});

describe('devices online now', () => {
  it('counts sessions the controller saw in the last 5 minutes, per location', () => {
    const now = new Date('2026-11-20T08:00:00Z');
    const ago = (m: number) => new Date(now.getTime() - m * 60_000).toISOString();
    const raw = base({ sessions: [{ location_id: 'A', last_seen_at: ago(1) }, { location_id: 'A', last_seen_at: ago(4) }, { location_id: 'B', last_seen_at: ago(1) }, { location_id: 'A', last_seen_at: ago(20) }] });
    expect(metrics(raw, { period: 'today', now, locationId: null }).network.devicesOnline).toBe(3);
    expect(metrics(raw, { period: 'today', now, locationId: 'A' }).network.devicesOnline).toBe(2);
    expect(metrics({ ...raw, sessions: undefined }, { period: 'today', now, locationId: null }).network.devicesOnline).toBe(0);
  });
});
