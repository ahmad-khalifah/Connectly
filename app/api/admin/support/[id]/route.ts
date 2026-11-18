import { NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { requireAdminApi } from '@/lib/auth/admin';
import { isUuid } from '@/lib/admin/inputs';
import { logAdminAction } from '@/lib/admin/audit';

const STATUSES = ['open', 'in_progress', 'resolved'] as const;

// Move a support ticket (or website enquiry) between open, in progress and resolved.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, denied } = await requireAdminApi();
  if (denied) return denied;

  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ message: 'Ticket not found.' }, { status: 404 });

  const body = (await req.json().catch(() => null)) as { status?: unknown } | null;
  const status = body?.status;
  if (typeof status !== 'string' || !(STATUSES as readonly string[]).includes(status)) {
    return NextResponse.json({ message: 'Status must be open, in progress or resolved.' }, { status: 400 });
  }

  const { data, error } = await db
    .from('support_tickets')
    .update({ status, assigned_to: user.email ?? null, resolved_at: status === 'resolved' ? new Date().toISOString() : null })
    .eq('id', id)
    .select('id, ticket_number, location_id');
  if (error) {
    console.error('[SUPPORT_UPDATE_ERROR]', error);
    return NextResponse.json({ message: 'The ticket was not updated.' }, { status: 500 });
  }
  const row = (data ?? [])[0] as { id: string; ticket_number: number; location_id: string | null } | undefined;
  if (!row) return NextResponse.json({ message: 'Ticket not found.' }, { status: 404 });

  await logAdminAction(user, 'support.status_changed', `Ticket #${row.ticket_number} marked ${status.replace('_', ' ')}`, id, { locationId: row.location_id, metadata: { status } });
  return NextResponse.json({ success: true });
}
