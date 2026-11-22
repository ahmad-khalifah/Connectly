import type { Metadata } from 'next';
import { pageMeta } from '@/lib/seo';
import { SiteHeader } from '@/components/site/site-header';
import { SiteFooter } from '@/components/site/site-footer';
import { Container, CtaBand, PageHero, Photo, SectionTitle } from '@/components/site/blocks';

export const metadata: Metadata = pageMeta('About | Connectly Technologies', 'Connectly Technologies is a technology and infrastructure company working to widen access to reliable connectivity.', '/about');

const VALUES = [
  ['Reliability', 'A network earns trust by working every day. We design for dependability first and measure ourselves by it.'],
  ['Access', 'We start from the people who are hardest to reach and build outward from there.'],
  ['Integrity', 'We say what we can deliver, and we deliver what we say. No inflated claims.'],
  ['Partnership', 'Good networks are built with the organisations and communities that use them, and we stay once they are live.'],
];

export default function AboutPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-surface">
      <SiteHeader />
      <main className="flex-1">
        <PageHero
          title="A technology company built around access."
          intro="Connectly Technologies Ltd designs connectivity solutions, builds the technology that runs them and manages the result as a service."
        />

        <section>
          <Container className="grid gap-12 py-16 md:grid-cols-2 md:py-24">
            <div>
              <SectionTitle title="Who we are" />
              <div className="mt-6 space-y-5 text-[17px] leading-relaxed text-muted">
                <p>
                  Connectly is a technology and infrastructure company. We work on the parts of connectivity that decide whether it is usable: how a network is designed, the software that controls access to it, and the management and support that keep it dependable.
                </p>
                <p>
                  We build and manage network solutions for institutions, businesses and communities. We are an early-stage company, and we grow deliberately: every network we manage teaches us how to run the next one better.
                </p>
              </div>
            </div>
            <Photo src="/site/lab.jpg" alt="A lecturer helping students working at computers in a large room" width={1199} height={799} ratio="aspect-[4/3]" className="md:self-start" />
          </Container>
        </section>

        <section className="bg-canvas">
          <Container className="grid gap-px overflow-hidden py-16 md:grid-cols-2 md:gap-16 md:py-24">
            <div>
              <SectionTitle title="Our vision" />
              <p className="mt-6 text-[26px] font-medium leading-[1.25] tracking-[-0.02em] text-ink sm:text-[30px]">
                Reliable digital access within reach of every community.
              </p>
            </div>
            <div className="mt-12 md:mt-0">
              <SectionTitle title="Our mission" />
              <p className="mt-6 text-[26px] font-medium leading-[1.25] tracking-[-0.02em] text-ink sm:text-[30px]">
                To design, deploy and manage dependable connectivity solutions, and to extend their reach into underserved markets through technology and disciplined delivery.
              </p>
            </div>
          </Container>
        </section>

        <section aria-labelledby="values">
          <Container className="py-16 md:py-24">
            <SectionTitle title="What guides our work" />
            <h2 id="values" className="sr-only">Values</h2>
            <dl className="mt-12 grid gap-x-12 gap-y-10 md:grid-cols-2">
              {VALUES.map(([t, d]) => (
                <div key={t} className="border-t border-line-strong pt-5">
                  <dt className="text-[21px] font-semibold tracking-[-0.01em] text-ink">{t}</dt>
                  <dd className="mt-2 text-[16px] leading-relaxed text-muted">{d}</dd>
                </div>
              ))}
            </dl>
          </Container>
        </section>

        <section className="bg-burgundy-950 text-white">
          <Container className="grid gap-10 py-16 md:grid-cols-[1fr_1.4fr] md:py-24">
            <SectionTitle tone="dark" title="Our commitment to expanding digital access" />
            <div className="space-y-5 text-[18px] leading-relaxed text-white/80">
              <p>Access to dependable connectivity shapes who can learn, trade, work and take part. Too many communities still wait for it.</p>
              <p>We are committed to closing that gap with solutions that are well designed, well run and built to last, and to doing it in partnership with the institutions, businesses and communities that need them.</p>
            </div>
          </Container>
        </section>

        <CtaBand
          title="Let us talk about what you need."
          text="Whether you run a site that needs connectivity or want to work together, we would like to hear from you."
          href="/contact"
          label="Contact us"
          secondaryHref="/solutions"
          secondaryLabel="Our solutions"
        />
      </main>
      <SiteFooter />
    </div>
  );
}
