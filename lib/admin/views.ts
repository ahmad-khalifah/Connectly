// Data for each admin page, loaded on the server and sent as JSON to the
// static page that draws it (registered in lib/http/admin-api.ts). Each
// loader keeps to about eight database calls: on Cloudflare Workers Free a
// request has 10 ms of CPU, roughly one millisecond per call. Pages that
// need more are split into parts the browser asks for at once.
//
// Everything a page needs that touches the database or server settings is
// worked out here, so the pages import nothing from the server.

import { db } from '@/lib/db/client';
import { appUrl } from '@/lib/env';
import { adminEmails } from '@/lib/auth/admin-emails';
import { smsConfigured } from '@/lib/sms';
import { fetchAll } from '@/lib/db/fetch-all';
import { paidTotals } from '@/lib/admin/metrics-loader';
import { isUuid, lagosToday, LOCATION_STATUSES, planToInput, type LocationInput } from '@/lib/admin/inputs';
import { isPeriod, periodRange, type ExpenseRow, type Period } from '@/lib/admin/metrics';
import { isControllerLive, JOB_KINDS, JOB_STATUSES } from '@/lib/network/jobs';
import { classifyGrantSearch, GRANT_STATUSES } from '@/lib/network/access';
import { normaliseNigerianMobile } from '@/lib/phone';
import { activationBlockers, ROUTER_PUBLIC_COLUMNS, type ConnectionMethod, type Lifecycle, type RouterInput } from '@/lib/network/routers';
import { buildDirectSetupLines, buildSetupScript } from '@/lib/network/setup-script';
import { HOTSPOT_COLUMNS, hotspotState, type HotspotRow } from '@/lib/network/hotspot';

export class NotFound extends Error {}

type Q = URLSearchParams;
const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));
const idOf = (q: Q): string => {
  const v = q.get('id');
  if (!isUuid(v)) throw new NotFound();
  return v;
};
const pageOf = (q: Q) => Math.max(1, Math.min(10_000, Number(q.get('page')) || 1));

// ---------------------------------------------------------------- settings

export async function settingsView() {
  const { data: ns, error } = await db.from('network_settings').select('portal_url, walled_garden_hosts').maybeSingle();
  return {
    network: ns ? { portalUrl: String(ns.portal_url), hosts: ((ns.walled_garden_hosts as string[] | null) ?? []) } : null,
    networkError: Boolean(error),
    admins: adminEmails(),
    smsConfigured: smsConfigured(),
  };
}

// ---------------------------------------------------------------- expenses

export async function expensesView() {
  const [expensesRes, locationsRes] = await Promise.all([
    db.from('expenses').select('id, category, amount_ngn, description, expense_date, recorded_by, locations(name)').order('expense_date', { ascending: false }).order('created_at', { ascending: false }),
    db.from('locations').select('id, name').order('name'),
  ]);
  if (expensesRes.error) console.error('[EXPENSES_FETCH_ERROR]', expensesRes.error);
  return {
    expenses: (expensesRes.data ?? []).map((e) => ({ ...e, location: one(e.locations as { name: string } | { name: string }[] | null)?.name ?? null, locations: undefined })),
    locations: (locationsRes.data ?? []) as { id: string; name: string }[],
    failed: Boolean(expensesRes.error),
    today: lagosToday(),
  };
}

// --------------------------------------------------------------- customers

export const CUSTOMERS_PER_PAGE = 20;

/** "0803..." and "+234 803..." both find 234803... */
function phoneNeedle(q: string): string {
  const d = q.replace(/\D/g, '');
  return d.startsWith('0') ? '234' + d.slice(1) : d;
}

export async function customersView(q: Q) {
  const page = pageOf(q);
  const search = (q.get('search') ?? '').trim().slice(0, 64);
  // One row per phone number, grouped and paged by the database; the newest purchase decides the current plan.
  const { data, error } = await db.rpc('admin_customer_page', {
    p_search: search ? phoneNeedle(search) || search : '',
    p_limit: CUSTOMERS_PER_PAGE,
    p_offset: (page - 1) * CUSTOMERS_PER_PAGE,
    p_now: new Date().toISOString(),
  });
  if (error) console.error('[CUSTOMERS_FETCH_ERROR]', error);
  const result = (data ?? {}) as { total?: number; rows?: unknown[] };
  return { rows: error ? [] : (result.rows ?? []), total: error ? 0 : Number(result.total ?? 0), failed: Boolean(error) };
}

