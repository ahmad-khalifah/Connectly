import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createFakeDb } from './fake-db';

let fake: ReturnType<typeof createFakeDb>;
const sendTermiiSMS = vi.fn();
const reconcilePurchase = vi.fn();
vi.mock('@/lib/db/client', () => ({ get db() { return fake.db; } }));
vi.mock('@/lib/sms', () => ({ sendTermiiSMS: (...a: unknown[]) => sendTermiiSMS(...a) }));
vi.mock('@/lib/payments/ledger', async (orig) => ({
  ...(await orig<typeof import('@/lib/payments/ledger')>()),
  reconcilePurchase: (...a: unknown[]) => reconcilePurchase(...a),
}));

const NOW = new Date('2026-11-18T12:00:00Z');
const claim = (template: string, extra: object = {}) => ({
  notification_id: `n-${template}`, template, purchase_id: `p-${template}`, recipient: '2348031234567',
  reference: 'CONN_abc', amount_kobo: 25000, expires_at: '2026-11-18T12:40:00Z',
  plan_name: 'Day pass', location_name: 'Garki', voucher_code: 'ABCD2345', ...extra,
});

/** A database whose claim_due_sms returns `claimed`; record_sms_results optionally fails. */
function queue(claimed: object[], { recordFails = false } = {}) {
  fake = createFakeDb(() => ({ data: null, error: null }), (fn) => {
    if (fn === 'claim_due_sms') return { data: claimed, error: null };
    if (fn === 'record_sms_results') return recordFails ? { data: null, error: { message: 'down' } } : { data: claimed.length, error: null };
    return { data: null, error: null };
  });
}

beforeEach(() => {
  vi.resetModules();
  sendTermiiSMS.mockReset();
  sendTermiiSMS.mockResolvedValue({ ok: true, messageId: 'm1' });
  reconcilePurchase.mockReset();
  reconcilePurchase.mockResolvedValue({ outcome: 'paid', purchaseId: 'p1' });
});

describe('due texts (scheduled)', () => {
  it('claims a small batch, sends each text once and records every result in one call', async () => {
    queue([claim('payment_confirmed'), claim('expiry_soon'), claim('expired', { location_name: null, plan_name: 'Hour', expires_at: '2026-11-18T11:30:00Z' })]);
    const { sendDueTexts } = await import('@/lib/notifications/sms-queue');
    expect(await sendDueTexts({ now: NOW })).toEqual({ claimed: 3, sent: 3, failed: 0 });
    expect(fake.rpcCalls[0]).toEqual({ fn: 'claim_due_sms', args: { p_now: NOW.toISOString(), p_limit: 5 } });
    const texts = sendTermiiSMS.mock.calls.map((c) => c[1] as string);
    expect(texts[0]).toMatch(/^Connectly: NGN 250 received for Day pass at Garki\. Your WiFi code: ABCD2345 .* Ref CONN_abc$/);
    expect(texts[1]).toMatch(/your Day pass at Garki ends at 1:40\s?pm/i);
    expect(texts[2]).toMatch(/your Hour has ended/);
    expect(fake.rpcCalls).toHaveLength(2);
    expect(fake.rpcCalls[1].fn).toBe('record_sms_results');
    expect(fake.rpcCalls[1].args.p_results).toEqual([
      { id: 'n-payment_confirmed', status: 'sent', body: texts[0], provider_message_id: 'm1' },
      { id: 'n-expiry_soon', status: 'sent', body: texts[1], provider_message_id: 'm1' },
      { id: 'n-expired', status: 'sent', body: texts[2], provider_message_id: 'm1' },
    ]);
    expect(fake.ops).toEqual([]); // no table reads or writes beyond the two calls
  });

  it('the scheduled confirmation reads exactly like the one the payment page sends', async () => {
    const { confirmationText } = await import('@/lib/payments/ledger');
    const { textFor } = await import('@/lib/notifications/sms-queue');
    const c = claim('payment_confirmed');
    expect(textFor(c as never)).toBe(confirmationText({ amountKobo: 25000, planName: 'Day pass', locationName: 'Garki', voucher: 'ABCD2345', expiresAt: c.expires_at, reference: 'CONN_abc' }));
  });

  it('nothing due: one call, nothing sent', async () => {
    queue([]);
    const { sendDueTexts } = await import('@/lib/notifications/sms-queue');
    expect(await sendDueTexts({ now: NOW })).toEqual({ claimed: 0, sent: 0, failed: 0 });
    expect(fake.rpcCalls).toHaveLength(1);
    expect(sendTermiiSMS).not.toHaveBeenCalled();
  });

  it('records a Termii failure or error and carries on; a failed record does not throw', async () => {
    queue([claim('expiry_soon'), claim('expired')], { recordFails: true });
    sendTermiiSMS.mockResolvedValueOnce({ ok: false, error: 'Termii is not configured' }).mockRejectedValueOnce(new Error('timeout'));
    const { sendDueTexts } = await import('@/lib/notifications/sms-queue');
    expect(await sendDueTexts({ now: NOW })).toEqual({ claimed: 2, sent: 0, failed: 2 });
    expect((fake.rpcCalls[1].args.p_results as { status: string; error: string }[]).map((r) => [r.status, r.error])).toEqual([
      ['failed', 'Termii is not configured'],
      ['failed', 'Error: timeout'],
    ]);
  });

  it('a database that cannot be reached is an error, not a silent success', async () => {
    fake = createFakeDb(() => ({ data: null, error: null }), () => ({ data: null, error: { message: 'down' } }));
    const { sendDueTexts } = await import('@/lib/notifications/sms-queue');
    await expect(sendDueTexts({ now: NOW })).rejects.toThrow(/claim_due_sms failed/);
  });
});

