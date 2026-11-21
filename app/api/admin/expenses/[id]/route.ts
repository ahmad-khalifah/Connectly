import { db } from '@/lib/db/client';
import { requireAdminApi } from '@/lib/auth/admin';
import { isUuid } from '@/lib/admin/inputs';
import { logAdminAction } from '@/lib/admin/audit';

// Remove an expense recorded by mistake. The full record is kept in the
// activity log, with who removed it, so the change can be traced.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, denied } = await requireAdminApi(req);
  if (denied) return denied;

  const { id } = await params;
  if (!isUuid(id)) return Response.json({ message: 'Expense not found.' }, { status: 404 });

  const { data, error } = await db.from('expenses').delete().eq('id', id).select('*');
  if (error) {
    console.error('[EXPENSE_DELETE_ERROR]', error);
    return Response.json({ message: 'Could not remove the expense.' }, { status: 500 });
  }
  const removed = (data ?? [])[0] as Record<string, unknown> | undefined;
  if (!removed) return Response.json({ message: 'Expense not found.' }, { status: 404 });

  await logAdminAction(user, 'expense.deleted', `Expense of ₦${Number(removed.amount_ngn).toLocaleString('en-NG')} (${removed.category}) removed`, id, {
    locationId: (removed.location_id as string | null) ?? null,
    metadata: { removed },
  });
  return Response.json({ success: true });
}