// ---------------------------------------------------------------- payments

export const PAYMENTS_PER_PAGE = 30;
export const PAYMENT_FILTERS = ['', 'paid', 'pending', 'failed'];

export async function transactionsView(q: Q) {
  const page = pageOf(q);
  const status = PAYMENT_FILTERS.includes(q.get('status') ?? '') ? (q.get('status') ?? '') : '';
  // Characters limited so the term cannot alter the PostgREST filter.
  const raw = (q.get('search') ?? '').replace(/[^0-9A-Za-z_+ -]/g, '').trim().slice(0, 64);
  const digits = raw.replace(/[\s+-]/g, '');
  const phoneTerm = /^\d+$/.test(digits) ? (digits.startsWith('0') ? '234' + digits.slice(1) : digits) : '';
  const refTerm = raw.replace(/[^0-9A-Za-z_-]/g, '');

  let query = db
    .from('purchases')
    .select('id, reference, status, amount_kobo, amount_paid, gateway_fee_ngn, net_amount_ngn, created_at, paid_at, failure_reason, phone_number, plans(name), locations(name)', { count: 'exact' })
    .order('created_at', { ascending: false });
  if (status) query = query.eq('status', status);
  if (refTerm) query = query.or(phoneTerm ? `phone_number.ilike.%${phoneTerm}%,reference.ilike.%${refTerm}%` : `reference.ilike.%${refTerm}%`);
  const from = (page - 1) * PAYMENTS_PER_PAGE;
  const { data, count, error } = await query.range(from, from + PAYMENTS_PER_PAGE - 1);
  if (error) console.error('[TRANSACTIONS_FETCH_ERROR]', error);
  return { rows: data ?? [], total: count ?? 0, failed: Boolean(error) };
}

// ----------------------------------------------------------------- revenue

export async function revenueView(q: Q) {
  const period: Period = isPeriod(q.get('period')) ? (q.get('period') as Period) : '30d';
  const location = q.get('location');
  const locationId = isUuid(location) ? location : null;
  const range = periodRange(period, new Date());
  const [locationsRes, plansRes, data] = await Promise.all([
    db.from('locations').select('id, name').order('name'),
    db.from('plans').select('id, name'),
    Promise.all([
      paidTotals({ ...range, locationId, byLocation: true }),
      paidTotals({ ...range, locationId, byPlan: true }),
      fetchAll<ExpenseRow>((f, t) => db.from('expenses').select('amount_ngn, expense_date, location_id').order('expense_date').range(f, t)),
    ]).then(([byLocation, byPlan, expenses]) => ({ byLocation, byPlan, expenses }), (err: Error) => ({ error: err.message })),
  ]);
  return {
    locations: (locationsRes.data ?? []) as { id: string; name: string }[],
    plans: (plansRes.data ?? []) as { id: string; name: string }[],
    data,
  };
}

// ----------------------------------------------------------------- support

export const SUPPORT_FILTERS = ['active', 'resolved', 'all'];

