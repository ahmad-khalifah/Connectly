import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createFakeDb, type Handler } from './fake-db';

let fake: ReturnType<typeof createFakeDb>;
const sendTermiiSMS = vi.fn();
vi.mock('@/lib/db/client', () => ({ get db() { return fake.db; } }));
vi.mock('@/lib/sms', () => ({ sendTermiiSMS: (...a: unknown[]) => sendTermiiSMS(...a) }));

const NOW = new Date('2026-11-18T12:00:00Z');
const soon = { id: 'p-soon', phone_number: '2348031234567', expires_at: '2026-11-18T12:40:00Z', plans: { name: 'Day pass' }, locations: { name: 'Garki' } };
const ended = { id: 'p-ended', phone_number: '2348039999999', expires_at: '2026-11-18T11:30:00Z', plans: { name: 'Hour' }, locations: null };

type World = { soon?: object[]; ended?: object[]; claimed?: Set<string>; revoked?: Set<string>; toppedUp?: Set<string> };
const world = (w: World): Handler => (op) => {
  const f = Object.fromEntries(op.filters);
  if (op.table === 'purchases' && 'expires_at<=' in f) {
    const lo = Date.parse(String(f['expires_at>'])), hi = Date.parse(String(f['expires_at<=']));
    const rows = [...(w.soon ?? []), ...(w.ended ?? [])] as { expires_at: string }[];
    return { data: rows.filter((r) => Date.parse(r.expires_at) > lo && Date.parse(r.expires_at) <= hi), error: null };
  }
  if (op.table === 'purchases') { // newer paid plan for the same phone?
    return { data: w.toppedUp?.has(String(f.phone_number)) ? { id: 'newer' } : null, error: null };
  }
  if (op.table === 'network_authorizations') {
    return { data: w.revoked?.has(String(f.purchase_id)) ? { status: 'revoked', revoked_at: '2026-11-18T10:00:00Z' } : { status: 'active', revoked_at: null }, error: null };
  }
  if (op.table === 'notifications' && op.action === 'insert') {
    const v = op.values as { purchase_id: string; template: string };
    const key = `${v.purchase_id}:${v.template}`;
    if (w.claimed?.has(key)) return { data: null, error: { code: '23505', message: 'duplicate' } };
    w.claimed?.add(key);
    return { data: { id: `n-${key}` }, error: null };
  }
  if (op.table === 'notifications' && op.action === 'select') return { data: { attempts: 0 }, error: null };
  return { data: null, error: null };
};

beforeEach(() => {
  vi.resetModules();
  sendTermiiSMS.mockReset();
  sendTermiiSMS.mockResolvedValue({ ok: true, messageId: 'm1' });
});

describe('expiry reminders', () => {
  it('reminds a plan ending within the hour and one that just ended, by expiry time', async () => {
    fake = createFakeDb(world({ soon: [soon], ended: [ended], claimed: new Set() }));
    const { sendExpiryReminders } = await import('@/lib/notifications/reminders');
    expect(await sendExpiryReminders(NOW)).toEqual({ considered: 2, sent: 2, skipped: 0, failed: 0 });
    const texts = sendTermiiSMS.mock.calls.map((c) => c[1] as string);
    expect(texts[0]).toMatch(/your Day pass at Garki ends at 1:40\s?pm/i);
    expect(texts[1]).toMatch(/your Hour has ended/);
    const queries = fake.ops.filter((o) => o.table === 'purchases' && o.filters.some(([k]) => k === 'expires_at<='));
    expect(queries.map((q) => Object.fromEntries(q.filters))).toEqual([
      expect.objectContaining({ status: 'paid', 'expires_at>': NOW.toISOString(), 'expires_at<=': '2026-11-18T13:00:00.000Z' }),
      expect.objectContaining({ status: 'paid', 'expires_at>': '2026-11-18T11:00:00.000Z', 'expires_at<=': NOW.toISOString() }),
    ]);
  });

  it('sends each reminder once however often it runs', async () => {
    const claimed = new Set<string>();
    fake = createFakeDb(world({ soon: [soon], claimed }));
    const { sendExpiryReminders } = await import('@/lib/notifications/reminders');
    await sendExpiryReminders(NOW);
    await sendExpiryReminders(new Date(NOW.getTime() + 10 * 60_000));
    expect(sendTermiiSMS).toHaveBeenCalledTimes(1);
  });

  it('does not remind revoked access or a customer who already topped up', async () => {
    fake = createFakeDb(world({ soon: [soon], ended: [ended], claimed: new Set(), revoked: new Set(['p-soon']), toppedUp: new Set(['2348039999999']) }));
    const { sendExpiryReminders } = await import('@/lib/notifications/reminders');
    expect(await sendExpiryReminders(NOW)).toMatchObject({ sent: 0, skipped: 2 });
    expect(sendTermiiSMS).not.toHaveBeenCalled();
  });

  it('records an SMS failure and carries on', async () => {
    sendTermiiSMS.mockResolvedValue({ ok: false, error: 'Termii 400' });
    fake = createFakeDb(world({ soon: [soon], ended: [ended], claimed: new Set() }));
    const { sendExpiryReminders } = await import('@/lib/notifications/reminders');
    expect(await sendExpiryReminders(NOW)).toMatchObject({ sent: 0, failed: 2 });
  });

  it('the endpoint refuses callers without the cron secret', async () => {
    fake = createFakeDb(world({}));
    vi.stubEnv('CRON_SECRET', 'x'.repeat(40));
    const { GET } = await import('@/app/api/cron/sms-reminders/route');
    expect((await GET(new Request('http://x', { headers: { authorization: 'Bearer wrong' } }))).status).toBe(401);
    expect((await GET(new Request('http://x', { headers: { authorization: `Bearer ${'x'.repeat(40)}` } }))).status).toBe(200);
    vi.unstubAllEnvs();
  });
});

describe('legacy router code is gone', () => {
  const root = path.resolve(__dirname, '..');
  it.each(['app/api/claim', 'app/api/telemetry', 'app/api/auth/verify-roaming', 'lib/network/mikrotik.ts', 'lib/network/mock.ts', 'lib/network/index.ts'])('%s does not exist', (p) => {
    expect(fs.existsSync(path.join(root, p))).toBe(false);
  });
  it('no app code calls a router API directly (only the controller does)', () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else if (/\.(ts|tsx)$/.test(e.name) && /\/rest\/|ip\/hotspot\/(user|active)/.test(fs.readFileSync(p, 'utf8'))) offenders.push(path.relative(root, p));
      }
    };
    walk(path.join(root, 'app'));
    walk(path.join(root, 'lib'));
    expect(offenders).toEqual([]);
  });
});
