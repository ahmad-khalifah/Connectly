'use client';

// The admin console's frame. The pages are static files, so the sign-in
// check happens here in the browser first (a current session, and the
// server confirming this account is an admin), and again on the server for
// every data request.

import { useEffect, useState } from 'react';
import AdminShell from '@/app/admin/admin-shell';
import { freshSession } from '@/lib/auth/browser';
import { adminFetch, Loading } from './admin-data';

type Me = { email: string; environment: 'production' | 'preview' | 'development' };

export function AdminFrame({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!(await freshSession())) {
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.assign('/login');
        return;
      }
      const res = await adminFetch('/api/admin/me');
      if (cancelled || res.status === 401) return;
      if (res.status === 403) {
        // Signed in, but not on the admin list.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.assign('/login?error=not_authorized');
        return;
      }
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
  if (!me) {
    return (
      <main className="flex min-h-screen flex-1 items-center justify-center bg-canvas">
        <Loading label="Checking your sign-in" />
      </main>
    );
  }
  return <AdminShell operatorEmail={me.email} environment={me.environment}>{children}</AdminShell>;
}
