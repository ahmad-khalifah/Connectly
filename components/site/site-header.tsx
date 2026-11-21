'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { Wordmark } from '@/components/ui/lens-mark';
import { buttonClass } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/wifi', label: 'Managed WiFi' },
  { href: '/#about', label: 'About' },
  { href: '/#contact', label: 'Contact' },
];

export function SiteHeader() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/85">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-5 py-3.5 sm:px-8">
        <Link prefetch={false} href="/" aria-label="Connectly home" onClick={() => setOpen(false)}><Wordmark /></Link>
        <nav aria-label="Main" className="hidden items-center gap-7 md:flex">
          {NAV.map((n) => (
            <Link prefetch={false} key={n.href} href={n.href} aria-current={path === n.href ? 'page' : undefined}
              className={cn('text-[15px] font-medium transition-colors', path === n.href ? 'text-brand' : 'text-muted hover:text-ink')}>
              {n.label}
            </Link>
          ))}
          <Link prefetch={false} href="/#contact" className={buttonClass({ size: 'sm' })}>Talk to us</Link>
        </nav>
        <button type="button" className="rounded-md p-2 md:hidden" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={open ? 'Close menu' : 'Open menu'}>
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      {open && (
        <nav aria-label="Main" className="border-t border-line px-5 pb-5 pt-2 md:hidden">
          <ul className="divide-y divide-line">
            {NAV.map((n) => (
              <li key={n.href}><Link prefetch={false} href={n.href} onClick={() => setOpen(false)} className="block py-3 text-base font-semibold text-ink">{n.label}</Link></li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}
