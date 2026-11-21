import LoginForm from './login-form';

// proxy.ts redirects signed-in accounts that are not on the admin allow-list
// here with ?error=not_authorized.
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <LoginForm
      initialError={
        error === 'not_authorized' ? 'This account is not on the admin list. Sign in with an admin account.' : ''
      }
    />
  );
}
