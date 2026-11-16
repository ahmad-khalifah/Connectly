import { Clock } from 'lucide-react';

// Korapay redirects the customer here after checkout. A redirect is NOT proof
// of payment (the customer may have cancelled or the charge may have failed),
// so this page grants nothing and claims nothing. Access is provisioned only
// from a verified Korapay webhook. A live status view keyed on the payment
// reference replaces this message in the payments stage.
export default async function SuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ reference?: string }>;
}) {
  const { reference } = await searchParams;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md bg-white p-8 rounded-xl shadow-sm border border-gray-100 text-center">
        <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <Clock className="h-8 w-8" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Confirming your payment</h1>
        <p className="text-gray-600">
          We are waiting for confirmation from our payment provider. Your Wi-Fi access will be activated
          once the payment is confirmed. If you were charged and are not connected within a few minutes,
          please contact Connectly support.
        </p>
        {reference && (
          <p className="mt-6 text-xs text-gray-500">
            Payment reference: <span className="font-mono text-gray-700">{reference}</span>
          </p>
        )}
      </div>
    </main>
  );
}
