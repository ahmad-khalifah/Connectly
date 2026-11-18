import type { Metadata } from 'next';
import { SiteHeader } from '@/components/site/site-header';
import { SiteFooter } from '@/components/site/site-footer';
import { EnquiryForm } from '@/components/site/enquiry-form';
import { buttonClass } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Connectly Consultancy | Enter and grow in Northern Nigeria',
  description: 'Market entry strategy, local research, partnerships, customer acquisition and regional expansion for companies working in Northern Nigeria.',
};

const SERVICES = [
  ['Market entry strategy', 'Which states and cities first, which customers, which route to market, and in what order.'],
  ['Market research and intelligence', 'What people buy, how they pay, who they trust and what competitors do, gathered on the ground.'],
  ['Market validation', 'Small, quick tests with real customers before you commit budget, so you know what works.'],
  ['Customer acquisition and adoption', 'Getting the first customers to try, use and keep using your product, and learning why.'],
  ['Business development', 'Finding distributors, agents and resellers, and opening the first commercial conversations.'],
  ['Partnerships and stakeholder engagement', 'Introductions to and work with associations, institutions and community leaders whose support matters.'],
  ['Regional expansion', 'Taking what works in one state into the next, with the local differences planned for.'],
];

const STAGES = [
  ['Understand', 'Research and conversations on the ground.', 'A clear picture of the market and where you fit.'],
  ['Validate', 'Small tests with real customers and partners.', 'Evidence of what sells, to whom, at what price.'],
  ['Enter', 'Partners, first customers and a working route to market.', 'A live presence you can build on.'],
  ['Grow', 'Adoption, business development and the next locations.', 'A repeatable plan for expansion.'],
];

const SECTORS = ['Consumer goods and retail', 'Financial services and payments', 'Telecoms and digital services', 'Agriculture and food', 'Health', 'Education', 'Energy', 'Development programmes'];

/** Two rings and their overlap: your company, the market, and where we work. */
function OverlapDiagram() {
  const lens = 'M200 74.6 A110 110 0 0 1 200 285.4 A110 110 0 0 1 200 74.6 Z';
  return (
    <svg viewBox="0 0 400 360" className="h-auto w-full max-w-md" role="img" aria-label="Two overlapping circles: your company and the market. The overlap is where Connectly Consultancy works.">
      <path d={lens} fill="var(--color-ochre)" opacity="0.7" />
      <circle cx="140" cy="180" r="110" fill="none" stroke="var(--color-indigo)" strokeWidth="3" />
      <circle cx="260" cy="180" r="110" fill="none" stroke="var(--color-indigo)" strokeWidth="3" />
      <text x="88" y="184" textAnchor="middle" className="fill-[var(--color-ink)] text-[15px] font-semibold">Your company</text>
      <text x="312" y="184" textAnchor="middle" className="fill-[var(--color-ink)] text-[15px] font-semibold">The market</text>
      <text x="200" y="330" textAnchor="middle" className="fill-[var(--color-muted)] text-[13px]">Where we work</text>
      <line x1="200" y1="300" x2="200" y2="270" stroke="var(--color-muted)" strokeWidth="1" />
    </svg>
  );
}

export default function ConsultancyPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-surface">
      <SiteHeader />
      <main className="flex-1">
        <section className="border-b border-line">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 sm:px-8 md:py-24 lg:grid-cols-[1.2fr_1fr]">
            <div>
              <p className="text-[15px] font-semibold text-indigo">Connectly Consultancy</p>
              <h1 className="mt-3 max-w-[16ch] text-[42px] font-bold leading-[1.04] tracking-[-0.03em] text-ink sm:text-[56px]">Enter and grow in Northern Nigeria.</h1>
              <p className="mt-6 max-w-[36rem] text-lg leading-relaxed text-muted">
                We help companies understand the North, test their offer, find the right partners and win their first customers, with a team based in the region.
              </p>
              <a href="#enquire" className={`mt-9 ${buttonClass({ size: 'lg', variant: 'indigo' })}`}>Discuss your plans</a>
            </div>
            <div className="flex justify-center lg:justify-end"><OverlapDiagram /></div>
          </div>
        </section>

        <section aria-labelledby="services">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 md:py-20">
            <h2 id="services" className="text-[28px] font-bold tracking-[-0.02em] text-ink">What we do</h2>
            <dl className="mt-10 grid gap-x-12 gap-y-8 md:grid-cols-2">
              {SERVICES.map(([t, d]) => (
                <div key={t} className="border-t border-line pt-5">
                  <dt className="text-[17px] font-semibold text-ink">{t}</dt>
                  <dd className="mt-1.5 text-[15px] leading-relaxed text-muted">{d}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section aria-labelledby="stages" className="border-y border-line bg-indigo-soft/50">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 md:py-20">
            <h2 id="stages" className="text-[28px] font-bold tracking-[-0.02em] text-ink">How we work</h2>
            <p className="mt-3 max-w-[40rem] text-[17px] leading-relaxed text-muted">Four stages. You can start at any of them, and stop once you have what you need.</p>
            <ol className="mt-10 grid gap-px overflow-hidden rounded-[var(--radius-panel)] border border-line bg-line md:grid-cols-4">
              {STAGES.map(([t, what, get], i) => (
                <li key={t} className="bg-surface p-6">
                  <p className="tnum text-sm font-semibold text-indigo">{i + 1}</p>
                  <p className="mt-1 text-[19px] font-bold text-ink">{t}</p>
                  <p className="mt-2 text-[15px] leading-relaxed text-muted">{what}</p>
                  <p className="mt-3 text-[15px] leading-relaxed text-ink"><span className="font-semibold">You get:</span> {get}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section aria-labelledby="who">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
            <h2 id="who" className="text-[28px] font-bold tracking-[-0.02em] text-ink">Who we work with</h2>
            <p className="mt-3 max-w-[42rem] text-[17px] leading-relaxed text-muted">
              Companies and organisations from elsewhere in Nigeria or abroad that want customers, partners or operations in the North.
              The consultancy is separate from our WiFi business: you do not need to be a WiFi customer.
            </p>
            <ul className="mt-8 flex flex-wrap gap-2">
              {SECTORS.map((s) => <li key={s} className="rounded-full border border-line px-4 py-2 text-[15px] text-ink">{s}</li>)}
            </ul>
          </div>
        </section>

        <section id="enquire" aria-labelledby="enquire-title" className="scroll-mt-20 border-t border-line bg-canvas">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 sm:px-8 md:py-20 lg:grid-cols-[1fr_1.6fr]">
            <div>
              <h2 id="enquire-title" className="text-[28px] font-bold tracking-[-0.02em] text-ink">Discuss your plans</h2>
              <p className="mt-3 text-[17px] leading-relaxed text-muted">Tell us what you are trying to do. The first conversation is to understand it; we suggest a scope only once we do.</p>
            </div>
            <EnquiryForm kind="consultancy" />
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
