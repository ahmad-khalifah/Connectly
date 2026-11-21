'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, Users, CreditCard, MapPin, Router, ArrowLeftRight, TrendingUp, Receipt,
  LifeBuoy, Settings, LogOut, ListChecks, KeyRound, Bell, Menu, X,
} from 'lucide-react';
import { Wordmark } from '@/components/ui/lens-mark';
import { cn } from '@/lib/utils';
import { browserAuth } from '@/lib/auth/browser';

type NavItem = { name: string; href: string; icon: React.ComponentType<{ className?: string }> };

// Every signed-in admin sees every section: access is one allow-list
// (ADMIN_EMAILS), with no roles.
const NAV: { group: string; items: NavItem[] }[] = [
  {
    group: 'Overview',
    items: [
      { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
      { name: 'Alerts', href: '/admin/alerts', icon: Bell },
    ],
  },
  {
    group: 'Sales',
    items: [
      { name: 'Customers', href: '/admin/customers', icon: Users },
      { name: 'Payments', href: '/admin/transactions', icon: ArrowLeftRight },
      { name: 'Plans', href: '/admin/plans', icon: CreditCard },
      { name: 'Revenue', href: '/admin/revenue', icon: TrendingUp },
      { name: 'Expenses', href: '/admin/expenses', icon: Receipt },
    ],
  },
  {
    group: 'Network',
    items: [
      { name: 'Locations', href: '/admin/locations', icon: MapPin },
      { name: 'Routers', href: '/admin/network', icon: Router },
      { name: 'Access grants', href: '/admin/network/access', icon: KeyRound },
      { name: 'Controller jobs', href: '/admin/network/jobs', icon: ListChecks },
    ],
  },
  {
    group: 'Service',
    items: [
      { name: 'Support', href: '/admin/support', icon: LifeBuoy },
      { name: 'Settings', href: '/admin/settings', icon: Settings },
    ],
  },
];

const ALL = NAV.flatMap((g) => g.items);

/** The most specific nav item that matches the path. */
function activeHref(pathname: string): string | undefined {
  return ALL.map((i) => i.href)
    .filter((h) => pathname === h || (h !== '/admin' && pathname.startsWith(h + '/')) || (h !== '/admin' && pathname === h))
    .sort((a, b) => b.length - a.length)[0] ?? (pathname === '/admin' ? '/admin' : undefined);
}

export default function AdminShell({
  children,
  operatorEmail,
  environment,
}: {
  children: React.ReactNode;
  operatorEmail: string;
  environment: 'production' | 'preview' | 'development';
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const active = activeHref(pathname);

  const envLabel = environment === 'production' ? 'Production' : environment === 'preview' ? 'Staging' : 'Local';

  const nav = (
    <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5" aria-label="Admin">
      {NAV.map((group) => (
        <div key={group.group}>
          <p className="px-3 text-xs font-semibold text-subtle">{group.group}</p>
          <ul className="mt-1.5 space-y-0.5">
            {group.items.map((item) => {
              const isActive = item.href === active;
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={isActive ? 'page' : undefined}
                    onClick={() => setOpen(false)}
                    className={cn(
                      'flex items-center gap-3 rounded-[var(--radius-control)] px-3 py-2 text-sm font-medium transition-colors',
                      isActive ? 'bg-brand-soft text-brand' : 'text-muted hover:bg-canvas hover:text-ink'
                    )}
                  >
                    <Icon className={cn('h-4 w-4', isActive ? 'text-brand' : 'text-subtle')} />
                    {item.name}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  const footer = (
    <div className="border-t border-line px-4 py-4">
      <p className="truncate text-[13px] font-semibold text-ink" title={operatorEmail}>{operatorEmail || 'Signed in'}</p>
      <button
        type="button"
        onClick={async () => {
          // Ends the session with Supabase Auth and clears the session cookie.
          await browserAuth().signOut().catch(() => {});
          router.replace('/login');
        }}
        className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted hover:text-bad"
      >
        <LogOut className="h-3.5 w-3.5" /> Sign out
      </button>
    </div>
  );

  const brand = (
    <div className="flex items-center justify-between gap-2">
      <Link href="/admin" aria-label="Connectly admin home"><Wordmark /></Link>
      <span
        className={cn(
          'rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ring-inset',
          environment === 'production' ? 'bg-ok-soft text-ok ring-ok/20' : 'bg-warn-soft text-warn ring-warn/20'
        )}
        title="Which database and payment keys this console uses"
      >
        {envLabel}
      </span>
    </div>
  );

  return (
    <div className="flex min-h-screen flex-1 bg-canvas text-ink">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-line bg-surface lg:flex">
        <div className="border-b border-line px-5 py-4">{brand}</div>
        {nav}
        {footer}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <div className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-surface px-4 py-3 lg:hidden">
          {brand}
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="ml-3 rounded-md p-2 text-ink hover:bg-canvas"
            aria-label="Open menu"
            aria-expanded={open}
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>

        {open && (
          <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
            <div className="absolute inset-0 bg-ink/40" onClick={() => setOpen(false)} />
            <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col bg-surface shadow-xl">
              <div className="flex items-center justify-between border-b border-line px-4 py-3">
                <Wordmark />
                <button type="button" onClick={() => setOpen(false)} className="rounded-md p-2 hover:bg-canvas" aria-label="Close menu">
                  <X className="h-5 w-5" />
                </button>
              </div>
              {nav}
              {footer}
            </aside>
          </div>
        )}

        <main className="min-w-0 flex-1">
          <div className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
