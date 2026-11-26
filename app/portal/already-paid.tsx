'use client';

import { useState } from 'react';
import { KeyRound, ChevronDown, MessageCircle } from 'lucide-react';
import CodeLogin from './code-login';
import PhoneLookup from './phone-lookup';
import { WhatsAppNumber } from '@/components/portal/whatsapp-number';
import { cn } from '@/lib/utils';

/**
 * First thing on the plan page: people who already paid should not have to
 * scroll past the plans to find their way back online. One big button opens
 * the code box. When the router's login address is not known the box cannot
 * work, so the panel says what to do instead of showing a dead form.
 */
export function AlreadyPaid({ loginUrl, routerId, mac }: { loginUrl: string | null; routerId: string; mac: string }) {
  const [open, setOpen] = useState(false);

  return (
    <section className="rounded-[var(--radius-panel)] border border-line-strong bg-surface">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="already-paid-panel"
        className="flex min-h-12 w-full items-center gap-3 px-4 py-2.5 text-left"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand"><KeyRound className="h-4 w-4" aria-hidden /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold leading-5 text-ink">Already paid?</span>
          <span className="block text-[12px] leading-4 text-muted">Use your phone number or WiFi code</span>
        </span>
        <ChevronDown className={cn('h-5 w-5 shrink-0 text-muted transition-transform', open && 'rotate-180')} aria-hidden />
      </button>

      {open && (
        <div id="already-paid-panel" className="border-t border-line px-4 pb-4 pt-4">
          <PhoneLookup routerId={routerId} mac={mac} />
          {loginUrl ? (
            <div className="mt-5 border-t border-line pt-4">
              <CodeLogin loginUrl={loginUrl} heading="Or enter your WiFi code" />
            </div>
          ) : (
            <p className="text-sm leading-relaxed text-muted">
              Turn your WiFi off and on, then wait for this page to open again. Your code is in the text we sent after you paid.
            </p>
          )}
          <p className="mt-4 flex flex-wrap items-center gap-2 text-sm text-muted">
            <MessageCircle className="h-4 w-4 text-brand" aria-hidden />
            Lost your code? WhatsApp <WhatsAppNumber />
          </p>
        </div>
      )}
    </section>
  );
}
