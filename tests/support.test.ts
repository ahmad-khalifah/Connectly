import { describe, it, expect, vi } from 'vitest';
import { createFakeDb } from './fake-db';

let fake: ReturnType<typeof createFakeDb>;
vi.mock('@/lib/db/client', () => ({ get db() { return fake.db; } }));
vi.mock('@/lib/auth/admin', () => ({
  requireAdminApi: async () => ({ user: { id: 'u1', email: 'connectly.hq@outlook.com' }, denied: null }),
}));

const T = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const patch = async (status: unknown, id = T, extra: object = {}) => {
  const { PATCH } = await import('@/app/api/admin/support/[id]/route');
  return PATCH(new Request('https://x', { method: 'PATCH', body: JSON.stringify({ status, ...extra }) }), { params: Promise.resolve({ id }) });
};

describe('support ticket status', () => {
  it('resolves a ticket, records who did it and logs it', async () => {
    fake = createFakeDb((op) => (op.table === 'support_tickets' ? { data: [{ id: T, ticket_number: 7, location_id: null }], error: null } : { data: null, error: null }));
    expect((await patch('resolved')).status).toBe(200);
    const upd = fake.ops.find((o) => o.table === 'support_tickets' && o.action === 'update');
    expect(upd?.values).toMatchObject({ status: 'resolved', assigned_to: 'connectly.hq@outlook.com' });
    expect((upd?.values as { resolved_at: string | null }).resolved_at).toBeTruthy();
    expect(fake.ops.find((o) => o.table === 'activity_logs')?.values).toMatchObject({ event_type: 'support.status_changed', message: 'Ticket #7 marked resolved' });
  });

  it('clears the resolved time when reopened', async () => {
    fake = createFakeDb((op) => (op.table === 'support_tickets' ? { data: [{ id: T, ticket_number: 7, location_id: null }], error: null } : { data: null, error: null }));
    await patch('open');
    expect(fake.ops.find((o) => o.action === 'update')?.values).toMatchObject({ status: 'open', resolved_at: null });
  });

  it('refuses an unknown status or id without writing', async () => {
    fake = createFakeDb(() => ({ data: [], error: null }));
    expect((await patch('closed')).status).toBe(400);
    expect((await patch('resolved', 'nope')).status).toBe(404);
    expect(fake.ops).toHaveLength(0);
  });

  it('keeps a note with the change in the activity log', async () => {
    fake = createFakeDb((op) => (op.table === 'support_tickets' ? { data: [{ id: T, ticket_number: 7, location_id: null }], error: null } : { data: null, error: null }));
    expect((await patch('resolved', T, { note: '  Test   enquiry, no action  ' })).status).toBe(200);
    expect(fake.ops.find((o) => o.table === 'activity_logs')?.values).toMatchObject({
      message: 'Ticket #7 marked resolved: Test enquiry, no action',
      metadata: { status: 'resolved', note: 'Test enquiry, no action' },
    });
  });

  it('refuses a note that is too long or not text', async () => {
    fake = createFakeDb(() => ({ data: [], error: null }));
    expect((await patch('resolved', T, { note: 'x'.repeat(501) })).status).toBe(400);
    expect((await patch('resolved', T, { note: 5 })).status).toBe(400);
    expect(fake.ops).toHaveLength(0);
  });
});
