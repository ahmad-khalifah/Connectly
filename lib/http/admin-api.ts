// Data for the admin pages, as JSON, written against the plain Fetch API.
//
// The admin pages are static files drawn in the browser; each asks for its
// data here. On Cloudflare the Worker's front door (worker.ts) answers these
// paths without starting Next.js (Workers Free: 10 ms of CPU per request,
// about 1 ms per database call), so a page with many figures asks for them
// in several small parts at once. app/api/admin/view and app/api/admin/me
// serve the same handlers for local dev and Vercel.
//
// Every request is checked: signed in to Supabase Auth AND on ADMIN_EMAILS.

import { db } from '@/lib/db/client';
import { appEnv } from '@/lib/env';
import { checkAdmin, type RequestAdmin } from '@/lib/auth/request-admin';
import { refusal } from '@/lib/auth/admin';
import { isUuid } from '@/lib/admin/inputs';
import { isPeriod, type Period } from '@/lib/admin/metrics';
import { loadNetworkPart, loadPaidPart, loadPeoplePart } from '@/lib/admin/metrics-loader';
import { loadAlerts } from '@/lib/admin/alerts';
import { reconcileRecentPending } from '@/lib/payments/ledger';
import * as views from '@/lib/admin/views';
import { NotFound } from '@/lib/admin/views';

type Handler = (request: Request) => Promise<Response>;

const HEADERS = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: HEADERS });

type View = (q: URLSearchParams, admin: RequestAdmin) => Promise<unknown>;

const period = (q: URLSearchParams): Period => {
  const p = q.get('period');
  return isPeriod(p) ? p : '30d';
};
const location = (q: URLSearchParams): string | null => {
  const l = q.get('location');
  return isUuid(l) ? l : null;
};
const id = (q: URLSearchParams): string => {
  const v = q.get('id');
  if (!isUuid(v)) throw new NotFound();
  return v;
};

/** One entry per admin data request. Each should make 8 database calls or fewer. */
export const ADMIN_VIEWS: Record<string, View> = {
  // Dashboard, in parts (see lib/admin/metrics-loader.ts).
  'dashboard-paid': (q) => loadPaidPart(period(q), location(q), new Date()),
  'dashboard-people': (q) => loadPeoplePart(period(q), location(q), new Date()),
  'dashboard-network': () => loadNetworkPart(new Date()),
  'dashboard-alerts': () => loadAlerts(),
  'dashboard-side': async () => {
    const [locations, routers, activity] = await Promise.all([
      db.from('locations').select('id, name').order('name'),
      db.from('routers').select('id, name, identifier, status, lifecycle_status, last_seen_at, location_id').neq('lifecycle_status', 'retired').order('name'),
      db.from('activity_logs').select('id, event_type, severity, message, created_at').order('created_at', { ascending: false }).limit(10),
    ]);
    return { locations: locations.data ?? [], routers: routers.data ?? [], activity: activity.data ?? [] };
  },

  alerts: () => loadAlerts(),
  settings: () => views.settingsView(),
  expenses: () => views.expensesView(),
  customers: (q) => views.customersView(q),
  transactions: (q) => views.transactionsView(q),
  revenue: (q) => views.revenueView(q),
  support: (q) => views.supportView(q),
  plans: () => views.plansView(),
  'plan-form': (q) => views.planFormView(q),
  locations: () => views.locationsView(),
  'location-form': (q) => views.locationFormView(q),
  location: (q) => views.locationView(q),
  network: () => views.networkView(),
  jobs: (q) => views.jobsView(q),
  'job-counts': (q) => views.jobCountsView(q),
  access: (q) => views.accessView(q),
  router: (q) => views.routerView(q),
  'router-form': (q) => views.routerFormView(q),

  customer: async (q) => {
    const customerId = id(q);
    const { data: customer } = await db.from('customers').select('id, phone_number, created_at').eq('id', customerId).maybeSingle();
    if (!customer) throw new NotFound();
    // Purchases are matched by customer link and by phone, so purchases made
    // before the customer record existed still appear.
    const [{ data: purchases }, { data: devices }] = await Promise.all([
      db.from('purchases')
        .select('id, reference, status, amount_paid, amount_kobo, net_amount_ngn, created_at, paid_at, expires_at, failure_reason, plans(name), locations(name), network_authorizations(status, revoked_at, voucher_code)')
        .or(/^\d{6,20}$/.test(customer.phone_number) ? `customer_id.eq.${customerId},phone_number.eq.${customer.phone_number}` : `customer_id.eq.${customerId}`)
        .order('created_at', { ascending: false })
        .limit(100),
      db.from('devices').select('id, mac_address, last_seen_at').eq('customer_id', customerId),
    ]);
    const ids = (purchases ?? []).map((p) => p.id as string);
    const { data: sms } = ids.length
      ? await db.from('notifications').select('id, purchase_id, status, created_at, last_error').in('purchase_id', ids)
      : { data: [] };
    return { customer, purchases: purchases ?? [], devices: devices ?? [], sms: sms ?? [] };
  },
};

