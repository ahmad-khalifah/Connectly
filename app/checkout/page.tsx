'use client';

import { useState } from 'react';
import { usePaystackPayment } from 'react-paystack';
import { useRouter } from 'next/navigation';

interface CheckoutFormProps {
  plan: { id: string; name: string; priceNaira: number };
  phoneNumber: string;
  locationSlug: string;
}

export default function CheckoutForm({ plan, phoneNumber, locationSlug }: CheckoutFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  // Initialize with dummy values; these are overridden dynamically after the backend fetch
  const [paystackConfig, setPaystackConfig] = useState({
    publicKey: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || '',
    reference: '',
    email: '',
    amount: 0,
    currency: 'NGN',
  });

  const initializePayment = usePaystackPayment(paystackConfig);

  const handlePayment = async () => {
    setLoading(true);
    setError('');

    try {
      // 1. Call your backend to generate the reference and dummy email
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

      // 2. Trigger the Paystack modal with the exact data from the backend
      const dynamicConfig = {
        ...paystackConfig,
        reference: data.reference,
        email: data.email,
        amount: data.amount_kobo,
      };

      // @ts-ignore - react-paystack allows overriding config at call time but types sometimes miss it
      initializePayment(
        () => {
          // onSuccess callback
          router.push(`/connect?loc=${locationSlug}&status=success`);
        },
        () => {
          // onClose callback
          setLoading(false);
        },
        dynamicConfig
      );

    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
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