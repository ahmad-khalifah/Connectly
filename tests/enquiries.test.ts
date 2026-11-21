import { describe, it, expect, vi } from 'vitest';
import { createFakeDb } from './fake-db';
import { enquiryTicket, parseEnquiry } from '@/lib/enquiries';

let fake: ReturnType<typeof createFakeDb>;
vi.mock('@/lib/db/client', () => ({ get db() { return fake.db; } }));

const NOW = 1_800_000_000_000;
const wifi = { name: 'Amina Bello', organisation: 'Kofar Market Traders', email: 'Amina@Example.com', phone: '0803 123 4567', message: 'We want paid WiFi for 300 shops.', siteType: 'Market or shopping centre', siteLocation: 'Kano', users: '500 to 2,000 people a day', startedAt: NOW - 30_000 };

describe('parseEnquiry', () => {
  it('accepts a WiFi enquiry and tidies it', () => {
    const r = parseEnquiry(wifi, NOW);
    expect(r).toMatchObject({ ok: true, value: { email: 'amina@example.com', siteType: 'Market or shopping centre', users: '500 to 2,000 people a day' } });
  });
  it('drops choices that are not on the list', () => {
    const r = parseEnquiry({ ...wifi, siteType: 'Spaceport', users: 'lots' }, NOW);
    expect(r.ok && [r.value.siteType, r.value.users]).toEqual([undefined, undefined]);
  });
  it('treats a filled hidden field or an instant post as spam', () => {
    expect(parseEnquiry({ ...wifi, website: 'http://spam' }, NOW)).toEqual({ ok: false, spam: true });
    expect(parseEnquiry({ ...wifi, startedAt: NOW - 500 }, NOW)).toEqual({ ok: false, spam: true });
    expect(parseEnquiry({ ...wifi, startedAt: undefined }, NOW)).toEqual({ ok: false, spam: true });
  });
  it.each([
    [{ name: 'A' }, 'name'],
    [{ email: 'not-an-email' }, 'email'],
    [{ phone: 'call me' }, 'phone'],
    [{ message: 'hi' }, 'message'],
    [{ organisation: '' }, 'organisation'],
  ])('says which field is wrong: %o', (patch, field) => {
    const r = parseEnquiry({ ...wifi, ...patch }, NOW);
    expect(r).toMatchObject({ ok: false, field });
  });
  it('turns an enquiry into a tagged support ticket', () => {
    const r = parseEnquiry({ ...wifi, phone: '' }, NOW);
    if (!r.ok) throw new Error('should parse');
    const t = enquiryTicket(r.value);
    expect(t.subject).toBe('[WiFi for your site] Kofar Market Traders');
    expect(t.description).toContain('Where: Kano');
    expect(t.description).toContain('Phone: not given');
  });
});

describe('POST /api/enquiries', () => {
  const post = async (body: object) => {
    const { POST } = await import('@/app/api/enquiries/route');
    return POST(new Request('https://x/api/enquiries', { method: 'POST', body: JSON.stringify(body) }));
  };
  it('stores a real enquiry and returns its ticket number', async () => {
    fake = createFakeDb((op) => (op.table === 'support_tickets' ? { data: { ticket_number: 12 }, error: null } : { data: null, error: null }));
    const res = await post({ ...wifi, startedAt: Date.now() - 10_000 });
    expect(await res.json()).toEqual({ ok: true, reference: 12 });
    expect(fake.ops[0]).toMatchObject({ table: 'support_tickets', action: 'insert' });
    expect((fake.ops[0].values as { subject: string }).subject).toBe('[WiFi for your site] Kofar Market Traders');
  });
  it('answers spam like success but stores nothing', async () => {
    fake = createFakeDb(() => ({ data: null, error: null }));
    const res = await post({ ...wifi, website: 'x', startedAt: Date.now() - 10_000 });
    expect(res.status).toBe(200);
    expect(fake.ops).toHaveLength(0);
  });
  it('rejects a bad email with the field name', async () => {
    fake = createFakeDb(() => ({ data: null, error: null }));
    const res = await post({ ...wifi, email: 'x', startedAt: Date.now() - 10_000 });
    expect(res.status).toBe(400);
    expect((await res.json()).field).toBe('email');
  });
});
