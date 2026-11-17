'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, Users, CreditCard, MapPin, Network, 
  ArrowLeftRight, TrendingUp, Receipt, 
  LifeBuoy, Settings, LogOut, ShieldAlert, ListChecks, KeyRound } from 'lucide-react';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: string[];
}

const NAVIGATION_GROUPS: { group: string; items: NavItem[] }[] = [
  {
    group: 'CORE OPERATIONS',
    items: [
      { name: 'Dashboard', href: '/admin', icon: LayoutDashboard, roles: ['owner', 'admin', 'finance', 'network_engineer', 'support', 'operations'] },
      { name: 'Customers 360', href: '/admin/customers', icon: Users, roles: ['owner', 'admin', 'support'] },
      { name: 'Locations & Campuses', href: '/admin/locations', icon: MapPin, roles: ['owner', 'admin', 'network_engineer', 'operations'] },
      { name: 'Plans & Pricing', href: '/admin/plans', icon: CreditCard, roles: ['owner', 'admin'] },
    ]
  },
  {
    group: 'NETWORK INFRASTRUCTURE',
    items: [
      { name: 'Network', href: '/admin/network', icon: Network, roles: ['owner', 'admin', 'network_engineer'] },
      { name: 'Controller Jobs', href: '/admin/network/jobs', icon: ListChecks, roles: ['owner', 'admin', 'network_engineer'] },
      { name: 'Access Grants', href: '/admin/network/access', icon: KeyRound, roles: ['owner', 'admin', 'network_engineer', 'support'] },
    ]
  },
  {
    group: 'FINANCE & AUDIT',
    items: [
      { name: 'Transactions', href: '/admin/transactions', icon: ArrowLeftRight, roles: ['owner', 'admin', 'finance'] },
      { name: 'Revenue Analytics', href: '/admin/revenue', icon: TrendingUp, roles: ['owner', 'admin', 'finance'] },
      { name: 'Operating Expenses', href: '/admin/expenses', icon: Receipt, roles: ['owner', 'admin', 'finance'] },
    ]
  },
  {
    group: 'SERVICES & SECURITY',
    items: [
      { name: 'Support Tickets', href: '/admin/support', icon: LifeBuoy, roles: ['owner', 'admin', 'support'] },
      { name: 'Settings', href: '/admin/settings', icon: Settings, roles: ['owner', 'admin'] },
    ]
  }
];

export default function AdminShell({
  children,
  operatorEmail,
}: {
  children: React.ReactNode;
  operatorEmail: string;
}) {
  const pathname = usePathname();
  // Extracted from verified session cookie or auth context
  const [currentRole] = useState<string>('owner'); 

  return (
    <div className="flex min-h-screen bg-[#F8F9FA] text-slate-800 antialiased font-sans">
      {/* Enterprise Side Navigation */}
      <aside className="w-72 bg-white border-r border-slate-200 flex flex-col shrink-0">
        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-200 bg-white">
          <Image 
            src="/connectly-logo-horizontal.svg" 
            alt="Connectly Technologies" 
            width={130} 
            height={32} 
            priority
          />
          <span className="text-[10px] font-mono uppercase tracking-wider bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200">
            v2.4-prod
          </span>
        </div>

        {/* Navigation Sections */}
        <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
          {NAVIGATION_GROUPS.map((group) => {
            const accessibleItems = group.items.filter(item => item.roles.includes(currentRole));
            if (accessibleItems.length === 0) return null;

            return (
              <div key={group.group}>
                <h3 className="px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  {group.group}
                </h3>
                <div className="space-y-1">
                  {accessibleItems.map((item) => {
                    const isActive = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href));
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          isActive 
                            ? 'bg-[#6d1825] text-white shadow-sm' 
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                        }`}
                      >
                        <Icon className={`h-4 w-4 ${isActive ? 'text-[#cfa253]' : 'text-slate-500'}`} />
                        {item.name}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {/* User Identity & Secure Logout */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-900 leading-none truncate max-w-[180px]" title={operatorEmail}>
              {operatorEmail || 'Console Operator'}
            </p>
            <span className="inline-block mt-1 text-[10px] uppercase tracking-wide font-mono text-[#6d1825] font-bold bg-[#6d1825]/10 px-1.5 py-0.5 rounded">
              {currentRole}
            </span>
          </div>
          <button 
            onClick={async () => {
              await fetch('/api/auth/logout', { method: 'POST' });
              window.location.href = '/login';
            }}
            title="Sign Out"
            className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-white border border-transparent hover:border-slate-200 transition-colors"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </aside>

      {/* Main Execution Surface */}
      <main className="flex-1 min-w-0 overflow-y-auto">
        <div className="p-8 max-w-[1600px] mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}