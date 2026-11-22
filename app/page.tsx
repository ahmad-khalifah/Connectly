import type { Metadata } from 'next';
import { pageMeta } from '@/lib/seo';
import Link from 'next/link';
import { ArrowRight, Network, Compass, ShieldCheck, LineChart, Handshake, Layers } from 'lucide-react';
import { SiteHeader } from '@/components/site/site-header';
import { SiteFooter } from '@/components/site/site-footer';
import { Container, CtaBand, Photo, SectionTitle } from '@/components/site/blocks';
import { Rings } from '@/components/site/rings';

export const metadata: Metadata = pageMeta('Connectly Technologies | Connectivity infrastructure and managed network solutions', 'Connectly Technologies designs and manages network solutions for institutions, businesses and communities, with the ambition of widening access to reliable connectivity.', '/');

const CAPABILITIES = [
  { icon: Network, title: 'Managed network solutions', text: 'Wireless networks for shared spaces, designed, deployed and managed as one service.' },
  { icon: Compass, title: 'Connectivity planning', text: 'We study how a place is used, then shape the network around the people who rely on it.' },
  { icon: Layers, title: 'Digital access platforms', text: 'Software that controls who connects, for how long and under what terms.' },
  { icon: ShieldCheck, title: 'Monitoring and support', text: 'Continuous visibility of every network we manage, and a team that responds.' },
  { icon: LineChart, title: 'Reporting and insight', text: 'Clear reporting so owners understand how their network is used and how it performs.' },
  { icon: Handshake, title: 'Deployment support', text: 'Practical help for organisations that want to extend connectivity to new sites.' },
];

const AUDIENCES = [
  { title: 'Institutions', text: 'Universities, colleges and schools.', photo: '/site/classroom.jpg', w: 736, h: 414 },
  { title: 'Businesses', text: 'Offices, commercial spaces and trading centres.', photo: '/site/businesses.jpg', w: 1200, h: 801 },
  { title: 'Residential communities', text: 'Estates and shared housing.', photo: '/site/residential.jpg', w: 1200, h: 800 },
  { title: 'Underserved markets', text: 'Communities where reliable access is hardest to find.', photo: '/site/community.jpg', w: 626, h: 417 },
];

