import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteHeader } from '@/components/site/site-header';
import { SiteFooter, CONTACT_EMAIL } from '@/components/site/site-footer';
import { CoverageDrawing } from '@/components/site/coverage-drawing';
import { buttonClass } from '@/components/ui/button';
import { INSTAGRAM_HANDLE, INSTAGRAM_URL } from '@/lib/brand';

export const metadata: Metadata = {
  title: 'Connectly Networks | Managed WiFi for Northern Nigeria',
  description: 'Connectly Networks designs, installs and runs paid WiFi for markets, campuses, hostels and estates. People pay on their phone and are online in seconds.',
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
                Connectly Networks designs, installs and runs paid WiFi for markets, campuses, hostels and estates. People pay on their phone and are online in seconds.
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Link prefetch={false} href="/wifi#enquire" className={buttonClass({ size: 'lg' })}>Enquire about your site</Link>
                <Link prefetch={false} href="/wifi" className={buttonClass({ size: 'lg', variant: 'secondary' })}>How it works</Link>
              </div>
            </div>
            <figure className="relative">
              <CoverageDrawing className="h-auto w-full" />
              <figcaption className="mt-3 text-[13px] text-subtle">Five access points over a market plan. Where their coverage overlaps, nobody drops off.</figcaption>
            </figure>
          </div>
        </section>

        {/* One service, seen from both sides: the site and the people on it. */}
        <section aria-labelledby="audiences">
          <h2 id="audiences" className="sr-only">Who it is for</h2>
          <div className="mx-auto grid max-w-6xl md:grid-cols-2">
            <article className="border-b border-line px-5 py-14 sm:px-8 md:border-b-0 md:border-r">
              <div className="h-1 w-12 bg-brand" aria-hidden />
              <h3 className="mt-6 text-[28px] font-bold leading-tight tracking-[-0.02em] text-ink">For site owners</h3>
              <p className="mt-3 max-w-[30rem] text-[17px] leading-relaxed text-muted">
                We put in the network and run it: the equipment, the internet link, the sign-in page and payments. You get WiFi that works without managing it.
              </p>
              <ul className="mt-6 space-y-2.5 text-[15px] text-ink">
                <li>Routers, access points and cabling, installed and tested by our engineer</li>
                <li>The internet link, including satellite where there is no fibre</li>
                <li>Every router watched around the clock, with problems fixed by us</li>
              </ul>
              <Link prefetch={false} href="/wifi" className="mt-8 inline-block text-[15px] font-semibold text-brand underline underline-offset-4 hover:no-underline">What we provide</Link>
            </article>
            <article className="px-5 py-14 sm:px-8">
              <div className="h-1 w-12 bg-ochre" aria-hidden />
              <h3 className="mt-6 text-[28px] font-bold leading-tight tracking-[-0.02em] text-ink">For the people online</h3>
              <p className="mt-3 max-w-[30rem] text-[17px] leading-relaxed text-muted">
                Join the WiFi, choose a plan and pay on the phone. No account, no subscription, no airtime.
              </p>
              <ul className="mt-6 space-y-2.5 text-[15px] text-ink">
                <li>Plans set for each site, paid through Korapay</li>
                <li>Online straight after paying, with a WiFi code for other devices</li>
                <li>Help from a person if anything goes wrong</li>
              </ul>
              <Link prefetch={false} href="/wifi#journey" className="mt-8 inline-block text-[15px] font-semibold text-brand underline underline-offset-4 hover:no-underline">How customers get online</Link>
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
                <p className="mt-2 text-[15px] leading-relaxed text-muted">Our team surveys, installs, visits and supports every site itself, so the people who built a network are the ones who keep it running.</p>
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
            <p className="mt-3 max-w-[40rem] text-[17px] leading-relaxed text-muted">Want WiFi at your site, or need help with a plan you bought? Here is where to reach us.</p>
            <div className="mt-10 grid gap-px overflow-hidden rounded-[var(--radius-panel)] border border-line bg-line md:grid-cols-3">
              <Link prefetch={false} href="/wifi#enquire" className="group bg-surface p-6 hover:bg-brand-soft">
                <p className="text-[17px] font-semibold text-ink group-hover:text-brand">WiFi for your site</p>
                <p className="mt-1 text-sm text-muted">Markets, campuses, hostels, estates, offices and events.</p>
              </Link>
              <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className="group bg-surface p-6 hover:bg-brand-soft">
                <p className="text-[17px] font-semibold text-ink group-hover:text-brand">Help with a plan</p>
                <p className="mt-1 text-sm text-muted">Paid but not online, or lost your code? Message {INSTAGRAM_HANDLE} on Instagram.</p>
              </a>
              <div className="bg-surface p-6">
                <p className="text-[17px] font-semibold text-ink">Anything else</p>
                <p className="mt-1 text-sm text-muted">
                  <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-ink underline underline-offset-2">{CONTACT_EMAIL}</a>
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
