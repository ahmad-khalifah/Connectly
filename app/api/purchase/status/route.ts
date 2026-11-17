import { NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { reconcilePurchase } from '@/lib/payments/ledger';
import { accessForPurchase, connectLink } from '@/lib/network/customer-access';

// Payment status for the customer's return page, looked up by the payment
// reference (an unguessable UUID). Returns no personal data. Once paid it
// returns the voucher: the reference is the customer's receipt, and they
// need the voucher to log in (it is also sent to their phone).
//
// With ?check=1, a still-pending purchase is re-checked with Korapay's
// verify API, which Korapay documents as the expected step after a
// checkout redirect. Limited to recent pending purchases.

const REF_RE = /^CONN_[0-9a-f-]{36}$/i;
const CHECK_WINDOW_MS = 2 * 60 * 60 * 1000;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const reference = url.searchParams.get('reference') ?? url.searchParams.get('ref') ?? '';
  if (!REF_RE.test(reference)) {
    return NextResponse.json({ message: 'Invalid reference' }, { status: 400 });
  }

  const load = () =>
    db
      .from('purchases')
      .select('id, router_id, status, created_at, expires_at, amount_kobo, plans(name), locations(name)')
      .eq('reference', reference)
      .maybeSingle();

  let { data: p } = await load();
  if (!p) return NextResponse.json({ status: 'not_found' }, { status: 404 });

  const recent = Date.now() - new Date(p.created_at).getTime() < CHECK_WINDOW_MS;
  if (url.searchParams.get('check') === '1' && p.status === 'pending' && recent) {
    try {
      await reconcilePurchase(reference);
      ({ data: p } = await load());
    } catch (error) {
      console.error('[STATUS_RECHECK_FAILED]', reference, error);
    }
  }
  if (!p) return NextResponse.json({ status: 'not_found' }, { status: 404 });

  const plan = (Array.isArray(p.plans) ? p.plans[0] : p.plans) as { name?: string } | null;
  const location = (Array.isArray(p.locations) ? p.locations[0] : p.locations) as { name?: string } | null;

  return NextResponse.json(
    {
      status: p.status,
      planName: plan?.name ?? null,
      locationName: location?.name ?? null,
      amountNaira: p.amount_kobo ? p.amount_kobo / 100 : null,
      expiresAt: p.expires_at,
      access: p.status === 'paid' ? await accessView(p.id, p.router_id) : null,
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

async function accessView(purchaseId: string, routerId: string | null) {
  const a = await accessForPurchase(purchaseId, routerId);
  if (!a) return null;
  return { voucher: a.voucher, ready: a.ready, ended: a.ended, devices: a.devices, connectUrl: connectLink(a.loginUrl, a.voucher) };
}
