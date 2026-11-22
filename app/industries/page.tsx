import type { Metadata } from 'next';
import { pageMeta } from '@/lib/seo';
import { SiteHeader } from '@/components/site/site-header';
import { SiteFooter } from '@/components/site/site-footer';
import { Container, CtaBand, PageHero, Photo } from '@/components/site/blocks';
import { Rings } from '@/components/site/rings';
import { cn } from '@/lib/utils';

export const metadata: Metadata = pageMeta('Industries | Connectly Technologies', 'Connectivity solutions for institutions, businesses, residential communities and underserved markets.', '/industries');

type Sector = { title: string; lead: string; text: string; points: string[]; photo?: { src: string; alt: string; w: number; h: number } };

const SECTORS: Sector[] = [
  {
    title: 'Institutions',
    lead: 'Universities, colleges and schools.',
    text: 'Learning and administration now depend on connectivity. We design networks that cope with many people online at once, and manage them so staff can concentrate on teaching.',
    points: ['Built for large numbers of users', 'Straightforward access for students and staff', 'Reporting for those who run the institution'],
    photo: { src: '/site/classroom.jpg', alt: 'A teacher helping children using laptops in a classroom', w: 736, h: 414 },
  },
  {
    title: 'Businesses',
    lead: 'Offices, commercial spaces and trading centres.',
    text: 'Staff, customers and tenants all expect to get online. We provide dependable connectivity as a managed service, with clear visibility for the people responsible for the space.',
    points: ['Reliable access for staff and visitors', 'Managed so you do not have to', 'Simple reporting and a point of contact'],
  },
  {
    title: 'Residential communities',
    lead: 'Estates and shared housing.',
    text: 'Residents want connectivity that simply works. We plan and manage networks for shared housing so access is consistent across the community.',
    points: ['Planned around how residents live', 'Consistent access across the community', 'Support when residents need it'],
    photo: { src: '/site/campus.jpg', alt: 'Friends studying together with laptops outdoors', w: 626, h: 417 },
  },
  {
    title: 'Underserved markets and communities',
    lead: 'Where reliable access is hardest to find.',
    text: 'This is where our ambition lies. We are building the technology and the operating discipline to bring dependable connectivity to communities and markets that have been left waiting, working with partners who share that goal.',
    points: ['Designed for practical, local conditions', 'Built with the organisations that serve these communities', 'Focused on access that lasts'],
    photo: { src: '/site/community.jpg', alt: 'A man in a straw hat using a tablet in a green field', w: 626, h: 417 },
  },
];

export default function IndustriesPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-surface">
      <SiteHeader />
      <main className="flex-1">
        <PageHero
          title="Built for places where many people depend on one connection."
          intro="Our solutions serve institutions, businesses and communities, and reach toward the markets where reliable access matters most."
        />

        <section aria-labelledby="sectors">
          <h2 id="sectors" className="sr-only">Who we serve</h2>
          {SECTORS.map((s, i) => (
            <div key={s.title} className={cn(i % 2 === 1 && 'bg-canvas')}>
              <Container className="grid items-center gap-10 py-16 md:grid-cols-2 md:gap-16 md:py-24">
                <div className={cn(i % 2 === 1 && 'md:order-2')}>
                  <div className="h-1 w-12 rounded-full bg-sand-strong" aria-hidden />
                  <h3 className="mt-5 text-[30px] font-semibold leading-[1.1] tracking-[-0.025em] text-ink sm:text-[38px]">{s.title}</h3>
                  <p className="mt-3 text-[18px] font-medium text-brand">{s.lead}</p>
                  <p className="mt-4 text-[17px] leading-relaxed text-muted">{s.text}</p>
                  <ul className="mt-6 space-y-2.5 text-[16px] text-ink">
                    {s.points.map((p) => (
                      <li key={p} className="flex gap-3"><span aria-hidden className="mt-[10px] h-1.5 w-1.5 shrink-0 rounded-full bg-sand-strong" />{p}</li>
                    ))}
                  </ul>
                </div>
                {s.photo ? (
                  <Photo src={s.photo.src} alt={s.photo.alt} width={s.photo.w} height={s.photo.h} ratio="aspect-[4/3]" />
                ) : (
                  <div className="relative aspect-[4/3] overflow-hidden rounded-[var(--radius-panel)] bg-burgundy-950" aria-hidden>
                    <Rings quiet className="absolute -right-16 -top-16 h-[26rem] w-[26rem]" />
                  </div>
                )}
              </Container>
            </div>
          ))}
        </section>

        <CtaBand
          title="Not sure which describes you?"
          text="Tell us about your organisation and what you need. We will help you work out the right starting point."
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
