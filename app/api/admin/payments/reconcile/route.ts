import { adminApiGuard } from '@/lib/auth/admin';
import { reconcilePurchase } from '@/lib/payments/ledger';

// Admin-only: re-check one payment with Korapay's verify API.
export async function POST(request: Request) {
  const denied = await adminApiGuard(request);
  if (denied) return denied;

  const { reference } = await request.json().catch(() => ({}));
  if (typeof reference !== 'string' || !/^CONN_[0-9a-f-]{36}$/i.test(reference)) {
    return Response.json({ message: 'Invalid reference' }, { status: 400 });
  }

  try {
    const result = await reconcilePurchase(reference);
    return Response.json(result);
  } catch (error) {
    console.error('[ADMIN_RECONCILE_ERROR]', reference, error);
    return Response.json({ message: 'Could not reach Korapay. Try again.' }, { status: 502 });
  }
}
