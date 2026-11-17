// RouterOS 7 REST client (www-ssl, port 443 by default), reached through the
// WireGuard tunnel. Jobs depend only on the RouterClient interface, so tests
// use a simulated router and CHR or real routers use this class unchanged.
//
// TLS: routers use a self-signed certificate made during bootstrap. The
// first successful Test Connection records its SHA-256 fingerprint; every
// later connection must present the same certificate. The fingerprint is
// checked on the raw TLS socket BEFORE any request (and so before the
// password) is written. The tunnel already authenticates the router by its
// WireGuard key, so trusting the certificate on first use is acceptable here.
//
// STATUS: field names follow RouterOS 7 documentation; untested on a real
// RouterOS until the CHR stage.

import tls from 'node:tls';
import http from 'node:http';

export type RouterErrorKind = 'unreachable' | 'timeout' | 'auth' | 'pin_mismatch' | 'protocol' | 'not_found';

export class RouterError extends Error {
  readonly kind: RouterErrorKind;
  readonly status: number | undefined;
  constructor(kind: RouterErrorKind, message: string, status?: number) {
    super(message);
    this.kind = kind;
    this.status = status;
  }
  /** Retrying will not help: wrong password, wrong certificate, bad request. */
  get permanent(): boolean {
    return this.kind === 'auth' || this.kind === 'pin_mismatch' || this.kind === 'protocol';
  }
}

export type HotspotUser = { id: string; name: string; comment?: string; profile?: string; limitUptime?: string };
export type ActiveSession = { id: string; user: string; address?: string; macAddress?: string; uptime?: string };
export type Resource = { version: string; boardName: string; uptimeSeconds: number; cpuLoad: number; memoryUsedPct: number };

export interface RouterClient {
  /** SHA-256 fingerprint of the certificate seen on the last connection. */
  readonly observedFingerprint: string | null;
  identity(): Promise<string>;
  resource(): Promise<Resource>;
  findHotspotUser(name: string): Promise<HotspotUser | null>;
  listHotspotUsers(): Promise<HotspotUser[]>;
  addHotspotUser(u: { name: string; password: string; profile: string; limitUptime: string; limitBytesTotal?: number; comment: string }): Promise<string>;
  updateHotspotUser(id: string, u: { password?: string; profile?: string; limitUptime?: string; limitBytesTotal?: number; comment?: string }): Promise<void>;
  removeHotspotUser(id: string): Promise<void>;
  ensureUserProfile(p: { name: string; rateLimit: string; sharedUsers: number }): Promise<void>;
  listActive(user?: string): Promise<ActiveSession[]>;
  removeActive(id: string): Promise<void>;
}

export type RouterTarget = { host: string; port: number; user: string; password: string; pinnedFingerprint: string | null; timeoutMs: number };

/** "1w2d3h4m5s" -> seconds. */
export function parseRouterOsDuration(s: string | undefined): number {
  if (!s) return 0;
  let total = 0;
  for (const [, n, unit] of s.matchAll(/(\d+)([wdhms])/g)) {
    total += Number(n) * { w: 604800, d: 86400, h: 3600, m: 60, s: 1 }[unit as 'w' | 'd' | 'h' | 'm' | 's'];
  }
  return total;
}

