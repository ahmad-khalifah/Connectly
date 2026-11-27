import { Wordmark } from '@/components/ui/lens-mark';
import { HelpSection } from './help-section';
import { COMPANY_ADDRESS_LINE, COMPANY_EMAIL, COMPANY_NAME } from '@/lib/company';

/**
 * Frame for every customer-facing WiFi screen: brand, the place, the content,
 * then help. Narrow and single-column: it is used on phones inside the
 * sign-in window that opens when they join the WiFi.
 */
export function PortalShell({
  place,
  children,
  showHelp = true,
}: {
  place?: string | null;
  children: React.ReactNode;
  showHelp?: boolean;
}) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-canvas">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-md items-center justify-between px-5 py-3.5">
          <Wordmark />
          {showHelp && (
            <a href="#help" className="rounded-md px-2 py-1 text-sm font-semibold text-brand hover:bg-brand-soft">
              Help
            </a>
          )}
        </div>
        {place && (
          <div className="mx-auto max-w-md px-5 pb-3.5">
            <p className="text-sm text-muted">
              WiFi at <span className="font-semibold text-ink">{place}</span>
            </p>
          </div>
        )}
      </header>
      <main className="mx-auto w-full max-w-md flex-1 px-5 pb-10 pt-6">{children}</main>
      {showHelp && <HelpSection />}
      {/* Business details on every portal screen (required for the Termii sender ID). */}
      <footer className="border-t border-line bg-surface">
        <address className="mx-auto max-w-md px-5 py-5 text-xs not-italic leading-relaxed text-subtle">
          <span className="block font-semibold text-muted">{COMPANY_NAME}</span>
          <span className="block">{COMPANY_ADDRESS_LINE}</span>
          <span className="block">{COMPANY_EMAIL}</span>
        </address>
      </footer>
    </div>
  );
}
