'use client';

import { useEffect, useState } from 'react';
import { Check, Copy, Loader2 } from 'lucide-react';
import { LensMark } from '@/components/ui/lens-mark';
import { ButtonLink, buttonClass } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { naira } from '@/lib/plan-format';
import { cn } from '@/lib/utils';

type Status = {
  status: 'pending' | 'paid' | 'failed' | 'expired' | 'cancelled' | 'not_found' | 'error';
  planName?: string | null;
  locationName?: string | null;
  amountNaira?: number | null;
  expiresAt?: string | null;
  retryPath?: string | null;
  access?: { voucher: string; ready: boolean; ended: boolean; devices: number; online?: boolean; sms?: 'sent' | 'failed' | 'queued' | 'none'; connectUrl: string } | null;
};

/** Paid, but the controller has not put the voucher on the router yet: keep polling. */
const settling = (s: Status) => s.status === 'paid' && !s.access?.ready && !s.access?.ended;

// Polls the server for 3 minutes. Asks the server to re-check with Korapay on
// a few of the polls (not all), in case the webhook is slow or blocked.
const POLL_MS = 4000;
const MAX_POLLS = 45;
const CHECK_ON = new Set([0, 2, 5, 10, 20, 35]);

const lagos = (iso: string) =>
  new Date(iso).toLocaleString('en-NG', { timeZone: 'Africa/Lagos', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

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

  // ----------------------------------------------------------- waiting
  if (!state || state.status === 'pending' || state.status === 'error') {
    return (
      <>
        <Heading lens="pending" title="Confirming your payment">
          {gaveUp
            ? 'We have not had confirmation yet. Bank transfers can take a few minutes, so keep this page open.'
            : 'Waiting for Korapay to confirm. This usually takes a few seconds.'}
        </Heading>
        {gaveUp && (
          <Notice tone="warn" className="mt-6" title="Still waiting">
            If money left your account and no code appears within 15 minutes, message Connectly with the payment reference below.
          </Notice>
        )}
        {!gaveUp && <Spinner label="Checking with Korapay" className="mt-6" />}
      </>
    );
  }

  // ----------------------------------------------------------- not found / failed
  if (state.status === 'not_found') {
    return (
      <Heading lens="off" title="Payment not found">
        We have no payment with this reference. Check the link, or message Connectly with the reference.
      </Heading>
    );
  }

  if (state.status !== 'paid') {
    return (
      <>
        <Heading lens="off" title="Payment not completed">
          The payment did not go through, so you have not been charged for access.
        </Heading>
        <div className="mt-6 space-y-3">
          {state.retryPath ? (
            <ButtonLink href={state.retryPath} size="lg" full>Choose a plan again</ButtonLink>
          ) : (
            <p className="text-sm text-muted">Join the Connectly WiFi again to choose a plan.</p>
          )}
          <p className="text-[13px] text-muted">If money left your account, keep the reference below and message Connectly.</p>
        </div>
      </>
    );
  }

  // ----------------------------------------------------------- paid
  const a = state.access;
  const online = Boolean(a?.ready && a.online);
  const steps: { label: string; done: boolean; detail?: string }[] = [
    { label: 'Payment confirmed', done: true },
    { label: 'WiFi code ready on the network', done: Boolean(a?.ready), detail: a && !a.ready && !a.ended ? (gaveUp ? 'Taking longer than usual' : 'Setting up, a few seconds') : undefined },
    { label: 'This device online', done: online },
  ];

  return (
    <>
      <Heading lens={online ? 'on' : 'pending'} title={online ? "You're online" : a?.ended ? 'This plan has ended' : 'Payment confirmed'}>
        {state.planName ?? 'Your plan'}
        {state.locationName ? ` at ${state.locationName}` : ''}
        {state.amountNaira ? `, ${naira(state.amountNaira)}` : ''}.
        {state.expiresAt && !a?.ended && <> Runs until <span className="tnum font-semibold text-ink">{lagos(state.expiresAt)}</span>.</>}
      </Heading>

      {!a?.ended && (
        <ol className="mt-6 space-y-2.5" aria-label="Progress">
          {steps.map((s) => (
            <li key={s.label} className="flex items-center gap-3 text-[15px]">
              <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-full', s.done ? 'bg-ok text-white' : 'border border-line-strong text-subtle')}>
                {s.done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
              </span>
              <span className={s.done ? 'font-semibold text-ink' : 'text-muted'}>{s.label}</span>
              {s.detail && <span className="text-[13px] text-subtle">{s.detail}</span>}
            </li>
          ))}
        </ol>
      )}

      {a ? (
        <>
          <VoucherBox code={a.voucher} devices={a.devices} sms={a.sms ?? 'none'} />
          <div className="mt-5">
            {a.ended ? (
              <p className="text-sm text-muted">Join the Connectly WiFi again to buy a new plan.</p>
            ) : online ? (
              <p className="text-sm text-muted">For another device, join the WiFi and enter this code under &ldquo;Already paid?&rdquo;.</p>
            ) : a.ready ? (
              <>
                <a href={a.connectUrl} className={buttonClass({ size: 'lg', full: true })}>Connect this device</a>
                <p className="mt-2 text-[13px] text-muted">If your browser warns that the WiFi sign-in page is not secure, choose Continue: it is your Connectly WiFi router.</p>
              </>
            ) : (
              <Spinner label={gaveUp ? 'Still setting up. Try the code on the WiFi sign-in page in a minute.' : 'Putting your code on the WiFi network'} />
            )}
          </div>
        </>
      ) : (
        <Spinner className="mt-6" label={gaveUp ? 'Your code is taking longer than usual. Message Connectly with the reference below.' : 'Preparing your WiFi code'} />
      )}
    </>
  );
}

function Heading({ lens, title, children }: { lens: 'on' | 'off' | 'pending'; title: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4">
      <LensMark className="h-14 w-14" state={lens} />
      <div className="min-w-0">
        <h1 className="text-[22px] font-bold leading-tight tracking-[-0.01em] text-ink">{title}</h1>
        <p className="mt-1.5 text-[15px] leading-relaxed text-muted">{children}</p>
      </div>
    </div>
  );
}

function Spinner({ label, className }: { label: string; className?: string }) {
  return (
    <p className={cn('flex items-center gap-2 text-sm text-muted', className)} role="status">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> {label}
    </p>
  );
}

function VoucherBox({ code, devices, sms }: { code: string; devices: number; sms: 'sent' | 'failed' | 'queued' | 'none' }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked in some sign-in windows: the code is on screen */
    }
  };
  const smsLine =
    sms === 'sent' ? 'Also sent to your phone by text.'
    : sms === 'failed' ? 'We could not text it to you, so write it down or take a screenshot.'
    : 'A copy is on its way by text.';
  return (
    <div className="mt-6 rounded-[var(--radius-panel)] border border-line bg-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-muted">Your WiFi code</p>
        <button type="button" onClick={copy} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-semibold text-brand hover:bg-brand-soft">
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <p className="tnum mt-2 text-[34px] font-bold leading-none tracking-[0.14em] text-ink" data-testid="voucher">{code}</p>
      <p className="mt-3 text-[13px] leading-relaxed text-muted">
        Use it as both username and password{devices > 1 ? `, on up to ${devices} devices` : ''}. {smsLine}
      </p>
    </div>
  );
}