export async function supportView(q: Q) {
  const filter = SUPPORT_FILTERS.includes(q.get('show') ?? '') ? (q.get('show') as string) : 'active';
  let query = db.from('support_tickets').select('id, ticket_number, category, subject, description, status, assigned_to, created_at, resolved_at, customers(phone_number), locations(name)').order('created_at', { ascending: false }).limit(200);
  if (filter === 'active') query = query.in('status', ['open', 'in_progress']);
  if (filter === 'resolved') query = query.eq('status', 'resolved');
  const { data: tickets, error } = await query;

  // The latest note per ticket, kept in the activity log when its status changed.
  const ids = (tickets ?? []).map((t) => t.id as string);
  const notes: Record<string, string> = {};
  if (ids.length) {
    const { data: logs } = await db.from('activity_logs').select('entity_id, metadata, created_at')
      .eq('event_type', 'support.status_changed').in('entity_id', ids).order('created_at', { ascending: false }).limit(1000);
    for (const l of logs ?? []) {
      const note = (l.metadata as { note?: unknown } | null)?.note;
      if (typeof note === 'string' && l.entity_id && !(l.entity_id in notes)) notes[l.entity_id as string] = note;
    }
  }
  return {
    filter,
    tickets: (tickets ?? []).map((t) => ({
      id: t.id as string, ticket_number: t.ticket_number as number, subject: t.subject as string, description: t.description as string,
      status: (t.status as string | null) ?? 'open', assigned_to: t.assigned_to as string | null, created_at: t.created_at as string,
      phone: one(t.customers as { phone_number: string } | { phone_number: string }[] | null)?.phone_number ?? null,
      location: one(t.locations as { name: string } | { name: string }[] | null)?.name ?? null,
    })),
    notes,
    failed: Boolean(error),
  };
}

// ------------------------------------------------------------------- plans

export async function plansView() {
  const [{ data: plans, error }, { data: locations }, paid] = await Promise.all([
    db.from('plans').select('*').order('price_kobo', { ascending: true }),
    db.from('locations').select('id, name'),
    paidTotals({ from: null, to: new Date(), byPlan: true }).catch(() => null),
  ]);
  if (error) console.error('[PLANS_FETCH_ERROR]', error);
  const paidByPlan = new Map<string, number>();
  for (const p of paid ?? []) if (p.plan_id) paidByPlan.set(p.plan_id, (paidByPlan.get(p.plan_id) ?? 0) + p.payments);
  return {
    plans: (plans ?? []).map((row) => ({ id: row.id as string, ...planToInput(row), paidCount: paidByPlan.get(row.id as string) ?? 0 })),
    locations: (locations ?? []) as { id: string; name: string }[],
    paidFailed: paid === null,
    failed: Boolean(error),
  };
}

export async function planFormView(q: Q) {
  const id = q.get('id');
  const locations = db.from('locations').select('id, name, is_active').order('name');
  if (!id) return { locations: (await locations).data ?? [] };
  if (!isUuid(id)) throw new NotFound();
  const [{ data: plan }, { data: locs }, { count: paidCount }] = await Promise.all([
    db.from('plans').select('*').eq('id', id).maybeSingle(),
    locations,
    db.from('purchases').select('id', { count: 'exact', head: true }).eq('plan_id', id).eq('status', 'paid'),
  ]);
  if (!plan) throw new NotFound();
  return { locations: locs ?? [], plan: { id, name: plan.name as string, input: planToInput(plan), paidCount: paidCount ?? 0 } };
}

// --------------------------------------------------------------- locations

export async function locationsView() {
  const now = new Date();
  const [{ data, error }, paid, { data: running }] = await Promise.all([
    db.from('locations').select('id, name, slug, is_active, institutions(name), routers(id, status, lifecycle_status, last_seen_at)').order('name', { ascending: true }),
    paidTotals({ from: null, to: now, byLocation: true }).catch(() => null),
    // Only the plans running now: bounded by how many customers are online.
    db.from('network_authorizations').select('router_id').in('status', ['active', 'pending_device']).is('revoked_at', null).gt('expires_at', now.toISOString()).limit(10_000),
  ]);
  const runningByRouter = new Map<string, number>();
  for (const g of running ?? []) runningByRouter.set(g.router_id as string, (runningByRouter.get(g.router_id as string) ?? 0) + 1);
  const revenueByLocation = new Map<string, number>();
  for (const b of paid ?? []) if (b.location_id) revenueByLocation.set(b.location_id, (revenueByLocation.get(b.location_id) ?? 0) + b.revenue);

  type Raw = { id: string; name: string; slug: string; is_active: boolean | null; institutions: { name: string } | { name: string }[] | null; routers: { id: string; status: string | null; lifecycle_status: string; last_seen_at: string | null }[] | null };
  return {
    base: appUrl(),
    failed: Boolean(error),
    revenueFailed: paid === null,
    locations: ((data ?? []) as unknown as Raw[]).map((l) => ({
      id: l.id, name: l.name, slug: l.slug, is_active: l.is_active,
      institution: one(l.institutions)?.name ?? null,
      routers: (l.routers ?? []).map(({ status, lifecycle_status, last_seen_at }) => ({ status, lifecycle_status, last_seen_at })),
      running: (l.routers ?? []).reduce((s, r) => s + (runningByRouter.get(r.id) ?? 0), 0),
      revenue: Math.round((revenueByLocation.get(l.id) ?? 0) * 100) / 100,
    })),
  };
}

