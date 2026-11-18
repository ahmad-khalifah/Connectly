import type { Metadata } from 'next';
import { SiteHeader } from '@/components/site/site-header';
import { SiteFooter } from '@/components/site/site-footer';
import { EnquiryForm } from '@/components/site/enquiry-form';
import { LensMark } from '@/components/ui/lens-mark';
import { buttonClass } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Managed WiFi | Connectly',
  description: 'Paid WiFi for markets, campuses, hostels and estates, designed, installed and run by Connectly. Customers pay on their phone and are online in seconds.',
};

const PROVIDE = [
  ['Site survey and design', 'We walk the site, measure where people gather, and plan access points so coverage overlaps instead of dropping out.'],
  ['Installation', 'Router, switch, access points and cabling, installed by our engineer and tested before opening.'],
  ['The internet link', 'Fibre or mobile where it is good, satellite where there is nothing else, sized to the number of people.'],
  ['Payments and access', 'The sign-in page, plans, payment through Korapay, WiFi codes and the device and speed limits on each plan.'],
  ['Monitoring', 'Every router reports its health every minute. Problems show on our console before customers call.'],
  ['Reporting', 'Revenue, payments and customers per site, from the same records the payments come from.'],
];

const STEPS = [
  ['Join the WiFi', 'The sign-in page opens by itself and shows the plans for this site.', 'off'],
  ['Pay on the phone', 'Choose a plan and pay through Korapay. The price shown is the price paid.', 'pending'],
  ['Online', 'The phone is connected by itself. Other devices sign in with the WiFi code.', 'on'],
] as const;

const GO_LIVE = [
  ['Survey', 'A visit to see the site, the power and the internet options.'],
  ['Design and quote', 'Where each access point goes, what the link is, and what it costs.'],
  ['Install', 'Router, access points, switch and cabling.'],
  ['Test', 'Every step a customer takes, on real phones, before anyone pays.'],
  ['Open', 'Plans go on sale and the site starts earning.'],
  ['Run', 'We monitor, support and update the site from then on.'],
];

const PLACES = ['Markets and shopping centres', 'Universities and colleges', 'Student accommodation', 'Schools', 'Estates and housing', 'Offices and business hubs', 'Events and conferences', 'Community spaces'];

export default function WifiPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-surface">
      <SiteHeader />
      <main className="flex-1">
        <section className="border-b border-line">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 md:py-24">
            <h1 className="max-w-[16ch] text-[42px] font-bold leading-[1.04] tracking-[-0.03em] text-ink sm:text-[56px]">Paid WiFi for busy places, built and run for you.</h1>
            <p className="mt-6 max-w-[38rem] text-lg leading-relaxed text-muted">
              Connectly puts in the network and runs it: the equipment, the internet link, the sign-in page and payments. Your customers pay for time on their phone; you get WiFi that works without managing it.
            </p>
            <a href="#enquire" className={`mt-9 ${buttonClass({ size: 'lg' })}`}>Enquire about your site</a>
          </div>
        </section>

        <section aria-labelledby="journey" className="border-b border-line bg-canvas">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
            <h2 id="journey" className="text-[28px] font-bold tracking-[-0.02em] text-ink">How customers get online</h2>
            <ol className="mt-10 grid gap-10 md:grid-cols-3">
              {STEPS.map(([title, text, state], i) => (
                <li key={title} className="flex gap-4">
                  <LensMark className="h-12 w-12" state={state} title={i === 2 ? 'Connected' : undefined} />
                  <div>
                    <p className="text-[17px] font-semibold text-ink">{i + 1}. {title}</p>
                    <p className="mt-1 text-[15px] leading-relaxed text-muted">{text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section aria-labelledby="provide">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 md:py-20">
            <h2 id="provide" className="text-[28px] font-bold tracking-[-0.02em] text-ink">What Connectly provides</h2>
            <dl className="mt-10 grid gap-x-12 gap-y-8 md:grid-cols-2">
              {PROVIDE.map(([t, d]) => (
                <div key={t} className="border-t border-line pt-5">
                  <dt className="text-[17px] font-semibold text-ink">{t}</dt>
                  <dd className="mt-1.5 text-[15px] leading-relaxed text-muted">{d}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section aria-labelledby="golive" className="border-y border-line bg-canvas">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 md:py-20">
            <h2 id="golive" className="text-[28px] font-bold tracking-[-0.02em] text-ink">How a site goes live</h2>
            <ol className="mt-10 grid gap-px overflow-hidden rounded-[var(--radius-panel)] border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
              {GO_LIVE.map(([t, d], i) => (
                <li key={t} className="bg-surface p-6">
                  <p className="tnum text-sm font-semibold text-brand">Step {i + 1}</p>
                  <p className="mt-1 text-[17px] font-semibold text-ink">{t}</p>
                  <p className="mt-1 text-[15px] leading-relaxed text-muted">{d}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section aria-labelledby="places">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
            <h2 id="places" className="text-[28px] font-bold tracking-[-0.02em] text-ink">Where it works</h2>
            <p className="mt-3 max-w-[40rem] text-[17px] leading-relaxed text-muted">Anywhere many people spend time and need to get online for a while: an hour in the market, a day on campus, a month in a hostel.</p>
            <ul className="mt-8 flex flex-wrap gap-2">
              {PLACES.map((p) => <li key={p} className="rounded-full border border-line px-4 py-2 text-[15px] text-ink">{p}</li>)}
            </ul>
          </div>
        </section>

        <section id="enquire" aria-labelledby="enquire-title" className="scroll-mt-20 border-t border-line bg-canvas">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 sm:px-8 md:py-20 lg:grid-cols-[1fr_1.6fr]">
            <div>
              <h2 id="enquire-title" className="text-[28px] font-bold tracking-[-0.02em] text-ink">WiFi for your site</h2>
              <p className="mt-3 text-[17px] leading-relaxed text-muted">Tell us about the place. We will come back with questions, and then a visit.</p>
            </div>
            <EnquiryForm kind="wifi" />
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
