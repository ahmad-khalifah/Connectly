'use client';

import { useState } from 'react';
import { Wifi, Phone, Loader2, CheckCircle2, CreditCard, X, AlertCircle } from 'lucide-react';

const MOCK_PLANS = [
  { id: '1', name: '2 Hours Unlimited', price: 200 },
  { id: '2', name: '24 Hours Unlimited', price: 500 },
];

const BRAND = { burgundy: '#6d1825', sand: '#cfa253' };

export default function SimulatorPage() {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5 | 6>(1);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  
  // Simulated Monnify Payment state
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const triggerDummyPayment = () => {
    setShowPaymentModal(true);
  };

  const handlePaymentSuccess = () => {
    setShowPaymentModal(false);
    setStep(3); // Move to processing step
    
    // Simulate the webhook and Mikrotik network delay (3 seconds)
    setTimeout(() => {
      // Magic number to trigger fallback, otherwise success
      if (phoneNumber === '08099999999') {
        setStep(5); // Fallback
      } else {
        setStep(4); // Success
      }
    }, 3000);
  };

  const resetSimulator = () => {
    setStep(1);
    setSelectedPlan(null);
    setPhoneNumber('');
    setShowPaymentModal(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-10 relative">
      {/* Warning Banner */}
      <div className="max-w-md mx-auto mb-6 bg-blue-50 text-blue-800 p-3 rounded-lg text-sm text-center border border-blue-200">
        <strong>Simulator Mode:</strong> This page does not communicate with your database or Mikrotik router.
      </div>

      <div className="max-w-md w-full mx-auto space-y-4 px-4">
        
        {/* Step 1: Plan Selection */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 flex items-center justify-between bg-gray-50 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full text-white" style={{ backgroundColor: step === 1 ? BRAND.burgundy : '#d1d5db' }}>
                <Wifi size={18} />
              </div>
              <h2 className="font-semibold text-gray-900">1. Select Data Plan</h2>
            </div>
            {step > 1 && step < 4 && (
              <button onClick={() => setStep(1)} className="text-sm font-medium hover:underline" style={{ color: BRAND.burgundy }}>Edit</button>
            )}
          </div>
          
          {step === 1 ? (
            <div className="p-4 space-y-3">
              {MOCK_PLANS.map(plan => (
                <button 
                  key={plan.id} 
                  onClick={() => { setSelectedPlan(plan); setStep(2); }} 
                  className="w-full p-4 border rounded-lg text-left transition-all hover:border-gray-400 focus:ring-2 flex justify-between items-center group"
                  style={{ outlineColor: BRAND.sand }}
                >
                  <span className="font-bold text-gray-800">{plan.name}</span>
                  <span className="font-bold text-lg" style={{ color: BRAND.burgundy }}>₦{plan.price}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="p-4 flex justify-between items-center bg-white text-gray-600">
              <span>{selectedPlan?.name}</span>
              <span className="font-semibold">₦{selectedPlan?.price}</span>
            </div>
          )}
        </div>

        {/* Step 2: Phone Input & Pay Button */}
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Enter Phone Number (Your Password)</label>
                <input 
                  type="tel" 
                  value={phoneNumber} 
                  onChange={(e) => setPhoneNumber(e.target.value)} 
                  placeholder="080..." 
                  className="w-full p-4 border border-gray-300 rounded-lg outline-none text-lg tracking-wide focus:ring-2 focus:ring-[#cfa253]" 
                />
                <p className="text-xs mt-2 text-gray-500">Hint: Use 08099999999 to test the failure/fallback state.</p>
              </div>
              <button 
                onClick={triggerDummyPayment} 
                disabled={!phoneNumber || phoneNumber.length < 10} 
                className="w-full text-white p-4 rounded-lg font-bold text-lg transition-opacity disabled:opacity-50"
                style={{ backgroundColor: BRAND.burgundy }}
              >
                Pay ₦{selectedPlan?.price}
              </button>
            </div>
          )}
        </div>

        {/* Step 3: Processing (Waiting for Webhook) */}
        {step === 3 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center space-y-4 border-t-4" style={{ borderColor: BRAND.sand }}>
             <Loader2 className="h-10 w-10 animate-spin mx-auto" style={{ color: BRAND.burgundy }} />
             <h3 className="font-semibold text-gray-900">Verifying Payment...</h3>
             <p className="text-sm text-gray-500">Simulating webhook and Mikrotik network request.</p>
          </div>
        )}

        {/* Step 4: Success State */}
        {step === 4 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center space-y-4 border-t-4" style={{ borderColor: BRAND.burgundy }}>
             <CheckCircle2 className="h-16 w-16 mx-auto text-green-500" />
             <h3 className="text-2xl font-bold text-gray-900">Connected!</h3>
             <p className="text-gray-500">Your device has been authorized on the network automatically.</p>
             <button onClick={resetSimulator} className="mt-4 text-sm font-medium hover:underline" style={{ color: BRAND.burgundy }}>
               Run Simulation Again
             </button>
          </div>
        )}

        {/* Step 5: Fallback State */}
        {step === 5 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center space-y-4 border-t-4" style={{ borderColor: BRAND.sand }}>
             <AlertCircle className="h-16 w-16 mx-auto text-amber-500" />
             <h3 className="text-2xl font-bold text-gray-900">Manual Login Required</h3>
             <p className="text-sm text-gray-500">Payment verified, but auto-connection failed.</p>
             
             <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 my-4">
               <p className="text-xs text-gray-500 uppercase tracking-wide">Your Access Code</p>
               <p className="text-3xl font-mono font-bold mt-1" style={{ color: BRAND.burgundy }}>{phoneNumber}</p>
             </div>

             <button className="block w-full py-3 rounded-lg text-white font-bold" style={{ backgroundColor: BRAND.burgundy }}>
               Go to Login Page
             </button>
             <button onClick={resetSimulator} className="mt-4 block w-full text-sm font-medium text-gray-500 hover:text-gray-900">
               Reset Simulation
             </button>
          </div>
        )}
      </div>

      {/* Simulated Monnify Modal Overlay */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-sm rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="bg-gray-100 p-4 flex justify-between items-center border-b">
              <div className="font-bold flex items-center gap-2">
                <CreditCard size={18} /> Fake Monnify Widget
              </div>
              <button onClick={() => setShowPaymentModal(false)} className="text-gray-500 hover:text-gray-900">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 text-center space-y-6">
              <div className="text-3xl font-bold">₦{selectedPlan?.price}</div>
              <p className="text-sm text-gray-500">Clicking success will close this popup and trigger the simulated webhook delay.</p>
              
              <button 
                onClick={handlePaymentSuccess}
                className="w-full bg-green-600 text-white font-bold py-3 rounded-lg hover:bg-green-700 transition-colors"
              >
                Simulate Successful Transfer
              </button>
              
              <button 
                onClick={() => setShowPaymentModal(false)}
                className="w-full bg-gray-200 text-gray-800 font-bold py-3 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancel Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}