export async function locationFormView(q: Q) {
  const id = q.get('id');
  const institutions = db.from('institutions').select('id, name').order('name');
  if (!id) return { institutions: (await institutions).data ?? [] };
  if (!isUuid(id)) throw new NotFound();
  const [{ data: loc }, { data: insts }] = await Promise.all([db.from('locations').select('*').eq('id', id).maybeSingle(), institutions]);
  if (!loc) throw new NotFound();
  const initial: LocationInput = {
    name: loc.name,
    slug: loc.slug,
    building: loc.building,
    address: loc.address,
    contactPhone: loc.contact_phone,
    locationType: loc.location_type ?? 'campus_facility',
    status: (LOCATION_STATUSES as readonly string[]).includes(loc.status) ? loc.status : 'active',
    isActive: loc.is_active !== false,
    institutionId: loc.institution_id,
  };
  return { institutions: insts ?? [], location: { id, name: loc.name as string, initial } };
}

export async function locationView(q: Q) {
  const id = idOf(q);
  const now = new Date();
  const [locationRes, routersRes, purchasesRes, plansRes, paid] = await Promise.all([
    db.from('locations').select('id, name, slug, building, address, is_active, institutions(name)').eq('id', id).maybeSingle(),
    db.from('routers').select('id, name, identifier, lifecycle_status, status, management_ip, routeros_version, board_name, uptime_seconds, cpu_usage_pct, memory_usage_pct, last_seen_at').eq('location_id', id).neq('lifecycle_status', 'retired').order('name'),
    db.from('purchases').select('id, status, amount_paid, amount_kobo, created_at, phone_number, plans(name)').eq('location_id', id).order('created_at', { ascending: false }).limit(10),
    db.from('plans').select('id, name, price_kobo, allowed_location_ids').eq('is_active', true).order('price_kobo'),
    paidTotals({ from: null, to: now, locationId: id }).catch(() => null),
  ]);
  const location = locationRes.data;
  if (!location) throw new NotFound();
  const routers = routersRes.data ?? [];
  const routerIds = routers.map((r) => r.id as string);
  const { count: running } = routerIds.length
    ? await db.from('network_authorizations').select('id', { count: 'exact', head: true }).in('router_id', routerIds).in('status', ['active', 'pending_device']).gt('expires_at', now.toISOString())
    : { count: 0 };
  return {
    location: {
      id, name: location.name as string, slug: location.slug as string, is_active: location.is_active as boolean | null,
      description: [one(location.institutions as { name: string } | { name: string }[] | null)?.name, location.building, location.address].filter(Boolean).join(', '),
    },
    infoLink: `${appUrl()}/connect?loc=${location.slug}`,
    routers,
    purchases: (purchasesRes.data ?? []).map((p) => ({ ...p, plan: one(p.plans as { name: string } | { name: string }[] | null)?.name ?? null, plans: undefined })),
    plansHere: (plansRes.data ?? []).filter((p) => !(p.allowed_location_ids as string[] | null)?.length || (p.allowed_location_ids as string[]).includes(id)).map(({ id: planId, name, price_kobo }) => ({ id: planId, name, price_kobo })),
    running: running ?? 0,
    revenue: paid ? Math.round(paid.reduce((s, p) => s + p.revenue, 0) * 100) / 100 : null,
    paidPurchases: paid ? paid.reduce((s, p) => s + p.payments, 0) : null,
  };
}

