'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { browserAuth } from '@/lib/auth/browser';
import { LensMark } from '@/components/ui/lens-mark';
import { Field, inputClass } from '@/components/ui/field';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';

/** Supabase's own wording, said plainly. */
function friendly(message: string): string {
  if (/invalid login credentials/i.test(message)) return 'That email and password do not match an admin account.';
  if (/email not confirmed/i.test(message)) return 'This email address has not been confirmed yet.';
  if (/rate limit|too many/i.test(message)) return 'Too many attempts. Wait a minute and try again.';
  return message;
}

const NOT_AUTHORIZED = 'This account is not on the admin list. Sign in with an admin account.';

export default function LoginForm() {
  const router = useRouter();
  const notAuthorized = useSearchParams().get('error') === 'not_authorized';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(notAuthorized ? NOT_AUTHORIZED : '');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { data, error: authError } = await browserAuth().signInWithPassword({ email, password });
    if (authError) {
      setError(friendly(authError.message));
      setLoading(false);
      return;
    }
    if (data.session) {
      router.push('/admin');
      router.refresh();
    }
  };

  return (
    <main className="flex min-h-full flex-1 items-center justify-center bg-canvas px-5 py-12">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3">
          <LensMark className="h-10 w-10" />
          <div>
            <h1 className="text-xl font-bold tracking-[-0.01em] text-ink">Connectly admin</h1>
            <p className="text-sm text-muted">For Connectly staff only.</p>
          </div>
        </div>

        <form className="mt-8 space-y-5 rounded-[var(--radius-panel)] border border-line bg-surface p-6" onSubmit={handleLogin}>
          <Field label="Email" htmlFor="login-email">
            <input id="login-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Password" htmlFor="login-password">
            <input id="login-password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
          </Field>
          {error && <Notice tone="bad" title="Not signed in">{error}</Notice>}
          <Button type="submit" size="lg" full disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</Button>
        </form>
      </div>
    </main>
  );
}
