'use client';

import { useState } from 'react';
import { sendTermiiSMS } from '@/app/actions/sms';

export default function SuccessPage() {
  const [smsStatus, setSmsStatus] = useState('');

  const handleTestSMS = async () => {
    setSmsStatus('Sending...');
    
    // Testing the SMS action with your number and a dummy Wi-Fi pin
    const success = await sendTermiiSMS("07026976277", "Connectly test! Your Wi-Fi voucher code is: 998877");
    
    if (success) {
      setSmsStatus('✅ Sent successfully! Check your phone.');
    } else {
      setSmsStatus('❌ Failed to send. Check VS Code terminal.');
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md bg-white p-8 rounded-xl shadow-sm border border-gray-100 text-center">
        <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6 text-3xl">
          ✓
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Successful!</h1>
        <p className="text-gray-600 mb-6">
          Your transaction is complete. We are provisioning your Wi-Fi access now.
        </p>
        
        {/* Temporary Developer SMS Test Block */}
        <div className="mt-8 pt-6 border-t border-gray-100">
          <h2 className="text-sm font-bold text-gray-700 mb-4">Developer SMS Test</h2>
          <button 
            onClick={handleTestSMS}
            className="w-full bg-gray-900 text-white py-3 rounded-lg font-medium hover:bg-gray-800 transition-colors"
          >
            Send Test SMS
          </button>
          {smsStatus && (
            <p className="mt-3 text-sm font-medium text-gray-600">{smsStatus}</p>
          )}
        </div>
        
      </div>
    </main>
  );
}