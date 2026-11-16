import { NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { requireAdminApi } from '@/lib/auth/admin';
import { isUuid, parsePlanInput, planRow } from '@/lib/admin/inputs';
import { logAdminAction } from '@/lib/admin/audit';

type Ctx = { params: Promise<{ id: string }> };

// Edit a plan. Price and duration changes apply to purchases started after the
// edit: each purchase stores the amount it was charged (purchases.amount_kobo).
export async function PATCH(request: Request, { params }: Ctx) {
  const { user, denied } = await requireAdminApi();
  if (denied) return denied;

  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ message: 'Plan not found.' }, { status: 404 });

  const body = await request.json().catch(() => null);

  // Archive / restore only.
  if (body && typeof body === 'object' && Object.keys(body).length === 1 && typeof body.isActive === 'boolean') {
    const { data, error } = await db.from('plans').update({ is_active: body.isActive }).eq('id', id).select('id, name');
    if (error) return NextResponse.json({ message: 'Could not update the plan.' }, { status: 500 });
    if (!data?.length) return NextResponse.json({ message: 'Plan not found.' }, { status: 404 });
    await logAdminAction(user, body.isActive ? 'plan.restored' : 'plan.archived', `Plan "${data[0].name}" ${body.isActive ? 'restored' : 'archived'}`, id);
    return NextResponse.json({ success: true });
  }

  const parsed = parsePlanInput(body);
  if (!parsed.ok) return NextResponse.json({ message: parsed.error }, { status: 400 });

  const { data, error } = await db.from('plans').update(planRow(parsed.value)).eq('id', id).select('id');
  if (error) {
    console.error('[PLAN_UPDATE_ERROR]', error);
    return NextResponse.json({ message: 'Could not update the plan.' }, { status: 500 });
  }
  if (!data?.length) return NextResponse.json({ message: 'Plan not found.' }, { status: 404 });

  await logAdminAction(user, 'plan.updated', `Plan "${parsed.value.name}" updated`, id, { metadata: planRow(parsed.value) });
  return NextResponse.json({ success: true });
}

// "Delete" archives the plan (is_active = false) and never hard-deletes it, so
// its purchase history is always kept.
export async function DELETE(_request: Request, { params }: Ctx) {
  const { user, denied } = await requireAdminApi();
  if (denied) return denied;

  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ success: false, message: 'Plan not found.' }, { status: 404 });

  const { data, error } = await db.from('plans').update({ is_active: false }).eq('id', id).select('id, name');
  if (error) {
    console.error('[PLAN_ARCHIVE_ERROR]', error);
    return NextResponse.json({ success: false, message: 'Failed to archive plan.' }, { status: 400 });
  }
  if (!data?.length) return NextResponse.json({ success: false, message: 'Plan not found.' }, { status: 404 });

  await logAdminAction(user, 'plan.archived', `Plan "${data[0].name}" archived`, id);
  return NextResponse.json({
    success: true,
    message: 'Plan archived. It is hidden from customers and its purchase history is kept.',
  });
}
