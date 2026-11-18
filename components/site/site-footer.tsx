import Link from 'next/link';
import { Wordmark } from '@/components/ui/lens-mark';
import { INSTAGRAM_HANDLE, INSTAGRAM_URL } from '@/lib/brand';

export const CONTACT_EMAIL = 'connectly.hq@outlook.com';

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:px-8 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Wordmark />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted">
            Connectly Technologies Ltd builds and runs WiFi networks, and advises companies working in Northern Nigeria.
          </p>
          <p className="mt-4 text-[13px] leading-relaxed text-subtle">RC 9843504<br />Abuja, Nigeria</p>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-ink">What we do</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            <li><Link href="/wifi" className="hover:text-brand">Managed WiFi</Link></li>
            <li><Link href="/consultancy" className="hover:text-indigo">Connectly Consultancy</Link></li>
          </ul>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-ink">Contact</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            <li><a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-brand">{CONTACT_EMAIL}</a></li>
            <li><a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className="hover:text-brand">{INSTAGRAM_HANDLE} on Instagram</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line">
        <p className="mx-auto max-w-6xl px-5 py-5 text-[13px] text-subtle sm:px-8">© {new Date().getFullYear()} Connectly Technologies Ltd.</p>
      </div>
    </footer>
  );
}
