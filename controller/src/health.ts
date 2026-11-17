// Router health polling and reconciliation.
//
// Health: every active router is asked for its resource figures; three missed
// polls in a row mark it offline (and log it once).
//
// Reconciliation (at start-up and every 15 minutes): compares the hotspot
// users this controller created on a router (comment "connectly:<grant id>")
// with the database. Users whose grant has ended are removed straight away;
// live grants missing from the router get a provision job (at most once an
// hour per grant). This repairs any drift, including work missed while the
// controller was down.

import type { Db, RouterRow } from './db.ts';
import { clientFor, type JobContext } from './jobs.ts';
import { RouterError } from './routeros.ts';
import { KeyError } from './keys.ts';

export const OFFLINE_AFTER_MISSES = 3;

export class HealthMonitor {
  private readonly misses = new Map<string, number>();
  private readonly ctx: JobContext;
  constructor(ctx: JobContext) {
    this.ctx = ctx;
  }

  async pollRouter(router: RouterRow): Promise<'online' | 'missed' | 'offline'> {
    try {
      const res = await clientFor(router, this.ctx).resource();
      const wasOffline = (this.misses.get(router.id) ?? 0) >= OFFLINE_AFTER_MISSES || router.status === 'offline';
      this.misses.set(router.id, 0);
      await this.ctx.db.recordHealth(router.id, { online: true, version: res.version, uptimeSeconds: res.uptimeSeconds, cpu: res.cpuLoad, memory: res.memoryUsedPct });
      if (wasOffline) await this.ctx.db.logActivity('router.online', 'info', router.id, router.location_id, `Router ${router.identifier} is reachable again`);
      return 'online';
    } catch (e) {
      if (!(e instanceof RouterError || e instanceof KeyError)) throw e;
      const n = (this.misses.get(router.id) ?? 0) + 1;
      this.misses.set(router.id, n);
      if (n === OFFLINE_AFTER_MISSES) {
        await this.ctx.db.recordHealth(router.id, { online: false, error: e.message });
        await this.ctx.db.logActivity('router.offline', 'warn', router.id, router.location_id, `Router ${router.identifier} missed ${n} health checks`, { error: e.message });
        return 'offline';
      }
      return n > OFFLINE_AFTER_MISSES ? 'offline' : 'missed';
    }
  }

  async pollAll(): Promise<Record<string, string>> {
    const out: Record<string, string> = {};
    for (const r of await this.ctx.db.listRouters(['active'])) out[r.identifier] = await this.pollRouter(r);
    return out;
  }
}

export async function reconcileRouter(router: RouterRow, ctx: JobContext): Promise<{ removed: string[]; requeued: string[] }> {
  const db: Db = ctx.db;
  const client = clientFor(router, ctx);
  const live = await db.liveGrantsForRouter(router.id);
  const liveById = new Map(live.map((g) => [g.id, g]));
  const onRouter = (await client.listHotspotUsers()).filter((u) => u.comment?.startsWith('connectly:'));

  const removed: string[] = [];
  for (const u of onRouter) {
    const grantId = u.comment!.slice('connectly:'.length);
    if (liveById.has(grantId)) continue;
    for (const s of await client.listActive(u.name)) await client.removeActive(s.id);
    await client.removeHotspotUser(u.id);
    removed.push(u.name);
  }

  const present = new Set(onRouter.map((u) => u.comment));
  const requeued: string[] = [];
  const hour = Math.floor((ctx.now?.() ?? new Date()).getTime() / 3_600_000);
  for (const g of live) {
    if (present.has(`connectly:${g.id}`)) continue;
    const r = await db.enqueueJob('access.provision', router.id, g.id, { reason: 'reconcile' }, `reconcile:${g.id}:${hour}`, 'reconcile');
    if (r.created) requeued.push(g.hotspot_username);
  }

  if (removed.length || requeued.length) {
    await db.logActivity('router.reconciled', 'info', router.id, router.location_id,
      `Reconciled ${router.identifier}: removed ${removed.length} ended user(s), re-queued ${requeued.length} missing grant(s)`, { removed, requeued });
  }
  return { removed, requeued };
}
