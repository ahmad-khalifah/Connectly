import { NextResponse } from 'next/server';
import { db } from '../../../../../lib/db/client';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 1. Attempt a hard delete first
    const { error } = await db
      .from('plans')
      .delete()
      .eq('id', id);

    // 2. Catch the PostgreSQL Foreign Key Constraint Error (Code 23503)
    if (error && error.code === '23503') {
      // Fallback to Soft Delete (Archive)
      const { error: updateError } = await db
        .from('plans')
        .update({ is_active: false })
        .eq('id', id);

      if (updateError) {
        return NextResponse.json({ success: false, message: 'Failed to archive plan.' }, { status: 400 });
      }

      return NextResponse.json({ success: true, message: 'Plan archived (soft-deleted) due to existing purchase history.' });
    } 
    
    if (error) {
      return NextResponse.json({ success: false, message: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: 'Plan permanently deleted.' });
  } catch (error) {
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}