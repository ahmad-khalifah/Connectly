'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import PortalClient from '@/app/portal/portal-client';
import CodeLogin from '@/app/portal/code-login';
import PhoneLookup from '@/app/portal/phone-lookup';
import { PortalShell } from '@/components/portal/portal-shell';
import { LensMark } from '@/components/ui/lens-mark';
import { Notice } from '@/components/ui/notice';
import { Button } from '@/components/ui/button';
import type { PortalView } from '@/lib/http/customer-api';

// The captive portal, rendered in the browser. The page itself is a static
// file (no CPU on Cloudflare); this component reads the address the router
// sent the customer to and asks /api/portal what to show.
//
// `page` keeps the two entry points' wording: /portal is where the router
// sends customers, /connect also takes location links printed on QR codes.

const lagos = (iso: string) =>
  new Date(iso).toLocaleString('en-NG', { timeZone: 'Africa/Lagos', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

type Load = { state: 'loading' } | { state: 'error' } | { state: 'ready'; view: PortalView };

export function CustomerPortal({ page }: { page: 'portal' | 'connect' }) {
  const q = useSearchParams();
  const router = q.get('router') ?? '';
  const mac = q.get('mac') ?? '';
  const ip = q.get('ip') ?? '';
  const loc = page === 'connect' ? q.get('loc') ?? '' : '';
  const needsWifi = page === 'portal' ? !router || !mac : !router && !loc;

  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (needsWifi) return;
    const params = new URLSearchParams();
    if (router) params.set('router', router);
    if (mac) params.set('mac', mac);
    if (loc) params.set('loc', loc);
    let cancelled = false;
    fetch(`/api/portal?${params.toString()}`, { cache: 'no-store' })
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.json() as Promise<PortalView>;
      })
      .then((view) => { if (!cancelled) setLoad({ state: 'ready', view }); })
      .catch(() => { if (!cancelled) setLoad({ state: 'error' }); });
    return () => { cancelled = true; };
  }, [needsWifi, router, mac, loc, attempt]);

  const retry = () => {
    setLoad({ state: 'loading' });
    setAttempt((n) => n + 1);
  };

  if (needsWifi) {
    return page === 'portal' ? (
      <PortalShell>
        <Notice tone="warn" title="Open this page from the Connectly WiFi">
          Join the Connectly WiFi network on your phone. The sign-in page opens by itself; if it does not, open any website and it will appear.
        </Notice>
      </PortalShell>
    ) : (
      <UnknownLocation />
    );
  }

  if (load.state === 'loading') return <PortalLoading />;

  if (load.state === 'error') {
    return (
      <PortalShell>
        <Notice tone="bad" title="The plans could not be loaded">
          Check that you are still on the Connectly WiFi, then try again.
        </Notice>
        <Button variant="secondary" size="lg" full className="mt-5" onClick={retry}>Try again</Button>
      </PortalShell>
    );
  }

  const view = load.view;
  switch (view.kind) {
    case 'unknown':
    case 'not_set_up':
      return page === 'connect' ? (
        <UnknownLocation />
      ) : (
        <PortalShell>
          <Notice tone="bad" title="This WiFi is not taking payments yet">
            The network you joined is not set up for Connectly payments. Ask the staff on site, or message us with the WiFi name you see.
          </Notice>
        </PortalShell>
      );

    case 'join':
      return (
        <PortalShell place={view.location.name}>
          <div className="flex items-start gap-4">
            <LensMark className="h-12 w-12" state="off" />
            <div>
              <h1 className="text-xl font-bold tracking-[-0.01em] text-ink">Join the WiFi to get online</h1>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">
                On your phone, open WiFi settings and join <span className="font-semibold text-ink">Connectly WiFi</span>. The sign-in page opens by itself and shows the plans for {view.location.name}.
              </p>
            </div>
          </div>
        </PortalShell>
      );

    case 'running':
      return (
        <PortalShell place={view.place}>
          <div className="flex items-start gap-4">
            <LensMark className="h-12 w-12" state="on" />
            <div>
              <h1 className="text-xl font-bold tracking-[-0.01em] text-ink">Your plan is still running</h1>
              <p className="mt-1 text-sm text-muted">
                It ends <span className="tnum font-semibold text-ink">{lagos(view.expiresAt)}</span>.
              </p>
            </div>
          </div>
          <section className="mt-6 rounded-[var(--radius-panel)] border border-line bg-surface p-5">
            <h2 className="text-base font-semibold text-ink">Not browsing? Reconnect</h2>
            <div className="mt-4">
              <PhoneLookup routerId={view.routerId} mac={mac} />
            </div>
            {view.loginUrl && (
              <div className="mt-5 border-t border-line pt-4">
                <CodeLogin loginUrl={view.loginUrl} heading="Or enter your WiFi code" />
              </div>
            )}
          </section>
        </PortalShell>
      );

    case 'plans':
      return (
        <PortalShell place={view.location.name}>
          <PortalClient mac={mac} ip={ip} routerId={view.routerId} location={view.location} plans={view.plans} loginUrl={view.loginUrl} />
        </PortalShell>
      );
  }
}

function UnknownLocation() {
  return (
    <PortalShell>
      <Notice tone="bad" title="We do not recognise this location">
        Check the link or QR code, or join the Connectly WiFi on site to see the plans.
      </Notice>
    </PortalShell>
  );
}

/** Shown in the static file and while the plans load. */
export function PortalLoading() {
  return (
    <PortalShell>
      <p className="flex items-center gap-2 text-sm text-muted" role="status">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading the plans
      </p>
    </PortalShell>
  );
}
