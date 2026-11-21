// The router agent's one endpoint: POST /api/router/agent/sync.
//
// A MikroTik router calls it every ~15 seconds over HTTPS, outbound only. In one
// request it says who it is (bearer token), reports the results of jobs it was
// given earlier and a heartbeat, and is handed any new work (add this customer,
// remove that one). All of the logic is one database function
// (router_agent_sync, migration 20261122090000), so the Worker does almost no
// work per request: it stays well inside Workers Free's 10 ms of CPU.
//
// Security:
//   * the token is "cxa_" + 64 hex characters, one per router; only its SHA-256
//     is stored. The Worker hashes what it is given and the database looks the
//     hash up. The token has 244 random bits, so a hash lookup leaks nothing
//     useful through timing;
//   * anything wrong with the token (missing, malformed, unknown, router not
//     agent-enabled or retired) gets the same 401, so nothing can be probed;
//   * the body is size-limited and every field is re-typed and trimmed before
//     it reaches the database; the router is trusted to run its own work, not
//     to write arbitrary data.

import { createHash } from 'crypto';
import { db } from '@/lib/db/client';

const TOKEN_RE = /^cxa_[0-9a-f]{64}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BODY_BYTES = 64 * 1024;
const MAX_RESULTS = 20;
const MAX_SESSIONS = 200;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });

const unauthorized = () => json({ ok: false }, 401);

export function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

const str = (v: unknown, max: number): string | undefined => (typeof v === 'string' && v.length > 0 ? v.slice(0, max) : undefined);
const num = (v: unknown, min: number, max: number): number | undefined => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : NaN;
  return Number.isFinite(n) && n >= min && n <= max ? n : undefined;
};
const bool = (v: unknown): boolean | undefined => (typeof v === 'boolean' ? v : v === 'true' ? true : v === 'false' ? false : undefined);

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Only the fields the database function reads, each re-typed and bounded. */
export function cleanResults(raw: unknown): Obj[] {
  if (!Array.isArray(raw)) return [];
  const out: Obj[] = [];
  for (const r of raw.slice(0, MAX_RESULTS)) {
    if (!isObj(r)) continue;
    const jobId = str(r.job_id, 36);
    if (!jobId || !UUID_RE.test(jobId)) continue;
    const item: Obj = { job_id: jobId, ok: bool(r.ok) ?? false };
    const error = str(r.error, 500);
    if (error) item.error = error;
    const retryable = bool(r.retryable);
    if (retryable !== undefined) item.retryable = retryable;
    if (isObj(r.response)) {
      const text = JSON.stringify(r.response);
      if (text.length <= 2048) item.response = r.response;
    }
    out.push(item);
  }
  return out;
}

export function cleanStatus(raw: unknown): Obj {
  if (!isObj(raw)) return {};
  const out: Obj = {};
  const version = str(raw.version, 40);
  if (version) out.version = version;
  const agentVersion = str(raw.agent_version, 40);
  if (agentVersion) out.agent_version = agentVersion;
  const uptime = num(raw.uptime_seconds, 0, 1e10);
  if (uptime !== undefined) out.uptime_seconds = Math.floor(uptime);
  const cpu = num(raw.cpu, 0, 100);
  if (cpu !== undefined) out.cpu = cpu;
  const memory = num(raw.memory, 0, 100);
  if (memory !== undefined) out.memory = memory;
  const epoch = num(raw.router_epoch, 1_000_000_000, 4_000_000_000);
  if (epoch !== undefined) out.router_epoch = Math.floor(epoch);
  if (Array.isArray(raw.sessions)) {
    const sessions: Obj[] = [];
    for (const s of raw.sessions.slice(0, MAX_SESSIONS)) {
      if (!isObj(s)) continue;
      const id = str(s.id, 40);
      const mac = str(s.mac, 17);
      if (!id || !mac) continue;
      sessions.push({
        id, mac,
        user: str(s.user, 64) ?? null,
        ip: str(s.ip, 15) ?? null,
        uptime: Math.floor(num(s.uptime, 0, 1e10) ?? 0),
        bytes_in: Math.floor(num(s.bytes_in, 0, 1e15) ?? 0),
        bytes_out: Math.floor(num(s.bytes_out, 0, 1e15) ?? 0),
      });
    }
    out.sessions = sessions;
  }
  return out;
}

// RouterOS's JSON parser turns strings that look like numbers, times or IP
// addresses into those types (a voucher such as 23456789 loses its string-ness),
// so a router asks for ?format=lines and splits plain text instead:
//   S|server_epoch|poll_after_seconds
//   P|job_id|grant_id|username|password|profile|rate_limit|shared_users|remaining_seconds|expires_epoch|limit_bytes|comment|device_mac
//   R|job_id|grant_id|username|reason
//   D|job_id|router_session_id
// Fields never contain "|" or line breaks (they are stripped); empty = not set.
const field = (v: unknown): string => (v === null || v === undefined ? '' : String(v).replace(/[|\r\n]/g, ''));

export function renderLines(data: Obj): string {
  const out = [`S|${field(data.server_epoch)}|${field(data.poll_after_seconds)}`];
  const jobs = Array.isArray(data.jobs) ? data.jobs : [];
  for (const j of jobs) {
    if (!isObj(j)) continue;
    if (j.kind === 'access.provision') {
      const p = isObj(j.profile) ? j.profile : {};
      out.push(['P', j.job_id, j.grant_id, j.username, j.password, p.name, p.rate_limit, p.shared_users, j.remaining_seconds, j.expires_epoch, j.limit_bytes_total, j.comment, j.device_mac].map(field).join('|'));
    } else if (j.kind === 'access.revoke') {
      out.push(['R', j.job_id, j.grant_id, j.username, j.reason].map(field).join('|'));
    } else if (j.kind === 'session.disconnect') {
      out.push(['D', j.job_id, j.router_session_id].map(field).join('|'));
    }
  }
  return out.join('\n') + '\n';
}

export async function handleAgentSync(request: Request): Promise<Response> {
  const auth = request.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!TOKEN_RE.test(token)) return unauthorized();

  const declared = Number(request.headers.get('content-length') ?? '0');
  if (declared > MAX_BODY_BYTES) return json({ ok: false, error: 'too_large' }, 413);
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return json({ ok: false, error: 'too_large' }, 413);

  let body: unknown = {};
  if (text.trim()) {
    try {
      body = JSON.parse(text);
    } catch {
      return json({ ok: false, error: 'bad_json' }, 400);
    }
  }
  const b = isObj(body) ? body : {};

  const { data, error } = await db.rpc('router_agent_sync', {
    p_token_hash: hashToken(token),
    p_results: cleanResults(b.results),
    p_status: cleanStatus(b.status),
  });
  if (error) {
    console.error('[ROUTER_AGENT_SYNC]', error.code, error.message);
    return json({ ok: false, error: 'server_error' }, 500);
  }
  if (!isObj(data) || data.ok !== true) return unauthorized();
  if (new URL(request.url).searchParams.get('format') === 'lines') {
    return new Response(renderLines(data), {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }
  return json(data);
}

export function routerAgentRoute(method: string, pathname: string): ((request: Request) => Promise<Response>) | null {
  if (pathname.replace(/\/+$/, '') !== '/api/router/agent/sync') return null;
  if (method.toUpperCase() !== 'POST') return async () => json({ ok: false, error: 'method_not_allowed' }, 405);
  return handleAgentSync;
}
