import { requireAdminApi } from '@/lib/auth/admin';
import { isUuid } from '@/lib/admin/inputs';
import { logAdminAction } from '@/lib/admin/audit';
import { resendVoucher } from '@/lib/network/access';

// Texts the WiFi code again to the phone that paid for it.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, denied } = await requireAdminApi(req);
  if (denied) return denied;

  const { id } = await params;
  if (!isUuid(id)) return Response.json({ message: 'Access grant not found.' }, { status: 404 });

  const result = await resendVoucher(id);
  if (!result.ok) return Response.json({ message: result.message }, { status: result.status });
  await logAdminAction(user, 'access.voucher_resent', 'WiFi code resent by SMS to the paying phone', id);
  return Response.json({ sent: true });
}
