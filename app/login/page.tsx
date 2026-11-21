import { Suspense } from 'react';
import LoginForm from './login-form';

// Static page. An account that is signed in but not on the admin allow-list
// is sent here with ?error=not_authorized (components/admin/admin-frame.tsx,
// and proxy.ts on hosts that run it); LoginForm reads it in the browser.
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
