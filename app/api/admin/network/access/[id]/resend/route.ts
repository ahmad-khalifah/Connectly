import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/auth/admin';
import { isUuid } from '@/lib/admin/inputs';
import { logAdminAction } from '@/lib/admin/audit';
import { resendVoucher } from '@/lib/network/access';

// Texts the WiFi code again to the phone that paid for it.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, denied } = await requireAdminApi();
  if (denied) return denied;

  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ message: 'Access grant not found.' }, { status: 404 });

  const result = await resendVoucher(id);
  if (!result.ok) return NextResponse.json({ message: result.message }, { status: result.status });
  await logAdminAction(user, 'access.voucher_resent', 'WiFi code resent by SMS to the paying phone', id);
  return NextResponse.json({ sent: true });
}
