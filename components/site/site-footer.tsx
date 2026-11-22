import Link from 'next/link';
import { Wordmark } from '@/components/ui/lens-mark';
import { WHATSAPP_DISPLAY, WHATSAPP_URL } from '@/lib/brand';
import { COMPANY_ADDRESS, COMPANY_EMAIL, COMPANY_NAME, COMPANY_RC } from '@/lib/company';

export const CONTACT_EMAIL = COMPANY_EMAIL;

const COMPANY_LINKS = [
  ['About', '/about'],
  ['Solutions', '/solutions'],
  ['Industries', '/industries'],
  ['Partnerships', '/partnerships'],
  ['Contact', '/contact'],
] as const;

export function SiteFooter() {
  return (
    <footer className="bg-burgundy-950 text-white/75">
      <div className="mx-auto grid max-w-6xl gap-12 px-5 py-16 sm:px-8 md:grid-cols-[1.5fr_1fr_1.3fr]">
        <div>
          <Wordmark tone="light" />
          <p className="mt-5 max-w-sm text-[15px] leading-relaxed">
            Connectivity infrastructure and managed network solutions, built to widen access to reliable connectivity.
          </p>
        </div>
        <div>
          <h2 className="text-[15px] font-semibold text-white">Company</h2>
          <ul className="mt-4 space-y-3 text-[15px]">
            {COMPANY_LINKS.map(([label, href]) => (
              <li key={href}><Link prefetch={false} href={href} className="transition-colors hover:text-sand">{label}</Link></li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-[15px] font-semibold text-white">Contact</h2>
          <address className="mt-4 space-y-3 text-[15px] not-italic leading-relaxed">
            <p>
              {COMPANY_NAME}<br />
              {COMPANY_ADDRESS.map((line, i) => (<span key={line}>{line}{i < COMPANY_ADDRESS.length - 1 && <br />}</span>))}
            </p>
            <p><a href={`mailto:${COMPANY_EMAIL}`} className="transition-colors hover:text-sand">{COMPANY_EMAIL}</a></p>
            <p>
              Customer support on WhatsApp:{' '}
              <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="whitespace-nowrap font-semibold text-sand underline-offset-4 hover:underline">{WHATSAPP_DISPLAY}</a>
            </p>
          </address>
        </div>
      </div>
      <div className="border-t border-white/10">
        <p className="mx-auto max-w-6xl px-5 py-6 text-[13px] text-white/55 sm:px-8">
          © {new Date().getFullYear()} {COMPANY_NAME}. {COMPANY_RC}.
        </p>
      </div>
    </footer>
  );
}
