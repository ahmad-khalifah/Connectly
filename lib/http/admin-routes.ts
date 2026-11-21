// The admin's save and edit actions (app/api/admin/**/route.ts), answered by
// the Cloudflare Worker's front door without Next.js. The route files are
// plain Fetch handlers that check the caller themselves (requireAdminApi /
// adminApiGuard on the Request), so they run the same here and under
// Next.js (local dev, Vercel).

import * as expenses from '@/app/api/admin/expenses/route';
import * as expense from '@/app/api/admin/expenses/[id]/route';
import * as locations from '@/app/api/admin/locations/route';
import * as location from '@/app/api/admin/locations/[id]/route';
import * as accessResend from '@/app/api/admin/network/access/[id]/resend/route';
import * as accessRevoke from '@/app/api/admin/network/access/[id]/revoke/route';
import * as jobAction from '@/app/api/admin/network/jobs/[id]/[action]/route';
import * as routers from '@/app/api/admin/network/routers/route';
import * as router from '@/app/api/admin/network/routers/[id]/route';
import * as routerAction from '@/app/api/admin/network/routers/[id]/[action]/route';
import * as routerHotspot from '@/app/api/admin/network/routers/[id]/hotspot/route';
import * as networkSettings from '@/app/api/admin/network/settings/route';
import * as reconcile from '@/app/api/admin/payments/reconcile/route';
import * as plans from '@/app/api/admin/plans/route';
import * as plan from '@/app/api/admin/plans/[id]/route';
import * as smsTest from '@/app/api/admin/sms/test/route';
import * as support from '@/app/api/admin/support/[id]/route';

type Params = Record<string, string>;
type RouteFn = (request: Request, ctx: { params: Promise<Params> }) => Promise<Response>;
type Module = Partial<Record<'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', RouteFn>>;

const SEG = '([^/]+)';
// [path pattern, parameter names, route module]. Order does not matter: patterns are exact.
const ROUTES: [RegExp, string[], Module][] = [
  [/^\/api\/admin\/expenses$/, [], expenses as Module],
  [new RegExp(`^/api/admin/expenses/${SEG}$`), ['id'], expense as Module],
  [/^\/api\/admin\/locations$/, [], locations as Module],
  [new RegExp(`^/api/admin/locations/${SEG}$`), ['id'], location as Module],
  [new RegExp(`^/api/admin/network/access/${SEG}/resend$`), ['id'], accessResend as Module],
  [new RegExp(`^/api/admin/network/access/${SEG}/revoke$`), ['id'], accessRevoke as Module],
  [new RegExp(`^/api/admin/network/jobs/${SEG}/${SEG}$`), ['id', 'action'], jobAction as Module],
  [/^\/api\/admin\/network\/routers$/, [], routers as Module],
  [new RegExp(`^/api/admin/network/routers/${SEG}/hotspot$`), ['id'], routerHotspot as Module],
  [new RegExp(`^/api/admin/network/routers/${SEG}/${SEG}$`), ['id', 'action'], routerAction as Module],
  [new RegExp(`^/api/admin/network/routers/${SEG}$`), ['id'], router as Module],
  [/^\/api\/admin\/network\/settings$/, [], networkSettings as Module],
  [/^\/api\/admin\/payments\/reconcile$/, [], reconcile as Module],
  [/^\/api\/admin\/plans$/, [], plans as Module],
  [new RegExp(`^/api/admin/plans/${SEG}$`), ['id'], plan as Module],
  [/^\/api\/admin\/sms\/test$/, [], smsTest as Module],
  [new RegExp(`^/api/admin/support/${SEG}$`), ['id'], support as Module],
];

const METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * The handler for an admin action, or null when no route matches (the
 * request then goes to Next.js, which answers 404/405 as before).
 */
export function adminActionRoute(method: string, pathname: string): ((request: Request) => Promise<Response>) | null {
  const m = method.toUpperCase();
  if (!METHODS.has(m)) return null;
  const path = pathname.replace(/\/+$/, '');
  for (const [re, names, mod] of ROUTES) {
    const match = path.match(re);
    if (!match) continue;
    const fn = mod[m as keyof Module];
    if (!fn) return async () => Response.json({ message: 'Method not allowed' }, { status: 405 });
    let params: Params;
    try {
      params = Object.fromEntries(names.map((n, i) => [n, decodeURIComponent(match[i + 1])]));
    } catch {
      return async () => Response.json({ message: 'Not found' }, { status: 404 });
    }
    // Same-site check for writes, as Next.js does for Server Functions.
    return async (request: Request) => {
      const origin = request.headers.get('origin');
      if (origin && origin !== new URL(request.url).origin) return Response.json({ message: 'Request refused.' }, { status: 403 });
      return fn(request, { params: Promise.resolve(params) });
    };
  }
  return null;
}
