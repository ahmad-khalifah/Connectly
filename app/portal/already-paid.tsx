'use client';

import { useState } from 'react';
import { KeyRound, ChevronDown, MessageCircle } from 'lucide-react';
import CodeLogin from './code-login';
import { WHATSAPP_DISPLAY, WHATSAPP_URL } from '@/lib/brand';
import { cn } from '@/lib/utils';

/**
 * First thing on the plan page: people who already paid should not have to
 * scroll past the plans to find their way back online. One big button opens
 * the code box. When the router's login address is not known the box cannot
 * work, so the panel says what to do instead of showing a dead form.
 */
export function AlreadyPaid({ loginUrl }: { loginUrl: string | null }) {
  const [open, setOpen] = useState(false);

  return (
    <section className="rounded-[var(--radius-panel)] border border-line-strong bg-surface">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="already-paid-panel"
        className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand"><KeyRound className="h-5 w-5" aria-hidden /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-semibold text-ink">Already paid?</span>
          <span className="block text-[13px] text-muted">Tap here to get back online</span>
        </span>
        <ChevronDown className={cn('h-5 w-5 shrink-0 text-muted transition-transform', open && 'rotate-180')} aria-hidden />
      </button>

      {open && (
        <div id="already-paid-panel" className="border-t border-line px-4 pb-4 pt-4">
          {loginUrl ? (
            <CodeLogin loginUrl={loginUrl} heading="Enter your WiFi code" />
          ) : (
            <p className="text-sm leading-relaxed text-muted">
              Turn your WiFi off and on, then wait for this page to open again. Your code is in the text we sent after you paid.
            </p>
          )}
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-brand underline underline-offset-4"
          >
            <MessageCircle className="h-4 w-4" aria-hidden />
            Lost your code? WhatsApp {WHATSAPP_DISPLAY}
          </a>
        </div>
      )}
    </section>
  );
}
