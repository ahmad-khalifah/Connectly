'use client';

// Loads an admin page's data from /api/admin/view/<name> (lib/http/admin-api.ts).
// The admin pages are static files: everything shown comes from here, and
// every request is checked for a signed-in admin on the server.

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { freshSession } from '@/lib/auth/browser';
import { Notice } from '@/components/ui/notice';
import { Button } from '@/components/ui/button';

export type Loaded<T> = { state: 'loading' } | { state: 'error'; message: string } | { state: 'not_found' } | { state: 'ready'; data: T };

// A full page load: /login is a static file, and the admin state should reset.
function toLogin() {
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign('/login');
}

/** GET an admin data URL; on an expired session refresh it once, then send to sign-in. */
export async function adminFetch(input: string, init?: RequestInit): Promise<Response> {
  let res = await fetch(input, { cache: 'no-store', ...init });
  if (res.status === 401 && (await freshSession(true))) res = await fetch(input, { cache: 'no-store', ...init });
  if (res.status === 401) toLogin();
  return res;
}

const CHANGED = 'connectly:admin-data-changed';

/** After a save or action: every admin view on the page loads its data again. */
export function refreshAdminData() {
  window.dispatchEvent(new Event(CHANGED));
}

export function viewUrl(name: string, params: Record<string, string | null | undefined> = {}): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
  const qs = q.toString();
  return `/api/admin/view/${name}${qs ? `?${qs}` : ''}`;
}

/** Loads one view; `key` changes (e.g. filters) reload it. `reload()` loads it again. */
export function useAdminView<T>(url: string | null): { loaded: Loaded<T>; reload: () => void } {
  const [loaded, setLoaded] = useState<Loaded<T>>({ state: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [lastUrl, setLastUrl] = useState(url);
  if (url !== lastUrl) {
    // A new address (filters changed): show loading again, during render rather than in an effect.
    setLastUrl(url);
    setLoaded({ state: 'loading' });
  }

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    adminFetch(url)
      .then(async (res) => {
        if (cancelled || res.status === 401) return;
        if (res.status === 404) return setLoaded({ state: 'not_found' });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) return setLoaded({ state: 'error', message: (body as { message?: string }).message ?? `Error ${res.status}` });
        setLoaded({ state: 'ready', data: body as T });
      })
      .catch(() => { if (!cancelled) setLoaded({ state: 'error', message: 'The server could not be reached.' }); });
    return () => { cancelled = true; };
  }, [url, attempt]);

  // Reload (without showing loading again) when an action changed the data.
  useEffect(() => {
    const again = () => setAttempt((n) => n + 1);
    window.addEventListener(CHANGED, again);
    return () => window.removeEventListener(CHANGED, again);
  }, []);

  return { loaded, reload: () => { setLoaded({ state: 'loading' }); setAttempt((n) => n + 1); } };
}

export function Loading({ label = 'Loading' }: { label?: string }) {
  return (
    <p className="flex items-center gap-2 py-10 text-sm text-muted" role="status">
      <Loader2 className="h-4 w-4 animate-spin text-brand" aria-hidden /> {label}
    </p>
  );
}

export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="space-y-3">
      <Notice tone="bad" title="Could not load">
        {message}. Nothing is shown rather than showing wrong figures.
      </Notice>
      <Button variant="secondary" onClick={onRetry}>Try again</Button>
    </div>
  );
}

export function NotFoundNotice({ what }: { what: string }) {
  return <Notice tone="warn" title={`${what} not found`}>Check the link, or go back and choose again.</Notice>;
}

/** Renders a loaded view, or its loading / error / not-found state. */
export function ViewState<T>({ loaded, reload, what = 'Page', children }: { loaded: Loaded<T>; reload: () => void; what?: string; children: (data: T) => React.ReactNode }) {
  if (loaded.state === 'loading') return <Loading />;
  if (loaded.state === 'not_found') return <NotFoundNotice what={what} />;
  if (loaded.state === 'error') return <LoadError message={loaded.message} onRetry={reload} />;
  return <>{children(loaded.data)}</>;
}
