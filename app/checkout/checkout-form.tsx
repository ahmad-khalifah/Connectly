'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Script from 'next/script';

export default function CheckoutForm({ plan, phoneNumber, locationSlug }: any) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handlePayment = async () => {
    setLoading(true);

    try {
      const res = await fetch('/api/purchase/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: plan?.id, phoneNumber, locationSlug })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      if (typeof window === 'undefined' || !(window as any).PaystackPop) {
        throw new Error('Paystack script is still loading. Please try again.');
      }

      const handler = (window as any).PaystackPop.setup({
        key: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || '',
        email: `${phoneNumber}@campusnet.local`,
        amount: data.amount_kobo || (plan?.price || 500) * 100,
        ref: data.reference,
        currency: 'NGN',
        callback: () => {
          router.push(`/status?ref=${data.reference}`);
        },
        onClose: () => {
          setLoading(false);
        },
      });

      handler.openIframe();
    } catch (error) {
      console.error(error);
      setLoading(false);
    }
  };

  return (
    <>
      <Script src="https://js.paystack.co/v1/inline.js" strategy="afterInteractive" />
      <button 
        onClick={handlePayment} 
        disabled={loading}
        className="w-full rounded-lg bg-blue-600 py-3 text-sm font-medium text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
      >
        {loading ? 'Processing...' : 'Pay with Paystack'}
      </button>
    </>
  );
}