// ---------------------------------------------------------------- routers

export async function networkView() {
  const [routersRes, instancesRes, settingsRes, jobsRes] = await Promise.all([
    db.from('routers')
      .select('id, name, identifier, lifecycle_status, status, connection_method, tunnel_ip, management_ip, last_seen_at, last_test_at, last_test_result, locations(name)')
      .order('created_at', { ascending: false }),
    db.from('controller_instances').select('id, version, started_at, last_heartbeat_at, info').order('last_heartbeat_at', { ascending: false }).limit(3),
    db.from('network_settings').select('controller_endpoint, credential_key_id, tunnel_cidr').maybeSingle(),
    db.from('controller_jobs').select('status').in('status', ['queued', 'running', 'failed', 'dead']),
  ]);
  const instances = instancesRes.data ?? [];
  const live = instances.find((i) => isControllerLive(i.last_heartbeat_at as string)) ?? null;
  const jobCounts = (jobsRes.data ?? []).reduce<Record<string, number>>((acc, j) => ((acc[j.status as string] = (acc[j.status as string] ?? 0) + 1), acc), {});
  return {
    routers: (routersRes.data ?? []).map((r) => ({ ...r, location: one(r.locations as { name: string } | { name: string }[] | null)?.name ?? null, locations: undefined })),
    controller: live
      ? { state: 'running' as const, id: live.id as string, version: (live.version as string | null) ?? null, heartbeat: live.last_heartbeat_at as string, info: (live.info ?? null) as { production?: boolean; environment?: string } | null }
      : instances.length ? { state: 'stopped' as const, heartbeat: instances[0].last_heartbeat_at as string } : { state: 'never' as const },
    settings: settingsRes.data ?? null,
    jobCounts,
    failed: Boolean(routersRes.error || instancesRes.error || settingsRes.error || jobsRes.error),
  };
}

export const JOBS_PER_PAGE = 50;

function jobFilters(q: Q) {
  const status = (JOB_STATUSES as readonly string[]).includes(q.get('status') ?? '') ? (q.get('status') as string) : '';
  const kind = (JOB_KINDS as readonly string[]).includes(q.get('kind') ?? '') ? (q.get('kind') as string) : '';
  const router = q.get('router');
  return { status, kind, routerId: isUuid(router) ? router : '' };
}

