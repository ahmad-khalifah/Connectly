import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteHeader } from '@/components/site/site-header';
import { SiteFooter, CONTACT_EMAIL } from '@/components/site/site-footer';
import { CoverageDrawing } from '@/components/site/coverage-drawing';
import { buttonClass } from '@/components/ui/button';
import { INSTAGRAM_HANDLE, INSTAGRAM_URL } from '@/lib/brand';

export const metadata: Metadata = {
  title: 'Connectly | Managed WiFi and consultancy for Northern Nigeria',
  description: 'Connectly builds and runs paid WiFi for markets, campuses and estates, and helps companies enter and grow in Northern Nigeria.',
};

export default function Home() {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-surface">
      <SiteHeader />
      <main className="flex-1">
        {/* Hero: the claim, the two ways in, and the coverage drawing. */}
        <section className="border-b border-line">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 sm:px-8 md:py-24 lg:grid-cols-[1fr_1.05fr]">
            <div>
              <h1 className="text-[44px] font-bold leading-[1.02] tracking-[-0.03em] text-ink sm:text-[60px]">
                Northern Nigeria, connected.
              </h1>
              <p className="mt-6 max-w-[34rem] text-lg leading-relaxed text-muted">
                Connectly builds and runs paid WiFi for markets, campuses and estates. Through Connectly Consultancy, we help companies enter and grow in the North.
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Link href="/wifi" className={buttonClass({ size: 'lg' })}>WiFi for your site</Link>
                <Link href="/consultancy" className={buttonClass({ size: 'lg', variant: 'secondary' })}>Connectly Consultancy</Link>
              </div>
            </div>
            <figure className="relative">
              <CoverageDrawing className="h-auto w-full" />
              <figcaption className="mt-3 text-[13px] text-subtle">Five access points over a market plan. Where their coverage overlaps, nobody drops off.</figcaption>
            </figure>
          </div>
        </section>

        {/* Two offerings, one company. Each keeps its own colour. */}
        <section aria-labelledby="offerings">
          <h2 id="offerings" className="sr-only">What we do</h2>
          <div className="mx-auto grid max-w-6xl md:grid-cols-2">
            <article className="border-b border-line px-5 py-14 sm:px-8 md:border-b-0 md:border-r">
              <div className="h-1 w-12 bg-brand" aria-hidden />
              <h3 className="mt-6 text-[28px] font-bold leading-tight tracking-[-0.02em] text-ink">Managed WiFi</h3>
              <p className="mt-3 max-w-[30rem] text-[17px] leading-relaxed text-muted">
                We design, install and run the network, and the payment and access system on top of it. People pay on their phone and are online in seconds.
              </p>
              <ul className="mt-6 space-y-2.5 text-[15px] text-ink">
                <li>Pay as you go through Korapay, with no account or subscription</li>
                <li>Routers, access points and the internet link, including satellite where there is no fibre</li>
                <li>One console for payments, customers and every router</li>
              </ul>
              <Link href="/wifi" className="mt-8 inline-block text-[15px] font-semibold text-brand underline underline-offset-4 hover:no-underline">How managed WiFi works</Link>
            </article>
            <article className="px-5 py-14 sm:px-8">
              <div className="h-1 w-12 bg-indigo" aria-hidden />
              <h3 className="mt-6 text-[28px] font-bold leading-tight tracking-[-0.02em] text-ink">Connectly Consultancy</h3>
              <p className="mt-3 max-w-[30rem] text-[17px] leading-relaxed text-muted">
                For companies that want to sell, partner or operate in Northern Nigeria. We do the groundwork: research, validation, partners and the first customers.
              </p>
              <ul className="mt-6 space-y-2.5 text-[15px] text-ink">
                <li>Market entry strategy, research and validation</li>
                <li>Local partnerships and stakeholder engagement</li>
                <li>Customer acquisition, business development and regional expansion</li>
              </ul>
              <Link href="/consultancy" className="mt-8 inline-block text-[15px] font-semibold text-indigo underline underline-offset-4 hover:no-underline">How the consultancy works</Link>
            </article>
          </div>
        </section>

        {/* About */}
        <section id="about" className="scroll-mt-20 border-y border-line bg-canvas">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 md:py-20">
            <h2 className="max-w-[22ch] text-[32px] font-bold leading-tight tracking-[-0.02em] text-ink">A connectivity company that stays after the launch.</h2>
            <div className="mt-10 grid gap-10 md:grid-cols-3">
              <div>
                <h3 className="text-[17px] font-semibold text-ink">Based in Abuja, working across the North</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-muted">Our team installs, visits and supports the sites itself, and knows the places our consultancy clients want to reach.</p>
              </div>
              <div>
                <h3 className="text-[17px] font-semibold text-ink">Our own platform</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-muted">The sign-in page, payments, WiFi codes and router control are Connectly software, so we can fix and improve them without waiting on anyone.</p>
              </div>
              <div>
                <h3 className="text-[17px] font-semibold text-ink">We run what we build</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-muted">A network is only useful while it works. We monitor every router and keep the site running, rather than handing over and leaving.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Contact */}
        <section id="contact" className="scroll-mt-20">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 md:py-20">
            <h2 className="text-[32px] font-bold leading-tight tracking-[-0.02em] text-ink">Talk to us</h2>
            <p className="mt-3 max-w-[40rem] text-[17px] leading-relaxed text-muted">Tell us what you need and the right team will reply. Each enquiry form asks only what helps us answer properly.</p>
            <div className="mt-10 grid gap-px overflow-hidden rounded-[var(--radius-panel)] border border-line bg-line md:grid-cols-3">
              <Link href="/wifi#enquire" className="group bg-surface p-6 hover:bg-brand-soft">
                <p className="text-[17px] font-semibold text-ink group-hover:text-brand">WiFi for your site</p>
                <p className="mt-1 text-sm text-muted">Markets, campuses, hostels, estates, offices and events.</p>
              </Link>
              <Link href="/consultancy#enquire" className="group bg-surface p-6 hover:bg-indigo-soft">
                <p className="text-[17px] font-semibold text-ink group-hover:text-indigo">Consultancy</p>
                <p className="mt-1 text-sm text-muted">Entering or growing in Northern Nigeria.</p>
              </Link>
              <div className="bg-surface p-6">
                <p className="text-[17px] font-semibold text-ink">Anything else</p>
                <p className="mt-1 text-sm text-muted">
                  <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-ink underline underline-offset-2">{CONTACT_EMAIL}</a>
                  <br />
                  <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">{INSTAGRAM_HANDLE}</a> on Instagram
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
