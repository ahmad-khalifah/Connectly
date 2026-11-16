'use client';

import { useState } from 'react';
import Script from 'next/script';
import { useRouter } from 'next/navigation';

export default function CheckoutForm({ planId, priceNaira, phone }: { planId: string, priceNaira: number, phone: string }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const router = useRouter();

  const triggerKoraPayment = () => {
    setIsProcessing(true);
    
    // @ts-ignore - Kora is injected globally via the Script tag
    window.Korapay.initialize({
      key: process.env.NEXT_PUBLIC_KORA_PUBLIC_KEY,
      amount: priceNaira, 
      currency: "NGN",
      reference: `CONN_${Date.now()}`,
      customer: {
        name: "Connectly User",
        email: `${planId}@connectly.net`, // Passing planId through email metadata
        phone: phone
      },
      onClose: function () {
        console.log('Payment modal closed');
        setIsProcessing(false);
      },
      onSuccess: function (data: any) {
        console.log('Payment successful', data);
        // The webhook handles the DB insert. Redirect the user to a success page.
        router.push('/success'); 
      }
    });
  };

  return (
    <>
      {/* Next.js optimized script loading */}
      <Script 
        src="https://korapay.com/assets/js/KorapayPayInline.js" 
        strategy="lazyOnload"
      />

      <button 
        onClick={triggerKoraPayment}
        disabled={isProcessing}
        className="w-full bg-[#6d1825] text-white py-3 rounded-lg font-bold hover:bg-[#5a141e] disabled:opacity-50 transition-colors"
      >
        {isProcessing ? 'Initializing...' : `Pay ₦${priceNaira}`}
      </button>
    </>
  );
}