/** seconds -> "3h20m0s" (RouterOS time value). */
export function formatRouterOsDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 3600)}h${Math.floor((s % 3600) / 60)}m${s % 60}s`;
}

const normalizeFp = (fp: string) => fp.replace(/:/g, '').toUpperCase();

export class RestRouterClient implements RouterClient {
  private readonly t: RouterTarget;
  observedFingerprint: string | null = null;

  constructor(target: RouterTarget) {
    this.t = target;
  }

  private connect(): Promise<tls.TLSSocket> {
    return new Promise((resolve, reject) => {
      const socket = tls.connect({ host: this.t.host, port: this.t.port, rejectUnauthorized: false, timeout: this.t.timeoutMs });
      const fail = (e: RouterError) => {
        socket.destroy();
        reject(e);
      };
      socket.once('timeout', () => fail(new RouterError('timeout', `No answer from ${this.t.host}:${this.t.port} within ${this.t.timeoutMs} ms`)));
      socket.once('error', (e: NodeJS.ErrnoException) => fail(new RouterError('unreachable', `Cannot reach ${this.t.host}:${this.t.port} (${e.code ?? e.message})`)));
      socket.once('secureConnect', () => {
        const fp = socket.getPeerCertificate()?.fingerprint256;
        if (!fp) return fail(new RouterError('protocol', 'The router presented no certificate'));
        this.observedFingerprint = normalizeFp(fp);
        if (this.t.pinnedFingerprint && normalizeFp(this.t.pinnedFingerprint) !== this.observedFingerprint) {
          return fail(new RouterError('pin_mismatch', 'The router presented a different certificate from the one recorded at its first test. Nothing was sent.'));
        }
        socket.removeAllListeners('timeout');
        socket.removeAllListeners('error');
        resolve(socket);
      });
    });
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const socket = await this.connect();
    const payload = body === undefined ? undefined : JSON.stringify(body);
    return new Promise<T>((resolve, reject) => {
      const req = http.request({
        createConnection: () => socket,
        host: this.t.host,
        method,
        path: `/rest${path}`,
        timeout: this.t.timeoutMs,
        headers: {
          authorization: 'Basic ' + Buffer.from(`${this.t.user}:${this.t.password}`).toString('base64'),
          accept: 'application/json',
          ...(payload ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) } : {}),
        },
      });
      req.on('timeout', () => req.destroy(new RouterError('timeout', `RouterOS did not answer ${method} ${path} in time`)));
      req.on('error', (e) => reject(e instanceof RouterError ? e : new RouterError('unreachable', e.message)));
      req.on('response', (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          const status = res.statusCode ?? 0;
          if (status === 401 || status === 403) return reject(new RouterError('auth', 'The router refused the controller login', status));
          if (status === 404) return reject(new RouterError('not_found', `${path} not found on the router`, status));
          if (status >= 400) {
            let detail = '';
            try { detail = (JSON.parse(text) as { detail?: string; message?: string }).detail ?? ''; } catch { /* not JSON */ }
            return reject(new RouterError(status >= 500 ? 'unreachable' : 'protocol', `RouterOS ${status} on ${method} ${path}${detail ? `: ${detail}` : ''}`, status));
          }
          if (!text) return resolve(undefined as T);
          try { resolve(JSON.parse(text) as T); } catch { reject(new RouterError('protocol', `RouterOS sent invalid JSON for ${path}`, status)); }
        });
      });
      req.end(payload);
    });
  }

  async identity(): Promise<string> {
    return (await this.request<{ name: string }>('GET', '/system/identity')).name;
  }

  async resource(): Promise<Resource> {
    const r = await this.request<Record<string, string>>('GET', '/system/resource');
    const total = Number(r['total-memory'] ?? 0);
    const free = Number(r['free-memory'] ?? 0);
    return {
      version: r.version ?? '',
      boardName: r['board-name'] ?? '',
      uptimeSeconds: parseRouterOsDuration(r.uptime),
      cpuLoad: Number(r['cpu-load'] ?? 0),
      memoryUsedPct: total > 0 ? Math.round(((total - free) / total) * 100) : 0,
    };
  }

  private static toUser(u: Record<string, string>): HotspotUser {
    return { id: u['.id']!, name: u.name!, comment: u.comment, profile: u.profile, limitUptime: u['limit-uptime'] };
  }

  async findHotspotUser(name: string): Promise<HotspotUser | null> {
    const rows = await this.request<Record<string, string>[]>('GET', `/ip/hotspot/user?name=${encodeURIComponent(name)}`);
    return rows[0] ? RestRouterClient.toUser(rows[0]) : null;
  }

  async listHotspotUsers(): Promise<HotspotUser[]> {
    return (await this.request<Record<string, string>[]>('GET', '/ip/hotspot/user')).map(RestRouterClient.toUser);
  }

  async addHotspotUser(u: { name: string; password: string; profile: string; limitUptime: string; limitBytesTotal?: number; comment: string }): Promise<string> {
    const created = await this.request<Record<string, string>>('PUT', '/ip/hotspot/user', {
      name: u.name, password: u.password, profile: u.profile, 'limit-uptime': u.limitUptime, comment: u.comment,
      ...(u.limitBytesTotal ? { 'limit-bytes-total': String(u.limitBytesTotal) } : {}),
    });
    return created['.id']!;
  }

  async updateHotspotUser(id: string, u: { password?: string; profile?: string; limitUptime?: string; limitBytesTotal?: number; comment?: string }): Promise<void> {
    const body: Record<string, string> = {};
    if (u.password !== undefined) body.password = u.password;
    if (u.profile !== undefined) body.profile = u.profile;
    if (u.limitUptime !== undefined) body['limit-uptime'] = u.limitUptime;
    if (u.limitBytesTotal !== undefined) body['limit-bytes-total'] = String(u.limitBytesTotal);
    if (u.comment !== undefined) body.comment = u.comment;
    await this.request('PATCH', `/ip/hotspot/user/${encodeURIComponent(id)}`, body);
  }

  async removeHotspotUser(id: string): Promise<void> {
    try {
      await this.request('DELETE', `/ip/hotspot/user/${encodeURIComponent(id)}`);
    } catch (e) {
      if (!(e instanceof RouterError && e.kind === 'not_found')) throw e; // already gone: fine
    }
  }

  async ensureUserProfile(p: { name: string; rateLimit: string; sharedUsers: number }): Promise<void> {
    const rows = await this.request<Record<string, string>[]>('GET', `/ip/hotspot/user/profile?name=${encodeURIComponent(p.name)}`);
    const body = { 'rate-limit': p.rateLimit, 'shared-users': String(p.sharedUsers) };
    if (rows[0]) await this.request('PATCH', `/ip/hotspot/user/profile/${encodeURIComponent(rows[0]['.id']!)}`, body);
    else await this.request('PUT', '/ip/hotspot/user/profile', { name: p.name, ...body });
  }

  async listActive(user?: string): Promise<ActiveSession[]> {
    const rows = await this.request<Record<string, string>[]>('GET', `/ip/hotspot/active${user ? `?user=${encodeURIComponent(user)}` : ''}`);
    return rows.map((r) => ({ id: r['.id']!, user: r.user!, address: r.address, macAddress: r['mac-address'], uptime: r.uptime }));
  }

  async removeActive(id: string): Promise<void> {
    try {
      await this.request('DELETE', `/ip/hotspot/active/${encodeURIComponent(id)}`);
    } catch (e) {
      if (!(e instanceof RouterError && e.kind === 'not_found')) throw e;
    }
  }
}
