'use client';

import { useState } from 'react';
import { usePaystackPayment } from 'react-paystack';
import { useRouter } from 'next/navigation';

export default function CheckoutForm({ plan, phoneNumber, locationSlug }: any) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const [paystackConfig] = useState({
    publicKey: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || '',
    reference: '',
    email: `${phoneNumber}@campusnet.local`,
    amount: (plan?.price || 500) * 100, 
    currency: 'NGN',
  });

  const initializePayment = usePaystackPayment(paystackConfig);

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

      const dynamicConfig = {
        ...paystackConfig,
        reference: data.reference,
        amount: data.amount_kobo || (plan?.price || 500) * 100, 
      };

      // @ts-ignore
      initializePayment(
        () => {
          router.push(`/status?ref=${data.reference}`);
        },
        () => {
          setLoading(false);
        },
        dynamicConfig
      );
    } catch (error) {
      console.error(error);
      setLoading(false);
    }
  };

  return (
    <button 
      onClick={handlePayment} 
      disabled={loading}
      className="w-full rounded-lg bg-blue-600 py-3 text-sm font-medium text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
    >
      {loading ? 'Processing...' : 'Pay with Paystack'}
    </button>
  );
}