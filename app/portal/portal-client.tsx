'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Script from 'next/script';
import { supabaseBrowser } from '../../lib/db/browser';
import { CheckCircle2, Loader2, Wifi, Phone } from 'lucide-react';

export default function PortalClient({ 
  plans, 
  location, 
  mac, 
  ip, 
  routerId 
}: { 
  plans: any[], 
  location: any,
  mac: string,
  ip: string,
  routerId: string
}) {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [reference, setReference] = useState('');

  const BRAND = { burgundy: '#6d1825', sand: '#cfa253' };

  // Poll Supabase for webhook updates
  useEffect(() => {
    if (!reference) return;

    const interval = setInterval(async () => {
      const { data, error } = await supabaseBrowser
        .from('purchases')
        .select('status')
        .eq('reference', reference)
        .single();

      if (error) {
        console.error('Polling error:', error.message);
        return;
      }

      if (data?.status === 'success') {
        setStep(4);
        clearInterval(interval);
      } else if (data?.status === 'failed') {
        setStep(5);
        clearInterval(interval);
      }
    }, 3000); 

    return () => clearInterval(interval);
  }, [reference]);

  const handleInitiate = async () => {
    setStep(3);

    try {
      const res = await fetch('/api/purchase/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          planId: selectedPlan.id, 
          phoneNumber, 
          location_id: location.id,
          macAddress: mac,
          routerId: routerId
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to initiate purchase');

      setReference(data.reference);

      if (typeof window === 'undefined' || !(window as any).PaystackPop) {
        throw new Error('Paystack script is still loading. Please try again.');
      }

      const handler = (window as any).PaystackPop.setup({
        key: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || '',
        email: data.email || `${phoneNumber}@connectly.app`,
        amount: data.amount_kobo || selectedPlan.price_kobo,
        ref: data.reference,
        currency: 'NGN',
        channels: ['bank_transfer', 'card'],
        callback: (response: any) => {
          console.log('Paystack success response:', response);
        },
        onClose: () => {
          setStep((prevStep) => (prevStep < 4 ? 2 : prevStep));
        },
      });

      handler.openIframe();
      
    } catch (error) {
      console.error(error);
      setStep(2);
    }
  };

  if (step === 4) {
    return (
      <div className="max-w-md w-full mx-auto text-center space-y-6 p-8 bg-white rounded-xl shadow-sm mt-10 border-t-4" style={{ borderColor: BRAND.burgundy }}>
        <CheckCircle2 className="h-20 w-20 mx-auto text-green-500" />
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Connected!</h2>
          <p className="text-gray-500 mt-2">Your device has been authorized on the network.</p>
        </div>
        <button onClick={() => window.location.reload()} className="text-sm font-medium hover:underline" style={{ color: BRAND.burgundy }}>
          Connect another device
        </button>
      </div>
    );
  }

  if (step === 5) {
    return (
      <div className="max-w-md w-full mx-auto text-center space-y-6 p-8 bg-white rounded-xl shadow-sm mt-10 border-t-4" style={{ borderColor: BRAND.sand }}>
        <Wifi className="h-16 w-16 mx-auto text-gray-400" />
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Payment Verified</h2>
          <p className="text-gray-500 mt-2 text-sm">
            We couldn't auto-connect this device, but your plan is active. Please log in manually.
          </p>
        </div>
        
        <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
          <p className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">Your Access Code</p>
          <p className="text-3xl font-mono font-bold tracking-wider" style={{ color: BRAND.burgundy }}>
            {phoneNumber}
          </p>
        </div>

        <div className="space-y-3">
          <a href={`http://${ip}/login`} target="_blank" rel="noreferrer" 
             className="block w-full py-3 rounded-lg text-white font-bold transition-opacity"
             style={{ backgroundColor: BRAND.burgundy }}>
            Go to Login Page
          </a>
          <button className="text-sm font-medium text-gray-500 hover:text-gray-900">
            Contact Support
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md w-full mx-auto mt-10 space-y-6">
      <Script src="https://js.paystack.co/v1/inline.js" strategy="lazyOnload" />
      
      <div className="flex justify-center mb-8">
        <Image src="/connectly-logo-horizontal.svg" alt="Connectly Logo" width={240} height={60} priority />
      </div>

      <div className="space-y-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden transition-all">
          <div className="p-4 flex items-center justify-between bg-gray-50 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full text-white" style={{ backgroundColor: step === 1 ? BRAND.burgundy : '#d1d5db' }}>
                <Wifi size={18} />
              </div>
              <h2 className="font-semibold text-gray-900">1. Select Data Plan</h2>
            </div>
            {step > 1 && (
              <button onClick={() => setStep(1)} className="text-sm font-medium hover:underline" style={{ color: BRAND.burgundy }}>Edit</button>
            )}
          </div>
          
          {step === 1 ? (
            <div className="p-4 space-y-3">
              {plans.map((plan: any) => (
                <button 
                  key={plan.id} 
                  onClick={() => { setSelectedPlan(plan); setStep(2); }} 
                  className="w-full p-4 border rounded-lg text-left transition-all hover:border-gray-400 focus:ring-2 flex justify-between items-center group"
                  style={{ outlineColor: BRAND.sand }}
                >
                  <span className="font-bold text-gray-800">{plan.name}</span>
                  <span className="font-bold text-lg" style={{ color: BRAND.burgundy }}>₦{plan.price_kobo / 100}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="p-4 flex justify-between items-center bg-white text-gray-600">
              <span>{selectedPlan?.name}</span>
              <span className="font-semibold">₦{selectedPlan?.price_kobo / 100}</span>
            </div>
          )}
        </div>

        <div className={`bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden transition-all ${step < 2 ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="p-4 flex items-center justify-between bg-gray-50 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full text-white" style={{ backgroundColor: step === 2 ? BRAND.burgundy : '#d1d5db' }}>
                <Phone size={18} />
              </div>
              <h2 className="font-semibold text-gray-900">2. Device Login Details</h2>
            </div>
          </div>
          
          {step === 2 && (
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Enter Phone Number (This will be your password)</label>
                <input 
                  type="tel" 
                  value={phoneNumber} 
                  onChange={(e) => setPhoneNumber(e.target.value)} 
                  placeholder="080..." 
                  className="w-full p-4 border border-gray-300 rounded-lg outline-none text-lg tracking-wide focus:ring-2 focus:ring-[#cfa253]" 
                />
              </div>
              <button 
                onClick={handleInitiate} 
                disabled={!phoneNumber || phoneNumber.length < 10} 
                className="w-full text-white p-4 rounded-lg font-bold text-lg transition-opacity disabled:opacity-50"
                style={{ backgroundColor: BRAND.burgundy }}
              >
                Pay ₦{selectedPlan?.price_kobo / 100}
              </button>
            </div>
          )}
        </div>

        {step === 3 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center space-y-4 border-t-4" style={{ borderColor: BRAND.sand }}>
             <Loader2 className="h-10 w-10 animate-spin mx-auto" style={{ color: BRAND.burgundy }} />
             <h3 className="font-semibold text-gray-900">Awaiting Payment...</h3>
             <p className="text-sm text-gray-500">Complete the transaction in the Paystack popup.</p>
          </div>
        )}
      </div>
    </div>
  );
}