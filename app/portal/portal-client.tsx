'use client';

import { useState } from 'react';
// Ensure this path matches where you created the server action
import { initializeKoraCheckout } from '../actions/payment'; 

interface Plan {
  id: string;
  name: string;
  price_kobo: number;
  download_limit_kbps: number | null;
}

interface Location {
  id: string;
  name: string;
  slug: string;
}

interface PortalClientProps {
  mac: string;
  ip: string;
  routerId: string;
  location: Location;
  plans: Plan[];
}

export default function PortalClient({ mac, ip, routerId, location, plans }: PortalClientProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string>(plans[0]?.id || '');
  const [phone, setPhone] = useState('');

  const selectedPlan = plans.find(p => p.id === selectedPlanId);
  const priceNaira = selectedPlan ? selectedPlan.price_kobo / 100 : 0;

  const triggerKoraPayment = async () => {
    // 1. We removed the window.Korapay check here entirely
    
    if (!selectedPlan || !phone) {
      alert("Please enter your phone number and select a plan.");
      return;
    }

    setIsProcessing(true);
    
    try {
      // 2. We now call the secure backend action
      const checkoutUrl = await initializeKoraCheckout({
        amount: priceNaira,
        mac,
        ip,
        routerId,
        planId: selectedPlan.id,
        phone
      });

      // 3. Redirect the user to the Kora-hosted payment page
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
      } else {
        throw new Error("No checkout URL returned from Kora");
      }

    } catch (error) {
      console.error("Checkout Error:", error);
      alert("Unable to start payment. Please check your console for details.");
      setIsProcessing(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Connectly Wi-Fi</h1>
          <p className="text-gray-500 text-sm mt-1">{location.name}</p>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
            <input 
              type="tel" 
              placeholder="080XXXXXXXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-[#6d1825]"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Select a Plan</label>
            <div className="space-y-3">
              {plans.map((plan) => (
                <label 
                  key={plan.id} 
                  className={`flex items-center justify-between p-4 border rounded-lg cursor-pointer transition-colors ${
                    selectedPlanId === plan.id ? 'border-[#6d1825] bg-[#6d1825]/5' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input 
                      type="radio" 
                      name="plan"
                      value={plan.id}
                      checked={selectedPlanId === plan.id}
                      onChange={(e) => setSelectedPlanId(e.target.value)}
                      className="text-[#6d1825] focus:ring-[#6d1825]"
                    />
                    <span className="font-medium text-gray-900">{plan.name}</span>
                  </div>
                  <span className="font-bold text-gray-900">₦{plan.price_kobo / 100}</span>
                </label>
              ))}
            </div>
          </div>

          <button 
            onClick={triggerKoraPayment}
            disabled={isProcessing || !phone}
            className="w-full bg-[#6d1825] text-white py-3.5 rounded-lg font-bold hover:bg-[#5a141e] disabled:opacity-50 transition-colors mt-4"
          >
            {isProcessing ? 'Connecting to secure gateway...' : `Pay ₦${priceNaira}`}
          </button>
        </div>
      </div>
    </main>
  );
}