export async function jobsView(q: Q) {
  const { status, kind, routerId } = jobFilters(q);
  const page = pageOf(q);
  let query = db
    .from('controller_jobs')
    .select('id, kind, status, attempts, max_attempts, run_after, locked_by, locked_at, created_at, updated_at, finished_at, last_error, requested_by, routers(id, name, identifier)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * JOBS_PER_PAGE, page * JOBS_PER_PAGE - 1);
  if (status) query = query.eq('status', status);
  if (kind) query = query.eq('kind', kind);
  if (routerId) query = query.eq('router_id', routerId);
  const [{ data: jobs, count, error }, instancesRes] = await Promise.all([
    query,
    db.from('controller_instances').select('id, last_heartbeat_at').order('last_heartbeat_at', { ascending: false }).limit(1),
  ]);
  const controller = instancesRes.data?.[0] ?? null;
  return {
    jobs: (jobs ?? []).map((j) => ({ ...j, router: one(j.routers as { id: string; name: string | null; identifier: string } | { id: string; name: string | null; identifier: string }[] | null), routers: undefined })),
    total: count ?? 0,
    failed: Boolean(error),
    controller: controller ? { id: controller.id as string, heartbeat: controller.last_heartbeat_at as string, live: isControllerLive(controller.last_heartbeat_at as string) } : null,
  };
}

/** How many jobs in each status (the filter counts), apart from the list so each request stays small. */
export async function jobCountsView(q: Q) {
  const { routerId } = jobFilters(q);
  const countFor = (s: string | null) => {
    let c = db.from('controller_jobs').select('id', { count: 'exact', head: true });
    if (s) c = c.eq('status', s);
    if (routerId) c = c.eq('router_id', routerId);
    return c;
  };
  const [all, ...each] = await Promise.all([countFor(null), ...JOB_STATUSES.map((s) => countFor(s))]);
  return { all: all.count ?? 0, byStatus: Object.fromEntries(JOB_STATUSES.map((s, i) => [s, each[i].count ?? 0])) as Record<string, number> };
}

export const GRANTS_PER_PAGE = 50;

export async function accessView(q: Q) {
  const status = (GRANT_STATUSES as readonly string[]).includes(q.get('status') ?? '') ? (q.get('status') as string) : '';
  const router = q.get('router');
  const routerId = isUuid(router) ? router : '';
  const page = pageOf(q);
  const search = classifyGrantSearch(q.get('q') ?? undefined, normaliseNigerianMobile);
  if (search?.kind === 'invalid') return { grants: [], total: 0, revokeStatus: {}, failed: false, invalidSearch: true };
  const byPurchase = search?.kind === 'reference' || search?.kind === 'phone';

  let query = db
    .from('network_authorizations')
    .select(`id, status, voucher_code, expires_at, created_at, provisioned_at, revoked_at, revoke_reason, last_error, routers(id, name, identifier), purchases${byPurchase ? '!inner' : ''}(id, reference, phone_number)`, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * GRANTS_PER_PAGE, page * GRANTS_PER_PAGE - 1);
  if (status) query = query.eq('status', status);
  if (routerId) query = query.eq('router_id', routerId);
  if (search?.kind === 'voucher') query = query.eq('voucher_code', search.value);
  if (search?.kind === 'reference') query = query.eq('purchases.reference', search.value);
  if (search?.kind === 'phone') query = query.eq('purchases.phone_number', search.value);
  const { data, count, error } = await query;

  // Revokes already queued for these grants, so the page says so instead of offering the button again.
  const ids = (data ?? []).map((g) => g.id as string);
  const { data: revokeJobs } = ids.length
    ? await db.from('controller_jobs').select('authorization_id, status').eq('kind', 'access.revoke').in('authorization_id', ids)
    : { data: [] as { authorization_id: string; status: string }[] };
  return {
    // Only the last four digits of the paying phone: enough to confirm with the caller.
    grants: (data ?? []).map((g) => {
      const p = one(g.purchases as { id: string; reference: string; phone_number: string | null } | { id: string; reference: string; phone_number: string | null }[] | null);
      return {
        id: g.id as string, status: g.status as string, voucher_code: g.voucher_code as string | null, expires_at: g.expires_at as string,
        provisioned_at: g.provisioned_at as string | null, revoked_at: g.revoked_at as string | null, revoke_reason: g.revoke_reason as string | null, last_error: g.last_error as string | null,
        router: one(g.routers as { id: string; name: string | null; identifier: string } | { id: string; name: string | null; identifier: string }[] | null),
        reference: p?.reference ?? null,
        phoneLast4: p?.phone_number ? p.phone_number.slice(-4) : null,
      };
    }),
    total: count ?? 0,
    revokeStatus: Object.fromEntries((revokeJobs ?? []).map((j) => [j.authorization_id as string, j.status as string])) as Record<string, string>,
    failed: Boolean(error),
    invalidSearch: false,
  };
}

export async function routerView(q: Q) {
  const id = idOf(q);
  const [{ data: r }, { data: settings }, { data: jobs }, { data: hotspotRaw }] = await Promise.all([
    db.from('routers').select(`${ROUTER_PUBLIC_COLUMNS}, locations(name)`).eq('id', id).maybeSingle(),
    db.from('network_settings').select('controller_endpoint, controller_wg_public_key, controller_tunnel_ip, tunnel_cidr, portal_url, walled_garden_hosts').maybeSingle(),
    db.from('controller_jobs')
      .select('id, kind, status, attempts, max_attempts, created_at, run_after, finished_at, last_error, requested_by')
      .eq('router_id', id).order('created_at', { ascending: false }).limit(10),
    db.from('router_hotspot_settings').select(HOTSPOT_COLUMNS).eq('router_id', id).maybeSingle(),
  ]);
  if (!r) throw new NotFound();
  const hotspot = (hotspotRaw as HotspotRow | null) ?? null;
  const lifecycle = r.lifecycle_status as Lifecycle;
  const hasCredential = Boolean(r.credential_key_id);
  const blockers = activationBlockers({
    lifecycle_status: lifecycle,
    connection_method: r.connection_method as ConnectionMethod,
    has_credential: hasCredential,
    wg_public_key: r.wg_public_key,
    tunnel_ip: r.tunnel_ip,
    management_ip: r.management_ip,
    last_test_at: r.last_test_at,
    last_test_result: r.last_test_result as { ok?: unknown } | null,
    hotspot: hotspot ? { version: hotspot.version, applied_version: hotspot.applied_version } : null,
  });
  const setup = settings && r.connection_method === 'wireguard'
    ? buildSetupScript({
        router: { id: r.id, name: r.name ?? r.identifier, identifier: r.identifier, connection_method: r.connection_method, tunnel_ip: r.tunnel_ip, wg_public_key: r.wg_public_key },
        settings: { controller_endpoint: settings.controller_endpoint, controller_wg_public_key: settings.controller_wg_public_key, controller_tunnel_ip: String(settings.controller_tunnel_ip), tunnel_cidr: String(settings.tunnel_cidr) },
      })
    : null;
  return {
    router: {
      id: r.id as string, name: (r.name as string | null) ?? (r.identifier as string), identifier: r.identifier as string, model: r.model as string | null,
      location: one(r.locations as { name: string } | { name: string }[] | null)?.name ?? null,
      lifecycle, status: r.status as string | null, last_seen_at: r.last_seen_at as string | null,
      connection_method: r.connection_method as ConnectionMethod, tunnel_ip: r.tunnel_ip as string | null, management_ip: r.management_ip as string | null,
      wg_public_key: r.wg_public_key as string | null, routeros_version: r.routeros_version as string | null, board_name: r.board_name as string | null,
      last_test_at: r.last_test_at as string | null, last_test_result: r.last_test_result as { ok?: boolean; error?: string } | null, last_error: r.last_error as string | null,
      api_user: hasCredential ? (r.api_user as string | null) : null, credential_key_id: r.credential_key_id as string | null,
    },
    hasCredential,
    blockers,
    jobs: jobs ?? [],
    hotspot: hotspot ? { ...hotspot, gateway_cidr: String(hotspot.gateway_cidr) } : null,
    hotspotState: hotspotState(hotspot),
    portalUrl: (settings?.portal_url as string | undefined) ?? 'the payment page',
    sharedWalledGarden: ((settings?.walled_garden_hosts as string[] | null) ?? []),
    setup,
    directSetupLines: r.connection_method === 'direct_https' ? buildDirectSetupLines({ id: r.id, identifier: r.identifier }) : null,
  };
}

export async function routerFormView(q: Q) {
  const id = q.get('id');
  if (!id) {
    const { data: locations } = await db.from('locations').select('id, name').eq('is_active', true).order('name');
    return { locations: locations ?? [] };
  }
  if (!isUuid(id)) throw new NotFound();
  const [{ data: r }, { data: locations }] = await Promise.all([
    db.from('routers')
      .select('id, name, identifier, location_id, connection_method, lifecycle_status, wg_public_key, management_ip, hotspot_server_name, model')
      .eq('id', id).maybeSingle(),
    db.from('locations').select('id, name').order('name'),
  ]);
  if (!r) throw new NotFound();
  const initial: RouterInput = {
    name: r.name ?? r.identifier,
    locationId: r.location_id,
    identifier: r.identifier,
    connectionMethod: r.connection_method as ConnectionMethod,
    wgPublicKey: r.wg_public_key,
    managementHost: r.management_ip,
    hotspotServerName: r.hotspot_server_name ?? 'hs-main',
    model: r.model,
  };
  return { locations: locations ?? [], router: { id, lifecycle: r.lifecycle_status as Lifecycle, editable: r.lifecycle_status === 'registered' || r.lifecycle_status === 'suspended', initial } };
}
