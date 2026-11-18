import { describe, it, expect, vi } from 'vitest';
import { createFakeDb } from './fake-db';
import { parseExpenseInput, expenseRow, lagosToday } from '@/lib/admin/inputs';

let fake: ReturnType<typeof createFakeDb>;
vi.mock('@/lib/db/client', () => ({ get db() { return fake.db; } }));
vi.mock('@/lib/auth/admin', () => ({
  requireAdminApi: async () => ({ user: { id: 'u1', email: 'connectly.hq@outlook.com' }, denied: null }),
}));

const LOC = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const EXP = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const NOW = new Date('2026-11-18T22:30:00Z'); // 23:30 in Lagos
const base = { category: 'backhaul', amountNaira: '45,000', description: 'Starlink monthly subscription', expenseDate: '2026-11-18' };

describe('parseExpenseInput', () => {
  it('accepts a valid expense, reads "45,000" as 45000 and allows no location', () => {
    const r = parseExpenseInput(base, NOW);
    expect(r).toEqual({ ok: true, value: { category: 'backhaul', amountNaira: 45000, locationId: null, description: 'Starlink monthly subscription', expenseDate: '2026-11-18' } });
  });

  it('uses the Lagos date for "today"', () => {
    expect(lagosToday(new Date('2026-11-18T23:30:00Z'))).toBe('2026-11-19');
  });

  it.each([
    [{ ...base, category: 'fuel' }, 'category'],
    [{ ...base, amountNaira: 0 }, 'Amount'],
    [{ ...base, amountNaira: '-5' }, 'Amount'],
    [{ ...base, amountNaira: '10.555' }, 'decimal'],
    [{ ...base, amountNaira: 'abc' }, 'Amount'],
    [{ ...base, description: 'ab' }, 'Description'],
    [{ ...base, expenseDate: '2026-11-19' }, 'future'],
    [{ ...base, expenseDate: '18/11/2026' }, 'date'],
    [{ ...base, locationId: 'nope' }, 'location'],
  ])('rejects %o', (body, word) => {
    const r = parseExpenseInput(body, NOW);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain(word);
  });

  it('records the signed-in admin, not anything the browser sent', () => {
    const r = parseExpenseInput({ ...base, recorded_by: 'someone@else', locationId: LOC }, NOW);
    expect(r.ok && expenseRow(r.value, 'connectly.hq@outlook.com')).toEqual({
      category: 'backhaul', amount_ngn: 45000, location_id: LOC, description: 'Starlink monthly subscription',
      expense_date: '2026-11-18', recorded_by: 'connectly.hq@outlook.com',
    });
  });
});

describe('expense routes', () => {
  it('POST stores the expense and logs who recorded it', async () => {
    fake = createFakeDb((op) => (op.table === 'expenses' ? { data: { id: EXP }, error: null } : { data: null, error: null }));
    const { POST } = await import('@/app/api/admin/expenses/route');
    const res = await POST(new Request('https://x/api/admin/expenses', { method: 'POST', body: JSON.stringify({ ...base, expenseDate: '2026-11-01' }) }));
    expect(res.status).toBe(201);
    const insert = fake.ops.find((o) => o.table === 'expenses' && o.action === 'insert');
    expect(insert?.values).toMatchObject({ amount_ngn: 45000, recorded_by: 'connectly.hq@outlook.com' });
    const log = fake.ops.find((o) => o.table === 'activity_logs');
    expect(log?.values).toMatchObject({ event_type: 'expense.created', entity_id: EXP });
  });

  it('POST refuses bad input without writing', async () => {
    fake = createFakeDb(() => ({ data: null, error: null }));
    const { POST } = await import('@/app/api/admin/expenses/route');
    const res = await POST(new Request('https://x/api/admin/expenses', { method: 'POST', body: JSON.stringify({ ...base, amountNaira: 0 }) }));
    expect(res.status).toBe(400);
    expect(fake.ops).toHaveLength(0);
  });

  it('DELETE removes it and keeps the full record in the activity log', async () => {
    const row = { id: EXP, category: 'power', amount_ngn: 12000, location_id: LOC, description: 'Diesel', expense_date: '2026-11-10', recorded_by: 'connectly.hq@outlook.com' };
    fake = createFakeDb((op) => (op.table === 'expenses' ? { data: [row], error: null } : { data: null, error: null }));
    const { DELETE } = await import('@/app/api/admin/expenses/[id]/route');
    const res = await DELETE(new Request('https://x', { method: 'DELETE' }), { params: Promise.resolve({ id: EXP }) });
    expect(res.status).toBe(200);
    expect(fake.ops.find((o) => o.table === 'expenses')).toMatchObject({ action: 'delete', filters: [['id', EXP]] });
    const log = fake.ops.find((o) => o.table === 'activity_logs');
    expect(log?.values).toMatchObject({ event_type: 'expense.deleted', metadata: { operator: 'connectly.hq@outlook.com', removed: row } });
  });

  it('DELETE answers 404 for an unknown or malformed id', async () => {
    fake = createFakeDb(() => ({ data: [], error: null }));
    const { DELETE } = await import('@/app/api/admin/expenses/[id]/route');
    expect((await DELETE(new Request('https://x'), { params: Promise.resolve({ id: EXP }) })).status).toBe(404);
    expect((await DELETE(new Request('https://x'), { params: Promise.resolve({ id: 'x' }) })).status).toBe(404);
  });
});
