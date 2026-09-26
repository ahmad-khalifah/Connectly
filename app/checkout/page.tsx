'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Script from 'next/script';

interface CheckoutFormProps {
  plan: { id: string; name: string; priceNaira: number };
  phoneNumber: string;
  locationSlug: string;
}

export default function CheckoutForm({ plan, phoneNumber, locationSlug }: CheckoutFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handlePayment = async () => {
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/purchases/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: plan.id,
          phoneNumber,
          location_id: locationSlug, 
          macAddress: '00:00:00:00:00:00' 
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Failed to initialize payment');
      }

      const data = await res.json();

      if (typeof window === 'undefined' || !(window as any).PaystackPop) {
        throw new Error('Paystack script is still loading. Please try again.');
      }

      const handler = (window as any).PaystackPop.setup({
        key: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || '',
        email: data.email,
        amount: data.amount_kobo,
        ref: data.reference,
        currency: 'NGN',
        callback: () => {
          router.push(`/connect?loc=${locationSlug}&status=success`);
        },
        onClose: () => {
          setLoading(false);
        },
      });

      handler.openIframe();

    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Script src="https://js.paystack.co/v1/inline.js" strategy="afterInteractive" />
      
      {error && <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200">{error}</div>}
      
      <button
        onClick={handlePayment}
        disabled={loading}
        className="w-full bg-[#6d1825] text-white font-bold py-3 px-4 rounded-lg hover:bg-[#5a141e] transition-colors disabled:opacity-50"
      >
        {loading ? 'Initializing...' : `Pay ₦${plan.priceNaira}`}
      </button>
    </div>
  );
}