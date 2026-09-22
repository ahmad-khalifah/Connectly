'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { db } from '../../lib/db/client'; 
import { Loader2, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

function StatusContent() {
  const searchParams = useSearchParams();
  const reference = searchParams.get('ref');
  
  const [status, setStatus] = useState<'pending' | 'success' | 'failed' | 'fallback'>('pending');
  const [phoneNumber, setPhoneNumber] = useState<string>('');

  useEffect(() => {
    if (!reference) return;

    // 1. Initial check in case the webhook fired before the page loaded
    const checkInitialStatus = async () => {
      const { data } = await db
        .from('purchases')
        .select('status, phone') 
        .eq('reference', reference)
        .single();
        
      if (data) {
        if (data.phone) setPhoneNumber(data.phone);
        if (data.status !== 'pending') setStatus(data.status);
      }
    };
    
    checkInitialStatus();

    // 2. Subscribe to real-time updates for this specific reference
    const channel = db
      .channel(`purchase-${reference}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'purchases',
          filter: `reference=eq.${reference}`,
        },
        (payload) => {
          setStatus(payload.new.status);
        }
      )
      .subscribe();

    return () => {
      db.removeChannel(channel);
    };
  }, [reference]);

  if (!reference) return <div className="p-8 text-center">Invalid reference.</div>;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm max-w-md w-full text-center space-y-4">
        
        {status === 'pending' && (
          <>
            <Loader2 className="h-12 w-12 animate-spin text-[#6d1825] mx-auto" />
            <h2 className="text-xl font-bold text-gray-900">Waiting for Payment</h2>
            <p className="text-gray-500 text-sm">
              Bank transfers can take a few minutes. Please keep this page open. We will automatically connect you once the transfer drops.
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
            <h2 className="text-xl font-bold text-gray-900">Payment Successful!</h2>
            <p className="text-gray-500 text-sm">Your internet access has been activated. You are now connected.</p>
          </>
        )}

        {status === 'fallback' && (
          <>
            <AlertCircle className="h-12 w-12 text-[#cfa253] mx-auto" />
            <h2 className="text-xl font-bold text-gray-900">Manual Login Required</h2>
            <p className="text-gray-500 text-sm mb-4">
              Payment verified, but automatic connection failed.
            </p>
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-6">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Your Access Code</p>
              <p className="text-2xl font-mono font-bold tracking-widest mt-1 text-gray-900">
                {phoneNumber || 'Loading...'}
              </p>
            </div>
            <a 
              href="http://logout.net"
              className="inline-block bg-[#6d1825] text-white font-semibold py-3 px-6 rounded-lg hover:bg-opacity-90 w-full"
            >
              Go to Router Login
            </a>
          </>
        )}

        {status === 'failed' && (
          <>
            <XCircle className="h-12 w-12 text-red-500 mx-auto" />
            <h2 className="text-xl font-bold text-gray-900">Payment Failed</h2>
            <p className="text-gray-500 text-sm">We could not verify your transfer. Please contact support.</p>
          </>
        )}

      </div>
    </div>
  );
}

export default function StatusPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-[#6d1825]" /></div>}>
      <StatusContent />
    </Suspense>
  );
}