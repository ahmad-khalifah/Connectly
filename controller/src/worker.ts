// The controller's main loop. Database outages are expected and survivable:
// each loop backs off (1 s doubling to 30 s) and carries on; jobs stay in the
// database, so nothing is lost while the controller or its connection is down.

import type { Db } from './db.ts';
import { runJob, type JobContext } from './jobs.ts';
import { HealthMonitor, reconcileRouter } from './health.ts';
import type { Logger } from './log.ts';
import type { Environment } from './config.ts';
import { renderPeers, writePeersFile } from './wg-peers.ts';

export type WorkerOptions = {
  workerId: string;
  version: string;
  environment: Environment;
  concurrency: number;
  pollIntervalMs: number;
  heartbeatIntervalMs: number;
  sweepIntervalMs: number;
  healthIntervalMs: number;
  reconcileIntervalMs: number;
  wgPeersFile?: string | null;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class Controller {
  private running = false;
  private readonly loops: Promise<void>[] = [];
  private readonly timers: NodeJS.Timeout[] = [];
  private inFlight = 0;
  private readonly startedAt = new Date();
  private readonly db: Db;
  private readonly ctx: JobContext;
  private readonly log: Logger;
  private readonly o: WorkerOptions;
  private readonly health: HealthMonitor;
  stats = { jobsDone: 0, jobsFailed: 0, dbErrors: 0 };

  constructor(ctx: JobContext, options: WorkerOptions) {
    this.ctx = ctx;
    this.db = ctx.db;
    this.log = ctx.log;
    this.o = options;
    this.health = new HealthMonitor(ctx);
  }

  /** Runs one job if one is ready. Returns false when the queue had nothing. */
  async runOnce(): Promise<boolean> {
    const job = await this.db.claimNextJob(this.o.workerId);
    if (!job) return false;
    this.inFlight++;
    try {
      const outcome = await runJob(job, this.ctx);
      const status = await this.db.completeJob(outcome.ok
        ? { jobId: job.id, worker: this.o.workerId, ok: true, result: outcome.result, routerResponse: outcome.routerResponse }
        : { jobId: job.id, worker: this.o.workerId, ok: false, result: outcome.result, error: outcome.error, retryInSeconds: outcome.retryInSeconds });
      if (outcome.ok) this.stats.jobsDone++;
      else this.stats.jobsFailed++;
      this.log.info('job.finished', { job_id: job.id, kind: job.kind, router_id: job.router_id, attempt: job.attempts, status, ...(outcome.ok ? {} : { error: outcome.error }) });
    } finally {
      this.inFlight--;
    }
    return true;
  }

  private async jobLoop(slot: number): Promise<void> {
    let backoff = 1000;
    while (this.running) {
      try {
        const worked = await this.runOnce();
        backoff = 1000;
        if (!worked) await sleep(this.o.pollIntervalMs);
      } catch (e) {
        // Database unreachable or an unexpected error. A claimed job that was not
        // completed is handed out again after 5 minutes by claim_next_job.
        this.stats.dbErrors++;
        this.log.error('loop.error', { slot, error: e, retry_in_ms: backoff });
        await sleep(backoff);
        backoff = Math.min(30_000, backoff * 2);
      }
    }
  }

  async heartbeat(): Promise<void> {
    await this.db.heartbeat(this.o.workerId, this.o.version, {
      environment: this.o.environment,
      production: this.o.environment === 'production',
      started_at: this.startedAt.toISOString(),
      in_flight: this.inFlight,
      ...this.stats,
    });
  }

  /** Rewrites the WireGuard peer list when routers were added, changed or retired. */
  async syncPeers(): Promise<boolean> {
    if (!this.o.wgPeersFile) return false;
    const routers = await this.db.listRouters(['registered', 'active', 'suspended']);
    const changed = writePeersFile(this.o.wgPeersFile, renderPeers(routers));
    if (changed) this.log.info('wireguard.peers_written', { peers: routers.filter((r) => r.wg_public_key && r.tunnel_ip).length });
    return changed;
  }

  async sweep(): Promise<number> {
    const n = await this.db.enqueueExpiredRevocations();
    if (n > 0) this.log.info('expiry.queued', { revoke_jobs: n });
    return n;
  }

  async reconcileAll(): Promise<void> {
    for (const r of await this.db.listRouters(['active'])) {
      try {
        const out = await reconcileRouter(r, this.ctx);
        if (out.removed.length || out.requeued.length) this.log.info('reconcile.changed', { router: r.identifier, ...out });
      } catch (e) {
        this.log.warn('reconcile.failed', { router: r.identifier, error: e });
      }
    }
  }

  private every(ms: number, name: string, fn: () => Promise<unknown>) {
    const tick = () => fn().catch((e) => this.log.error(`${name}.error`, { error: e }));
    this.timers.push(setInterval(tick, ms));
    return tick;
  }

  /**
   * Start order after any downtime: heartbeat (dashboard shows Running), expiry
   * sweep (revokes for time that ran out while down), then the backlog of jobs,
   * then reconciliation of every active router.
   */
  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    await this.every(this.o.heartbeatIntervalMs, 'heartbeat', () => this.heartbeat())();
    await this.every(15_000, 'wireguard', () => this.syncPeers())();
    await this.every(this.o.sweepIntervalMs, 'sweep', () => this.sweep())();
    for (let i = 0; i < this.o.concurrency; i++) this.loops.push(this.jobLoop(i));
    this.every(this.o.healthIntervalMs, 'health', () => this.health.pollAll());
    void this.every(this.o.reconcileIntervalMs, 'reconcile', () => this.reconcileAll())();
    this.log.info('controller.started', { worker: this.o.workerId, environment: this.o.environment, concurrency: this.o.concurrency });
  }

  /** Stops taking jobs and waits for the ones in progress to finish. */
  async stop(): Promise<void> {
    this.running = false;
    for (const t of this.timers) clearInterval(t);
    await Promise.all(this.loops);
    this.log.info('controller.stopped', { worker: this.o.workerId, ...this.stats });
  }
}
