import type { Metadata } from 'next';
import { pageMeta } from '@/lib/seo';
import Link from 'next/link';
import { SiteHeader } from '@/components/site/site-header';
import { SiteFooter } from '@/components/site/site-footer';
import { Container, CtaBand, PageHero, SectionTitle } from '@/components/site/blocks';

export const metadata: Metadata = pageMeta('Solutions | Connectly Technologies', 'Managed network solutions, connectivity planning, digital access platforms, monitoring and support, reporting and deployment support.', '/solutions');

const SOLUTIONS = [
  { title: 'Managed network solutions', text: 'We design, deploy and manage wireless networks for shared spaces as one service, so the owner has a network that works without having to run it.', points: ['Designed around how the space is used', 'Deployed and tested before opening', 'Managed day to day by our team'] },
  { title: 'Connectivity planning', text: 'Before anything is built, we work out what the place needs: who will use it, when, and what they depend on it for.', points: ['Assessment of need and usage', 'A clear plan and scope', 'Honest advice on what is realistic'] },
  { title: 'Digital access platforms', text: 'Our own software governs who connects, for how long and on what terms, with a simple experience for the person getting online.', points: ['Straightforward sign-in for users', 'Flexible access models for operators', 'Built and maintained by Connectly'] },
  { title: 'Monitoring and support', text: 'Every network we manage is watched continuously, and problems are dealt with by a team that owns the outcome.', points: ['Continuous visibility', 'Prompt response to issues', 'A named point of contact'] },
  { title: 'Reporting and insight', text: 'Owners see how their network is used and how it performs, in plain reports they can act on.', points: ['Usage and performance reporting', 'Clear records for the people who manage it', 'Insight that informs the next decision'] },
  { title: 'Deployment support', text: 'For organisations that want to extend connectivity to new sites, we offer practical support from planning through to launch.', points: ['Planning and readiness', 'Support through installation and launch', 'A path to ongoing management'] },
];

const STEPS = [
  ['Discover', 'We learn about the place, the people and what the network must do.'],
  ['Design', 'We plan a solution that fits, and agree the scope with you.'],
  ['Deploy', 'We build and test it properly before anyone relies on it.'],
  ['Operate', 'We manage and support it, and keep improving it.'],
];

export default function SolutionsPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-surface">
      <SiteHeader />
      <main className="flex-1">
        <PageHero
          title="Connectivity solutions, from first plan to daily operation."
          intro="Design, technology and management that work together, so organisations get dependable connectivity without carrying the complexity."
        >
          <Link prefetch={false} href="/contact" className="inline-flex h-14 items-center justify-center rounded-[var(--radius-control)] bg-sand px-8 text-base font-semibold text-burgundy-950 transition-colors hover:bg-white">Discuss your needs</Link>
        </PageHero>

        <section aria-labelledby="sol">
          <Container className="py-16 md:py-24">
            <h2 id="sol" className="sr-only">Our solutions</h2>
            <ul className="grid gap-px overflow-hidden rounded-[var(--radius-panel)] border border-line bg-line md:grid-cols-2">
              {SOLUTIONS.map((s) => (
                <li key={s.title} className="bg-surface p-8 transition-colors hover:bg-sand-soft">
                  <p className="text-[22px] font-semibold tracking-[-0.015em] text-ink">{s.title}</p>
                  <p className="mt-3 text-[16px] leading-relaxed text-muted">{s.text}</p>
                  <ul className="mt-5 space-y-2 text-[15px] text-ink">
                    {s.points.map((p) => (
                      <li key={p} className="flex gap-3"><span aria-hidden className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-sand-strong" />{p}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </Container>
        </section>

        <section className="bg-canvas" aria-labelledby="how">
          <Container className="py-16 md:py-24">
            <SectionTitle title="How we work with you" intro="A clear sequence, with a decision point at each stage." />
            <h2 id="how" className="sr-only">Process</h2>
            <ol className="mt-12 grid gap-8 md:grid-cols-4">
              {STEPS.map(([t, d], i) => (
                <li key={t} className="border-t-2 border-brand pt-5">
                  <p className="tnum text-[15px] font-semibold text-brand">Step {i + 1}</p>
                  <p className="mt-1 text-[21px] font-semibold tracking-[-0.01em] text-ink">{t}</p>
                  <p className="mt-2 text-[15px] leading-relaxed text-muted">{d}</p>
                </li>
              ))}
            </ol>
          </Container>
        </section>

        <CtaBand
          title="Tell us about your site."
          text="Share what you need and we will come back to you with questions and next steps."
          href="/contact"
          label="Start a conversation"
          secondaryHref="/industries"
          secondaryLabel="Who we serve"
        />
      </main>
      <SiteFooter />
    </div>
  );
}
