'use client';

import { useState } from 'react';
// Ensure this path matches where you created the server action
import { initializeKoraCheckout } from '../actions/payment'; 
import CodeLogin from './code-login';

interface Plan {
  id: string;
  name: string;
  price_kobo: number;
  speed_down_mbps: number | null;
  duration_seconds: number | null;
  device_limit: number | null;
}

/** "1 day", "3 hours", "30 minutes". */
function fmtDuration(sec: number | null): string | null {
  if (!sec || sec <= 0) return null;
  const unit = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
  if (sec % 86400 === 0) return unit(sec / 86400, 'day');
  if (sec % 3600 === 0) return unit(sec / 3600, 'hour');
  return unit(Math.round(sec / 60), 'minute');
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
  /** The router's own login page, for customers who already have a code. */
  loginUrl: string | null;
}

export default function PortalClient({ mac, ip, routerId, location, plans, loginUrl }: PortalClientProps) {
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
      // The server prices the plan from the database; the browser sends no amount.
      const result = await initializeKoraCheckout({
        mac,
        ip,
        routerId,
        locationId: location.id,
        planId: selectedPlan.id,
        phone
      });

      if (!result.ok) {
        alert(result.error);
        setIsProcessing(false);
        return;
      }

      // Redirect the user to the Kora-hosted payment page
      window.location.href = result.checkoutUrl;
    } catch (error) {
      console.error("Checkout Error:", error);
      alert("Unable to start payment. Please check your connection and try again.");
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
                    <span>
                      <span className="block font-medium text-gray-900">{plan.name}</span>
                      <span className="block text-xs text-gray-500">
                        {[fmtDuration(plan.duration_seconds), plan.speed_down_mbps ? `up to ${plan.speed_down_mbps} Mbps` : null, (plan.device_limit ?? 1) > 1 ? `${plan.device_limit} devices` : null].filter(Boolean).join(' · ')}
                      </span>
                    </span>
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

        {loginUrl && (
          <div className="mt-8 border-t border-gray-100 pt-6">
            <CodeLogin loginUrl={loginUrl} />
          </div>
        )}
      </div>
    </main>
  );
}