'use client';

import { useState } from 'react';
import type { CheckoutResult } from '@/lib/payments/checkout';
import CodeLogin from './code-login';
import { Button } from '@/components/ui/button';
import { Field, inputClass } from '@/components/ui/field';
import { Notice } from '@/components/ui/notice';
import { naira, planData, planDevices, planDuration, planSpeed } from '@/lib/plan-format';
import { cn } from '@/lib/utils';
import { normaliseNigerianMobile } from '@/lib/phone';

export interface Plan {
  id: string;
  name: string;
  price_kobo: number;
  speed_down_mbps: number | null;
  duration_seconds: number | null;
  device_limit: number | null;
  data_limit_mb?: number | null;
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
  const [selectedPlanId, setSelectedPlanId] = useState<string>(plans[0]?.id || '');
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const selected = plans.find((p) => p.id === selectedPlanId);

  const pay = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const cleaned = phone.trim();
    if (!normaliseNigerianMobile(cleaned)) {
      setPhoneError('Enter a Nigerian mobile number, for example 08031234567.');
      return;
    }
    setPhoneError(null);
    if (!selected) {
      setError('Choose a plan first.');
      return;
    }
    setIsProcessing(true);
    try {
      // The server prices the plan from the database; the browser sends no amount.
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mac, ip, routerId, locationId: location.id, planId: selected.id, phone: cleaned }),
      });
      const result = (await res.json()) as CheckoutResult;
      if (!result.ok) {
        setError(result.error);
        setIsProcessing(false);
        return;
      }
      window.location.assign(result.checkoutUrl);
    } catch {
      setError('The payment page could not be opened. Check that you are still on the WiFi and try again.');
      setIsProcessing(false);
    }
  };

  if (plans.length === 0) {
    return (
      <Notice tone="warn" title="No plans on sale here right now">
        Ask the staff at {location.name}, or try again later.
      </Notice>
    );
  }

  return (
    <div className="space-y-8">
      <form onSubmit={pay} noValidate className="space-y-7">
        <fieldset>
          <legend className="text-xl font-bold tracking-[-0.01em] text-ink">Choose a plan</legend>
          <p className="mt-1 text-sm text-muted">Pay once. No account, no subscription.</p>
          <div className="mt-4 overflow-hidden rounded-[var(--radius-panel)] border border-line bg-surface">
            {plans.map((plan, i) => {
              const checked = plan.id === selectedPlanId;
              const details = [planDuration(plan.duration_seconds), planData(plan.data_limit_mb), planDevices(plan.device_limit), planSpeed(plan.speed_down_mbps)].filter(Boolean);
              return (
                <label
                  key={plan.id}
                  className={cn(
                    'relative flex cursor-pointer gap-3.5 px-4 py-4 transition-colors',
                    i > 0 && 'border-t border-line',
                    checked ? 'bg-brand-soft' : 'hover:bg-canvas'
                  )}
                >
                  {checked && <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-brand" />}
                  <input
                    type="radio"
                    name="plan"
                    value={plan.id}
                    checked={checked}
                    onChange={() => setSelectedPlanId(plan.id)}
                    className="mt-1 h-4 w-4 shrink-0 accent-[var(--color-brand)]"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="text-base font-semibold text-ink">{plan.name}</span>
                      <span className="tnum text-lg font-bold text-ink">{naira(plan.price_kobo / 100)}</span>
                    </span>
                    <span className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-muted">
                      {details.map((d) => <span key={d as string}>{d}</span>)}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <Field
          label="Your phone number"
          htmlFor="phone"
          error={phoneError}
          hint="For your receipt and WiFi code by text. We do not use it for anything else."
        >
          <input
            id="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="0803 123 4567"
            value={phone}
            onChange={(e) => { setPhone(e.target.value); setPhoneError(null); }}
            className={inputClass}
            aria-invalid={phoneError ? true : undefined}
          />
        </Field>

        {error && <Notice tone="bad" title="Payment not started">{error}</Notice>}

        <div className="sticky bottom-0 -mx-5 border-t border-line bg-surface/95 px-5 py-4 backdrop-blur supports-[backdrop-filter]:bg-surface/85">
          {selected && (
            <p className="mb-3 text-sm text-muted">
              <span className="font-semibold text-ink">{selected.name}</span>
              {', '}
              {[planDuration(selected.duration_seconds), planData(selected.data_limit_mb).toLowerCase(), planDevices(selected.device_limit)].filter(Boolean).join(', ')}
            </p>
          )}
          <Button type="submit" size="lg" full disabled={isProcessing || !selected}>
            {isProcessing ? 'Opening secure payment…' : `Pay ${selected ? naira(selected.price_kobo / 100) : ''}`}
          </Button>
          <p className="mt-2 text-center text-xs text-subtle">Secure payment by Korapay. You confirm the amount there.</p>
        </div>
      </form>

      {loginUrl && (
        <section className="rounded-[var(--radius-panel)] border border-line bg-surface p-5">
          <CodeLogin loginUrl={loginUrl} />
        </section>
      )}

      <section aria-labelledby="how" className="text-sm">
        <h2 id="how" className="font-semibold text-ink">How it works</h2>
        <ol className="mt-3 space-y-3">
          {[
            ['Pay for a plan', 'Korapay opens a secure payment page. The price shown here is the price you pay.'],
            ['Get your WiFi code', 'It appears on screen as soon as the payment is confirmed.'],
            ['You are online', 'This phone is connected for you. Other devices sign in with the code.'],
          ].map(([t, d], i) => (
            <li key={t} className="flex gap-3">
              <span className="tnum flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-line-strong text-xs font-semibold text-muted">{i + 1}</span>
              <span>
                <span className="font-semibold text-ink">{t}.</span> <span className="text-muted">{d}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
