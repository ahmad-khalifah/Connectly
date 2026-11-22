import { MessageCircle } from 'lucide-react';
import { WHATSAPP_DISPLAY, WHATSAPP_URL } from '@/lib/brand';

/**
 * Always-visible help on phones: one big tap to WhatsApp. Hidden on larger
 * screens, where the header and contact section already carry it.
 * `HelpBarSpacer` keeps the page's last line from sitting under it.
 */
export function HelpBar() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur md:hidden supports-[backdrop-filter]:bg-surface/90">
      <a
        href={WHATSAPP_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="flex h-12 w-full items-center justify-center gap-2 rounded-[var(--radius-control)] bg-ok text-[15px] font-semibold text-white"
      >
        <MessageCircle className="h-5 w-5" aria-hidden />
        Need help? WhatsApp {WHATSAPP_DISPLAY}
      </a>
    </div>
  );
}

export function HelpBarSpacer() {
  return <div className="h-20 md:hidden" aria-hidden />;
}
