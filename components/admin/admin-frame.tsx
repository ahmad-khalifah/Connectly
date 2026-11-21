'use client';

// The admin console's frame. The pages are static files with no data in
// them; every request for data is checked on the server. To keep pages fast,
// the frame and the page's own data requests start together: the frame asks
// who is signed in (for the name and environment shown in the menu), and
// sends anyone signed out to /login and an account not on the admin list to
// /login?error=not_authorized.

import { useEffect, useState } from 'react';
import AdminShell from '@/app/admin/admin-shell';
import { adminFetch, ensureSession } from './admin-data';

type Me = { email: string; environment: 'production' | 'preview' | 'development' };

export function AdminFrame({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!(await ensureSession())) {
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.assign('/login');
        return;
      }
      // adminFetch sends a signed-out caller (401) or a non-admin (403) to sign-in.
      const res = await adminFetch('/api/admin/me');
      if (cancelled || res.status === 401 || res.status === 403) return;
      if (!res.ok) {
        setFailed(true);
        return;
      }
      setMe((await res.json()) as Me);
    })().catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, []);

  if (failed) {
    return (
      <main className="flex min-h-screen flex-1 items-center justify-center bg-canvas p-8 text-sm text-muted">
        The admin console could not reach the server. Check your connection and reload the page.
      </main>
    );
  }
  return <AdminShell operatorEmail={me?.email ?? ''} environment={me?.environment ?? null}>{children}</AdminShell>;
}
