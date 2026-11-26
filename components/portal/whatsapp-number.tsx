'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { WHATSAPP_DISPLAY } from '@/lib/brand';
import { cn } from '@/lib/utils';

/**
 * The help line inside the WiFi sign-in window. A wa.me link cannot work
 * there: the phone is not online yet, so the router blocks the site and iOS
 * shows "could not establish a secure connection". Instead we show the number
 * with a Copy button, which needs no internet; the customer opens WhatsApp
 * themselves (it can use mobile data).
 */
export function WhatsAppNumber({ className }: { className?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    const digits = WHATSAPP_DISPLAY.replace(/\s/g, '');
    let ok = false;
    try {
      await navigator.clipboard.writeText(digits);
      ok = true;
    } catch {
      // Older sign-in windows: copy through a temporary text box.
      const box = document.createElement('textarea');
      box.value = digits;
      box.setAttribute('readonly', '');
      box.style.position = 'fixed';
      box.style.opacity = '0';
      document.body.appendChild(box);
      box.select();
      try { ok = document.execCommand('copy'); } catch { ok = false; }
      box.remove();
    }
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <span className={cn('inline-flex flex-wrap items-center gap-x-2 gap-y-1', className)}>
      <span className="tnum select-all font-semibold text-ink">{WHATSAPP_DISPLAY}</span>
      <button
        type="button"
        onClick={copy}
        className="inline-flex min-h-8 items-center gap-1 rounded-md border border-line-strong px-2 text-xs font-semibold text-brand hover:bg-brand-soft"
        aria-live="polite"
      >
        {copied ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
        {copied ? 'Copied' : 'Copy'}
      </button>
    </span>
  );
}
