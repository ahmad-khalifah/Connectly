'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Clock, Loader2, XCircle } from 'lucide-react';

type Status = {
  status: 'pending' | 'paid' | 'failed' | 'expired' | 'cancelled' | 'not_found' | 'error';
  planName?: string | null;
  locationName?: string | null;
  amountNaira?: number | null;
  expiresAt?: string | null;
  access?: { voucher: string; ready: boolean; ended: boolean; devices: number; connectUrl: string } | null;
};

/** Paid, but the controller has not put the voucher on the router yet: keep polling. */
const settling = (s: Status) => s.status === 'paid' && !s.access?.ready && !s.access?.ended;

// Polls the server for 3 minutes. Asks the server to re-check with Korapay on
// a few of the polls (not all), in case the webhook is slow or blocked.
const POLL_MS = 4000;
const MAX_POLLS = 45;
const CHECK_ON = new Set([0, 2, 5, 10, 20, 35]);

export default function PaymentStatus({ reference }: { reference: string }) {
  const [state, setState] = useState<Status | null>(null);
  const [gaveUp, setGaveUp] = useState(false);

  useEffect(() => {
    let polls = 0;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;

    const tick = async () => {
      const check = CHECK_ON.has(polls) ? '&check=1' : '';
      try {
        const res = await fetch(`/api/purchase/status?reference=${encodeURIComponent(reference)}${check}`, { cache: 'no-store' });
        const json = (await res.json()) as Status;
        if (stopped) return;
        setState(res.ok || res.status === 404 ? json : { status: 'error' });
        if (json.status !== 'pending' && !settling(json)) return; // final state reached
      } catch {
        if (!stopped) setState({ status: 'error' });
      }
      polls += 1;
      if (polls >= MAX_POLLS) {
        setGaveUp(true);
        return;
      }
      timer = setTimeout(tick, POLL_MS);
    };
    tick();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [reference]);

  const expires = state?.expiresAt
    ? new Date(state.expiresAt).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })
    : null;

  if (!state || state.status === 'pending' || state.status === 'error') {
    return (
      <Card icon={gaveUp ? <Clock className="h-8 w-8" /> : <Loader2 className="h-8 w-8 animate-spin" />} tone="amber"
        title="Confirming your payment">
        {gaveUp
          ? 'We have not received confirmation yet. Bank transfers can take a few minutes. Keep this page and your reference; if you were charged, contact Connectly support.'
          : 'Waiting for confirmation from our payment provider. This usually takes a few seconds.'}
      </Card>
    );
  }

  if (state.status === 'paid') {
    const a = state.access;
    return (
      <>
        <Card icon={<CheckCircle2 className="h-8 w-8" />} tone="green" title="Payment confirmed">
          {state.planName ?? 'Your plan'}
          {state.locationName ? ` at ${state.locationName}` : ''} is paid
          {expires ? ` and valid until ${expires}` : ''}.
        </Card>
        {a ? (
          <div className="mt-6 space-y-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Your WiFi code</p>
              <p className="mt-1 font-mono text-3xl font-bold tracking-widest text-gray-900" data-testid="voucher">{a.voucher}</p>
              <p className="mt-1 text-xs text-slate-500">
                Also sent to your phone. Use it as both username and password
                {a.devices > 1 ? ` on up to ${a.devices} devices` : ''}.
              </p>
            </div>
            {a.ended ? (
              <p className="text-sm text-red-700">This code has ended.</p>
            ) : a.ready ? (
              <a href={a.connectUrl} className="block w-full rounded-lg bg-[#6d1825] py-3.5 font-bold text-white hover:bg-[#5a141e]">
                Connect now
              </a>
            ) : gaveUp ? (
              <p className="text-sm text-amber-700">Your access is taking longer than usual to set up. Try Connect again in a minute, or contact Connectly support with your reference.</p>
            ) : (
              <p className="flex items-center justify-center gap-2 text-sm text-slate-600">
                <Loader2 className="h-4 w-4 animate-spin" /> Setting up your access on the WiFi network…
              </p>
            )}
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-600">
            {gaveUp ? 'Your WiFi code is on its way by SMS. If it does not arrive, contact Connectly support with your reference.' : 'Preparing your WiFi code…'}
          </p>
        )}
      </>
    );
  }

  if (state.status === 'not_found') {
    return (
      <Card icon={<XCircle className="h-8 w-8" />} tone="red" title="Payment not found">
        We could not find this payment reference. Please contact Connectly support.
      </Card>
    );
  }

  return (
    <Card icon={<XCircle className="h-8 w-8" />} tone="red" title="Payment not completed">
      Your payment was not completed and you have not been charged for access. You can return to the Wi-Fi page and
      try again.
    </Card>
  );
}

function Card({ icon, tone, title, children }: { icon: React.ReactNode; tone: 'amber' | 'green' | 'red'; title: string; children: React.ReactNode }) {
  const tones = {
    amber: 'bg-amber-50 text-amber-600',
    green: 'bg-green-50 text-green-600',
    red: 'bg-red-50 text-red-600',
  };
  return (
    <>
      <div className={`w-16 h-16 ${tones[tone]} rounded-full flex items-center justify-center mx-auto mb-6`}>{icon}</div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">{title}</h1>
      <p className="text-gray-600">{children}</p>
    </>
  );
}