/**
 * GET /api/admin/me: who is signed in, and which environment this console
 * uses. 401 when signed out; 403 for an account not on the admin list.
 */
export async function handleAdminMe(request: Request): Promise<Response> {
  const check = await checkAdmin(request);
  if (!check.admin) return refusal(check);
  return json({ email: check.admin.email, environment: appEnv() });
}

/** GET /api/admin/view/<name>?...: one admin page's data (or one part of it). */
export async function handleAdminView(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const name = url.pathname.replace(/^\/api\/admin\/view\//, '').replace(/\/+$/, '');
  const view = Object.hasOwn(ADMIN_VIEWS, name) ? ADMIN_VIEWS[name] : null;
  if (!view) return json({ message: 'Not found' }, 404);
  const check = await checkAdmin(request);
  if (!check.admin) return refusal(check);
  try {
    return json(await view(url.searchParams, check.admin));
  } catch (error) {
    if (error instanceof NotFound) return json({ message: 'Not found' }, 404);
    console.error('[ADMIN_VIEW]', name, error);
    return json({ message: error instanceof Error ? error.message : 'Could not load' }, 500);
  }
}

/**
 * POST /api/admin/sweep: re-checks with Korapay up to two recent pending
 * payments whose notification never arrived. The dashboard calls it in the
 * background; two at a time keeps it within the CPU limit.
 */
export async function handleAdminSweep(request: Request): Promise<Response> {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return json({ message: 'Request refused.' }, 403);
  const check = await checkAdmin(request);
  if (!check.admin) return refusal(check);
  return json(await reconcileRecentPending({ limit: 2 }));
}

// Detail pages moved from /admin/<section>/<id> to /admin/<item>?id=<id>, so
// they can be static files. Old addresses (links, bookmarks) still work.
const MOVED: [RegExp, string][] = [
  [/^\/admin\/customers\/([0-9a-f-]{36})$/i, '/admin/customer'],
  [/^\/admin\/plans\/([0-9a-f-]{36})$/i, '/admin/plan'],
  [/^\/admin\/locations\/([0-9a-f-]{36})$/i, '/admin/location'],
  [/^\/admin\/locations\/([0-9a-f-]{36})\/edit$/i, '/admin/location/edit'],
  [/^\/admin\/network\/routers\/([0-9a-f-]{36})$/i, '/admin/network/router'],
  [/^\/admin\/network\/routers\/([0-9a-f-]{36})\/edit$/i, '/admin/network/router/edit'],
];

export function movedAdminPage(pathname: string): string | null {
  for (const [re, to] of MOVED) {
    const m = pathname.replace(/\/+$/, '').match(re);
    if (m && isUuid(m[1])) return `${to}?id=${m[1]}`;
  }
  return null;
}

async function handleMovedPage(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const to = movedAdminPage(url.pathname) ?? '/admin';
  return new Response(null, { status: 308, headers: { Location: new URL(to, url).toString(), 'Cache-Control': 'no-store' } });
}

/** The admin routes the Worker answers itself. Others still go to Next.js. */
export function adminApiRoute(method: string, pathname: string): Handler | null {
  const m = method.toUpperCase();
  const path = pathname.replace(/\/+$/, '');
  if (m === 'GET' && path === '/api/admin/me') return handleAdminMe;
  if (m === 'GET' && path.startsWith('/api/admin/view/')) return handleAdminView;
  if (m === 'POST' && path === '/api/admin/sweep') return handleAdminSweep;
  if (m === 'GET' && movedAdminPage(path)) return handleMovedPage;
  return null;
}