describe('missed-payment check (scheduled)', () => {
  const pending = (refs: string[]) => {
    fake = createFakeDb((op) => (op.table === 'purchases' ? { data: refs.map((reference) => ({ reference })), error: null } : { data: null, error: null }));
  };

  it('re-checks one pending checkout per run, taking turns, without sending the text itself', async () => {
    pending(['CONN_c', 'CONN_b', 'CONN_a']);
    const { checkOnePending } = await import('@/lib/notifications/sms-queue');
    expect(await checkOnePending(0)).toEqual({ checked: 'CONN_c', outcome: 'paid' });
    expect(await checkOnePending(4)).toEqual({ checked: 'CONN_b', outcome: 'paid' });
    expect(reconcilePurchase.mock.calls).toEqual([['CONN_c', { notify: false }], ['CONN_b', { notify: false }]]);
    expect(Object.fromEntries(fake.ops[0].filters)).toMatchObject({ status: 'pending', payment_gateway: 'korapay', 'reference~': 'CONN_%', limit: 10 });
  });

  it('nothing pending: nothing checked', async () => {
    pending([]);
    const { checkOnePending } = await import('@/lib/notifications/sms-queue');
    expect(await checkOnePending(3)).toEqual({ checked: null, outcome: null });
    expect(reconcilePurchase).not.toHaveBeenCalled();
  });
});

describe('cron', () => {
  it('even minutes send texts, odd minutes check a pending checkout', async () => {
    queue([]);
    const { runScheduled } = await import('@/lib/http/cron');
    expect(await runScheduled(Date.parse('2026-11-18T12:00:00Z'))).toEqual({ task: 'texts', claimed: 0, sent: 0, failed: 0 });
    fake = createFakeDb(() => ({ data: [], error: null }));
    expect(await runScheduled(Date.parse('2026-11-18T12:01:00Z'))).toEqual({ task: 'pending', checked: null, outcome: null });
  });

  it('the endpoint refuses callers without the cron secret, and the front door answers it', async () => {
    queue([]);
    vi.stubEnv('CRON_SECRET', 'x'.repeat(40));
    const { GET } = await import('@/app/api/cron/sms-reminders/route');
    const { cronRoute } = await import('@/lib/http/cron');
    expect((await GET(new Request('http://x', { headers: { authorization: 'Bearer wrong' } }))).status).toBe(401);
    const ok = await GET(new Request('http://x', { headers: { authorization: `Bearer ${'x'.repeat(40)}` } }));
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ success: true, claimed: 0, sent: 0, failed: 0 });
    expect(fake.rpcCalls[0].args.p_limit).toBe(50);
    const front = cronRoute('GET', '/api/cron/sms-reminders')!;
    expect((await front(new Request('http://x', { headers: { authorization: `Bearer ${'x'.repeat(40)}` } }))).status).toBe(200);
    expect(fake.rpcCalls[1].args.p_limit).toBe(5);
    expect(cronRoute('POST', '/api/cron/sms-reminders')).toBeNull();
    vi.stubEnv('CRON_SECRET', '');
    expect((await front(new Request('http://x', { headers: { authorization: 'Bearer ' } }))).status).toBe(401);
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

describe('scheduled runs see the same settings as requests', () => {
  it('Worker secrets and variables, then the built public settings, without overwriting', async () => {
    const { applyWorkerEnv } = await import('@/lib/http/worker-env');
    const target: Record<string, string | undefined> = {};
    applyWorkerEnv(
      { SUPABASE_SERVICE_ROLE_KEY: 'secret', APP_ENV: 'preview', ASSETS: { fetch() {} } },
      { production: { NEXT_PUBLIC_SUPABASE_URL: 'https://x.supabase.co', APP_ENV: 'built' }, development: { NEXT_PUBLIC_SUPABASE_URL: 'dev' } },
      target
    );
    expect(target).toEqual({ SUPABASE_SERVICE_ROLE_KEY: 'secret', APP_ENV: 'preview', NEXT_PUBLIC_SUPABASE_URL: 'https://x.supabase.co' });
  });
});
