import { Wordmark } from '@/components/ui/lens-mark';
import { HelpSection } from './help-section';

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
    </div>
  );
}
