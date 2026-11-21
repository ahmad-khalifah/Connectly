import PaymentStatus from './payment-status';
import { PortalShell } from '@/components/portal/portal-shell';
import { Notice } from '@/components/ui/notice';

// Korapay redirects the customer here after checkout. The redirect itself
// proves nothing; the status shown comes from our ledger, which only a
// Korapay-verified payment can mark as paid.
export default async function SuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ reference?: string | string[] }>;
}) {
  // Korapay appends its own ?reference= to our redirect URL, so the page can
  // receive the parameter twice (found on staging, 18 Nov). Use ours: CONN_<uuid>.
  const raw = (await searchParams).reference;
  const reference = (Array.isArray(raw) ? raw : [raw]).find((r): r is string => typeof r === 'string' && /^CONN_[0-9a-f-]{36}$/i.test(r));

  return (
    <PortalShell>
      {reference ? (
        <>
          <PaymentStatus reference={reference} />
          <p className="mt-8 border-t border-line pt-4 text-[13px] text-muted">
            Payment reference
            <span className="mt-0.5 block break-all font-semibold text-ink">{reference}</span>
          </p>
        </>
      ) : (
        <Notice tone="warn" title="No payment reference">
          Join the Connectly WiFi to choose a plan. If you have paid, open the link from your payment again.
        </Notice>
      )}
    </PortalShell>
  );
}
