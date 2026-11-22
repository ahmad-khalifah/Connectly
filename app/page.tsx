import type { Metadata } from 'next';
import Link from 'next/link';
import { MessageCircle, KeyRound, Wrench, Wallet } from 'lucide-react';
import { SiteHeader } from '@/components/site/site-header';
import { SiteFooter, CONTACT_EMAIL } from '@/components/site/site-footer';
import { PhoneDemo } from '@/components/site/phone-demo';
import { buttonClass } from '@/components/ui/button';
import { WHATSAPP_DISPLAY, WHATSAPP_URL } from '@/lib/brand';

export const metadata: Metadata = {
  title: 'Connectly Networks | Pay for WiFi on your phone',
  description: 'Connectly Networks designs, installs and runs paid WiFi for markets, campuses, hostels and estates. People pay on their phone and are online in seconds.',
};

const OWNER_POINTS = [
  { icon: Wrench, title: 'We install it', text: 'Routers, access points and cabling, fitted and tested by our own engineer.' },
  { icon: KeyRound, title: 'We run it', text: 'The sign-in page, payments, WiFi codes and the internet link. Every router is watched all day.' },
  { icon: Wallet, title: 'You earn from it', text: 'Customers pay for time on their phone. You see every payment in one place.' },
];

export default function Home() {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-surface">
      <SiteHeader />
      <main className="flex-1">
        {/* Hero: what a customer does, shown, with the two things people come here for. */}
        <section className="border-b border-line bg-ochre-soft/60">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-12 sm:px-8 md:py-20 lg:grid-cols-[1.1fr_1fr]">
            <div>
              <h1 className="text-[40px] font-bold leading-[1.05] tracking-[-0.03em] text-ink sm:text-[56px]">
                Pay for WiFi on your phone. Be online in seconds.
              </h1>
              <p className="mt-5 max-w-[32rem] text-lg leading-relaxed text-muted">
                No account, no airtime, no subscription. Join the WiFi, pick a plan and pay. That is all.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className={buttonClass({ size: 'lg', variant: 'secondary', className: 'h-14 text-base' })}>
                  <MessageCircle className="h-5 w-5 text-ok" aria-hidden />
                  I paid and I am not online
                </a>
                <Link prefetch={false} href="/wifi#enquire" className={buttonClass({ size: 'lg', className: 'h-14 text-base' })}>
                  Get WiFi for my business
                </Link>
              </div>
            </div>
            <PhoneDemo />
          </div>
        </section>

        {/* Help first: this is what most visitors on a phone are here for. */}
        <section id="help" aria-labelledby="help-title" className="scroll-mt-20">
          <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8 md:py-16">
            <h2 id="help-title" className="text-[28px] font-bold tracking-[-0.02em] text-ink">Need help?</h2>
            <p className="mt-2 max-w-[38rem] text-[17px] leading-relaxed text-muted">
              A real person answers on WhatsApp. Have your payment reference ready if you have one.
            </p>
            <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className={buttonClass({ size: 'lg', className: 'mt-6 h-14 w-full bg-ok text-base hover:bg-ok/90 sm:w-auto' })}>
              <MessageCircle className="h-5 w-5" aria-hidden />
              WhatsApp {WHATSAPP_DISPLAY}
            </a>
            <ul className="mt-8 grid gap-4 text-[15px] text-ink sm:grid-cols-3">
              <li className="rounded-[var(--radius-panel)] border border-line p-4"><span className="font-semibold">Paid but not online?</span><span className="mt-1 block text-muted">Tell us the phone number you paid with.</span></li>
              <li className="rounded-[var(--radius-panel)] border border-line p-4"><span className="font-semibold">Lost your WiFi code?</span><span className="mt-1 block text-muted">We find it from your payment and send it again.</span></li>
              <li className="rounded-[var(--radius-panel)] border border-line p-4"><span className="font-semibold">Plan ended too soon?</span><span className="mt-1 block text-muted">Send your payment reference and we will check.</span></li>
            </ul>
          </div>
        </section>

        {/* Site owners */}
        <section id="owners" aria-labelledby="owners-title" className="scroll-mt-20 border-y border-line bg-canvas">
          <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8 md:py-20">
            <h2 id="owners-title" className="max-w-[24ch] text-[30px] font-bold leading-tight tracking-[-0.02em] text-ink">Own a market, campus, hostel or estate?</h2>
            <p className="mt-3 max-w-[40rem] text-[17px] leading-relaxed text-muted">
              We put in paid WiFi and keep it running, so you get WiFi that works without managing it.
            </p>
            <ul className="mt-10 grid gap-5 md:grid-cols-3">
              {OWNER_POINTS.map(({ icon: Icon, title, text }) => (
                <li key={title} className="rounded-[var(--radius-panel)] border border-line bg-surface p-6">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-soft text-brand"><Icon className="h-5 w-5" aria-hidden /></span>
                  <p className="mt-4 text-[18px] font-semibold text-ink">{title}</p>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-muted">{text}</p>
                </li>
              ))}
            </ul>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link prefetch={false} href="/wifi#enquire" className={buttonClass({ size: 'lg', className: 'h-14 text-base' })}>Tell us about your site</Link>
              <Link prefetch={false} href="/wifi" className={buttonClass({ size: 'lg', variant: 'secondary', className: 'h-14 text-base' })}>See what we provide</Link>
            </div>
          </div>
        </section>

        {/* Contact */}
        <section id="contact" className="scroll-mt-20">
          <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8 md:py-16">
            <h2 className="text-[28px] font-bold tracking-[-0.02em] text-ink">Talk to us</h2>
            <p className="mt-2 text-[17px] text-muted">
              WhatsApp <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand underline underline-offset-4">{WHATSAPP_DISPLAY}</a>
              {' '}or email{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-brand underline underline-offset-4">{CONTACT_EMAIL}</a>.
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
