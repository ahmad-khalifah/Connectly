// A simulated RouterOS for tests. FakeRouter keeps hotspot users, profiles
// and active sessions in memory and implements the same RouterClient
// interface as the real REST client. FakeRestServer serves a small part of the
// RouterOS REST API over HTTPS, to test RestRouterClient itself (login, TLS
// pinning, error mapping). Neither is a substitute for the CHR stage.

import https from 'node:https';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { ActiveSession, HotspotUser, Resource, RouterClient } from '../src/routeros.ts';
import { RouterError } from '../src/routeros.ts';

export class FakeRouter {
  identity: string;
  password: string;
  reachable = true;
  users = new Map<string, HotspotUser & { password: string; limitBytesTotal?: number }>();
  profiles = new Map<string, { rateLimit: string; sharedUsers: number }>();
  active = new Map<string, ActiveSession>();
  calls: string[] = [];
  /** Generic RouterOS menus, keyed by REST path. */
  menus = new Map<string, Record<string, string>[]>([
    ['/interface', [{ '.id': '*I1', name: 'ether1' }, { '.id': '*I2', name: 'ether2' }, { '.id': '*I3', name: 'ether3' }]],
  ]);
  dns: Record<string, string> = { 'allow-remote-requests': 'false' };
  private seq = 0;
  constructor(identity: string, password: string) {
    this.identity = identity;
    this.password = password;
  }
  nextId() {
    return `*${(++this.seq).toString(16).toUpperCase()}`;
  }
  login(user: string, password: string) {
    const r = this;
    if (!r.reachable) throw new RouterError('unreachable', 'Cannot reach router (simulated)');
    if (user !== 'connectly-ctrl' || password !== r.password) throw new RouterError('auth', 'The router refused the controller login', 401);
    return new FakeClient(r);
  }
}

class FakeClient implements RouterClient {
  observedFingerprint = 'AA'.repeat(32);
  private readonly r: FakeRouter;
  constructor(r: FakeRouter) {
    this.r = r;
  }
  private call(name: string) {
    if (!this.r.reachable) throw new RouterError('unreachable', 'Cannot reach router (simulated)');
    this.r.calls.push(name);
  }
  async identity() { this.call('identity'); return this.r.identity; }
  async resource(): Promise<Resource> { this.call('resource'); return { version: '7.16.2 (stable)', boardName: 'CHR', uptimeSeconds: 3600, cpuLoad: 3, memoryUsedPct: 20 }; }
  async findHotspotUser(name: string) { this.call('findUser'); const u = this.r.users.get(name); return u ? { ...u } : null; }
  async listHotspotUsers() { this.call('listUsers'); return [...this.r.users.values()].map((u) => ({ ...u })); }
  async addHotspotUser(u: { name: string; password: string; profile: string; limitUptime: string; limitBytesTotal?: number; comment: string }) {
    this.call('addUser');
    if (this.r.users.has(u.name)) throw new RouterError('protocol', 'failure: already have user with this name', 400);
    const id = this.r.nextId();
    this.r.users.set(u.name, { id, ...u });
    return id;
  }
  async updateHotspotUser(id: string, u: Partial<{ password: string; profile: string; limitUptime: string; limitBytesTotal: number; comment: string }>) {
    this.call('updateUser');
    const found = [...this.r.users.values()].find((x) => x.id === id);
    if (!found) throw new RouterError('not_found', 'no such item', 404);
    Object.assign(found, u);
  }
  async removeHotspotUser(id: string) {
    this.call('removeUser');
    for (const [k, v] of this.r.users) if (v.id === id) this.r.users.delete(k);
  }
  async ensureUserProfile(p: { name: string; rateLimit: string; sharedUsers: number }) { this.call('ensureProfile'); this.r.profiles.set(p.name, { rateLimit: p.rateLimit, sharedUsers: p.sharedUsers }); }
  async listActive(user?: string) { this.call('listActive'); return [...this.r.active.values()].filter((s) => !user || s.user === user); }
  async removeActive(id: string) { this.call('removeActive'); this.r.active.delete(id); }
  private menu(path: string) {
    if (!this.r.menus.has(path)) this.r.menus.set(path, []);
    return this.r.menus.get(path)!;
  }
  async list(path: string, query: Record<string, string> = {}) {
    this.call(`list ${path}`);
    if (path === '/ip/dns') return this.r.dns as unknown as Record<string, string>[];
    return this.menu(path).filter((row) => Object.entries(query).every(([k, v]) => row[k] === v)).map((row) => ({ ...row }));
  }
  async add(path: string, fields: Record<string, string>) {
    this.call(`add ${path}`);
    const id = this.r.nextId();
    this.menu(path).push({ '.id': id, ...fields });
    // Like RouterOS: creating a hotspot server writes the default hotspot files.
    if (path === '/ip/hotspot' && !this.menu('/file').some((f) => f.name === 'hotspot/login.html')) {
      this.menu('/file').push({ '.id': this.r.nextId(), name: 'hotspot/login.html', contents: '<html>MikroTik default</html>' });
    }
    return id;
  }
  async set(path: string, id: string, fields: Record<string, string>) {
    this.call(`set ${path}`);
    const row = this.menu(path).find((r) => r['.id'] === id);
    if (!row) throw new RouterError('not_found', 'no such item', 404);
    Object.assign(row, fields);
  }
  async remove(path: string, id: string) {
    this.call(`remove ${path}`);
    const m = this.menu(path);
    const i = m.findIndex((r) => r['.id'] === id);
    if (i >= 0) m.splice(i, 1);
  }
  async command(path: string, fields: Record<string, string>) {
    this.call(`command ${path}`);
    if (path === '/ip/dns/set') Object.assign(this.r.dns, fields);
    if (path.endsWith('/move')) {
      // RouterOS: move item `numbers` to just before item `destination`.
      const m = this.menu(path.slice(0, -'/move'.length));
      const from = m.findIndex((x) => x['.id'] === fields.numbers);
      if (from < 0) throw new Error('no such item');
      const [item] = m.splice(from, 1);
      const to = m.findIndex((x) => x['.id'] === fields.destination);
      m.splice(to < 0 ? m.length : to, 0, item!);
    }
    return {};
  }
}

