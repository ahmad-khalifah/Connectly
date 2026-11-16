import { NextResponse } from 'next/server';
import { adminApiGuard } from '@/lib/auth/admin';
import { reconcilePurchase } from '@/lib/payments/ledger';

// Admin-only: re-check one payment with Korapay's verify API.
export async function POST(request: Request) {
  const denied = await adminApiGuard();
  if (denied) return denied;

  const { reference } = await request.json().catch(() => ({}));
  if (typeof reference !== 'string' || !/^CONN_[0-9a-f-]{36}$/i.test(reference)) {
    return NextResponse.json({ message: 'Invalid reference' }, { status: 400 });
  }

  try {
    const result = await reconcilePurchase(reference);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[ADMIN_RECONCILE_ERROR]', reference, error);
    return NextResponse.json({ message: 'Could not reach Korapay. Try again.' }, { status: 502 });
  }
}
