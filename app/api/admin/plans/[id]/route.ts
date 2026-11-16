import { NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { adminApiGuard } from '@/lib/auth/admin';

// "Delete" archives the plan (is_active = false) and never hard-deletes it.
//
// Why: in the live database purchases.plan_id is ON DELETE CASCADE, so a hard
// delete silently erased every purchase made on the plan. The old code
// expected a foreign-key error (23503) that the cascade never raises.
// Archived plans disappear from the customer portal but keep their history.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await adminApiGuard();
  if (denied) return denied;

  try {
    const { id } = await params;

    const { data, error } = await db
      .from('plans')
      .update({ is_active: false })
      .eq('id', id)
      .select('id');

    if (error) {
      console.error('[PLAN_ARCHIVE_ERROR]', error);
      return NextResponse.json({ success: false, message: 'Failed to archive plan.' }, { status: 400 });
    }
    if (!data || data.length === 0) {
      return NextResponse.json({ success: false, message: 'Plan not found.' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Plan archived. It is hidden from customers and its purchase history is kept.',
    });
  } catch (error) {
    console.error('[PLAN_ARCHIVE_ERROR]', error);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}
