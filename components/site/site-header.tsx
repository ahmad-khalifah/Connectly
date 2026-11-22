'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { Wordmark } from '@/components/ui/lens-mark';
import { cn } from '@/lib/utils';

export const NAV = [
  { href: '/about', label: 'About' },
  { href: '/solutions', label: 'Solutions' },
  { href: '/industries', label: 'Industries' },
  { href: '/partnerships', label: 'Partnerships' },
  { href: '/contact', label: 'Contact' },
];

export function SiteHeader() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-burgundy-950/95 text-white backdrop-blur supports-[backdrop-filter]:bg-burgundy-950/90">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-5 py-3.5 sm:px-8">
        <Link prefetch={false} href="/" aria-label="Connectly Technologies home" onClick={() => setOpen(false)}><Wordmark tone="light" /></Link>
        <nav aria-label="Main" className="hidden items-center gap-8 md:flex">
          {NAV.slice(0, 4).map((n) => (
            <Link prefetch={false} key={n.href} href={n.href} aria-current={path === n.href ? 'page' : undefined}
              className={cn('text-[15px] font-medium transition-colors', path === n.href ? 'text-sand' : 'text-white/75 hover:text-white')}>
              {n.label}
            </Link>
          ))}
          <Link prefetch={false} href="/contact" className="inline-flex h-10 items-center rounded-[var(--radius-control)] bg-sand px-5 text-[15px] font-semibold text-burgundy-950 transition-colors hover:bg-white">
            Contact us
          </Link>
        </nav>
        <button type="button" className="flex h-11 items-center gap-2 rounded-md px-3 text-[15px] font-semibold hover:bg-white/10 md:hidden" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="mobile-nav" aria-label={open ? 'Close menu' : 'Open menu'}>
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          Menu
        </button>
      </div>
      <div id="mobile-nav" className={cn('grid transition-[grid-template-rows] duration-300 ease-out md:hidden', open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
        <nav aria-label="Main" className="overflow-hidden">
          <ul className="divide-y divide-white/10 px-5 pb-4">
            {NAV.map((n) => (
              <li key={n.href}>
                <Link prefetch={false} href={n.href} tabIndex={open ? 0 : -1} onClick={() => setOpen(false)} className={cn('block py-4 text-lg font-semibold', path === n.href ? 'text-sand' : 'text-white')}>{n.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
