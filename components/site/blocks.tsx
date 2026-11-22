import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Rings } from './rings';

/** Page width and side padding, the same on every section. */
export function Container({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('mx-auto w-full max-w-6xl px-5 sm:px-8', className)}>{children}</div>;
}

/** Opening block of every inner page: dark, with the mark drawn quietly behind. */
export function PageHero({ title, intro, children }: { title: string; intro: string; children?: React.ReactNode }) {
  return (
    <section className="relative overflow-hidden bg-burgundy-950 text-white">
      <Rings quiet className="absolute -right-64 -top-20 h-[32rem] w-[32rem] md:-right-52 md:-top-28 md:h-[40rem] md:w-[40rem]" />
      <Container className="relative py-16 md:py-24">
        <h1 className="cx-rise max-w-[16ch] text-[40px] font-semibold leading-[1.04] tracking-[-0.035em] sm:text-[56px] md:text-[64px]">{title}</h1>
        <p className="cx-rise mt-6 max-w-[34rem] text-lg leading-relaxed text-white/80 [animation-delay:120ms]">{intro}</p>
        {children && <div className="cx-rise mt-9 [animation-delay:220ms]">{children}</div>}
      </Container>
    </section>
  );
}

/** Heading with a short sand rule above it; the rule marks where a section starts. */
export function SectionTitle({ title, intro, tone = 'light', className }: { title: string; intro?: string; tone?: 'light' | 'dark'; className?: string }) {
  return (
    <div className={cn('max-w-[42rem]', className)}>
      <div className="h-1 w-12 rounded-full bg-sand-strong" aria-hidden />
      <h2 className={cn('mt-5 text-[30px] font-semibold leading-[1.1] tracking-[-0.025em] sm:text-[38px]', tone === 'dark' ? 'text-white' : 'text-ink')}>{title}</h2>
      {intro && <p className={cn('mt-4 text-[17px] leading-relaxed', tone === 'dark' ? 'text-white/75' : 'text-muted')}>{intro}</p>}
    </div>
  );
}

/** A photograph under a burgundy tint so photos of different quality sit together. */
export function Photo({ src, alt, className, ratio = 'aspect-[4/3]', width, height }: { src: string; alt: string; className?: string; ratio?: string; width: number; height: number }) {
  return (
    <div className={cn('relative overflow-hidden rounded-[var(--radius-panel)] bg-burgundy-900', ratio, className)}>
      {/* A plain img on purpose: image optimisation is not part of the free plan. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} width={width} height={height} loading="lazy" decoding="async" className="h-full w-full object-cover" />
      <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-burgundy-950/55 via-burgundy-900/10 to-burgundy-800/20 mix-blend-multiply" />
    </div>
  );
}

/** Closing call to action, repeated at the foot of each page. */
export function CtaBand({ title, text, href, label, secondaryHref, secondaryLabel }: { title: string; text: string; href: string; label: string; secondaryHref?: string; secondaryLabel?: string }) {
  return (
    <section className="bg-sand-soft">
      <Container className="flex flex-col gap-8 py-14 md:flex-row md:items-center md:justify-between md:py-16">
        <div className="max-w-[36rem]">
          <h2 className="text-[28px] font-semibold leading-tight tracking-[-0.02em] text-burgundy-950 sm:text-[34px]">{title}</h2>
          <p className="mt-3 text-[17px] leading-relaxed text-burgundy-950/75">{text}</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link prefetch={false} href={href} className="inline-flex h-14 items-center justify-center rounded-[var(--radius-control)] bg-brand px-7 text-base font-semibold text-white transition-colors hover:bg-brand-strong">{label}</Link>
          {secondaryHref && secondaryLabel && (
            <Link prefetch={false} href={secondaryHref} className="inline-flex h-14 items-center justify-center rounded-[var(--radius-control)] border border-burgundy-950/25 px-7 text-base font-semibold text-burgundy-950 transition-colors hover:bg-white/60">{secondaryLabel}</Link>
          )}
        </div>
      </Container>
    </section>
  );
}
