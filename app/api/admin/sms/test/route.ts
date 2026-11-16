import { NextResponse } from 'next/server';
import { adminApiGuard } from '@/lib/auth/admin';
import { db } from '@/lib/db/client';
import { normaliseNigerianMobile } from '@/lib/phone';
import { deliverNotification } from '@/lib/payments/ledger';

// Admin-only replacement for the old public "Send test SMS" button.
// Sends a fixed message (admins cannot choose the text) and records it.
export async function POST(request: Request) {
  const denied = await adminApiGuard();
  if (denied) return denied;

  const { phone } = await request.json().catch(() => ({}));
  const to = normaliseNigerianMobile(phone);
  if (!to) return NextResponse.json({ message: 'Enter a valid Nigerian mobile number.' }, { status: 400 });

  const body = 'Connectly test message: SMS delivery is working.';
  const { data: row, error } = await db
    .from('notifications')
    .insert({ recipient: to, template: 'admin_test', body })
    .select('id')
    .single();
  if (error || !row) {
    console.error('[SMS_TEST_INSERT_ERROR]', error);
    return NextResponse.json({ message: 'Could not record the test message.' }, { status: 500 });
  }

  const result = await deliverNotification(row.id, to, body);
  return result.ok
    ? NextResponse.json({ ok: true, messageId: result.messageId })
    : NextResponse.json({ ok: false, message: result.error }, { status: 502 });
}
