import { NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { requireAdminApi } from '@/lib/auth/admin';
import { expenseRow, friendlyDbError, parseExpenseInput } from '@/lib/admin/inputs';
import { logAdminAction } from '@/lib/admin/audit';

// Record an operating expense. The signed-in admin is recorded as the
// person who logged it; the browser cannot choose that.
export async function POST(req: Request) {
  const { user, denied } = await requireAdminApi();
  if (denied) return denied;

  const parsed = parseExpenseInput(await req.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ message: parsed.error }, { status: 400 });

  const row = expenseRow(parsed.value, user.email ?? 'admin');
  const { data, error } = await db.from('expenses').insert(row).select('id').single();
  if (error || !data) {
    console.error('[EXPENSE_CREATE_ERROR]', error);
    return NextResponse.json({ message: friendlyDbError(error, 'Could not record the expense.') }, { status: 500 });
  }

  await logAdminAction(user, 'expense.created', `Expense of ₦${parsed.value.amountNaira.toLocaleString('en-NG')} (${parsed.value.category}) recorded`, data.id, {
    locationId: parsed.value.locationId,
    metadata: row,
  });
  return NextResponse.json({ data }, { status: 201 });
}
