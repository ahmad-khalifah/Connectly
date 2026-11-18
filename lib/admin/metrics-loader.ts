import { db } from '@/lib/db/client';
import { isControllerLive } from '@/lib/network/jobs';
import type { MetricInput } from './metrics';
import { fetchAll as all } from '@/lib/db/fetch-all';

type RawGrant = { status: string; expires_at: string; revoked_at: string | null; revoke_reason: string | null; router_id: string; purchases: { phone_number: string | null } | { phone_number: string | null }[] | null };

/** Fetches what computeMetrics needs. Throws on a database error so the page says so instead of showing zeros. */
export async function loadMetricInput(): Promise<MetricInput> {
  const [purchases, expenses, rawGrants, customers, routers, jobs, locations, heartbeat] = await Promise.all([
    all((f, t) => db.from('purchases').select('status, amount_paid, amount_kobo, gateway_fee_ngn, paid_at, created_at, expires_at, location_id, phone_number').in('status', ['paid', 'failed']).order('created_at').range(f, t)),
    all((f, t) => db.from('expenses').select('amount_ngn, expense_date, location_id').order('expense_date').range(f, t)),
    all<RawGrant>((f, t) => db.from('network_authorizations').select('status, expires_at, revoked_at, revoke_reason, router_id, purchases(phone_number)').order('created_at').range(f, t)),
    all((f, t) => db.from('customers').select('created_at').order('created_at').range(f, t)),
    all<{ id: string; status: string | null; lifecycle_status: string; location_id: string | null }>((f, t) => db.from('routers').select('id, status, lifecycle_status, location_id').range(f, t)),
    all<{ status: string; updated_at: string | null; finished_at: string | null; router_id: string }>((f, t) => db.from('controller_jobs').select('status, updated_at, finished_at, router_id').in('status', ['queued', 'running', 'failed', 'dead']).range(f, t)),
    all((f, t) => db.from('locations').select('id, is_active').range(f, t)),
    db.from('controller_instances').select('last_heartbeat_at').order('last_heartbeat_at', { ascending: false }).limit(1),
  ]);

  const routerLocation = new Map(routers.map((r) => [r.id, r.location_id]));
  const last = (heartbeat.data?.[0] as { last_heartbeat_at?: string } | undefined)?.last_heartbeat_at;

  return {
    purchases: purchases as MetricInput['purchases'],
    expenses: expenses as MetricInput['expenses'],
    grants: rawGrants.map((g) => {
      const p = Array.isArray(g.purchases) ? g.purchases[0] : g.purchases;
      return { status: g.status, expires_at: g.expires_at, revoked_at: g.revoked_at, revoke_reason: g.revoke_reason, location_id: routerLocation.get(g.router_id) ?? null, phone: p?.phone_number ?? null };
    }),
    customers: customers as MetricInput['customers'],
    routers: routers.map(({ status, lifecycle_status, location_id }) => ({ status, lifecycle_status, location_id })),
    jobs: jobs.map((j) => ({ status: j.status, updated_at: j.updated_at, finished_at: j.finished_at, location_id: routerLocation.get(j.router_id) ?? null })),
    locations: locations as MetricInput['locations'],
    controllerLive: Boolean(last && isControllerLive(last)),
  };
}
