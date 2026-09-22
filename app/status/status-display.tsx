'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, Loader2, Wifi } from 'lucide-react';

type PurchaseStatus = {
  status: 'pending' | 'paid' | 'failed';
  requiresWiFiConnection?: boolean;
  expiresAt?: string;
  planName?: string;
};

export default function StatusDisplay() {
  const searchParams = useSearchParams();
  const ref = searchParams.get('ref');
  const [data, setData] = useState<PurchaseStatus>({ status: 'pending' });

  useEffect(() => {
    if (!ref) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/purchase/status?ref=${ref}`);
        if (res.ok) {
          const result = await res.json();
          setData(result);
          if (result.status === 'paid' || result.status === 'failed') {
            clearInterval(interval);
          }
        }
      } catch (err) {
        console.error('Failed to poll status', err);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [ref]);

  if (!ref) {
    return <p className="text-center text-red-600 mt-20">No transaction reference found.</p>;
  }

  if (data.status === 'pending') {
    return (
      <div className="mt-20 flex flex-col items-center text-center">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
        <h2 className="mt-6 text-xl font-bold text-gray-900">Verifying Payment</h2>
        <p className="mt-2 text-gray-500">Please wait while we confirm your transaction...</p>
      </div>
    );
  }

  if (data.status === 'paid' && data.requiresWiFiConnection) {
    return (
      <div className="mt-12 flex flex-col items-center rounded-2xl bg-white p-8 text-center shadow-sm border border-blue-100">
        <div className="rounded-full bg-green-100 p-4">
          <CheckCircle2 className="h-12 w-12 text-green-600" />
        </div>
        <h2 className="mt-6 text-2xl font-bold text-gray-900">Payment Confirmed!</h2>
        <p className="mt-2 text-gray-600">Your {data.planName} is ready.</p>
        
        <div className="mt-8 w-full rounded-xl bg-blue-50 p-6 border border-blue-200">
          <Wifi className="mx-auto h-8 w-8 text-blue-600 mb-4" />
          <h3 className="font-bold text-gray-900">Next Step: Connect to WiFi</h3>
          <ol className="mt-4 text-sm text-left text-gray-700 space-y-3">
          <li>1. Open your device Settings &rarr; Wi-Fi</li>
            <li>2. Connect to the <strong>CampusNet WiFi</strong> network</li>
            <li>3. The login portal will open and automatically activate your access.</li>
          </ol>
        </div>
      </div>
    );
  }

  if (data.status === 'paid' && !data.requiresWiFiConnection) {
    return (
      <div className="mt-12 flex flex-col items-center rounded-2xl bg-white p-8 text-center shadow-sm border border-green-100">
        <div className="rounded-full bg-green-100 p-4">
          <CheckCircle2 className="h-12 w-12 text-green-600" />
        </div>
        <h2 className="mt-6 text-2xl font-bold text-gray-900">You Are Connected</h2>
        <p className="mt-2 text-gray-600">Your {data.planName} is now active.</p>
        <p className="mt-6 text-sm text-gray-500">
          Access expires at: <br />
          <strong className="text-gray-800">
            {new Date(data.expiresAt!).toLocaleString('en-NG')}
          </strong>
        </p>
      </div>
    );
  }

  return (
    <div className="mt-20 flex flex-col items-center text-center">
      <p className="text-red-600">Payment verification failed or expired. Please contact support.</p>
    </div>
  );
}