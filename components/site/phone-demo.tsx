'use client';

import { useState } from 'react';
import { LensMark } from '@/components/ui/lens-mark';
import { cn } from '@/lib/utils';

const STEPS = [
  { label: 'Pick a plan', hint: 'Choose how long you want to stay online.' },
  { label: 'Enter your number', hint: 'We text your receipt and WiFi code to it.' },
  { label: 'You are online', hint: 'Your phone connects by itself.' },
] as const;

const SAMPLE_PLANS = ['1 hour', '1 day', '1 week'];

/**
 * A phone showing what a customer sees, one screen per step. The person taps
 * the step they want to see; nothing moves on its own. The screens are
 * examples, so no prices or place names are shown.
 */
export function PhoneDemo({ className }: { className?: string }) {
  const [step, setStep] = useState(0);

  return (
    <div className={cn('mx-auto w-full max-w-[22rem]', className)}>
      <div role="group" aria-label="How paying for WiFi works" className="grid grid-cols-3 gap-2">
        {STEPS.map((s, i) => (
          <button
            key={s.label}
            type="button"
            onClick={() => setStep(i)}
            aria-pressed={step === i}
            className={cn(
              'flex min-h-14 flex-col items-center justify-center rounded-[var(--radius-control)] border px-2 py-2 text-center text-[13px] font-semibold leading-tight transition-colors',
              step === i ? 'border-brand bg-brand text-white' : 'border-line-strong bg-surface text-ink hover:bg-brand-soft'
            )}
          >
            <span className="tnum text-[15px]">{i + 1}</span>
            <span>{s.label}</span>
          </button>
        ))}
      </div>

      <div className="mt-5 rounded-[2.25rem] border-[6px] border-ink bg-ink p-0 shadow-[0_18px_40px_-18px_rgba(31,36,48,0.55)]">
        <div className="relative h-[22rem] overflow-hidden rounded-[1.75rem] bg-canvas">
          <div className="absolute left-1/2 top-2 h-1.5 w-16 -translate-x-1/2 rounded-full bg-ink/80" aria-hidden />
          <div className="flex items-center gap-2 border-b border-line bg-surface px-4 pb-3 pt-6">
            <LensMark className="h-5 w-5" state={step === 2 ? 'on' : 'off'} />
            <span className="text-[13px] font-bold text-brand">Connectly</span>
          </div>

          {step === 0 && (
            <div className="space-y-3 p-4">
              <p className="text-[15px] font-bold text-ink">Choose a plan</p>
              <div className="overflow-hidden rounded-[var(--radius-panel)] border border-line bg-surface">
                {SAMPLE_PLANS.map((p, i) => (
                  <div key={p} className={cn('flex items-center gap-3 px-3 py-3', i > 0 && 'border-t border-line', i === 1 && 'bg-brand-soft')}>
                    <span className={cn('h-4 w-4 rounded-full border-2', i === 1 ? 'border-brand bg-brand ring-2 ring-inset ring-white' : 'border-line-strong')} aria-hidden />
                    <span className="text-[14px] font-semibold text-ink">{p}</span>
                  </div>
                ))}
              </div>
              <div className="rounded-[var(--radius-control)] bg-brand py-3 text-center text-[14px] font-semibold text-white">Continue</div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-3 p-4">
              <p className="text-[15px] font-bold text-ink">Your phone number</p>
              <div className="rounded-[var(--radius-control)] border border-line-strong bg-surface px-3 py-3 text-[15px] tnum text-subtle">0803 123 4567</div>
              <div className="rounded-[var(--radius-control)] bg-brand py-3 text-center text-[14px] font-semibold text-white">Pay</div>
              <p className="text-center text-[12px] text-subtle">Secure payment by Korapay</p>
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col items-center px-4 pt-8 text-center">
              <LensMark className="h-20 w-20" state="on" title="Connected" />
              <p className="mt-5 text-[18px] font-bold text-ink">You are online</p>
              <p className="mt-1 text-[13px] text-muted">Your WiFi code for other devices:</p>
              <p className="mt-2 rounded-[var(--radius-control)] border border-line bg-surface px-4 py-2 text-[17px] font-bold tracking-[0.18em] text-ink">K7M2Q9XP</p>
            </div>
          )}
        </div>
      </div>

      <p className="mt-4 text-center text-[15px] leading-relaxed text-muted" aria-live="polite">{STEPS[step].hint}</p>
    </div>
  );
}
