import { describe, it, expect, beforeEach } from 'vitest';
import { vi } from 'vitest';
import { createHash } from 'crypto';
import { createFakeDb } from './fake-db';

// The router agent's endpoint (lib/http/router-agent.ts). The database logic is
// tested against real Postgres in supabase/tests/router_agent.test.mjs; here:
// authentication, input limits and sanitising, and that one RPC is made.

let fake: ReturnType<typeof createFakeDb>;
let rpcResult: { data: unknown; error: { code?: string; message: string } | null };
vi.mock('@/lib/db/client', () => ({ get db() { return fake.db; } }));

const TOKEN = 'cxa_' + 'ab12'.repeat(16);
const JOB = '11111111-2222-4333-8444-555555555555';

beforeEach(() => {
  rpcResult = { data: { ok: true, server_epoch: 1, poll_after_seconds: 15, jobs: [], accepted: 0, ignored: 0 }, error: null };
  fake = createFakeDb(() => ({ data: null, error: null }), () => rpcResult);
});

const mod = () => import('@/lib/http/router-agent');
const post = async (body: unknown, headers: Record<string, string> = { authorization: `Bearer ${TOKEN}` }) => {
  const { handleAgentSync } = await mod();
  return handleAgentSync(new Request('https://x/api/router/agent/sync', {
    method: 'POST', headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  }));
};

describe('authentication', () => {
  it.each([
    ['no header', {}],
    ['wrong scheme', { authorization: `Token ${TOKEN}` }],
    ['too short', { authorization: 'Bearer cxa_abc' }],
    ['not hex', { authorization: 'Bearer cxa_' + 'z'.repeat(64) }],
    ['no prefix', { authorization: 'Bearer ' + 'a'.repeat(64) }],
  ])('%s: 401, and the database is never asked', async (_n, headers) => {
    const res = await post({}, headers as Record<string, string>);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ ok: false });
    expect(fake.rpcCalls).toHaveLength(0);
  });

  it('sends only the SHA-256 of the token to the database', async () => {
    await post({});
    expect(fake.rpcCalls).toHaveLength(1);
    expect(fake.rpcCalls[0].fn).toBe('router_agent_sync');
    expect(fake.rpcCalls[0].args.p_token_hash).toBe(createHash('sha256').update(TOKEN).digest('hex'));
    expect(JSON.stringify(fake.rpcCalls[0].args)).not.toContain(TOKEN);
  });

  it('an unknown, disabled or retired router gets the same 401 as a malformed token', async () => {
    rpcResult = { data: { ok: false }, error: null };
    const res = await post({});
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ ok: false });
  });
});

describe('request handling', () => {
  it('returns the database answer, uncached', async () => {
    rpcResult = { data: { ok: true, server_epoch: 5, poll_after_seconds: 15, jobs: [{ job_id: JOB, kind: 'access.revoke' }], accepted: 0, ignored: 0 }, error: null };
    const res = await post({});
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect((await res.json()).jobs[0].job_id).toBe(JOB);
  });

  it('an empty body is a plain heartbeat', async () => {
    const res = await post('');
    expect(res.status).toBe(200);
    expect(fake.rpcCalls[0].args).toMatchObject({ p_results: [], p_status: {} });
  });

  it('bad JSON is 400; oversized is 413', async () => {
    expect((await post('{nope')).status).toBe(400);
    expect((await post('x'.repeat(70_000))).status).toBe(413);
    expect(fake.rpcCalls).toHaveLength(0);
  });

  it('a database error is a 500 that reveals nothing', async () => {
    rpcResult = { data: null, error: { code: 'XX000', message: 'secret internals' } };
    const res = await post({});
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain('secret');
  });

  it('only POST on exactly this path is routed', async () => {
    const { routerAgentRoute } = await mod();
    expect(routerAgentRoute('POST', '/api/router/agent/sync')).toBeTypeOf('function');
    expect(routerAgentRoute('POST', '/api/router/agent/sync/')).toBeTypeOf('function');
    expect(routerAgentRoute('POST', '/api/router/agent/other')).toBeNull();
    const get = routerAgentRoute('GET', '/api/router/agent/sync')!;
    expect((await get(new Request('https://x/api/router/agent/sync'))).status).toBe(405);
  });
});

describe('sanitising what the router sends', () => {
  it('keeps well-formed results and drops the rest, at most 20', async () => {
    const results = [
      { job_id: JOB, ok: true, response: { a: 1 }, extra: 'dropped' },
      { job_id: 'nope', ok: true },
      { ok: true },
      'string',
      { job_id: JOB, ok: 'false', error: 'e'.repeat(900), retryable: false },
      { job_id: JOB, ok: true, response: { big: 'x'.repeat(3000) } },
      ...Array.from({ length: 40 }, () => ({ job_id: JOB, ok: true })),
    ];
    await post({ results });
    const sent = fake.rpcCalls[0].args.p_results as Record<string, unknown>[];
    expect(sent.length).toBeLessThanOrEqual(20);
    expect(sent[0]).toEqual({ job_id: JOB, ok: true, response: { a: 1 } });
    expect(sent[1]).toEqual({ job_id: JOB, ok: false, error: 'e'.repeat(500), retryable: false });
    expect(sent[2]).toEqual({ job_id: JOB, ok: true }); // oversized response dropped
    expect(sent.every((r) => !('extra' in r))).toBe(true);
  });

  it('re-types status fields and drops impossible values', async () => {
    await post({ status: { version: '7.21.5', agent_version: '1', uptime_seconds: '1234', cpu: 250, memory: 41.5, router_epoch: 5, evil: 'x' } });
    expect(fake.rpcCalls[0].args.p_status).toEqual({ version: '7.21.5', agent_version: '1', uptime_seconds: 1234, memory: 41.5 });
  });

  it('sessions: bounded, typed, rows without id or mac dropped', async () => {
    const sessions = [
      { id: '*A1', user: 'ABCD2345', mac: 'AA:BB:CC:DD:EE:01', ip: '10.10.0.20', uptime: '30', bytes_in: 5, bytes_out: -1 },
      { id: '*A2' },
      { mac: 'AA:BB:CC:DD:EE:02' },
      ...Array.from({ length: 300 }, (_, i) => ({ id: `*${i}`, mac: 'AA:BB:CC:DD:EE:03', ip: '10.10.0.9' })),
    ];
    await post({ status: { sessions } });
    const sent = (fake.rpcCalls[0].args.p_status as { sessions: Record<string, unknown>[] }).sessions;
    expect(sent.length).toBe(198); // first 200 rows examined, 2 invalid dropped
    expect(sent[0]).toEqual({ id: '*A1', mac: 'AA:BB:CC:DD:EE:01', user: 'ABCD2345', ip: '10.10.0.20', uptime: 30, bytes_in: 5, bytes_out: 0 });
  });
});
