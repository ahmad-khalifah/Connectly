import type { Metadata } from 'next';
import { pageMeta } from '@/lib/seo';
import Link from 'next/link';
import { SiteHeader } from '@/components/site/site-header';
import { SiteFooter } from '@/components/site/site-footer';
import { Container, CtaBand, PageHero, SectionTitle } from '@/components/site/blocks';

export const metadata: Metadata = pageMeta('Partnerships | Connectly Technologies', 'Connectly Technologies partners with organisations that want to bring reliable connectivity to the people they serve.', '/partnerships');

const WHO = [
  ['Organisations seeking connectivity', 'Institutions, businesses and property owners who want dependable connectivity at their sites, delivered and managed for them.'],
  ['Technology and infrastructure partners', 'Organisations whose capabilities complement ours, and who want to bring connectivity solutions to the markets they know.'],
  ['Institutions and community organisations', 'Groups working to expand access for the communities they serve, and looking for a technology partner to help them do it.'],
];

const BRING = [
  ['Technology', 'Our own platform for access, management and reporting, maintained by our team.'],
  ['Deployment support', 'Practical help from planning through to launch, so a new site opens well.'],
  ['Operating discipline', 'Monitoring, support and a clear point of contact once a site is live.'],
  ['A long-term view', 'We are here to build lasting access, not to hand over and leave.'],
];

export default function PartnershipsPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-surface">
      <SiteHeader />
      <main className="flex-1">
        <PageHero
          title="Partner with Connectly to bring connectivity further."
          intro="We work with organisations that want to extend reliable connectivity to the people and places they serve, and need a technology and infrastructure partner to help."
        >
          <Link prefetch={false} href="/contact" className="inline-flex h-14 items-center justify-center rounded-[var(--radius-control)] bg-sand px-8 text-base font-semibold text-burgundy-950 transition-colors hover:bg-white">Start a conversation</Link>
        </PageHero>

        <section aria-labelledby="who">
          <Container className="py-16 md:py-24">
            <SectionTitle title="Who we partner with" />
            <h2 id="who" className="sr-only">Partner types</h2>
            <ul className="mt-12 grid gap-px overflow-hidden rounded-[var(--radius-panel)] border border-line bg-line md:grid-cols-3">
              {WHO.map(([t, d]) => (
                <li key={t} className="bg-surface p-8 transition-colors hover:bg-sand-soft">
                  <p className="text-[21px] font-semibold leading-snug tracking-[-0.01em] text-ink">{t}</p>
                  <p className="mt-3 text-[16px] leading-relaxed text-muted">{d}</p>
                </li>
              ))}
            </ul>
          </Container>
        </section>

        <section className="bg-burgundy-950 text-white" aria-labelledby="bring">
          <Container className="py-16 md:py-24">
            <SectionTitle tone="dark" title="What we bring to a partnership" />
            <h2 id="bring" className="sr-only">What we bring</h2>
            <dl className="mt-12 grid gap-x-12 gap-y-10 md:grid-cols-2">
              {BRING.map(([t, d]) => (
                <div key={t} className="border-t border-white/20 pt-5">
                  <dt className="text-[21px] font-semibold tracking-[-0.01em]">{t}</dt>
                  <dd className="mt-2 text-[16px] leading-relaxed text-white/75">{d}</dd>
                </div>
              ))}
            </dl>
          </Container>
        </section>

        <section>
          <Container className="grid gap-10 py-16 md:grid-cols-[1fr_1.4fr] md:py-24">
            <SectionTitle title="What we look for" />
            <ul className="space-y-5 text-[18px] leading-relaxed text-muted">
              <li className="flex gap-4"><span aria-hidden className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-sand-strong" />A shared commitment to reliable, lasting access.</li>
              <li className="flex gap-4"><span aria-hidden className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-sand-strong" />Clear responsibilities and honest expectations on both sides.</li>
              <li className="flex gap-4"><span aria-hidden className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-sand-strong" />A long-term view of the communities and sites being served.</li>
            </ul>
          </Container>
        </section>

        <CtaBand
          title="Let us explore working together."
          text="Tell us about your organisation and what you hope to achieve. We will respond personally."
          href="/contact"
          label="Contact us"
        />
      </main>
      <SiteFooter />
    </div>
  );
}
