import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import crypto from 'crypto';
import { nairaToKobo, verifyWebhookSignature, verifyCharge } from '@/lib/payments/korapay';
import { normaliseNigerianMobile } from '@/lib/phone';

const SECRET = 'sk_test_unit';
const sign = (data: unknown) => crypto.createHmac('sha256', SECRET).update(JSON.stringify(data)).digest('hex');

beforeEach(() => {
  process.env.KORA_SECRET_KEY = SECRET;
});
afterEach(() => vi.unstubAllGlobals());

describe('webhook signature (Korapay signs JSON.stringify(data) only)', () => {
  const body = { event: 'charge.success', data: { reference: 'CONN_x', amount: 250, status: 'success' } };

  it('accepts a correct signature', () => {
    expect(verifyWebhookSignature(body, sign(body.data))).toBe(true);
  });
  it('rejects a signature over the whole body', () => {
    const wholeBody = crypto.createHmac('sha256', SECRET).update(JSON.stringify(body)).digest('hex');
    expect(verifyWebhookSignature(body, wholeBody)).toBe(false);
  });
  it('rejects tampered data', () => {
    const sig = sign(body.data);
    expect(verifyWebhookSignature({ ...body, data: { ...body.data, amount: 1 } }, sig)).toBe(false);
  });
  it('rejects a missing signature', () => {
    expect(verifyWebhookSignature(body, null)).toBe(false);
  });
});

describe('money conversion', () => {
  it('converts naira strings and numbers to integer kobo', () => {
    expect(nairaToKobo('2000.00')).toBe(200000);
    expect(nairaToKobo(250)).toBe(25000);
    expect(nairaToKobo('3.75')).toBe(375);
    expect(nairaToKobo('abc')).toBeNull();
    expect(nairaToKobo(undefined)).toBeNull();
  });
});

describe('verifyCharge', () => {
  const respond = (status: number, json: unknown) =>
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(json), { status })));

  it('parses a successful charge', async () => {
    respond(200, { status: true, data: { reference: 'KPY-1', payment_reference: 'CONN_a', status: 'success', amount: '250.00', amount_paid: '250.00', fee: '3.75', currency: 'NGN' } });
    expect(await verifyCharge('CONN_a')).toEqual({
      reference: 'CONN_a', status: 'success', amountPaidKobo: 25000, feeKobo: 375, currency: 'NGN', providerReference: 'KPY-1',
    });
  });
  it('falls back to amount when amount_paid is 0 (seen in Korapay samples)', async () => {
    respond(200, { status: true, data: { reference: 'CONN_b', status: 'success', amount: '250.00', amount_paid: 0, currency: 'NGN' } });
    expect((await verifyCharge('CONN_b'))?.amountPaidKobo).toBe(25000);
  });
  it('returns null when Korapay does not know the reference', async () => {
    respond(404, { status: false, message: 'Not found' });
    expect(await verifyCharge('CONN_c')).toBeNull();
  });
  it('throws on server errors so the caller retries', async () => {
    respond(500, { status: false });
    await expect(verifyCharge('CONN_d')).rejects.toThrow(/verify failed/);
  });
  it('calls the documented endpoint with the secret key', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ status: true, data: { status: 'processing' } }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await verifyCharge('CONN_e');
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.korapay.com/merchant/api/v1/charges/CONN_e');
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${SECRET}`);
  });
});

describe('Nigerian mobile numbers', () => {
  it.each([
    ['08031234567', '2348031234567'],
    ['+234 803 123 4567', '2348031234567'],
    ['2347012345678', '2347012345678'],
    ['0913-456-7890', '2349134567890'],
  ])('%s -> %s', (input, out) => expect(normaliseNigerianMobile(input)).toBe(out));
  it.each(['0912897654', '12345', '05031234567', '+44 7700 900123', ''])('rejects %s', (input) =>
    expect(normaliseNigerianMobile(input)).toBeNull()
  );
});