export default function Home() {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-surface">
      <SiteHeader />
      <main className="flex-1">
        {/* Hero: the claim, drawn with the brand's own mark. */}
        <section className="relative overflow-hidden bg-burgundy-950 text-white">
          <Container className="grid items-center gap-12 py-16 md:py-24 lg:grid-cols-[1.15fr_0.85fr] lg:py-28">
            <div>
              <h1 className="cx-rise max-w-[15ch] text-[42px] font-semibold leading-[1.03] tracking-[-0.04em] sm:text-[60px] lg:text-[66px]">
                Reliable connectivity, built where it matters most.
              </h1>
              <p className="cx-rise mt-7 max-w-[36rem] text-lg leading-relaxed text-white/80 [animation-delay:120ms] sm:text-xl">
                Connectly Technologies designs and manages network solutions for institutions, businesses and communities, with the ambition of widening access to dependable connectivity across underserved markets.
              </p>
              <div className="cx-rise mt-10 flex flex-col gap-3 [animation-delay:240ms] sm:flex-row">
                <Link prefetch={false} href="/contact" className="inline-flex h-14 items-center justify-center rounded-[var(--radius-control)] bg-sand px-8 text-base font-semibold text-burgundy-950 transition-colors hover:bg-white">Talk to our team</Link>
                <Link prefetch={false} href="/solutions" className="inline-flex h-14 items-center justify-center rounded-[var(--radius-control)] border border-white/30 px-8 text-base font-semibold text-white transition-colors hover:bg-white/10">Explore our solutions</Link>
              </div>
            </div>
            <div className="cx-rise mx-auto aspect-square w-full max-w-[19rem] [animation-delay:300ms] sm:max-w-[24rem] lg:max-w-none">
              <Rings className="h-full w-full" />
            </div>
          </Container>
        </section>

        {/* Who we are */}
        <section className="border-b border-line">
          <Container className="grid gap-10 py-16 md:grid-cols-[1.6fr_1fr] md:items-end md:py-24">
            <p className="text-[26px] font-medium leading-[1.25] tracking-[-0.02em] text-ink sm:text-[34px]">
              We are a technology company. We design the network, build the platform that runs it and manage the result, so the people who depend on it do not have to think about it.
            </p>
            <Link prefetch={false} href="/about" className="group inline-flex items-center gap-2 text-[17px] font-semibold text-brand">
              About Connectly
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" aria-hidden />
            </Link>
          </Container>
        </section>

        {/* Capabilities */}
        <section aria-labelledby="capabilities" className="bg-canvas">
          <Container className="py-16 md:py-24">
            <SectionTitle title="What we do" intro="Connectivity is more than a signal. It is design, software, management and support working together." />
            <h2 id="capabilities" className="sr-only">Capabilities</h2>
            <ul className="mt-12 grid gap-px overflow-hidden rounded-[var(--radius-panel)] border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
              {CAPABILITIES.map(({ icon: Icon, title, text }) => (
                <li key={title} className="bg-surface p-7 transition-colors hover:bg-sand-soft">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand text-sand"><Icon className="h-5 w-5" aria-hidden /></span>
                  <p className="mt-5 text-[19px] font-semibold tracking-[-0.01em] text-ink">{title}</p>
                  <p className="mt-2 text-[15px] leading-relaxed text-muted">{text}</p>
                </li>
              ))}
            </ul>
            <Link prefetch={false} href="/solutions" className="group mt-10 inline-flex items-center gap-2 text-[17px] font-semibold text-brand">
              All solutions
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" aria-hidden />
            </Link>
          </Container>
        </section>

        {/* People, not equipment */}
        <section className="relative isolate overflow-hidden bg-burgundy-950 text-white">
          <Photo src="/site/lab.jpg" alt="Students working at computers in a lecture room while a lecturer helps" width={1199} height={799} ratio="aspect-auto" className="absolute inset-0 -z-10 h-full w-full rounded-none opacity-45" />
          <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-r from-burgundy-950 via-burgundy-950/80 to-burgundy-950/30" />
          <Container className="py-24 md:py-36">
            <p className="max-w-[22ch] text-[34px] font-semibold leading-[1.08] tracking-[-0.03em] sm:text-[52px]">
              Connectivity changes what a classroom, a business or a community can do.
            </p>
            <Link prefetch={false} href="/industries" className="group mt-9 inline-flex items-center gap-2 text-[17px] font-semibold text-sand">
              Who we serve
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" aria-hidden />
            </Link>
          </Container>
        </section>

        {/* Industries */}
        <section aria-labelledby="serve">
          <Container className="py-16 md:py-24">
            <SectionTitle title="Who we serve" intro="Our solutions are built for places where many people need dependable access at the same time." />
            <h2 id="serve" className="sr-only">Industries</h2>
            <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {AUDIENCES.map((a) => (
                <li key={a.title}>
                  <Link prefetch={false} href="/industries" className="group block">
                    {a.photo ? (
                      <Photo src={a.photo} alt="" width={a.w} height={a.h} ratio="aspect-[5/4]" className="transition-transform duration-500 group-hover:scale-[1.02]" />
                    ) : (
                      <div className="relative aspect-[5/4] overflow-hidden rounded-[var(--radius-panel)] bg-burgundy-900">
                        <Rings quiet className="absolute -right-10 -top-10 h-64 w-64" />
                      </div>
                    )}
                    <p className="mt-4 text-[19px] font-semibold tracking-[-0.01em] text-ink group-hover:text-brand">{a.title}</p>
                    <p className="mt-1 text-[15px] leading-relaxed text-muted">{a.text}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </Container>
        </section>

        {/* Ambition */}
        <section className="bg-burgundy-900 text-white">
          <Container className="grid gap-10 py-16 md:grid-cols-[1fr_1.4fr] md:py-24">
            <SectionTitle tone="dark" title="Our ambition" />
            <div>
              <p className="text-[24px] font-medium leading-[1.3] tracking-[-0.015em] sm:text-[30px]">
                Reliable connectivity should not depend on where someone lives or how hard it is to build for.
              </p>
              <p className="mt-5 max-w-[36rem] text-[17px] leading-relaxed text-white/75">
                We are building the technology and the operating discipline to bring dependable access to markets that have been left waiting, one well-run network at a time.
              </p>
            </div>
          </Container>
        </section>

        <CtaBand
          title="Looking for a technology and infrastructure partner?"
          text="We work with organisations that want to bring connectivity to the people they serve."
          href="/partnerships"
          label="Partner with us"
          secondaryHref="/contact"
          secondaryLabel="Contact us"
        />
      </main>
      <SiteFooter />
    </div>
  );
}
