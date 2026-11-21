'use client';

import { useSyncExternalStore } from 'react';

// Staging/local banner. Decided in the browser from the address, because
// static pages (the portal) are built once and served as files: a value
// worked out at build time would be wrong on the live site.
const PRODUCTION_HOSTS = new Set(['getconnectly.net', 'www.getconnectly.net']);

export function bannerFor(hostname: string): 'Staging' | 'Local' | null {
  if (PRODUCTION_HOSTS.has(hostname)) return null;
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]') return 'Local';
  return 'Staging';
}

const noSubscription = () => () => {};

export function EnvBanner() {
  // The address never changes while the page is open; null while prerendering.
  const label = useSyncExternalStore(noSubscription, () => bannerFor(window.location.hostname), () => null);
  if (!label) return null;
  return (
    <div className="w-full border-b border-warn/20 bg-warn-soft px-4 py-1.5 text-center text-xs font-semibold text-warn">
      {label}: test data and sandbox payments only
    </div>
  );
}
