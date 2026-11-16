import PaymentStatus from './payment-status';

// Korapay redirects the customer here after checkout. The redirect itself
// proves nothing; the status shown comes from our ledger, which only a
// Korapay-verified payment can mark as paid.
export default async function SuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ reference?: string }>;
}) {
  const { reference } = await searchParams;
  const valid = typeof reference === 'string' && /^CONN_[0-9a-f-]{36}$/i.test(reference);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md bg-white p-8 rounded-xl shadow-sm border border-gray-100 text-center">
        {valid ? (
          <PaymentStatus reference={reference} />
        ) : (
          <>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">No payment reference</h1>
            <p className="text-gray-600">Return to the Wi-Fi page to choose a plan.</p>
          </>
        )}
        {valid && (
          <p className="mt-6 text-xs text-gray-500">
            Payment reference: <span className="font-mono text-gray-700 break-all">{reference}</span>
          </p>
        )}
      </div>
    </main>
  );
}