/** Self-signed certificate made with the openssl CLI (test only). */
export function selfSigned(cn: string): { key: string; cert: string; fingerprint: string } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cx-cert-'));
  try {
    execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', path.join(dir, 'k.pem'), '-out', path.join(dir, 'c.pem'), '-days', '2', '-subj', `/CN=${cn}`], { stdio: 'ignore' });
    const cert = fs.readFileSync(path.join(dir, 'c.pem'), 'utf8');
    const fingerprint = new crypto.X509Certificate(cert).fingerprint256.replace(/:/g, '');
    return { key: fs.readFileSync(path.join(dir, 'k.pem'), 'utf8'), cert, fingerprint };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** Minimal RouterOS REST over HTTPS on 127.0.0.1. Records what each request carried. */
export async function startFakeRestServer(a: { identity: string; password: string; cert: { key: string; cert: string } }) {
  const requests: { method: string; url: string; authorized: boolean }[] = [];
  const users: Record<string, string>[] = [];
  const server = https.createServer({ key: a.cert.key, cert: a.cert.cert }, (req, res) => {
    const auth = req.headers.authorization ?? '';
    const authorized = auth === 'Basic ' + Buffer.from(`connectly-ctrl:${a.password}`).toString('base64');
    requests.push({ method: req.method ?? '', url: req.url ?? '', authorized });
    const send = (status: number, body?: unknown) => {
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(body === undefined ? '' : JSON.stringify(body));
    };
    if (!authorized) return send(401, { error: 401, message: 'Unauthorized' });
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      const url = new URL(req.url ?? '/', 'https://x');
      if (req.method === 'GET' && url.pathname === '/rest/system/identity') return send(200, { name: a.identity });
      if (req.method === 'GET' && url.pathname === '/rest/system/resource') {
        return send(200, { version: '7.16.2 (stable)', 'board-name': 'CHR', uptime: '1d2h3m4s', 'cpu-load': '7', 'free-memory': '268435456', 'total-memory': '1073741824' });
      }
      if (req.method === 'GET' && url.pathname === '/rest/ip/hotspot/user') {
        const name = url.searchParams.get('name');
        return send(200, users.filter((u) => !name || u.name === name));
      }
      if (req.method === 'PUT' && url.pathname === '/rest/ip/hotspot/user') {
        const body = JSON.parse(raw) as Record<string, string>;
        const row = { '.id': `*${users.length + 1}`, ...body };
        users.push(row);
        return send(201, row);
      }
      if (req.method === 'DELETE' && url.pathname.startsWith('/rest/ip/hotspot/user/')) {
        const id = decodeURIComponent(url.pathname.split('/').pop()!);
        const i = users.findIndex((u) => u['.id'] === id);
        if (i < 0) return send(404, { error: 404, message: 'Not Found' });
        users.splice(i, 1);
        return send(204);
      }
      if (url.pathname === '/rest/bad') return send(400, { error: 400, message: 'Bad Request', detail: 'unknown parameter' });
      send(404, { error: 404, message: 'Not Found' });
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const port = (server.address() as { port: number }).port;
  return { port, requests, users, close: () => new Promise<void>((r) => server.close(() => r())) };
}
